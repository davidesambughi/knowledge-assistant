// Wrapper generazione streaming via Gemini (Vercel AI SDK, provider Google) — Invariant #13
// (errore/timeout espliciti) e #15 (log latenza/esito), stesso trattamento di lib/rag/embeddings.ts.

import { APICallError, streamText } from "ai";
import { createGoogle } from "@ai-sdk/google";
import { env } from "@/lib/env";
import type { ChatRequest, RetrievedChunk } from "@/lib/types";
import { buildSystemPrompt } from "./prompt";

// gemini-2.5-flash risultava "attivo" sulla doc scrapata (ai.google.dev/gemini-api/docs/models),
// ma una chiamata reale con la chiave del progetto fallisce: "This model models/gemini-2.5-flash
// is no longer available to new users" — la doc pubblica non riflette lo stato per-account.
// Verificato con GET /v1beta/models sulla chiave reale del progetto (elenco modelli effettivamente
// disponibili) + una generateContent di prova: gemini-3.1-flash-lite risponde correttamente.
// Stesso trattamento di EMBEDDING_BATCH_SIZE in embeddings.ts: rate limit/free tier da riverificare
// su AI Studio prima di un uso a volume, i numeri non sono garantiti.
export const GENERATION_MODEL = "gemini-3.1-flash-lite";

// Timeout esplicito (Invariant #13) — senza, una richiesta a Gemini che non risponde mai (rete
// impallata, non un errore esplicito) resterebbe appesa indefinitamente: nessun errore, nessun log,
// nessun 500, il client aspetta all'infinito. `timeout` di streamText (numero = totalMs) aborta la
// chiamata oltre questa soglia, propagando l'abort come errore verso onError (vedi sotto).
const GENERATION_TIMEOUT_MS = 30_000;

// Tetto sui token generati (03d-security-review.md, OWASP LLM10 — unbounded consumption lato
// output): GENERATION_TIMEOUT_MS limita solo il *tempo*, non il volume — un modello veloce può
// generare molti token entro 30s. maxOutputTokens è il parametro nativo di streamText.
const GENERATION_MAX_OUTPUT_TOKENS = 2048;

// createGoogle (non il provider `google` di default) perché la chiave del progetto è GEMINI_API_KEY,
// non la env var che l'SDK leggerebbe implicitamente (GOOGLE_GENERATIVE_AI_API_KEY) — Invariant #5.
const google = createGoogle({ apiKey: env.GEMINI_API_KEY });

// Avvia lo streaming della risposta, vincolata al contesto recuperato (chunks) tramite il system
// prompt (Invariant #11/#12/#19, vedi lib/rag/prompt.ts).
//
// Nota sulla gestione errori a metà stream (dopo l'invio degli header): onError qui sotto logga
// solo server-side (Invariant #13/#15 rispettati lato log) — NON viene propagato al client.
// app/api/chat/route.ts ritorna semplicemente il testo stream-ato via createTextStreamResponse();
// un fallimento a questo punto produce un body vuoto/troncato con HTTP 200, senza alcun segnale
// d'errore visibile. Limite noto di toTextStream/toTextStreamResponse (nessun canale errore nel
// protocollo di solo testo, a differenza di toUIMessageStreamResponse) — non risolvibile senza
// cambiare protocollo (romperebbe la UI di 03b). Chiuso in 03d-security-review.md come rischio
// residuo accettato: la mitigazione lato client (isEmptyAssistantResponse in 03b) resta l'unica
// difesa, giudicata sufficiente per lo scope single-user di questo progetto.
export function streamChatResponse(messages: ChatRequest["messages"], chunks: RetrievedChunk[]) {
  const startedAt = Date.now();

  let result: ReturnType<typeof streamText>;
  try {
    result = streamText({
      model: google(GENERATION_MODEL),
      system: buildSystemPrompt(chunks),
      messages,
      timeout: GENERATION_TIMEOUT_MS,
      maxOutputTokens: GENERATION_MAX_OUTPUT_TOKENS,
      onError: ({ error }) => {
        const elapsedMs = Date.now() - startedAt;
        console.error(`[generation] streaming fallito dopo l'avvio (${elapsedMs}ms) — ${(error as Error).message}`);
      },
      onFinish: () => {
        const elapsedMs = Date.now() - startedAt;
        console.log(`[generation] stream completato: ${elapsedMs}ms, modello ${GENERATION_MODEL}`);
      },
    });
  } catch (error) {
    throw new Error(`streamChatResponse: avvio streaming fallito — ${(error as Error).message}`);
  }

  return result;
}

