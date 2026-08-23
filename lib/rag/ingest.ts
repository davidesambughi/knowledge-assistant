// Legge il corpus (cartella piatta di file .md), genera embeddings e scrive su document_chunks.
// `npm run ingest:preview` ispeziona i chunk a costo zero; `npm run ingest` esegue la pipeline reale.

import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chunkMarkdownFile, type RawChunk } from "./chunking";
import { embedTexts } from "./embeddings";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Riga in uscita verso document_chunks (architecture-context.md §Storage Model).
// Non è un data-boundary esterno in ingresso, quindi nessuno schema Zod (stesso trattamento di RawChunk).
type DocumentChunkRow = {
  source_file: string;
  heading_path: string;
  content: string;
  chunk_index: number;
  embedding: number[];
};

// Legge tutti i file .md in corpusDir (non ricorsivo — corpus piatto) e li divide in chunk.
export function readCorpus(corpusDir: string): RawChunk[] {
  const files = readdirSync(corpusDir).filter((name) => extname(name) === ".md");

  return files.flatMap((name) => {
    const filePath = join(corpusDir, name);
    const content = readFileSync(filePath, "utf-8");
    return chunkMarkdownFile(filePath, content);
  });
}

// Stampa un riepilogo dei chunk per ispezione manuale (non è un test automatizzato).
function previewCorpus(corpusDir: string) {
  const chunks = readCorpus(corpusDir);
  const bySourceFile = new Map<string, RawChunk[]>();
  for (const chunk of chunks) {
    const list = bySourceFile.get(chunk.sourceFile) ?? [];
    list.push(chunk);
    bySourceFile.set(chunk.sourceFile, list);
  }

  for (const [sourceFile, fileChunks] of bySourceFile) {
    console.log(`\n=== ${sourceFile} — ${fileChunks.length} chunk ===`);

    const first = fileChunks[0];
    console.log(`[0] "${first.headingPath}" — ${first.content.slice(0, 200).replace(/\n/g, " ")}`);

    if (fileChunks.length > 1) {
      const last = fileChunks[fileChunks.length - 1];
      console.log(
        `[${last.chunkIndex}] "${last.headingPath}" — ${last.content.slice(0, 200).replace(/\n/g, " ")}`,
      );
    }
  }

  console.log(`\nTotale: ${chunks.length} chunk su ${bySourceFile.size} file.`);
}

// Mappa 1:1 ogni RawChunk + il suo embedding a una riga document_chunks. Funzione pura.
export function buildDocumentRows(chunks: RawChunk[], embeddings: number[][]): DocumentChunkRow[] {
  if (chunks.length !== embeddings.length) {
    throw new Error(
      `buildDocumentRows: disallineamento — ${chunks.length} chunk ma ${embeddings.length} embedding`,
    );
  }

  return chunks.map((chunk, i) => ({
    source_file: chunk.sourceFile,
    heading_path: chunk.headingPath,
    content: chunk.content,
    chunk_index: chunk.chunkIndex,
    embedding: embeddings[i],
  }));
}

// Pipeline completa: legge il corpus, genera embeddings, riscrive document_chunks da zero.
// Svuota la tabella prima di inserire (delete() richiede sempre un filtro — not("id","is",null)
// seleziona tutte le righe) per rendere lo script ri-eseguibile senza duplicare dati.
export async function runIngest(corpusDir: string): Promise<void> {
  const chunks = readCorpus(corpusDir);
  const embeddings = await embedTexts(chunks.map((c) => c.content));
  const rows = buildDocumentRows(chunks, embeddings);

  const { error: deleteError } = await supabaseAdmin.from("document_chunks").delete().not("id", "is", null);
  if (deleteError) {
    throw new Error(`runIngest: svuotamento document_chunks fallito — ${deleteError.message}`);
  }

  const { error: insertError } = await supabaseAdmin.from("document_chunks").insert(rows);
  if (insertError) {
    throw new Error(`runIngest: scrittura document_chunks fallita — ${insertError.message}`);
  }

  console.log(`[ingest] scritte ${rows.length} righe su document_chunks.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const corpusDir = join(process.cwd(), "corpus");
  if (process.argv.includes("--preview")) {
    previewCorpus(corpusDir);
  } else {
    runIngest(corpusDir).catch((error) => {
      console.error(error);
      process.exit(1);
    });
  }
}
