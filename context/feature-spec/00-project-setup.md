# 00 — Project Setup & Environment

Leggi `AGENTS.md` prima di iniziare (la reading order al suo interno copre già project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md).

Questa unit prepara lo scaffold del progetto, il progetto Supabase con lo schema del vector store, e la validazione delle env vars — nessuna feature successiva può partire prima che questa sia completa.

---

## Validation

Usa lo schema Zod `envSchema` (esportato come `env` in `lib/env.ts`) definito in `tech-spec.md` §Environment Variables — non ridefinirlo qui né altrove. Nessun altro schema Zod è coinvolto in questa unit (non c'è ancora dato applicativo da validare).

---

## Implementation

1. **Scaffold Next.js**
   - Inizializza un progetto Next.js 16.3 in TypeScript, App Router.
   - Pinna `typescript@~6.0.x` esplicitamente in `package.json` — **non** lasciare che l'installazione risolva a TypeScript 7.0 (architecture-context.md, warning su `typescript-eslint` non ancora compatibile).
   - Crea la struttura cartelle base: `lib/rag/`, `lib/types.ts` (vuoto per ora, verrà popolato in `01-ingest.md`), `components/`, `app/api/`.

2. **Installa shadcn/ui**
   - Inizializza shadcn/ui con i primitive di default (Base UI, non Radix — cambio di default da luglio 2026, verificare che l'init lo rifletta).
   - Tailwind CSS configurato di conseguenza dall'init di shadcn/ui.
   - Non installare/generare componenti applicativi specifici in questa unit — solo l'init, i componenti concreti servono in `03-chat-ui.md`.

3. **Progetto Supabase**
   - Crea un progetto Supabase nuovo e dedicato (non riusare progetti di Remote NIF).
   - Abilita l'estensione `vector` (pgvector) **senza specificare una versione esplicita** — dal 5 agosto 2026 Supabase la ignora comunque e installa sempre la default (architecture-context.md).
   - Crea la tabella `document_chunks` e l'indice HNSW esattamente come definiti in `architecture-context.md` §Storage Model.

4. **Env config**
   - Crea `.env.local` seguendo il template in `tech-spec.md` §`.env.local` Template.
   - Crea `lib/env.ts` con lo schema Zod da `tech-spec.md` §Environment Variables (Invariant #5 — fail fast a startup se mancanti/malformate).
   - Popola `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` con i valori reali dal progetto Supabase creato allo step 3 (nomi aggiornati ago 2026 — Supabase ha ritirato `anon`/`service_role` per i nuovi progetti, vedi nota in `tech-spec.md` §Environment Variables).

5. **Account Upstash Redis**
   - Crea un database Upstash Redis (piano gratuito sufficiente per questo scope).
   - Popola `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` in `.env.local`.
   - Le chiavi devono superare la validazione Zod in `lib/env.ts`, ma non vengono ancora usate in nessuna route — l'integrazione vera è in `03c` (rate limiting).

---

## Dependencies

Installa: `shadcn` (CLI, via `npx`/init — non una dipendenza runtime persistente), `zod`, `@supabase/supabase-js`

---

## Scope Limits

- Nessun ingest di dati, nessuna riga scritta in `document_chunks` (quello è `01-ingest.md`).
- Nessuna chiamata reale a servizi di embeddings/generazione in questa unit — solo la env var validata, non testata funzionalmente (chiave OpenAI all'epoca, sostituita da `GEMINI_API_KEY` dopo `01b` — vedi `progress-tracker.md` §Architecture Decisions).
- Nessuna integrazione del rate limiting Upstash su una route — solo account/chiavi pronte.
- Nessun componente applicativo shadcn/ui installato — solo l'init del sistema.
- Nessun test automatizzato (unit/integration) in questo scope — decisione dichiarata, coerente con `project-overview.md` §Constraints (1-2 giorni di lavoro).
- Resta focalizzato sullo scaffold, lo schema DB e la validazione env — non sulla logica applicativa.

---

## Check When Done

- Il progetto Next.js 16.3 si avvia in locale (`npm run dev`) senza errori.
- `package.json` ha `typescript` pinnato su `~6.0.x`.
- shadcn/ui è inizializzato (file `components.json` presente, primitive Base UI).
- Il progetto Supabase esiste, l'estensione `vector` è abilitata, la tabella `document_chunks` e l'indice HNSW esistono (verificabili da Supabase dashboard o `psql`).
- `.env.local` contiene tutte le variabili richieste; `lib/env.ts` esporta `env` e lancia un errore chiaro se una variabile richiesta manca (verificabile rimuovendo temporaneamente una var e osservando il fail-fast).
- `npm run build` passa.
