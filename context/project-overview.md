# Project Overview — Knowledge Assistant

## Product Name

Knowledge Assistant (RAG)

## The User

Davide Sambughi — sviluppatore full-stack, unico utente/utilizzatore del tool.
Uso duplice:

1. Imparare RAG (embeddings, chunking, retrieval, generazione) costruendolo da zero, non solo dirigendolo.
2. Ottenere un artefatto da portfolio che dimostri competenza "Livello 3" (costruzione di pipeline LLM/RAG, non solo utilizzo di agenti AI per sviluppare più veloce).

## The Problem

Un chatbot generico (system prompt con testo incollato) non dimostra competenza tecnica reale su RAG, e non scala: non c'è retrieval verificabile, non c'è modo di controllare cosa "sa" davvero il modello vs cosa sta inventando. Serve un sistema dove la risposta sia tracciabile al contesto effettivamente recuperato da una ricerca semantica reale.

## What We're Building

**Descrizione:** Un chatbot standalone che risponde SOLO sulla base di un corpus di documenti markdown caricati (documentazione tecnica del progetto Remote NIF: README, spec, architettura).

**Core User Flow:**

1. Ingest: script che legge i file markdown, li divide in chunk semantici (per sezione/heading), genera embeddings, li salva su Supabase pgvector.
2. Query: l'utente scrive una domanda nella chat UI.
3. Retrieval: la domanda viene trasformata in embedding, si cercano i chunk più simili nel DB (similarity search).
4. Generazione: i chunk recuperati vengono passati come contesto al modello, che genera una risposta in streaming, basata SOLO su quel contesto.

**Features:**

- Script di ingest (chunking + embedding + storage)
- Ricerca semantica (retrieval) su Supabase pgvector
- Chat UI in Next.js con Vercel AI SDK, risposte in streaming
- ~~Bilingue IT/EN — UI tradotta (next-intl)~~ — RIVISTA (`03h`): UI fissa in inglese, lo switch IT/EN è stato rimosso (non influenzava comunque la risposta del modello, era fuorviante). Resta invariato: risposta del modello nella lingua della domanda dell'utente, indipendente dalla UI (vedi §Aggiornamento scope — bilingue)
- (Bonus, se il tempo lo permette) Un piccolo step agentico: tool use per interrogare una fonte esterna oltre ai documenti

## What We're NOT Building

- Nessuna autenticazione/utenti multipli (tool personale, uso singolo)
- Nessuna integrazione dentro il progetto Remote NIF esistente (repo/route separata)
- Nessun design system complesso: UI minimale, componenti shadcn/ui di default
- Nessun fine-tuning di modelli
- Nessuna gestione di corpus grandi o crescenti nel tempo (corpus fisso, piccolo, caricato una volta)
- Nessun re-ranking avanzato o pipeline di retrieval multi-step (a meno che si scopra necessario dopo aver visto i risultati)

## Success Criteria

- Il tool risponde correttamente a domande sulla documentazione di Remote NIF, citando/basandosi sui chunk effettivamente recuperati (non allucina)
- Davide è in grado di rispiegare con parole sue ogni decisione architetturale chiave (chunking strategy, embedding model, retrieval strategy) senza guardare il codice
- Il tool è deployabile e mostrabile pubblicamente nel portfolio, con link dal project-detail di Remote NIF

## Constraints

- **Tempo:** 1-2 giorni di lavoro
- **Stack:** TypeScript / Next.js / Supabase — niente Python
- **Scope architetturale:** progetto standalone, repo/route separata da Remote NIF; progetto Supabase nuovo e dedicato
- **Corpus:** documentazione markdown esistente di Remote NIF (100-700 righe/file, con blocchi mermaid)
- **Priorità:** capire ogni pezzo prima di andare avanti, non solo farlo funzionare — rallentare su decisioni architetturali, velocizzare su boilerplate

## Aggiornamento scope — bilingue (IT/EN)

Il portfolio di Davide è italiano/inglese — il tool deve essere presentabile in entrambe le lingue. Il corpus (documentazione Remote NIF) resta **solo in italiano**, non viene tradotto. Due parti separate, sforzo basso su entrambe:

1. ~~**UI** — stringhe minime..., gestite con `next-intl`, 2 file messaggi (`it.json`/`en.json`)~~ — RIVISTA (`03h`): lo switch IT/EN in UI è stato rimosso (fuorviante — non influenzava la risposta del modello, unica cosa che segue la lingua della domanda). UI fissa in inglese (`messages/en.json`), infrastruttura `next-intl` mantenuta per un eventuale multi-locale futuro.
2. **Risposta del modello** — il system prompt istruisce il modello a rispondere nella lingua della domanda dell'utente, basandosi comunque solo sui chunk recuperati (rinforza Invariant #11/#19 di `architecture-context.md`, non li sostituisce). **Nota — claim non riverificato dopo il passaggio a Gemini (vedi `progress-tracker.md` §Architecture Decisions):** questa riga assumeva originariamente `text-embedding-3-small` (OpenAI) per il retrieval cross-linguale (query in inglese → chunk italiani pertinenti) su un corpus tecnico con vocabolario in gran parte condiviso EN/IT. Il progetto usa `gemini-embedding-001` dal `01b` — nessuna modifica alla pipeline di ingest/retrieval è stata necessaria per il cambio di provider, ma il comportamento cross-linguale specifico non è mai stato testato con il nuovo modello. Tracciato come open question in `progress-tracker.md`, da verificare con una query reale in inglese prima di considerarlo un fatto accertato.

Non in scope: traduzione del corpus, contenuti duplicati IT/EN nel DB, rilevamento lingua lato UI (la lingua della UI è una preferenza utente esplicita, non auto-detected).

## Aggiornamento scope (dopo ricerca ago 2026)

Naive RAG da solo è considerato solo il livello base/didattico nel 2026, non la pratica di produzione. Scope aggiornato:

1. **Naive RAG resta il core** da capire bene (non cambia) — necessario per capire le basi
2. **Hybrid search** (ricerca vettoriale + keyword/full-text search, fuse insieme) aggiunto come primo upgrade realistico dentro i 2 giorni — è l'upgrade a più alto impatto e più economico secondo le fonti attuali, fattibile nativamente con Supabase (Postgres full-text search) senza servizi esterni aggiuntivi
3. **Agentic RAG resta fuori scope pratico** per i 2 giorni (troppo oneroso da costruire bene in questo tempo), ma va capito a sufficienza da poterlo discutere in un colloquio come "prossimo step naturale" del progetto

## Aggiornamento scope — testing mirato

Le prime feature-spec (`00`, `01a`) escludevano di default ogni test automatizzato, motivandolo con §Constraints ("1-2 giorni di lavoro"). Cambiato: ogni unit ora valuta esplicitamente se include unit/integration test — non più escluso di default (dettagli tecnici in `architecture-context.md` §Testing Policy, framework Vitest).

Non è un'estensione generalizzata dello scope: resta mirato solo a logica deterministica testabile senza costi esterni (parsing, validazione, trasformazioni dati — es. `chunkMarkdownFile` in `01a`) o a invariant di sicurezza. Chiamate reali a Gemini o scritture reali su Supabase restano **escluse** dai test automatici (costo/servizio esterno live) e continuano a essere verificate manualmente — coerente con §Constraints, il tempo aggiuntivo per questo testing mirato è marginale rispetto a testare l'intera pipeline end-to-end.
