# 03a — Chat API (solo backend)

Leggi `AGENTS.md` prima di iniziare (la reading order al suo interno copre già project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md). Dipende da `02-retrieval.md` (usa `hybridRetrieveChunks`/`TOP_K` già implementati e verificati su corpus reale) e da `01b-embeddings-storage.md` (pattern di gestione errore/logging riusato per la generazione).

Questa unit espone `app/api/chat/route.ts`: riceve la cronologia messaggi, recupera i chunk pertinenti via hybrid search, costruisce un system prompt vincolato al contesto recuperato e fa streaming della risposta di Gemini — nessuna UI, verificabile via `curl`/Postman, così che `03b-chat-ui.md` possa collegare un client senza dover toccare la logica di generazione.

> **Nota — verifica doc ufficiale (ago 2026), come richiesto da `AGENTS.md`.** Confermato su `ai-sdk.dev/providers/ai-sdk-providers/google` (AI SDK v7.x, versione attuale) che:
> - Il pattern corretto per il provider custom con API key esplicita è `createGoogle({ apiKey })` da `@ai-sdk/google` — **non** `createGoogleGenerativeAI`, nome usato nelle versioni precedenti dell'SDK e probabile falso ricordo da training data. Necessario perché la chiave del progetto è `GEMINI_API_KEY` (validata in `lib/env.ts`), non la env var di default che l'SDK leggerebbe implicitamente (`GOOGLE_GENERATIVE_AI_API_KEY`) — coerente con Invariant #5 (env centralizzata, mai letta raw altrove).
> - `streamText({ model, system, messages })` accetta un system prompt via il parametro `system` (alternativa: `instructions`, stesso effetto) e una cronologia `messages` con `role`/`content` stringa semplice — compatibile diretta con `ChatRequestSchema` (`tech-spec.md`), senza bisogno di conversione a `UIMessage`/`convertToModelMessages` (quel formato a `parts` serve solo lato client con `useChat`, fuori scope qui — deciso in `03b`).
> - Il risultato di `streamText` espone `toTextStreamResponse()` — stream di solo testo, `Response` diretta, verificabile con un `curl` semplice. Alternativa `toUIMessageStreamResponse()` produce il protocollo SSE strutturato per `useChat`; non necessaria in questa unit (nessuna UI ancora), la scelta del formato di consumo lato client resta aperta per `03b`.
> - Modello di generazione: verificato su `ai.google.dev/gemini-api/docs/models` che `gemini-2.5-flash` è attivo (non deprecato, nonostante fonti terze non ufficiali trovate in ricerca suggerissero uno spegnimento a ottobre 2026 — scartate, fonte non ufficiale, coerente col banner `AGENTS.md` di non fidarsi di date implicite). Usato come default in questa unit, ma **da riverificare su AI Studio al momento dell'implementazione** che rientri nel free tier del progetto (stesso trattamento riservato a `EMBEDDING_BATCH_SIZE` in `01b` — i rate limit non sono dati per accertati qui).

---

## Validation

