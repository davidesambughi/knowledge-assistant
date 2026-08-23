# 03i — Gestione Errore Quota Gemini (Chat Generation)

Leggi `AGENTS.md` prima di iniziare (la reading order al suo interno copre già project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md). Dipende da `03a-chat-api.md` (route/generation esistenti), `03d-security-review.md` (pattern di errori generici già in `route.ts`) e `03b-chat-ui.md` (stato `error` di `useChat` in `app/page.tsx`).

Intercetta un fallimento di generazione Gemini **prima** che la risposta in streaming raggiunga il client (tipicamente quota gratuita esaurita) e mostra un messaggio onesto e specifico invece di un body vuoto/errore generico — sia lato API sia, effettivamente, nella UI.

---

## Nota tecnica verificata (da leggere prima di implementare)

<!-- Non assumere il formato dell'errore, come segnalato in progress-tracker.md §Open Questions —
     questa sezione documenta cosa è stato verificato leggendo i sorgenti installati, non la doc web. -->

- `streamText()` (pacchetto `ai@7.x`) **non lancia mai in modo sincrono** un errore di rete/API: ritorna subito un `DefaultStreamTextResult` costruito sincronamente (verificato in `node_modules/ai/dist/index.js`). Un fallimento della chiamata a Gemini (inclusa quota esaurita) emerge più tardi come un "part" di tipo `"error"` dentro `result.fullStream`/`result.stream` — **non** come eccezione sincrona dalla chiamata a `streamChatResponse(...)`. Un try/catch attorno a quella sola chiamata non lo cattura.
- Per intercettarlo prima di iniziare la risposta al client, serve leggere (peek) il **primo** elemento di `result.fullStream` prima di decidere se avviare `createTextStreamResponse`/`toTextStream` o restituire un errore JSON.
- L'errore Gemini, tramite il provider `@ai-sdk/google`, arriva come `APICallError` (esportato da `"ai"`, verificato in `node_modules/@ai-sdk/provider/dist/index.js`), con:
  - `.statusCode` — `429` per quota esaurita (schema standard AI SDK: `isRetryable` è già `true` per 429);
  - `.data` — corpo dell'errore Google (`googleErrorDataSchema`, verificato in `node_modules/@ai-sdk/google/dist/index.js`): `{ error: { code, message, status, details } }`, dove `status` è la stringa Google (es. `"RESOURCE_EXHAUSTED"` per quota).
- Riconoscimento robusto: `APICallError.isInstance(error) && (error.statusCode === 429 || error.data?.error?.status === "RESOURCE_EXHAUSTED")`.
- **La UI oggi ignorerebbe comunque un messaggio server pulito**: verificato leggendo direttamente `app/page.tsx` (righe 63-66 al momento di questa spec) — mostra sempre la stringa fissa `t("streamError")` quando `error` (da `useChat`) è presente, mai il testo reale della risposta HTTP. Questa unit include quindi anche il minimo necessario lato client per mostrare davvero il messaggio, altrimenti il fix sarebbe invisibile all'utente finale (solo verificabile via curl).
- **Cosa finisce in `error.message` di `useChat` su una risposta non-2xx** (verificato in `node_modules/ai/dist/index.js`, classe `HttpChatTransport.sendMessages`, da cui `TextStreamChatTransport` eredita — usata in `app/page.tsx`): `if (!response.ok) { throw new Error((await response.text()) ?? "Failed to fetch the chat response."); }`. L'errore risale invariato fino allo stato esposto da `useChat` (`setStatus({ status: "error", error: err })`, nessun wrapping intermedio). Per una risposta `Response.json({ error: "..." }, { status: 503 })`, `error.message` sarà quindi esattamente la stringa `'{"error":"..."}'` — il body grezzo. `extractServerErrorMessage` deve fare `JSON.parse(rawMessage)` e leggere il campo `.error` su quel valore, non su una stringa già pulita.

---

## Validation

Nessuno schema Zod nuovo. Riusa il formato ad-hoc `{ error: string }` già usato in tutte le risposte di errore esistenti di `app/api/chat/route.ts` (non validato via Zod in uscita, coerente con il codice attuale).

---

## Testing

<!-- Logica pura, testabile senza chiamate reali a Gemini — coerente con architecture-context.md §Testing Policy. -->

- `isQuotaExceededError(error: unknown): boolean` (`lib/rag/generation.ts`) — unit test con:
  - un `APICallError` fabbricato con `statusCode: 429` → `true`
  - un `APICallError` fabbricato con `data: { error: { status: "RESOURCE_EXHAUSTED" } }` e `statusCode` diverso da 429 → `true`
  - un `APICallError` con `statusCode: 500` e nessun `RESOURCE_EXHAUSTED` in `data` → `false`
  - un errore generico (`new Error(...)`, non `APICallError`) → `false`
  - `undefined`/`null` → `false`
- `buildStreamOrErrorResult` (nome definitivo a scelta di chi implementa, vedi Implementation) — testabile iniettando uno stream fabbricato (non un vero `streamText`) che emette un primo part `{ type: "error", error: <APICallError fabbricato> }`: verifica che ritorni `{ ok: false, message: QUOTA_EXCEEDED_MESSAGE }` per quota, un messaggio generico per un errore non di quota, e che ricostruisca correttamente uno stream identico all'originale (nessun chunk perso) quando il primo part è testo normale.
- `extractServerErrorMessage(rawMessage: string | undefined): string | undefined` (`lib/chat/ui-helpers.ts`) — unit test con: JSON valido `'{"error":"x"}'` → `"x"`; stringa non-JSON → `undefined`; JSON valido ma senza campo `error` → `undefined`; `undefined` → `undefined`.
- **Esplicitamente non testato automaticamente**: una vera quota Gemini esaurita (richiederebbe consumare davvero il free tier) — verificato manualmente forzando il ramo di errore con dati fabbricati, non con una chiamata reale (vedi Check When Done).

