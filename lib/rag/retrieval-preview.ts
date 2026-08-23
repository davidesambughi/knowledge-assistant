// Script diagnostico standalone (stesso spirito di previewCorpus/ingest:preview, 01a) — ispeziona
// manualmente i risultati di hybridRetrieveChunks per una query data, senza aprire Supabase.
// Nessuna validazione di input oltre quella già esistente (RetrievedChunkSchema, dentro retrieval.ts).

import { hybridRetrieveChunks } from "./retrieval";

const CONTENT_PREVIEW_LENGTH = 160;

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error('Uso: npm run retrieval:preview -- "<query>"');
    process.exit(1);
  }

  const chunks = await hybridRetrieveChunks(query);

  console.log(`\nQuery: "${query}"`);
  console.log(`${chunks.length} chunk recuperati (hybrid search)\n`);

  chunks.forEach((chunk, i) => {
    const snippet = chunk.content.replace(/\s+/g, " ").trim().slice(0, CONTENT_PREVIEW_LENGTH);
    console.log(`#${i + 1} — ${chunk.sourceFile} > ${chunk.headingPath}`);
    console.log(`   similarity: ${chunk.similarity.toFixed(4)}`);
    console.log(`   "${snippet}${chunk.content.length > CONTENT_PREVIEW_LENGTH ? "…" : ""}"\n`);
  });
}

main();