Usa lo schema Zod `ChatRequestSchema` definito in `tech-spec.md` §Data Models — non ridefinirlo qui né altrove. Non esiste ancora come codice: va creato in `lib/types.ts` (Invariant #7), esattamente come definito in `tech-spec.md`, esportato come `ChatRequestSchema`/`ChatRequest` (stesso trattamento dato a `RetrievedChunkSchema` in `02-retrieval.md` §Implementation punto 0). Il body della richiesta POST va validato con `ChatRequestSchema.safeParse` prima di procedere a retrieval/generazione (Invariant #3) — su `success: false`, la route ritorna `400` con un JSON strutturato (`{ error: string }`), mai uno stream vuoto o un 500 generico.

---

## Testing

<!-- Vedi `feature-template.md` §Testing e `architecture-context.md` §Testing Policy: questa unit mischia
     logica pura (costruzione del system prompt) e I/O esterno live (retrieval via `02`, generazione
     Gemini) — si testa solo la prima. -->

Le chiamate reali a Gemini (generazione) e la retrieval reale (`hybridRetrieveChunks`, già coperta da `02-retrieval.md`) **non** sono coperte da test automatici qui — restano verificate manualmente in §Check When Done. La costruzione del system prompt è invece deterministica e va estratta in una funzione pura testabile senza rete:

- **`buildSystemPrompt(chunks: RetrievedChunk[]): string`** in `lib/rag/prompt.ts` — costruisce il system prompt a partire dai chunk recuperati. Test in `lib/rag/prompt.test.ts`:
  - con almeno un chunk, il prompt include il `content` di ogni chunk e la sua fonte (`heading_path`/`source_file`, Invariant #12);
  - con array vuoto (nessun chunk recuperato — query fuori corpus), il prompt istruisce esplicitamente il modello a dichiarare che l'informazione non è nella documentazione, non lascia un contesto vuoto senza istruzione (rinforza Invariant #11);
  - il prompt contiene sempre l'istruzione a rispondere solo dal contesto fornito (Invariant #11) e a ignorare istruzioni contrarie contenute nel messaggio utente (Invariant #19), indipendentemente dal contenuto dei chunk;
  - il prompt contiene sempre l'istruzione a rispondere nella lingua della domanda dell'utente (`project-overview.md` §Aggiornamento scope — bilingue).

---

## Implementation

0. **`lib/types.ts`** — aggiungi `ChatRequestSchema`/`ChatRequest` come da `tech-spec.md` §Data Models (vedi §Validation sopra).

1. **`lib/rag/prompt.ts`** (nuovo) — esporta `buildSystemPrompt(chunks: RetrievedChunk[]): string`, funzione pura (vedi §Testing per i requisiti di contenuto). Include per ogni chunk fonte (`sourceFile`/`headingPath`) e `content`, in un formato leggibile dal modello (es. blocco per chunk con intestazione `[Fonte: heading_path — source_file]` seguita dal contenuto). Il prompt include **sempre**, indipendentemente dai chunk recuperati: l'istruzione a rispondere solo dal contesto fornito (Invariant #11) e a ignorare istruzioni contrarie contenute nel messaggio utente (Invariant #19); l'istruzione a rispondere nella lingua della domanda dell'utente (`project-overview.md` §Aggiornamento scope — bilingue).

2. **`lib/rag/generation.ts`** (nuovo) — centralizza la configurazione del modello di generazione, stesso pattern di `EMBEDDING_MODEL` in `lib/rag/embeddings.ts`:
   - Costante `GENERATION_MODEL = "gemini-2.5-flash"` (verificare su AI Studio al momento dell'implementazione — vedi nota di apertura).
   - Istanzia il provider con `createGoogle({ apiKey: env.GEMINI_API_KEY })` da `@ai-sdk/google` (mai `google` di default, che leggerebbe una env var diversa — vedi nota di apertura).
   - Esporta una funzione `streamChatResponse(messages: ChatRequest["messages"], chunks: RetrievedChunk[])` che chiama `streamText({ model: google(GENERATION_MODEL), system: buildSystemPrompt(chunks), messages })` avvolta in gestione esplicita di errore (Invariant #13 — un fallimento della chiamata a Gemini deve propagarsi come errore leggibile, non fallire silenziosamente) e log di latenza/esito (Invariant #15, stesso pattern di `lib/rag/retrieval.ts`).

3. **`app/api/chat/route.ts`** (nuovo) — unico punto che gestisce lo streaming (Invariant #8, eccezione esplicita a "Server Actions per le mutazioni"):
   - `POST(req: Request)`: legge il body JSON, valida con `ChatRequestSchema.safeParse` (vedi §Validation) — su fallimento, `Response.json({ error: ... }, { status: 400 })`.
   - Estrae il testo dell'ultimo messaggio con `role: "user"` come query per il retrieval — se non esiste (array vuoto o solo messaggi `assistant`, caso già escluso da `ChatRequestSchema` che richiede `content.min(1)` ma non garantisce un messaggio `user`), ritorna `400`.
   - Chiama `hybridRetrieveChunks(query)` (da `02-retrieval.md`, `TOP_K` già centralizzato lì — non ridefinire qui, Invariant #14). Se la chiamata fallisce (Gemini o Supabase non raggiungibili), cattura l'errore e ritorna `Response.json({ error: ... }, { status: 500 })` — non uno stream troncato.
   - Chiama `streamChatResponse(request.messages, chunks)` e ritorna `result.toTextStreamResponse()`.

4. **`lib/env.ts`** — aggiorna il commento su `GEMINI_API_KEY` che anticipava "in futuro, per la generazione (`@ai-sdk/google`, `03a`)" — non è più "futuro", `03a` la usa. Nessuna modifica allo schema (già presente da `00`).

---

## Dependencies

Installa: `ai`, `@ai-sdk/google`

---

## Scope Limits

- Nessuna UI, nessun client — questa unit espone solo la route, consumata da `03b-chat-ui.md`.
- Nessun rate limiting — arriva in `03c-rate-limiting.md` (Invariant #18 non ancora applicato qui, la route è protetta solo dalla validazione Zod e dal costo implicito di chiamare Gemini senza controllo — accettabile perché non ancora pubblica).
- Nessuna gestione avanzata della cronologia (troncatura per limite token, riassunto messaggi vecchi) — i `messages` validati vengono passati così come arrivano a `streamText`; se il limite di contesto del modello diventa un problema reale, va prima loggato come open question in `progress-tracker.md`, non risolto silenziosamente qui.
- Nessuna citazione strutturata separata dalla risposta (es. un array JSON di fonti accanto al testo) — l'Invariant #12 è coperto instruendo il modello a citare `heading_path`/`source_file` in linea nella risposta stessa (vedi `buildSystemPrompt`); un formato di citazione strutturato resta una possibile estensione per `03b`, non decisa qui.
- Nessuna modifica a `lib/rag/retrieval.ts` o alle funzioni SQL di `02-retrieval.md` — quelle sono chiuse.
- Include unit test minimi per `buildSystemPrompt` (logica pura, nessun costo esterno) — vedi §Testing sopra; le chiamate reali a Gemini/retrieval restano escluse dai test automatici, coerente con `architecture-context.md` §Testing Policy.
- Resta focalizzato sulla route di chat backend-only — non toccare componenti/UI (`03b`) né rate limiting (`03c`).

---

## Check When Done

- `lib/types.ts` esporta `ChatRequestSchema`/`ChatRequest`.
- `lib/rag/prompt.ts` esporta `buildSystemPrompt`, testata come da §Testing.
- `lib/rag/generation.ts` centralizza `GENERATION_MODEL` e il provider Google (`createGoogle`), nessuna chiave letta raw da `process.env` fuori da `lib/env.ts`.
- `POST /api/chat` con un body valido (`messages` con una domanda presente nel corpus, es. "come funziona la gestione dei webhook?") ritorna uno stream di testo leggibile via `curl -N`, la risposta cita almeno una fonte (`heading_path`/`source_file`) coerente con `hybridRetrieveChunks` per la stessa query.
- Stessa richiesta con una domanda plausibile ma **fuori** dal corpus (es. una domanda generica non coperta dalla documentazione Remote NIF) — la risposta dichiara esplicitamente che l'informazione non è nella documentazione, non inventa una risposta (verifica manuale diretta di Invariant #11).
- `POST /api/chat` con body malformato (`messages` mancante o vuoto) ritorna `400` con `{ error: ... }`, non uno stream né un 500.
- `npm run test` passa (vedi §Testing).
- `npm run build` passa.