---

## Implementation

1. **`lib/rag/generation.ts`**
   - Import `APICallError` da `"ai"`.
   - Aggiungi costante esportata `QUOTA_EXCEEDED_MESSAGE` (inglese — vedi nota lingua sotto), es. `"This demo has hit its free-tier usage limit for now. Please try again later."`.
   - Aggiungi funzione pura esportata `isQuotaExceededError(error: unknown): boolean` che implementa il riconoscimento descritto in §Nota tecnica verificata.
   - Aggiungi funzione esportata (nome a scelta, es. `resolveChatStream`) che, dato il `result` ritornato da `streamChatResponse`:
     - ottiene un reader da `result.fullStream`;
     - legge il primo elemento;
     - se è `{ type: "error", error }`: chiama `reader.cancel()`, ritorna `{ ok: false, message: isQuotaExceededError(error) ? QUOTA_EXCEEDED_MESSAGE : <messaggio generico esistente, stesso testo usato oggi per gli errori 500> }`;
     - altrimenti: ricostruisce un nuovo `ReadableStream` che riemette il primo elemento letto e poi continua a leggere dallo stesso `reader` fino a `done`, e ritorna `{ ok: true, stream: <quel nuovo stream> }`.
   - Logga (Invariant #15) il ramo quota separatamente da un errore generico non riconosciuto, per poterli distinguere nei log.

2. **`app/api/chat/route.ts`**
   - Avvolgi la chiamata `const result = streamChatResponse(messages, chunks);` in un try/catch (gap reale oggi: un throw sincrono da `generation.ts` risalirebbe non gestito) — su errore, stesso trattamento 500 generico già usato per il retrieval.
   - Dopo aver ottenuto `result`, chiama la nuova funzione di risoluzione stream.
   - Se `ok: false`: `Response.json({ error: message }, { status: 503 })` (503, non 429, per non confondersi con il rate limit di `03c` che è già un 429 — è un limite dell'upstream Gemini, non del client).
   - Se `ok: true`: comportamento invariato, `createTextStreamResponse({ stream: toTextStream({ stream: <stream ricostruito> }) })`.

3. **`lib/chat/ui-helpers.ts`**
   - Aggiungi funzione pura esportata `extractServerErrorMessage(rawMessage: string | undefined): string | undefined` che tenta `JSON.parse(rawMessage)` e, se il risultato ha la forma `{ error: string }`, ritorna quella stringa; altrimenti `undefined` (mai un throw).

4. **`app/page.tsx`**
   - Dove oggi si mostra incondizionatamente `t("streamError")` quando `error` è presente: calcolare `extractServerErrorMessage(error?.message)` e mostrare quel valore se definito, altrimenti fallback su `t("streamError")` (comportamento invariato per errori non riconosciuti, es. un vero errore di rete del browser che non ha mai raggiunto `route.ts`).

---

## Dependencies

Nessuna nuova dipendenza — `APICallError` è già esportato da `"ai"` (installato).

---

## Scope Limits

- Non risolve il limite noto di errore-a-metà-streaming (chiuso in `03d-security-review.md` come rischio residuo accettato): questa unit copre solo un fallimento **prima** dell'invio del primo chunk reale al client. Un fallimento dopo che lo streaming è già iniziato resta invisibile lato client, invariato.
- Nessun retry automatico (né server né client) sul fallimento di quota.
- Non uniforma la lingua degli altri messaggi di errore ad-hoc già presenti in `route.ts` (restano in italiano: rate limit, origin, validazione, retrieval) — restano non mostrati testualmente all'utente (la UI mostra sempre un testo fisso o, ora, il nuovo messaggio quota). Solo `QUOTA_EXCEEDED_MESSAGE` è in inglese, perché è il primo messaggio server a essere effettivamente visualizzato verbatim in una UI fissa in inglese (`03h`). Non è una scelta di scope creep verso l'uniformare tutto: resta un'incongruenza pre-esistente, non toccata qui.
- Nessuna icona o stile visivo dedicato per l'errore di quota — riusa lo stesso contenitore `<p>` di errore già esistente in `app/page.tsx` (`03e`), cambia solo il testo mostrato.
- Include test unitari minimi (logica pura, nessuna chiamata reale) — non escluso di default, vedi §Testing.
- Resta focalizzato sulla gestione dell'errore pre-stream della generazione; non tocca retrieval (`hybridRetrieveChunks`, già gestito), rate limiting (`03c`, invariato) o il system prompt (`03g`, invariato).

---

## Check When Done

- `isQuotaExceededError` ritorna `true`/`false` correttamente sui casi elencati in §Testing.
- Con un fallimento fabbricato (non una vera quota Gemini) che simula il primo part di tipo `"error"` con dati di quota, `POST /api/chat` ritorna `503` con body `{ "error": "<QUOTA_EXCEEDED_MESSAGE>" }`, non un body vuoto né un 500.
- Con lo stesso scenario, la UI mostra il testo di `QUOTA_EXCEEDED_MESSAGE` nel banner di errore, non il generico `streamError`.
- Una richiesta normale (nessun errore) produce lo stesso streaming di testo identico a prima del fix — nessun chunk perso o duplicato dal meccanismo di peek (verifica manuale via curl e via UI, come già fatto in `03a`/`03b`).
- Un fallimento sincrono fabbricato di `streamChatResponse` (es. config invalida) risulta ora in un 500 gestito da `route.ts`, non in un'eccezione non catturata.
- `npm run test` passa.
- `npm run build` passa.
