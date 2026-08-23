# 02 — Retrieval

Leggi `AGENTS.md` prima di iniziare (la reading order al suo interno copre già project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md). Dipende da `01b-embeddings-storage.md` (usa `lib/supabase/admin.ts` e le costanti/pattern di `lib/rag/embeddings.ts` già implementati e verificati — `document_chunks` contiene 200 righe con embedding reali).

Questa unit prende una domanda utente (stringa), la trasforma in embedding, recupera i chunk più pertinenti da `document_chunks` — prima con naive similarity search (cosine, pgvector), poi con hybrid search (vector + Postgres full-text, fuse via Reciprocal Rank Fusion) come upgrade nello stesso file — così che `03-chat-ui.md` possa chiamare una singola funzione di retrieval senza dover generare o gestire SQL.

> **Nota — verifica doc ufficiale (ago 2026):** confermato su `supabase.com/docs` che PostgREST non espone operatori pgvector (`<=>`) direttamente — la similarity search va incapsulata in una funzione Postgres (`match_documents`) chiamata via `supabase.rpc(...)`, non in una query `.select()` diretta. Confermato anche il pattern hybrid search ufficiale Supabase: due ricerche indipendenti (vettoriale + `tsvector`/GIN) fuse con Reciprocal Rank Fusion (`1 / (k + rank)`, `k` di smoothing tipicamente 50), esposte come singola funzione RPC (`hybrid_search`) con pesi configurabili (`full_text_weight`, `semantic_weight`). Verificato anche su `ai.google.dev/api/embeddings` che il modello in uso in questo progetto, `gemini-embedding-001`, supporta ancora il parametro `taskType` (a differenza del più recente `gemini-embedding-2`, che lo ha deprecato in favore di un prefisso testuale nel prompt) — **`taskType: "RETRIEVAL_QUERY"` è il valore corretto per l'embedding della domanda utente** (asimmetrico per design rispetto a `RETRIEVAL_DOCUMENT`, usato per l'embedding dei chunk in `01b` — Gemini ottimizza i due embedding in modo diverso per query vs documenti indicizzati, non è un refuso). Nessuna migrazione a `gemini-embedding-2` in questa unit: lo spazio vettoriale tra modelli Gemini diversi non è compatibile, e i 200 chunk già ingeriti in `01b` usano `gemini-embedding-001` — cambiare modello a query-time romperebbe la similarity search.

---

## Validation

