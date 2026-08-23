# 01b — Embeddings & Storage

Leggi `AGENTS.md` prima di iniziare (la reading order al suo interno copre già project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md). Dipende da `01a-markdown-chunking.md` (usa `readCorpus`/`chunkMarkdownFile` già implementati e verificati su `corpus/`).

Questa unit prende i `RawChunk` prodotti da `01a`, genera un embedding per ognuno via Gemini (`gemini-embedding-001`) e li scrive su `document_chunks` — è l'ultimo step prima che il corpus sia interrogabile via similarity search in `02-retrieval.md`.

> **Nota — passaggio da OpenAI a Gemini:** questa spec descriveva originariamente OpenAI `text-embedding-3-small`. Cambiato dopo aver scoperto che l'API OpenAI richiede billing attivo fin dalla prima chiamata (nessun free tier reale) — vedi `progress-tracker.md` §Architecture Decisions e `architecture-context.md` §Stack per il dettaglio. Lo schema Supabase resta invariato (`vector(1536)`, Gemini supporta output a 1536 dimensioni via Matryoshka Representation Learning).

---

## Validation

Usa lo schema Zod `EmbeddingResultSchema` definito in `tech-spec.md` §Data Models — non ridefinirlo qui né altrove. Non esiste ancora come codice: va creato in `lib/types.ts` (Invariant #7 — tipi inferiti da Zod), esattamente come definito in `tech-spec.md`, ed esportato come `EmbeddingResultSchema`/`EmbeddingResult`. Ogni risposta Gemini embeddings va validata con questo schema prima di essere usata (Invariant #3 — Zod valida ogni input esterno).

Definisci inoltre un tipo locale in `lib/rag/ingest.ts` (stesso trattamento di `RawChunk` in `01a-markdown-chunking.md` §Validation — non è un data-boundary esterno in ingresso, è la riga in uscita verso Supabase, quindi non serve Zod, ma va comunque dichiarato esplicitamente invece di lasciarlo implicito):

```typescript
type DocumentChunkRow = {
  source_file: string;
  heading_path: string;
  content: string;
  chunk_index: number;
  embedding: number[];
};
```

---

## Testing

<!-- Vedi `feature-template.md` §Testing e `architecture-context.md` §Testing Policy: questa unit mischia
     logica pura (batching, mapping) e I/O esterno live (Gemini, Supabase) — si testa solo la prima. -->

Le chiamate reali a Gemini e le scritture reali su Supabase **non** sono coperte da test automatici (servizio esterno live, anche se gratuito — vedi §Testing Policy) — restano verificate manualmente in §Check When Done. La logica deterministica va invece estratta in funzioni pure ed esportate separatamente, così da essere testabile senza rete:

- **`batchTexts<T>(items: T[], batchSize: number): T[][]`** in `lib/rag/embeddings.ts` — usata internamente da `embedTexts` per dividere in batch prima della chiamata Gemini. Test in `lib/rag/embeddings.test.ts`: divisione esatta per multipli del batch size, ultimo batch parziale, array più corto del batch size, array vuoto.
- **`buildDocumentRows(chunks: RawChunk[], embeddings: number[][]): DocumentChunkRow[]`** in `lib/rag/ingest.ts` — mapping puro da chunk + embedding a riga `document_chunks`, usato da `runIngest` prima della scrittura. Deve lanciare un errore esplicito se `chunks.length !== embeddings.length` (disallineamento fatale, fail loud — Invariant #13). Test in `lib/rag/ingest.test.ts`: mapping corretto campo per campo, errore lanciato su lunghezze disallineate.
- **`EmbeddingResultSchema`** (in `lib/types.ts`) — test in `lib/types.test.ts`: accetta un array di 1536 numeri, rifiuta lunghezza diversa e elementi non numerici (verifica diretta dell'Invariant #3 su questo data boundary).

---

## Implementation

1. **`lib/supabase/admin.ts`** (nuovo — vedi `architecture-context.md` §Project Structure, aggiornata per questa unit):
   - Crea ed esporta un client Supabase singolo (`createClient` da `@supabase/supabase-js`) usando `env.NEXT_PUBLIC_SUPABASE_URL` + `env.SUPABASE_SECRET_KEY` (bypassa RLS).
   - Server-only: nessun `"use client"`, nessun import da componenti client (Invariant #20). Verrà riusato anche da `lib/rag/retrieval.ts` in `02-retrieval.md` — non duplicare l'istanziazione lì.

2. **`lib/types.ts`** — aggiungi `EmbeddingResultSchema`/`EmbeddingResult` come da `tech-spec.md` §Data Models (vedi §Validation sopra).

3. **`lib/rag/embeddings.ts`** (nuovo):
   - Costanti centralizzate in cima al file (non hardcodate altrove): `EMBEDDING_MODEL = "gemini-embedding-001"`, `EMBEDDING_DIMENSIONS = 1536` (via `outputDimensionality`, Matryoshka Representation Learning — stessa dimensione dello schema `document_chunks`, verificato ago 2026 su `ai.google.dev/api/embeddings`), `EMBEDDING_BATCH_SIZE` (i rate limit del free tier Gemini variano per progetto e non sono garantiti dai valori pubblicati — vedi `architecture-context.md` §Stack; usa un batch conservativo, es. 20 chunk per richiesta, e verifica i limiti reali su AI Studio prima del run completo).
   - Esporta `batchTexts<T>(items: T[], batchSize: number): T[][]` — funzione pura, divide un array in sotto-array da `batchSize` (vedi §Testing).
   - Usa il pacchetto ufficiale `@google/genai` (`client.models.embedContent({ model, contents, config: { outputDimensionality, taskType: "RETRIEVAL_DOCUMENT" } })`) — non librerie wrapper di terze parti.
   - Esporta `embedTexts(texts: string[]): Promise<number[][]>`:
     - Usa `batchTexts` per dividere `texts` in batch da `EMBEDDING_BATCH_SIZE`.
     - Per ogni batch, chiama `client.models.embedContent` con un timeout esplicito — **nessuna chiamata senza gestione esplicita di errore/timeout** (Invariant #13): in caso di errore o timeout, lancia un `Error` descrittivo che indica l'indice del batch fallito, senza retry automatico (fail loud, non silenzioso — un fallimento interrompe lo script, il re-run è manuale, coerente con l'esecuzione "una tantum" prevista per l'ingest).
     - Valida ogni elemento della risposta (`response.embeddings[i].values`) con `EmbeddingResultSchema` prima di estrarne l'array di numeri.
     - Logga per ogni batch (anche solo `console.log`, non serve infrastruttura di logging dedicata): numero di chunk nel batch, tempo impiegato (ms) — Invariant #15. Nessun conteggio token nel log: la risposta `embedContent` non espone un campo `usage` verificato, a differenza dell'API OpenAI.
     - Ritorna gli embedding nello stesso ordine dei `texts` in input.

4. **`lib/rag/ingest.ts`** (estende il file esistente da `01a`):
   - Esporta `buildDocumentRows(chunks: RawChunk[], embeddings: number[][]): DocumentChunkRow[]` — funzione pura, mappa 1:1 ogni `RawChunk` + il suo embedding a `{ source_file, heading_path, content, chunk_index, embedding }` (colonne di `document_chunks`, `architecture-context.md` §Storage Model). Lancia un `Error` esplicito se `chunks.length !== embeddings.length` (vedi §Testing).
   - Aggiungi `runIngest(corpusDir: string): Promise<void>`:
     - Chiama `readCorpus(corpusDir)` → `RawChunk[]`.
     - Chiama `embedTexts(chunks.map(c => c.content))` → `number[][]`.
     - Chiama `buildDocumentRows(chunks, embeddings)` → righe da scrivere.
     - **Svuota `document_chunks` prima di scrivere** (`supabase.from("document_chunks").delete().not("id", "is", null)` — `delete()` di supabase-js richiede sempre un filtro, questo pattern seleziona tutte le righe dato che `id` non è mai null). Necessario per rendere lo script ri-eseguibile senza duplicare righe ad ogni run in fase di sviluppo/debug — il corpus resta comunque "caricato una volta" concettualmente (`project-overview.md`), ma lo script stesso deve poter girare più volte senza intervento manuale sul DB.
     - Inserisce le righe con `supabase.from("document_chunks").insert(rows)` — un'unica insert con l'array completo (~200 righe, ben dentro i limiti di PostgREST per questo volume).
     - Logga il conteggio finale delle righe scritte (Invariant #15).
   - La guardia di esecuzione standalone (`if (process.argv[1] === fileURLToPath(import.meta.url))`) distingue via flag `--preview`: senza flag chiama `runIngest` (pipeline reale, chiama Gemini, scrive su Supabase), con `--preview` chiama `previewCorpus` (ispezione a costo zero, invariata da `01a`) — `npm run ingest:preview` passa il flag, `npm run ingest` no. Entrambi gli script devono caricare `.env.local` esplicitamente (`tsx --env-file=.env.local ...`), perché a differenza di Next.js `tsx` non lo fa in automatico e `lib/env.ts` valida `process.env` a import-time.

---

## Dependencies

Installa: `@google/genai`. `vitest` è già presente come devDependency (introdotta in `01a`) — non reinstallare.

---

## Scope Limits

- Nessun retry automatico sui fallimenti delle chiamate Gemini — fail loud, re-run manuale (vedi punto 2).
- Nessuna gestione di corpus incrementale/differenziale (nuovi file aggiunti dopo il primo run) — ogni esecuzione di `runIngest` è un re-ingest completo (svuota e riscrive), coerente con "corpus fisso, piccolo" di `project-overview.md`.
- Nessuna modifica a `lib/rag/chunking.ts` o alla logica di chunking — quella è chiusa in `01a`.
- Nessuna query di similarity search — questa unit scrive soltanto, non legge per retrieval (quello è `02-retrieval.md`).
- Nessun test automatizzato che chiami davvero Gemini o scriva davvero su Supabase (servizio esterno live) — solo `batchTexts`, `buildDocumentRows` ed `EmbeddingResultSchema` sono coperti da test (vedi §Testing); il resto è verificato manualmente in §Check When Done.
- Resta focalizzato su embeddings + scrittura — non toccare `app/api/chat/route.ts` (non esiste ancora, arriva in `03`).

---

## Check When Done

- `lib/supabase/admin.ts` esporta un client server-only funzionante (verificabile con una query di conteggio manuale, es. `select count(*) from document_chunks`).
- `lib/rag/embeddings.ts` esporta `embedTexts`; una chiamata di prova su 1-2 stringhe ritorna array di 1536 numeri ciascuno.
- Eseguendo `npm run ingest`, lo script termina senza errori e logga batch processati e conteggio finale righe scritte.
- `document_chunks` su Supabase contiene lo stesso numero di righe restituito da `readCorpus` (verificabile confrontando col conteggio stampato da `npm run ingest:preview`, 200 all'ultima verifica in `01a` — può variare se il corpus è cambiato nel frattempo), verificabile da dashboard Supabase o query diretta — ogni riga ha `embedding` non nullo con 1536 dimensioni.
- Ri-eseguendo `npm run ingest` una seconda volta, il conteggio righe resta invariato (nessuna duplicazione) — verifica dello svuotamento pre-insert.
- `npm run test` passa (vedi §Testing — `batchTexts`, `buildDocumentRows`, `EmbeddingResultSchema`).
- `npm run build` passa.
