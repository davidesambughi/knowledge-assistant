// Endpoint di chat — unico punto che gestisce lo streaming (Invariant #8, eccezione esplicita).
// Valida input, recupera i chunk pertinenti (hybrid search), fa streaming della risposta di Gemini
// vincolata al contesto (Invariant #11/#12/#19). Nessuna UI ancora (03a-chat-api.md) — solo backend.

import { createTextStreamResponse, toTextStream } from "ai";
import { ChatRequestSchema, TOTAL_LENGTH_ISSUE_TAG } from "@/lib/types";
import { hybridRetrieveChunks } from "@/lib/rag/retrieval";
import { resolveChatStream, streamChatResponse } from "@/lib/rag/generation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isAllowedOrigin } from "@/lib/security";

// Un superamento di questi due limiti (a differenza di un payload semplicemente malformato) è il
// segnale di abuso più concreto secondo la ricerca di 03d-security-review.md (LLM10) — loggato
// separatamente per essere distinguibile negli abuse log. Il ramo "custom" è riconosciuto solo
// tramite TOTAL_LENGTH_ISSUE_TAG (non code === "custom" generico), altrimenti un futuro
// .refine()/.superRefine() aggiunto allo schema per un motivo diverso finirebbe loggato qui per
// errore — fragilità segnalata da revisione esterna, verificata e chiusa.
function isOversizedRejection(issues: { code: string; params?: unknown }[]): boolean {
  return issues.some(
    (issue) =>
      issue.code === "too_big" ||
      (issue.code === "custom" &&
        (issue.params as { tag?: string } | undefined)?.tag === TOTAL_LENGTH_ISSUE_TAG),
  );
}

export async function POST(req: Request) {
  const ip = getClientIp(req);

  // Rate limit per IP (Invariant #18), prima di qualunque parsing/lavoro costoso.
  const { success, reset } = await checkRateLimit(req);
  if (!success) {
    console.warn("[chat] rate limit exceeded", { ip });
    const retryAfterSeconds = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
    return Response.json(
      { error: "Troppe richieste. Riprova tra qualche minuto." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  // Controllo leggero su Origin (03d-security-review.md) — dopo il rate limit (controllo più
  // economico va sempre per primo), prima del parsing del body.
  if (!isAllowedOrigin(req.headers.get("origin"), req.url)) {
    return Response.json({ error: "Origine non consentita." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Richiesta non valida: body non è JSON." }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);

  if (!parsed.success) {
    if (isOversizedRejection(parsed.error.issues)) {
      console.warn("[chat] oversized request rejected", { ip, reason: parsed.error.message });
    }
    return Response.json({ error: "Richiesta non valida: " + parsed.error.message }, { status: 400 });
  }

  const { messages } = parsed.data;
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");

  if (!lastUserMessage) {
    return Response.json({ error: "Nessun messaggio utente nella richiesta." }, { status: 400 });
  }

  let chunks;
  try {
    chunks = await hybridRetrieveChunks(lastUserMessage.content);
  } catch (error) {
    console.error("[chat] retrieval failed", error);
    return Response.json(
      { error: "Si è verificato un errore interno. Riprova più tardi." },
      { status: 500 },
    );
  }

  let result: ReturnType<typeof streamChatResponse>;
  try {
    result = streamChatResponse(messages, chunks);
  } catch (error) {
    console.error("[chat] avvio streaming fallito", error);
    return Response.json(
      { error: "Si è verificato un errore interno. Riprova più tardi." },
      { status: 500 },
    );
  }

  // Sbircia il primo elemento dello stream prima di avviare la risposta al client (03i):
  // un fallimento Gemini (es. quota esaurita) non lancia mai in modo sincrono da
  // streamChatResponse — emerge solo come part "error" dentro result.fullStream.
  const resolution = await resolveChatStream(result);
  if (!resolution.ok) {
    return Response.json({ error: resolution.message }, { status: 503 });
  }

  // toTextStreamResponse() è deprecato in questa versione dell'AI SDK (rimosso nella prossima major) —
  // sostituito dagli helper standalone toTextStream/createTextStreamResponse su result.stream.
  return createTextStreamResponse({ stream: toTextStream({ stream: resolution.stream }) });
}
