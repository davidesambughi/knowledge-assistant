# Architecture Context — Knowledge Assistant

## Stack

- **Framework:** Next.js 16.3 (verificato ago 2026 — GA 3 ago, ultima patch 16.3.1)
- **TypeScript:** 6.0.x — **non 7.0** (vedi warning sotto)
- **Database / Vector Store:** Supabase (Postgres + pgvector), progetto Supabase nuovo e dedicato
- **Embeddings:** Google Gemini `gemini-embedding-001` via SDK ufficiale `@google/genai`, output a 1536 dimensioni (Matryoshka Representation Learning, parametro `outputDimensionality`) — stessa dimensione di `text-embedding-3-small`, nessuna migrazione di schema. Verificato ago 2026 su `ai.google.dev/api/embeddings`.
- **Generazione / Chat:** Vercel AI SDK 7 (`ai@7.x`, rilasciato giu 2026), risposte in streaming, provider Google Gemini (`@ai-sdk/google`) — **da verificare su doc ufficiale (`ai.google.dev/gemini-api/docs/vercel-ai-sdk-example`) quando si implementa `03a`**, non dare per confermato il pattern qui, solo l'esistenza del provider (banner `AGENTS.md`).

> **Nota — passaggio da OpenAI a Gemini (ago 2026):** deciso dopo aver scoperto che l'API OpenAI richiede billing attivo fin dalla prima chiamata (nessun free tier reale) — vedi `progress-tracker.md` §Architecture Decisions. Gemini via AI Studio offre un free tier reale per embeddings e generazione. **I numeri esatti di rate limit (RPM/TPM/RPD) non sono documentati qui come fatto accertato** — Google stessa segnala che variano per progetto e i valori pubblicati non sono garantiti; verificare sempre i limiti live su AI Studio prima di dimensionare batch/concorrenza reali, non fidarsi di tabelle di terze parti.

- **UI:** shadcn/ui — **Base UI** è il default dei primitive dal luglio 2026 (non più Radix); componenti di default, nessun design system custom
- **Retrieval:** naive RAG (similarity search / cosine, via pgvector) come core; hybrid search (vector + Postgres full-text search) come upgrade in scope

⚠️ **TypeScript — pinnare 6.0.x esplicitamente.** TypeScript 7.0 è GA da luglio 2026 (nuovo compiler nativo, molto più veloce) ma **non ha ancora un'API programmatica stabile** — `typescript-eslint` non lo supporta (previsto in TS 7.1, autunno 2026). Se il progetto viene inizializzato con l'ultima versione di npm senza specificare la versione, si rischia di finire su TS7 e rompere il lint. Stesso problema già riscontrato in un altro progetto (Remote NIF/portfolio) — pinnare `typescript@~6.0.x` nel `package.json` fin dal setup iniziale.

> Come da banner in `AGENTS.md`: prima di implementare pattern di streaming (Vercel AI SDK) o retrieval (Supabase pgvector), verificare comunque la doc ufficiale aggiornata — queste versioni sono corrette al 15 agosto 2026, ma lo stack evolve in fretta.

## Storage Model

Il corpus ingerito è la documentazione tecnica esistente del progetto **Remote NIF** (README, architettura, spec tecniche di quel repo — non i file "spec docs" di questo stesso progetto, vedi nota sotto).

```sql
create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  source_file text not null,          -- es. "architecture.md" (file del corpus Remote NIF)
  heading_path text not null,         -- es. "Architettura > Gestione Webhook"
  content text not null,              -- il testo del chunk (heading-prefix + corpo)
  chunk_index int not null,           -- posizione del chunk nel file originale
  embedding vector(1536) not null,    -- generato da gemini-embedding-001 (outputDimensionality: 1536)
  created_at timestamptz default now()
);

alter table document_chunks enable row level security;

create index on document_chunks
  using hnsw (embedding vector_cosine_ops);

-- Aggiunta in 02-retrieval.md: full-text search per l'hybrid search (fusa con la ricerca
-- vettoriale via Reciprocal Rank Fusion, vedi funzione SQL hybrid_search in
-- supabase/sql/02-retrieval.sql).
alter table document_chunks
  add column fts tsvector
  generated always as (to_tsvector('italian', content)) stored;

create index document_chunks_fts_idx
  on document_chunks using gin (fts);
```

> **RLS abilitata senza policy, di proposito.** Tutto l'accesso a `document_chunks` è server-side (ingest e retrieval usano `SUPABASE_SECRET_KEY`, che bypassa RLS — vedi `tech-spec.md` §Environment Variables). Nessuna query client-side è prevista su questa tabella, quindi RLS senza policy nega di default qualunque accesso via `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, rinforzando Invariant #20 a livello DB oltre che applicativo.