// Messaggio mostrato al client quando Gemini rifiuta la richiesta per quota esaurita
// (free tier). Unica stringa d'errore di route.ts effettivamente mostrata all'utente
// (vedi app/page.tsx) — per questo in inglese, coerente con la UI fissa (03h).
export const QUOTA_EXCEEDED_MESSAGE =
  "This demo has hit its free-tier usage limit for now. Please try again later.";

// Messaggio generico per un fallimento pre-stream non riconosciuto come quota (rete,
// errore Gemini diverso da 429/RESOURCE_EXHAUSTED, ecc.) — stesso trattamento "onesto ma
// generico" già usato per gli altri errori 500 di route.ts.
export const GENERATION_FAILED_MESSAGE = "Si è verificato un errore interno. Riprova più tardi.";

// Riconosce un errore di quota Gemini esaurita (429). Verificato leggendo i sorgenti
// installati (non la doc web, vedi 03i-quota-error-handling.md §Nota tecnica verificata):
// il provider Google (@ai-sdk/google) mappa l'errore HTTP di Gemini in un APICallError con
// statusCode 429 e .data nella forma { error: { status: "RESOURCE_EXHAUSTED", ... } }
// (googleErrorDataSchema). Controlliamo entrambi i segnali perché nessuno dei due, da solo,
// è garantito stabile su ogni possibile risposta di errore di Gemini.
export function isQuotaExceededError(error: unknown): boolean {
  if (!APICallError.isInstance(error)) return false;
  if (error.statusCode === 429) return true;
  const data = error.data as { error?: { status?: string } } | undefined;
  return data?.error?.status === "RESOURCE_EXHAUSTED";
}

// "Sbircia" il primo elemento di result.fullStream prima di decidere se avviare la risposta
// in streaming al client o restituire un errore pulito. Necessario perché streamText() non
// lancia mai in modo sincrono per un fallimento della chiamata a Gemini (inclusa quota
// esaurita) — l'errore emerge solo come part di tipo "error" dentro lo stream stesso (vedi
// 03i-quota-error-handling.md §Nota tecnica verificata). Se il primo elemento non è un
// errore, viene riemesso in testa a un nuovo stream che continua a leggere dallo stesso
// reader — nessun chunk perso per il caso normale (nessun errore). Generico su T (il tipo
// reale è TextStreamPart<ToolSet>, inferito da result.fullStream) per non doverlo ridichiarare.
export async function resolveChatStream<T extends { type: string; error?: unknown }>(
  result: { fullStream: ReadableStream<T> },
): Promise<{ ok: true; stream: ReadableStream<T> } | { ok: false; message: string }> {
  const reader = result.fullStream.getReader();
  const first = await reader.read();

  if (!first.done && first.value.type === "error") {
    await reader.cancel();
    const error = first.value.error;
    if (isQuotaExceededError(error)) {
      console.error(`[generation] quota Gemini esaurita — ${(error as Error).message}`);
      return { ok: false, message: QUOTA_EXCEEDED_MESSAGE };
    }
    console.error("[generation] fallimento pre-stream non riconosciuto come quota", error);
    return { ok: false, message: GENERATION_FAILED_MESSAGE };
  }

  const rebuilt = new ReadableStream<T>({
    async start(controller) {
      if (!first.done) controller.enqueue(first.value);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(value);
      }
      controller.close();
    },
  });

  return { ok: true, stream: rebuilt };
}