Usa lo schema Zod `RetrievedChunkSchema` definito in `tech-spec.md` §Data Models — non ridefinirlo qui né altrove. Non esiste ancora come codice: va creato in `lib/types.ts` (Invariant #7 — tipi inferiti da Zod), esattamente come definito in `tech-spec.md`, ed esportato come `RetrievedChunkSchema`/`RetrievedChunk` (stesso trattamento dato a `EmbeddingResultSchema` in `01b-embeddings-storage.md` §Validation — vedi §Implementation punto 0).

**Attenzione — mismatch di naming, mapping esplicito richiesto.** `RetrievedChunkSchema` è camelCase (`headingPath`, `sourceFile`), ma le funzioni SQL `match_documents`/`hybrid_search` (§Implementation punti 2-3) ritornano colonne snake_case (`heading_path`, `source_file` — convenzione Postgres, PostgREST/`supabase-js` non fanno auto-conversione a camelCase, verificato su `supabase.com/docs`). Validare una riga RPC direttamente con `RetrievedChunkSchema.parse(row)` fallisce sempre a runtime: `headingPath`/`sourceFile` risultano `undefined`. Ogni riga va prima mappata esplicitamente da snake_case a camelCase (funzione pura `mapRowToRetrievedChunk`, §Implementation punto 5) e solo il risultato del mapping va validato con `RetrievedChunkSchema` — stesso pattern di `buildDocumentRows` in `01b` (mapping dichiarato, mai implicito), applicato qui in entrata invece che in uscita.

---

## Testing

<!-- Vedi `feature-template.md` §Testing e `architecture-context.md` §Testing Policy: questa unit mischia
     logica pura (fusione RRF, costruzione dei parametri RPC) e I/O esterno live (Gemini per l'embedding
     della query, Supabase per le due ricerche) — si testa solo la prima. -->

Le chiamate reali a Gemini (embedding della query) e le query reali su Supabase (`match_documents`/`hybrid_search` via RPC) **non** sono coperte da test automatici (servizio esterno live — vedi §Testing Policy) — restano verificate manualmente in §Check When Done. La logica di fusione RRF è invece deterministica e va estratta in una funzione pura testabile senza rete:

- **`fuseResults(vectorResults: RankedResult[], textResults: RankedResult[], k: number, weights: { vector: number; text: number }): RankedResult[]`** in `lib/rag/retrieval.ts` — implementa Reciprocal Rank Fusion (`score = weight * (1 / (k + rank))`, sommato per riga presente in entrambi gli insiemi, identificata per `id`). Test in `lib/rag/retrieval.test.ts`: una riga presente in entrambi gli insiemi supera una riga presente in uno solo a parità di rank; ordine di output decrescente per score; insieme vuoto da un lato non lancia errore; pesi diversi (es. `vector: 1, text: 0`) riproducono l'ordinamento del solo insieme vettoriale.
- **`mapRowToRetrievedChunk(row: { id: string; source_file: string; heading_path: string; content: string; similarity: number }): RetrievedChunk`** in `lib/rag/retrieval.ts` — mapping puro snake_case → camelCase da riga RPC a `RetrievedChunk` (vedi §Validation), usato da `retrieveChunks`/`hybridRetrieveChunks` prima della validazione Zod. Test in `lib/rag/retrieval.test.ts`: mapping corretto campo per campo (`heading_path` → `headingPath`, `source_file` → `sourceFile`, `content`/`similarity` invariati).
- **`buildRetrievalParams(topK: number)`** (o funzione equivalente che centralizza i parametri passati alle RPC — vedi Invariant #14) — se la logica è più che un valore statico, testala; se è solo un import di costante, non serve un test dedicato.

---

## Implementation

0. **`lib/types.ts`** — aggiungi `RetrievedChunkSchema`/`RetrievedChunk` come da `tech-spec.md` §Data Models (vedi §Validation sopra). Non esiste ancora nel codice — solo `EmbeddingResultSchema` (`01b`) è presente finora.

1. **Estendi lo schema `document_chunks`** (eseguito manualmente su Supabase SQL editor, stesso pattern di `00-project-setup.md` — nessuna cartella di migrazioni nel progetto):
   - Aggiungi una colonna generata `fts` (`tsvector`, `generated always as (to_tsvector('italian', content)) stored` — lingua `italian` perché il corpus Remote NIF è in italiano, vedi `project-overview.md` §Aggiornamento scope bilingue: solo la UI è bilingue, il corpus resta italiano).
   - Crea un indice GIN su `fts`.
   - Verifica che questa modifica non richieda touch di `architecture-context.md` §Storage Model solo se la colonna esiste già — se non esiste, aggiorna quella sezione con la nuova colonna/indice a implementazione riuscita (non prima).

2. **Funzione SQL `match_documents`** (naive similarity search, Supabase SQL editor):
   - Parametri: `query_embedding vector(1536)`, `match_count int`.
   - Ritorna: `id uuid, source_file text, heading_path text, content text, similarity float` — calcolata come `1 - (embedding <=> query_embedding)` (cosine distance → similarity, verificato su doc ufficiale pgvector/Supabase).
   - Ordina per `embedding <=> query_embedding` ascendente (distanza minore = più simile), limita a `match_count`.
   - Nessun `match_threshold` in questa unit — non richiesto da nessun invariant o requisito esplicito; se emerge la necessità durante il testing manuale, va prima loggato come open question in `progress-tracker.md`, non aggiunto silenziosamente.

3. **Funzione SQL `hybrid_search`** (upgrade, stesso SQL editor):
   - Parametri: `query_text text`, `query_embedding vector(1536)`, `match_count int`, `full_text_weight float default 1`, `semantic_weight float default 1`, `rrf_k int default 50`.
   - Esegue le due ricerche indipendenti (vector via `<=>`, full-text via `fts @@ websearch_to_tsquery('italian', query_text)`), fonde i risultati via Reciprocal Rank Fusion (`1 / (rrf_k + rank)` per ciascun insieme, pesato), ritorna le stesse colonne di `match_documents`.

4. **`lib/rag/embeddings.ts`** (estende il file esistente da `01b`):
   - Esporta `embedQuery(text: string): Promise<number[]>` — singola chiamata a `client.models.embedContent` con `taskType: "RETRIEVAL_QUERY"` (vedi nota in apertura), stesso modello/dimensioni di `EMBEDDING_MODEL`/`EMBEDDING_DIMENSIONS` già centralizzati in `01b`, stessa gestione esplicita di errore/timeout (Invariant #13), validata con `EmbeddingResultSchema`.
   - Non duplicare `EMBEDDING_MODEL`/`EMBEDDING_DIMENSIONS` — riusa le costanti esistenti.

5. **`lib/rag/retrieval.ts`** (nuovo):
   - Costante centralizzata `TOP_K` (es. 5) — unico punto che definisce quanti chunk recuperare (Invariant #14, mai hardcodato altrove, incluso in `03-chat-ui.md` quando lo consumerà).
   - Esporta `mapRowToRetrievedChunk` — vedi §Testing e §Validation per firma e motivo (mismatch snake_case/camelCase tra colonne SQL e `RetrievedChunkSchema`).
   - Esporta `retrieveChunks(query: string, topK: number = TOP_K): Promise<RetrievedChunk[]>` — naive RAG: chiama `embedQuery`, poi `supabase.rpc("match_documents", { query_embedding, match_count: topK })`, mappa ogni riga con `mapRowToRetrievedChunk`, valida il risultato con `RetrievedChunkSchema`, ritorna l'array. **Mai** passare una riga RPC grezza direttamente a `RetrievedChunkSchema.parse` — vedi §Validation.
   - Esporta `hybridRetrieveChunks(query: string, topK: number = TOP_K): Promise<RetrievedChunk[]>` — chiama `embedQuery`, poi `supabase.rpc("hybrid_search", { query_text: query, query_embedding, match_count: topK })`, stesso mapping + validazione.
   - Se preferisci esporre `fuseResults` lato applicativo invece che in SQL (alternativa architetturale valida: due RPC separate `match_documents_vector`/`match_documents_text` più fusione in TypeScript) — scegli **un solo approccio**, non entrambi, e documenta la scelta in `progress-tracker.md` §Architecture Decisions. Questa spec assume la fusione lato SQL (§Implementation punto 3) come default, perché riusa direttamente il pattern ufficiale Supabase verificato in apertura; se durante l'implementazione risulta più semplice fondere in TS (es. per riusare `fuseResults` testato in §Testing su dati reali, non solo su fixture), è una deviazione accettabile — va solo registrata, non lasciata implicita.
   - Logga latenza ed esito di ogni chiamata (embedding + RPC) — Invariant #15.

---

## Dependencies

Nessuna nuova dipendenza — riusa `@google/genai` e `@supabase/supabase-js` già installati in `01b`.

---

## Scope Limits

- Nessuna UI, nessuna route API — questa unit espone solo funzioni in `lib/rag/`, consumate da `03-chat-ui.md`.
- Nessuna chiamata al modello di generazione — solo retrieval, la generazione (system prompt, streaming) è `03a`/`03-chat-ui.md`.
- Nessun re-ranking aggiuntivo oltre alla fusione RRF di `hybrid_search` — coerente con `project-overview.md` §What We're NOT Building.
- Nessun `match_threshold`/filtro di qualità minima sui risultati — non richiesto esplicitamente, vedi punto 2 sopra.
- Nessuna modifica a `lib/rag/chunking.ts` o `lib/rag/ingest.ts` — quelli sono chiusi in `01a`/`01b`.
- Se questa unit produce logica deterministica testabile senza costi esterni, include unit test minimi prima di considerarsi "fatta" — vedi §Testing sopra (`fuseResults` se la fusione resta lato SQL, va comunque replicata/testata in TS solo se effettivamente usata dal codice applicativo; se la fusione resta interamente in SQL e l'unica logica TS è I/O verso Supabase/Gemini, dichiaralo esplicitamente in `progress-tracker.md` invece di forzare un test artificiale su codice che non esiste).
- Resta focalizzato su retrieval (naive + hybrid) — non toccare `app/api/chat/route.ts` (non esiste ancora, arriva in `03`).

---

## Check When Done

- Le funzioni SQL `match_documents` e `hybrid_search` esistono su Supabase (verificabile da SQL editor o dashboard).
- `lib/rag/embeddings.ts` esporta `embedQuery`; una chiamata di prova su una stringa breve ritorna un array di 1536 numeri.
- `lib/rag/retrieval.ts` esporta `retrieveChunks` e `hybridRetrieveChunks`; una chiamata di prova con una domanda plausibile sul corpus Remote NIF (es. "come funziona la gestione dei webhook?") ritorna `TOP_K` chunk con `similarity` decrescente e `heading_path`/`source_file` coerenti col contenuto atteso.
- `hybridRetrieveChunks` su una query con un termine esatto presente nel corpus (es. il nome di una funzione o variabile citata testualmente) recupera almeno quel chunk anche se la similarity vettoriale da sola lo classificherebbe più in basso — verifica manuale che l'upgrade hybrid stia effettivamente contribuendo, non solo che non lanci errori.
- `npm run test` passa (vedi §Testing — `fuseResults` se applicabile).
- `npm run build` passa.
