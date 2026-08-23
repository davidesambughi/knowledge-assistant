# 03f — Open Questions Cleanup (pre-04a)

Leggi `AGENTS.md` prima di iniziare (la reading order al suo interno copre già project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md). Dipende da `01b-embeddings-storage.md` e `02-retrieval.md` (i due file toccati qui, `lib/rag/embeddings.ts` e `lib/rag/retrieval.ts`, sono già chiusi e verificati).

Chiude le due open question non bloccanti rimaste in `progress-tracker.md` prima di `04a — Deploy su Vercel`: il timeout dichiarato ma mai cablato in `embeddings.ts`, e la verifica mai fatta del retrieval cross-linguale (query EN → corpus IT) dopo il passaggio a Gemini.

---

## Validation

Nessun nuovo schema Zod. Riusa `EmbeddingResultSchema` e `RetrievedChunkSchema`, già definiti in `tech-spec.md` §Data Models — nessuna modifica ai due schemi.

---

## Implementation

1. **Cablare `EMBEDDING_TIMEOUT_MS` in `lib/rag/embeddings.ts` — via `abortSignal`, non `httpOptions.timeout`**
   - Verifica preliminare fatta con ricerca dedicata (ago 2026), non solo sul type declaration: `EmbedContentConfig` (`node_modules/@google/genai/dist/genai.d.ts`) espone sia `httpOptions.timeout` (numero, ms) sia `abortSignal` (`AbortSignal` standard). **`httpOptions.timeout` è documentato come inaffidabile nel repository ufficiale del pacchetto** (`googleapis/js-genai` su GitHub): issue [#1277](https://github.com/googleapis/js-genai/issues/1277) ("`config.httpOptions.timeout` option is broken for `models.generateContent`", v1.38.0, la libreria di fatto ignora il valore e usa un default interno di ~5 minuti) e issue [#712](https://github.com/googleapis/js-genai/issues/712) (stesso sintomo, v1.6.0) — entrambe ancora aperte, nessuna nota di fix per la major line 2.x installata in questo progetto (`@google/genai@2.17.1`). Le issue riguardano esplicitamente `generateContent`, non è confermato se `embedContent` sia colpito allo stesso modo, ma non c'è nessuna conferma del contrario — rischiare lo stesso bug su un parametro critico per Invariant #13 non è accettabile senza una verifica propria (vedi step di verifica sotto).
   - Per questo motivo, usa **`abortSignal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS)`** (API standard Node/Web, non passa dal codice interno di `httpOptions` del SDK) invece di `httpOptions.timeout`, sia in `embedTexts` (chiamata batch) sia in `embedQuery` (chiamata singola). Nota già presente nel type stesso (`AbortSignal` è "client-only": non cancella la richiesta lato servizio Google, l'uso resta fatturato) — accettabile, l'obiettivo di Invariant #13 è non restare appesi indefinitamente, non risparmiare la chiamata già in corso.
   - Verifica che il timeout scatti davvero, stesso metodo già usato in `03a` per `GENERATION_TIMEOUT_MS`: abbassa `EMBEDDING_TIMEOUT_MS` temporaneamente a un valore vicino a zero, esegui `npm run ingest` (o una chiamata a `embedQuery`) e conferma che la chiamata fallisce rapidamente con un errore esplicito (il `throw new Error(...)` già presente in `embedTexts`/`embedQuery` cattura l'`AbortError`) invece di restare appesa — questo è anche il modo in cui si scopre se `embedContent` soffre dello stesso bug di `httpOptions.timeout`, dato che qui si passa da `abortSignal` e non da `httpOptions` — poi ripristina `EMBEDDING_TIMEOUT_MS = 30_000` e riverifica un run reale completo (200 righe, idempotenza invariata, coerente con quanto già verificato in `01b`).

2. **Script di diagnostica per retrieval, `lib/rag/retrieval-preview.ts`**
   - Script standalone (stesso pattern di `previewCorpus`/`ingest:preview`, non un endpoint): legge una query da `process.argv[2]`, chiama `hybridRetrieveChunks`, stampa a console per ogni risultato `source_file`, `heading_path`, `score`/`similarity` e un estratto breve di `chunk_text` — sufficiente per ispezionare manualmente la pertinenza senza aprire Supabase.
   - Aggiungi script npm `retrieval:preview` in `package.json`, stesso pattern di `ingest:preview`: `tsx --env-file=.env.local lib/rag/retrieval-preview.ts`.
   - Nessuna validazione input oltre l'esistente (`hybridRetrieveChunks` già valida via `RetrievedChunkSchema`) — è uno strumento di ispezione manuale, non un percorso applicativo.

3. **Verifica manuale del retrieval cross-linguale**
   - Esegui `npm run retrieval:preview -- "<query in inglese>"` con almeno una query in inglese equivalente a una già verificata in italiano in `02-retrieval.md` (es. l'equivalente inglese di "come funziona la gestione dei webhook?").
   - Confronta i risultati con quelli già noti per la query italiana equivalente: stessi chunk pertinenti (stesso `source_file`/`heading_path`) o una divergenza chiaramente peggiore? Non dare per scontato un esito positivo — registra quello che succede davvero.
   - Documenta l'esito in `progress-tracker.md` come decisione chiusa (non lasciarla come nota sparsa): se il retrieval cross-linguale funziona in modo comparabile, chiudi l'open question con `~~testo~~` seguito da **RISOLTA** e il dettaglio verificato (stesso pattern già usato per le altre open question chiuse in quel file). Se emerge una degradazione reale, documentala con la stessa onestà — non è nello scope di questa unit *correggerla* (richiederebbe eventualmente un modello di embedding o una query pre-traduzione, fuori scope qui), solo accertarla e descriverla con precisione per una decisione futura informata.

---

## Scope Limits

- Nessuna modifica a `hybrid_search`/`match_documents` (SQL) né a `RetrievedChunkSchema`/`EmbeddingResultSchema`.
- Nessuna traduzione automatica della query, nessun cambio di modello di embedding: se il retrieval cross-linguale risulta degradato, questa unit si limita a documentarlo come open question rivista, non a risolverlo.
- `lib/rag/retrieval-preview.ts` è uno strumento diagnostico manuale (stesso spirito di `ingest:preview`), non una route API né un componente UI.
- Nessuna sezione §Testing: non c'è nuova logica pura deterministica da testare — il cablaggio del timeout è un parametro passato a una chiamata I/O esterna già coperta da `01b` (nessuna nuova funzione), e `retrieval-preview.ts` è un wrapper I/O di ispezione, stesso trattamento già dato a `previewCorpus`/`ingest.ts` in `01a`/`01b` (nessun test automatico contro Gemini/Supabase reali, per `architecture-context.md` §Testing Policy).
- Resta focalizzato sulla chiusura delle due open question già tracciate in `progress-tracker.md` — non un audit generale pre-`04a` più ampio (i security header applicativi restano esplicitamente assegnati a `04a`, non qui).

---

## Check When Done

- `lib/rag/embeddings.ts`: `abortSignal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS)` presente sia in `embedTexts` sia in `embedQuery` (non `httpOptions.timeout`, noto inaffidabile — vedi Implementation).
- Timeout verificato come effettivamente funzionante (abbassato temporaneamente, chiamata fallita rapidamente con errore esplicito invece di restare appesa) e poi ripristinato a `30_000`; un run reale di `npm run ingest` dopo il ripristino conferma 200 righe, idempotenza invariata.
- `lib/rag/retrieval-preview.ts` esiste, `npm run retrieval:preview -- "<query>"` stampa risultati leggibili (`source_file`, `heading_path`, score/similarity, estratto testo) per una query reale.
- Almeno una query in inglese testata via `retrieval:preview` contro il corpus italiano, con esito confrontato a una query italiana equivalente già nota da `02-retrieval.md`.
- `progress-tracker.md` §Open Questions aggiornato: entrambe le voci (`EMBEDDING_TIMEOUT_MS` mai cablata, retrieval cross-linguale mai riverificato) chiuse con l'esito reale documentato — non lasciate aperte né chiuse per assunzione.
- `npm run test` passa (suite esistente, nessun nuovo test — coerente con l'assenza di §Testing sopra).
- `npm run build` passa.