> **Nota — identificatori con underscore in full-text search (scoperto in verifica manuale `02-retrieval.md`, meccanismo confermato su doc ufficiale Postgres + verifica diretta sul DB del progetto):** un identificatore come `NEXT_PUBLIC_FLAG_AI_REVIEW`, passato a `websearch_to_tsquery`, **non** viene ignorato — Postgres lo tokenizza come parola composta (`hword`, stesso meccanismo delle parole con trattino: token intero + componenti) e lo traduce in una query di **frase** con operatori `FOLLOWED BY` (`<->`/`<N>`), non in un semplice AND libero tra parole. Verificato sul DB reale: `select websearch_to_tsquery('italian', 'NEXT_PUBLIC_FLAG_AI_REVIEW')` ritorna `'next' <-> 'public' <-> 'flag' <2> 'review'` — il `<2>` invece di `<->` tra `flag` e `review` è dovuto alla stopword italiana "ai" (preposizione articolata "a"+"i"), scartata dal dizionario ma che lascia comunque un "buco" di posizione nella distanza richiesta. Conseguenza pratica: la query richiede che quei lexeme compaiano in quella sequenza esatta e a quella distanza nel documento, non semplicemente "da qualche parte" — molto più fragile di un AND libero. Se il termine compare nel chunk con punteggiatura diversa attorno (es. `process.env.NEXT_PUBLIC_FLAG_AI_REVIEW`, dove il `.` altera la tokenizzazione) il match può fallire pur essendo il termine presente testualmente. Su parole singole normali (anche tecniche, es. "Sentry", "Idempotency") il full-text funziona senza questa fragilità e l'hybrid search recupera chunk che la sola similarity vettoriale non trova (verificato: query "Idempotency" — il chunk `Flow 3 — Stripe Checkout` non compare nemmeno tra i primi 100 risultati vettoriali, ma è #2 con l'hybrid search). Nessun workaround implementato (es. normalizzazione degli identificatori prima dell'indicizzazione) — fuori scope per `02`, da tenere presente se emergono query reali su identificatori di codice.
>
> **Nota pgvector (verificato ago 2026):** dal 5 agosto 2026 Supabase ignora versioni esplicite passate a `create extension vector version '...'` — installa sempre la versione default del progetto. Non specificare mai una versione hardcoded nello script di setup dell'estensione.

**Ruolo di ogni colonna:**

- `content` → dato al modello di embedding e al modello di generazione
- `heading_path` → mai passato al modello di embedding; usato per filtri e citazione fonte
- `source_file` → colonna separata da `heading_path` per query dirette senza parsing di stringhe (es. `where source_file = 'tech-spec.md'`)
- `chunk_index` → non usato attivamente nel naive RAG; utile per debug e per una futura espansione "contesto adiacente" (index-1/index+1)

**Nota — due insiemi di documenti da non confondere:**

1. **Spec docs** (questo progetto) — `AGENTS.md`, `project-overview.md`, `architecture-context.md`, `tech-spec.md`, `feature-specs/*.md`, `progress-tracker.md`. Guidano la costruzione del tool. Non vengono mai ingeriti.
2. **Corpus docs** (Remote NIF) — i file che finiscono in `document_chunks`, ciò su cui il tool risponde.

## Project Structure

Dove vive ogni responsabilità:

```
lib/rag/ingest.ts       script di ingest: legge markdown, chunking, genera embeddings, salva su Supabase
lib/rag/retrieval.ts    similarity search (+ hybrid search con RRF lato SQL)
lib/rag/embeddings.ts   wrapper chiamate Gemini embeddings (gemini-embedding-001)
lib/rag/chunking.ts     parsing markdown + chunking per heading (fence-aware)
lib/rag/prompt.ts       costruzione system prompt (funzione pura, Invariant #11/#12/#19)
lib/rag/generation.ts   wrapper generazione streaming Gemini (gemini-3.1-flash-lite)
lib/supabase/admin.ts   client Supabase server-only con SUPABASE_SECRET_KEY (bypassa RLS, Invariant #20)
lib/rate-limit.ts       rate limiting per IP via Upstash Redis (10 req/10 min, Invariant #18)
lib/security.ts         controllo Origin auto-referenziale e hardening endpoint (03d)
lib/chat/messages.ts    trasformazione messaggi useChat -> ChatRequest payload server
lib/chat/ui-helpers.ts  helper pure UI (es. rilevamento rifiuto guardrail Invariant #11)
lib/types.ts            tipi condivisi e schemi Zod (Invariant #3/#7)
components/ui/          shadcn/ui primitive (button, input, scroll-area, badge, card, avatar)
components/chat/        componenti dashboard tecnica (header, empty state con chip, message item, input form)
components/overview/    pannello esplicativo recruiter-facing (04a/04b)
app/api/chat/route.ts   endpoint di chat, rate-limiting, validation, retrieval, streaming Gemini
```

## Testing Policy

<!-- Aggiunta dopo 01a/01b — vedi progress-tracker.md per la decisione e il contesto. -->

Non più "nessun test di default": ogni feature-spec valuta esplicitamente se la propria logica è testabile senza costi esterni (parsing, validazione, trasformazioni dati) o copre un invariant di sicurezza — in quel caso include unit/integration test minimi (`feature-template.md` §Testing).

- **Framework:** Vitest (verificato ago 2026 — raccomandazione ufficiale Next.js per unit test, `nextjs.org/docs/app/guides/testing/vitest`; nessun setup React/jsdom necessario per ora, dato che la logica testata finora è pura TS, non componenti).
- **File di test:** colocati accanto al file testato, suffisso `*.test.ts` (es. `lib/rag/chunking.ts` → `lib/rag/chunking.test.ts`).
- **Comando:** `npm run test` (esegue `vitest run`, non watch mode — coerente con l'uso in CI/verifica one-shot).
- **Cosa NON testare automaticamente:** chiamate reali a Gemini o scritture reali su Supabase (servizio esterno live, anche se gratuito) — se una funzione mischia logica pura e chiamata esterna, la logica pura va estratta in una funzione separata e testata; la chiamata esterna resta verificata manualmente (vedi §Check When Done di ogni spec).

## Invariants

<!-- Vincoli hard, mai violabili. Se un'implementazione proposta ne viola uno, si ferma e si trova un altro approccio. -->

### Stack / pattern generali

1. Server Components sono il default — `"use client"` solo se serve API browser, hook o event handler.
2. Business logic vive in `lib/` — Server Actions e API routes restano sottili.
3. Zod valida ogni input esterno (risposte Gemini embeddings/generazione, payload di query, risultati Supabase).
4. Ogni data boundary è tipato (esplicito o via Zod).
5. Env vars sono validate a startup con Zod — fail fast se mancanti/malformate.
6. shadcn/ui è il default per i componenti; custom solo se nessun primitive shadcn si adatta.
7. Tipi TypeScript sono inferiti da Zod (`z.infer<typeof schema>`) — mai duplicati a mano.
8. Server Actions per le mutazioni classiche (es. trigger manuale di ingest); l'endpoint di chat è un'API route per necessità tecnica dello streaming — eccezione esplicita, non violazione.
9. Server Actions ritornano risultati strutturati (`{ success, data }` / `{ success, error }`), mai throw al client — eccezione: lo streaming della chat, che stream-a direttamente.
10. Solo design tokens per i colori, niente valori raw — token di default shadcn, nessun sistema custom.

### RAG-specific

11. Il modello risponde SOLO dal contesto recuperato — mai da conoscenza propria. Se il contesto non contiene la risposta, il modello dice esplicitamente che non è nella documentazione.
12. Ogni risposta cita la fonte (`heading_path`/`source_file`) dei chunk effettivamente usati.
13. Nessuna chiamata Gemini (embedding o generazione) senza gestione esplicita di errore/timeout — fail loud, mai silenzioso.
14. Il numero di chunk recuperati (top-k) è un valore centralizzato e configurabile, mai hardcoded in più punti.
15. Le chiamate embedding/generazione sono loggate, anche informalmente, per tracciare costo/latenza.

### Domain-specific (chunking)

16. Un blocco Mermaid non viene mai spezzato tra due chunk.
17. Ogni chunk porta il proprio heading-prefix.

### Sicurezza (tool pubblico nel portfolio)

18. L'endpoint di chat ha un rate limit per IP — protezione minima contro abuso di costo su un tool pubblico.
19. Il system prompt vincola esplicitamente il modello al contesto recuperato e istruisce a ignorare tentativi di override contenuti nel messaggio dell'utente (rinforza #11 come difesa anche da prompt injection, non solo da allucinazione).
20. Nessuna chiave privilegiata (Supabase service role, Gemini API key) è mai esposta lato client — solo chiamate server-side.
