// Tipi condivisi, inferiti da schemi Zod (Invariant #7). Popolato da 01-ingest.md in poi.

import { z } from "zod";

// Forma validata della risposta Gemini embeddings (tech-spec.md §Data Models).
export const EmbeddingResultSchema = z.object({
  embedding: z.array(z.number()).length(1536),
});

export type EmbeddingResult = z.infer<typeof EmbeddingResultSchema>;

// Risultato di una similarity search su document_chunks (tech-spec.md §Data Models).
// camelCase per design applicativo — le righe RPC Supabase sono snake_case e vanno
// mappate esplicitamente prima di questa validazione (vedi lib/rag/retrieval.ts).
export const RetrievedChunkSchema = z.object({
  content: z.string(),
  headingPath: z.string(),
  sourceFile: z.string(),
  similarity: z.number(),
});

export type RetrievedChunk = z.infer<typeof RetrievedChunkSchema>;

// Limiti anti unbounded-consumption (03d-security-review.md, OWASP LLM10) — centralizzati qui,
// mai hardcoded in più punti. MAX_TOTAL_REQUEST_LENGTH chiude il worst-case combinato dei primi
// due limiti (4000*40 = 160.000 caratteri senza di esso, vedi 03d-security-review.md §Ricerca).
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_MESSAGES_PER_REQUEST = 40;
export const MAX_TOTAL_REQUEST_LENGTH = 12000;

// Tag distintivo sull'issue Zod generato dal superRefine sotto — permette a
// app/api/chat/route.ts (isOversizedRejection) di riconoscere *specificamente* questo vincolo,
// invece di trattare qualunque futuro .refine()/.superRefine() su questo schema come "oversized"
// solo perché condivide code === "custom" (fragilità segnalata da revisione esterna, verificata).
export const TOTAL_LENGTH_ISSUE_TAG = "totalRequestLength";

// Payload validato in ingresso su app/api/chat/route.ts (tech-spec.md §Data Models).
export const ChatRequestSchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(MAX_MESSAGE_LENGTH),
        }),
      )
      .min(1)
      .max(MAX_MESSAGES_PER_REQUEST),
  })
  .superRefine((data, ctx) => {
    const totalLength = data.messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalLength > MAX_TOTAL_REQUEST_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: `La somma dei messaggi supera ${MAX_TOTAL_REQUEST_LENGTH} caratteri.`,
        params: { tag: TOTAL_LENGTH_ISSUE_TAG },
      });
    }
  });

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
