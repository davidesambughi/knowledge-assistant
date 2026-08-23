# Feature List — Knowledge Assistant

<!-- Linea guida di sviluppo, da inizio a fine. Ogni riga diventerà una feature-spec
     (`feature-specs/NN-nome.md`) scritta con prompt dedicato usando `00-template.md`.
     Il numero definisce l'ordine di build/dipendenza. Modifiche in corso d'opera sono
     normali — vanno documentate in `progress-tracker.md`, non fatte silenziosamente
     (vedi ai-workflow-rules.md §Gestione dei Requisiti Mancanti). -->

## 00 — Project Setup & Environment

- **00a — Scaffold & dependencies**
  Init Next.js 16, pin `typescript@~6.0.x` (architecture-context.md — warning TS7), installa shadcn/ui (Base UI default), Tailwind, crea struttura cartelle base (`lib/rag/`, `components/`, `app/`).

- **00b — Supabase project & schema**
  Crea progetto Supabase dedicato, abilita estensione pgvector (nessuna versione hardcoded, vedi nota ago 2026 in architecture-context.md), crea tabella `document_chunks` + indice HNSW.

- **00c — Env config & validation**
  `.env.local` da template in `tech-spec.md`, `lib/env.ts` con Zod schema (Invariant #5, fail fast), account Upstash Redis (chiavi pronte, non ancora usate — servono in 03c).

_Dipendenza: nessuna. Blocca tutto il resto._

---

## 01 — Ingest Pipeline

- **01a — Markdown parsing & chunking**
  Legge il corpus Remote NIF, divide per heading, blocco mermaid mai spezzato tra due chunk (Invariant #16), ogni chunk porta il proprio heading-prefix (Invariant #17). Output: oggetti chunk grezzi, **senza embeddings**.

- **01b — Embeddings & storage**
  `lib/rag/embeddings.ts` (wrapper chiamate Gemini, gestione errore/timeout esplicita — Invariant #13; originariamente OpenAI, cambiato dopo `01b` per mancanza di free tier reale — vedi `progress-tracker.md`), `lib/rag/ingest.ts` orchestrazione: chunk → embedding → scrittura su `document_chunks`. Esecuzione una tantum sul corpus, verifica row count / spot-check.

_Dipendenza: 00b (tabella deve esistere), 00c (OPENAI_API_KEY validata)._

---

## 02 — Retrieval

- **02a — Naive similarity search**
  `lib/rag/retrieval.ts`, cosine similarity via pgvector, valida output con `RetrievedChunkSchema`, top-k centralizzato e configurabile (Invariant #14, mai hardcoded in più punti).

- **02b — Hybrid search upgrade**
  Aggiunge Postgres full-text search, fusione con i risultati vettoriali (es. Reciprocal Rank Fusion). Stessa forma di output di 02a (`RetrievedChunkSchema` invariato).

_Dipendenza: 01b (serve `document_chunks` popolata per testare risultati reali)._

---

## 03 — Chat API & UI

- **03a — Chat API route (solo backend)**
  `app/api/chat/route.ts`, valida input con `ChatRequestSchema`, chiama retrieval, costruisce system prompt vincolato al contesto recuperato (Invariant #11 — mai da conoscenza propria — e #19 — resistenza a prompt injection) **+ istruzione a rispondere nella lingua della domanda dell'utente** (project-overview.md §Aggiornamento scope — bilingue), streaming via AI SDK. Testabile via curl/Postman, nessuna UI ancora.

- **03b — Chat UI**
  Client component con `useChat` hook, lista messaggi, input, stati di loading/streaming, citazione fonte (`heading_path`/`source_file`, Invariant #12). UI bilingue IT/EN via `next-intl` (project-overview.md §Aggiornamento scope — bilingue) — **verifica doc ufficiale next-intl aggiornata ad ago 2026 prima di implementare, vedi banner in `AGENTS.md`**, non fidarsi di pattern da training data. Solo componenti shadcn/ui di default, nessun design custom (project-overview.md — no design system complesso).

- **03c — Rate limiting**
  Integrazione Upstash Redis su `/api/chat`, limite per IP (Invariant #18), errore gestito in modo leggibile lato UI in caso di limite raggiunto.

_Dipendenza: 02b (retrieval completo, hybrid incluso) per 03a. 03b dipende da 03a (route deve rispondere). 03c può essere fatta in parallelo a 03b ma va verificata prima del deploy pubblico._

---

## 03d — Security Review (pre-deploy)

Checkpoint dedicato prima dell'esposizione pubblica dell'endpoint. Contenuto specifico **non definito qui apposta** — le best practice aggiornate ( controlla online agosto 2026 !) per endpoint AI/chat pubblici (prompt injection avanzata, limiti su lunghezza/costo del singolo messaggio oltre al rate limit per IP, gestione errori che non esponga dettagli interni, logging per rilevare abuso) vanno verificate con una ricerca dedicata al momento di scrivere questa spec, coerente col banner in `AGENTS.md` (non fidarsi della sola memoria di training su materia che evolve in fretta). Copre anche una verifica incrociata degli Invariants #18-20 già in `architecture-context.md`. cercao nline per qualsiasi possibile attacco e vulnerabilita .
_Dipendenza: 03c completata. Blocca 04a — nessun deploy pubblico prima di questo checkpoint._

---

## 03i — Gemini Quota / Pre-stream Error Handling

<!-- Nota grezza da conversazione con un altro LLM (2026-08-23), da rifinire prossima sessione —
     vedi progress-tracker.md §Open Questions per i dettagli non ancora decisi. -->

Oggi se Gemini fallisce **prima** che parta lo streaming (es. quota gratuita esaurita), quel fallimento non è catturato da nessun try/catch in `app/api/chat/route.ts` — il client vedrebbe un errore grezzo/generico invece di un `{ error: "..." }` pulito. Fix: try/catch mancante attorno alla chiamata che innesca `streamChatResponse`/l'avvio dello stream, con riconoscimento specifico dell'errore di quota (non trattato come errore generico) per un messaggio onesto tipo "demo momentaneamente al limite di utilizzo gratuito, riprova più tardi" invece di un errore tecnico confuso.

_Dipendenza: 03a/03d (route e gestione errori esistenti). Da rifinire (dettaglio esatto del try/catch, come si riconosce l'errore di quota) prima di implementare — vedi Open Questions._

---

## 04 — Project Overview Panel (recruiter-facing)

<!-- Idea grezza, da rifinire prima di scrivere una feature-spec vera e propria — vedi
     progress-tracker.md per lo stato di raffinamento. Numerata prima del deploy perché deve
     essere già presente nella preview live linkata dal portfolio, non un'aggiunta post-hoc. -->

- **04a — Overview panel: contenuto e layout**
  Pannello esplicativo in colonna (destra o sinistra, da decidere in fase di design — layout attuale è a singola colonna) accanto alla chat: cos'è il progetto in linguaggio semplice + punti tecnici principali (chunking, hybrid search, guardrail Invariant #11, rate limiting, stack) per chi legge da ingegnere. Contenuto derivato da `project-overview.md`/`progress-tracker.md`, non reinventato. Nessuna nuova pipeline dati — solo presentazione statica.
  **Eccezione bilingue (confermata 2026-08-23):** solo questo pannello è bilingue IT/EN (proprio switch/testo dedicato) — non è un ripristino di `LocaleSwitch`/`03h`, che resta rimosso: il resto della UI (chat, header) resta fisso in inglese.

_Dipendenza: 03h (UI corrente stabile). Da rifinire in una feature-spec dedicata prima dell'implementazione — incluso come implementare lo switch bilingue solo per questo pannello senza reintrodurre `next-intl` a livello di UI generale._

---

## 05 — Deploy & Portfolio Wiring

- **05a — Deploy su Vercel**
  Env vars su dashboard Vercel, verifica che nessuna chiave privilegiata sia esposta lato client (Invariant #20), smoke test in produzione. **Dettagli aggiunti 2026-08-23 (nota grezza, da rifinire):**
  - Repo non ancora su GitHub — serve creare il repo remoto e fare il push prima del collegamento a Vercel (git locale già inizializzato, commit iniziale presente, nessun remote configurato).
  - Progetto Vercel collegato al repo GitHub (non deploy manuale via CLI) — così ogni push futuro rideploya automaticamente.
  - Sottodominio dedicato su dominio già esistente `davidesambughi.dev` (Porkbun, già in uso per il portfolio live su un progetto Vercel separato — nessuna condivisione/interferenza): nuovo record CNAME su Porkbun che punta al progetto Vercel del Knowledge Assistant. Nome esatto del sottodominio non ancora deciso (es. `kb.davidesambughi.dev`).

- **05b — Collegamento portfolio**
  Link dal project-detail di Remote NIF, README del repo che spiega l'approccio RAG per chi lo guarda da fuori.

_Dipendenza: 03d (security review chiusa prima di esporre pubblicamente un endpoint che costa). 03i (gestione errore quota) andrebbe chiusa prima dello smoke test pubblico — un errore di quota grezzo davanti a un recruiter è peggio che assente. 04 (overview panel) deve essere presente prima dello smoke test pubblico, non necessariamente completo prima di iniziare 05a._

---

## 06 — Learning Synthesis (non-code)

Sintesi finale da riusare per portfolio/CV/colloqui: ogni decisione architetturale chiave (chunking, embedding model, retrieval strategy, hybrid search) ri-spiegata con parole tue, senza guardare il codice — verifica diretta del Success Criteria in `project-overview.md`.

_Dipendenza: tutto il resto completato._

---

## Fuori scope — solo tracciato

- **Agentic RAG (bonus)** — tool use / chiamata a fonte esterna oltre ai documenti. Si prova _solo_ se 00→05 sono completi e resta tempo. Se non si arriva a costruirlo, resta come open question / prossimo step in `progress-tracker.md`, utile per narrativa da colloquio (vedi note-concetti-rag.md §Scala evolutiva).
