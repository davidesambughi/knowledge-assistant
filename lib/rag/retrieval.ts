// Similarity search (naive RAG) + hybrid search (vector + Postgres full-text, RRF lato SQL)
// su document_chunks. Le funzioni SQL match_documents/hybrid_search vivono su Supabase
// (vedi supabase/sql/02-retrieval.sql) — questo file chiama solo le RPC e valida l'output.

import { embedQuery } from "./embeddings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { RetrievedChunkSchema, type RetrievedChunk } from "@/lib/types";

// Unico punto che definisce quanti chunk recuperare (Invariant #14) — mai hardcodato altrove.
export const TOP_K = 5;

// Riga grezza ritornata da match_documents/hybrid_search (snake_case, convenzione Postgres).
type RetrievedRow = {
  id: string;
  source_file: string;
  heading_path: string;
  content: string;
  similarity: number;
};

// Mapping puro snake_case -> camelCase. RetrievedChunkSchema non va mai validato direttamente
// su una riga RPC grezza (vedi 02-retrieval.md §Validation) — solo sul risultato di questa funzione.
export function mapRowToRetrievedChunk(row: RetrievedRow): RetrievedChunk {
  return {
    content: row.content,
    headingPath: row.heading_path,
    sourceFile: row.source_file,
    similarity: row.similarity,
  };
}

function parseRows(rows: RetrievedRow[]): RetrievedChunk[] {
  return rows.map((row) => RetrievedChunkSchema.parse(mapRowToRetrievedChunk(row)));
}

// Naive RAG: similarity search vettoriale (cosine, pgvector) via la RPC match_documents.
export async function retrieveChunks(query: string, topK: number = TOP_K): Promise<RetrievedChunk[]> {
  const startedAt = Date.now();
  const queryEmbedding = await embedQuery(query);

  const { data, error } = await supabaseAdmin.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: topK,
  });

  if (error) {
    throw new Error(`retrieveChunks: match_documents fallita — ${error.message}`);
  }

  const elapsedMs = Date.now() - startedAt;
  const rows = (data ?? []) as RetrievedRow[];
  console.log(`[retrieval] naive: ${rows.length} chunk, ${elapsedMs}ms`);

  return parseRows(rows);
}

// Hybrid search: vettoriale + Postgres full-text, fusi via Reciprocal Rank Fusion lato SQL
// (RPC hybrid_search) — stessa forma di output di retrieveChunks (RetrievedChunkSchema invariato).
// Nota: l'ordine dell'array segue il punteggio RRF (SQL), non il campo `similarity` (cosine pura,
// ricalcolato a parte) — i due possono divergere, vedi tech-spec.md §Data Models > RetrievedChunk.
export async function hybridRetrieveChunks(query: string, topK: number = TOP_K): Promise<RetrievedChunk[]> {
  const startedAt = Date.now();
  const queryEmbedding = await embedQuery(query);

  const { data, error } = await supabaseAdmin.rpc("hybrid_search", {
    query_text: query,
    query_embedding: queryEmbedding,
    match_count: topK,
  });

  if (error) {
    throw new Error(`hybridRetrieveChunks: hybrid_search fallita — ${error.message}`);
  }

  const elapsedMs = Date.now() - startedAt;
  const rows = (data ?? []) as RetrievedRow[];
  console.log(`[retrieval] hybrid: ${rows.length} chunk, ${elapsedMs}ms`);

  return parseRows(rows);
}
