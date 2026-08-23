// Wrapper chiamate Gemini embeddings (Invariant #13 — errore/timeout espliciti, fail loud).
// Nessun retry automatico: un fallimento interrompe lo script, re-run manuale (ingest "una tantum").

import { GoogleGenAI } from "@google/genai";
import { env } from "@/lib/env";
import { EmbeddingResultSchema } from "@/lib/types";

export const EMBEDDING_MODEL = "gemini-embedding-001";
// quale modello Gemini chiami per trasformare testo in vettore
// 1536 via Matryoshka Representation Learning (MRL) — stessa dimensione di document_chunks.embedding,
// nessuna migrazione di schema necessaria (verificato ago 2026, ai.google.dev/api/embeddings).
export const EMBEDDING_DIMENSIONS = 1536;
// quanti numeri ha ogni vettore in output
// Conservativo: i rate limit del free tier Gemini variano per progetto e Google stessa sconsiglia
// di trattare i numeri pubblicati come garantiti (verifica sempre su AI Studio) — batch piccolo per
// restare comunque ben sotto qualunque soglia plausibile per un corpus di ~200 chunk.
export const EMBEDDING_BATCH_SIZE = 20;
// quanti chunk mandi in una singola chiamata API invece di chiamarla uno per uno

// Timeout esplicito per batch (Invariant #13) — evita che una chiamata resti appesa indefinitamente.
// Cablato via `abortSignal: AbortSignal.timeout(...)`, non `config.httpOptions.timeout`: quest'ultimo
// è documentato come inaffidabile nel repo ufficiale del pacchetto (googleapis/js-genai issue #1277
// e #712, ancora aperte, nessun fix confermato per la major line 2.x installata qui) — il client
// ignora di fatto il valore e usa un default interno di ~5 minuti. AbortSignal è un'API standard
// Node/Web, non passa dal codice interno di httpOptions del SDK. Nota: è "client-only" (non annulla
// la richiesta lato servizio Google, la chiamata resta fatturata) — accettabile, l'obiettivo qui è
// non restare appesi indefinitamente, non risparmiare la chiamata in corso.
const EMBEDDING_TIMEOUT_MS = 30_000;

const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// Divide un array in sotto-array da batchSize. Funzione pura, nessuna chiamata esterna.
export function batchTexts<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

// Genera un embedding per ogni testo in input, nello stesso ordine. Chiama Gemini a batch.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const batches = batchTexts(texts, EMBEDDING_BATCH_SIZE);
  const results: number[][] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const startedAt = Date.now();

    let response;
    try {
      response = await client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: batch,
        config: {
          outputDimensionality: EMBEDDING_DIMENSIONS,
          taskType: "RETRIEVAL_DOCUMENT",
          abortSignal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
        },
      });
    } catch (error) {
      throw new Error(`embedTexts: batch ${i} fallito (${batch.length} testi) — ${(error as Error).message}`);
    }

    const elapsedMs = Date.now() - startedAt;
    const embeddings = response.embeddings ?? [];
    console.log(`[embeddings] batch ${i + 1}/${batches.length}: ${batch.length} testi, ${elapsedMs}ms`);

    for (const item of embeddings) {
      const validated = EmbeddingResultSchema.parse({ embedding: item.values });
      results.push(validated.embedding);
    }
  }

  return results;
}

// Genera l'embedding di una singola query utente, a query-time (retrieval, 02-retrieval.md).
// taskType RETRIEVAL_QUERY è asimmetrico per design rispetto a RETRIEVAL_DOCUMENT (embedTexts,
// usato in ingest) — Gemini ottimizza i due embedding in modo diverso.
export async function embedQuery(text: string): Promise<number[]> {
  const startedAt = Date.now();

  let response;
  try {
    response = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: [text],
      config: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: "RETRIEVAL_QUERY",
        abortSignal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
      },
    });
  } catch (error) {
    throw new Error(`embedQuery: chiamata fallita — ${(error as Error).message}`);
  }

  const elapsedMs = Date.now() - startedAt;
  const embeddings = response.embeddings ?? [];
  console.log(`[embeddings] query: ${elapsedMs}ms`);

  const validated = EmbeddingResultSchema.parse({ embedding: embeddings[0]?.values });
  return validated.embedding;
}
