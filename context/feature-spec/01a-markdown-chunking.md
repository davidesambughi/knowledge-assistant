# 01a — Markdown Parsing & Chunking

Leggi `AGENTS.md` prima di iniziare (la reading order al suo interno copre già project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md).

Questa unit legge il corpus Remote NIF e lo divide in chunk semantici per heading, senza generare ancora nessun embedding — l'obiettivo è poter ispezionare i chunk grezzi (heading-prefix corretto, blocchi Mermaid mai spezzati) prima di generare embeddings in `01b-embeddings-storage.md`.

---

## Validation

Nessuno schema Zod da `tech-spec.md` è coinvolto in questa unit — `RetrievedChunkSchema` e `EmbeddingResultSchema` entrano in gioco solo da `01b` in poi. Definisci qui un solo tipo locale, non in `lib/types.ts` (che resta riservato ai tipi inferiti da Zod, Invariant #7):

```typescript
type RawChunk = {
  sourceFile: string;
  headingPath: string;
  content: string;
  chunkIndex: number;
};
```

Non è un data-boundary esterno (nessun input utente, nessuna risposta API) — Zod non è richiesto qui, ma i campi devono corrispondere 1:1 alle colonne `source_file`, `heading_path`, `content`, `chunk_index` di `document_chunks` (architecture-context.md §Storage Model), così `01b` può scriverli senza rimappare nulla.

---

## Testing

<!-- Aggiunta dopo l'implementazione iniziale — vedi progress-tracker.md, feature-template.md §Testing
     ora richiede di valutare esplicitamente ogni unit invece di escludere i test di default. -->

`chunkMarkdownFile` è logica deterministica pura (parsing/trasformazione testo, nessuna chiamata esterna) — qualifica per §Testing di `feature-template.md`. Test in `lib/rag/chunking.test.ts` (Vitest, vedi `architecture-context.md` §Testing Policy):

- `headingPath` costruito correttamente su heading annidati multi-livello, e resettato quando arriva un heading più superficiale.
- `content` di ogni chunk è prefissato dal proprio `headingPath` (Invariant #17).
- `chunkIndex` sequenziale 0-based, `sourceFile` è il basename del path passato.
- Un blocco fenced con un marker `#` al suo interno (es. commento bash) non genera uno split spurio (Invariant #16 generalizzato) — sia per fence generico che per Mermaid.
- Un preambolo vuoto prima del primo heading non produce un chunk vuoto.

`readCorpus` (lettura file system, non chiamate esterne a pagamento) non ha test dedicati in questa unit — è un wrapper sottile su `chunkMarkdownFile` e `fs.readdirSync`/`readFileSync`, verificato manualmente via `npm run ingest:preview` sul corpus reale (vedi §Check When Done).

---

## Implementation

1. **Crea la cartella `corpus/`** nella root del repo (nuova, non esiste ancora). Copia manualmente dentro i file markdown della documentazione tecnica Remote NIF (README, spec, architettura — quelli descritti in project-overview.md §Constraints, 100-700 righe/file con blocchi Mermaid). Questo è un passo manuale una tantum, non parte dello script.

2. **`lib/rag/chunking.ts`** — funzione `chunkMarkdownFile(filePath: string, content: string): RawChunk[]`:
   - Divide il contenuto per heading Markdown (`#`, `##`, `###`...) — ogni sezione diventa un chunk candidato.
   - Costruisce `headingPath` come percorso gerarchico degli heading attraversati (es. `"Architettura > Gestione Webhook"`, come da esempio in architecture-context.md).
   - Antepone l'heading-prefix al `content` di ogni chunk (Invariant #17 — ogni chunk porta il proprio heading-prefix nel testo, non solo nel campo `headingPath`).
   - **Non spezza mai un blocco Mermaid tra due chunk** (Invariant #16): un blocco Mermaid resta sempre intero nello stesso chunk della sezione a cui appartiene, indipendentemente dalla sua lunghezza — nessuna soglia di lunghezza è definita per questo progetto (chunking puro per heading, nessun sub-splitting dimensionale è in scope: se una sezione è molto grande, il chunk resta grande così com'è).
   - **Il parser deve essere fence-aware in generale, non solo per Mermaid**: mentre scansiona il testo per marker di heading (`#`), deve tracciare se si trova dentro un blocco fenced (` ``` ` o `~~~`, qualunque linguaggio dichiarato — bash, SQL, TypeScript, ecc.) e ignorare qualunque `#` incontrato mentre è dentro un fence. Senza questo tracking, un commento tipo `# config` dentro un blocco bash/Python verrebbe letto come heading e spezzerebbe il blocco a metà — lo stesso bug che l'Invariant #16 vuole evitare per Mermaid, ma che si presenta ugualmente su qualsiasi altro blocco fenced in un corpus tecnico con codice misto. Proteggere Mermaid è quindi un caso particolare di questa regola più generale, non un caso a parte.
   - Assegna `chunkIndex` come posizione progressiva del chunk all'interno del file (0-based), coerente col ruolo descritto in architecture-context.md ("non usato attivamente nel naive RAG; utile per debug ed espansione futura contesto adiacente").
   - `sourceFile` è il nome del file (es. `"architettura.md"`), non il path assoluto.

3. **`lib/rag/ingest.ts`** — funzione `readCorpus(corpusDir: string): RawChunk[]`:
   - Legge tutti i file `.md` in `corpus/` (non ricorsivo — corpus piatto, coerente con "corpus fisso, piccolo" di project-overview.md §What We're NOT Building).
   - Per ognuno chiama `chunkMarkdownFile` e concatena i risultati.
   - Nessuna chiamata a servizi di embedding, nessuna scrittura su Supabase in questa unit — questa funzione è il punto di innesto per `01b`, che la userà come primo step della pipeline.

4. **Script di verifica manuale** (`lib/rag/ingest.ts`, eseguibile standalone es. via `tsx` o script npm temporaneo): stampa a console il numero di chunk per file, il primo e l'ultimo chunk di ciascun file (heading-prefix + primi 200 caratteri di `content`), per ispezione visiva prima di procedere a `01b`. Non è un test automatizzato — è una verifica manuale una tantum.

---

## Dependencies

Nessuna nuova dipendenza runtime necessaria per il parsing Markdown base. Lo split per heading con fence-awareness (punto 2) è realizzabile con parsing manuale/regex a state-tracking (dentro/fuori blocco fenced) — non serve una libreria markdown dedicata per questo corpus noto e controllato. Dev-dependency: `vitest` (§Testing, vedi `architecture-context.md` §Testing Policy).

---

## Scope Limits

- Nessuna chiamata a servizi di embedding — zero costo in questa unit (quello è `01b-embeddings-storage.md`).
- Nessuna scrittura su Supabase/`document_chunks` — questa unit produce solo dati in memoria, non persistiti.
- Nessuna gestione di corpus annidato in sottocartelle — corpus piatto, un solo livello.
- Nessuna deduplicazione o merge di chunk troppo piccoli — se emerge come problema reale ispezionando l'output, si documenta come open question in `progress-tracker.md`, non si risolve preventivamente qui.
- Test automatizzati limitati a `chunkMarkdownFile` (logica pura, vedi §Testing) — `readCorpus` resta verificata solo manualmente, nessun test su I/O filesystem in questo scope.
- Resta focalizzato sul parsing e chunking puro — non toccare `lib/rag/embeddings.ts` (non esiste ancora, arriva in `01b`).

---

## Check When Done

- `corpus/` esiste nella root del repo e contiene i file markdown reali di Remote NIF.
- `lib/rag/chunking.ts` esporta `chunkMarkdownFile`, `lib/rag/ingest.ts` esporta `readCorpus`.
- Eseguendo lo script di verifica manuale, ogni chunk stampato ha un `headingPath` corretto e leggibile, e nessun blocco fenced (Mermaid o di altro linguaggio — bash/SQL/TypeScript) risulta troncato a metà (verifica visiva sui file che contengono diagrammi e blocchi di codice con commenti `#`).
- Il numero totale di chunk generati è coerente con il numero di heading nel corpus (nessun file saltato, nessun chunk vuoto).
- `npm run test` passa (vedi §Testing).
- `npm run build` passa.
