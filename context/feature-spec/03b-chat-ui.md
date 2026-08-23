# 03b — Chat UI

Leggi `AGENTS.md` prima di iniziare (la reading order al suo interno copre già project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md). Dipende da `03a-chat-api.md` (route `/api/chat` già implementata e verificata via curl — questa unit la consuma così com'è, **nessuna modifica a `app/api/chat/route.ts`, `lib/rag/generation.ts` o `ChatRequestSchema`**, vedi §Implementation punto 2 per il perché).

Questa unit costruisce l'interfaccia chat in `app/page.tsx`: lista messaggi, input, stati di loading/streaming, citazione fonte visibile nella risposta, UI bilingue IT/EN — il primo punto in cui il tool diventa usabile da un utente reale invece che da `curl`.

> **Nota — verifica doc ufficiale (15 ago 2026), come richiesto da `AGENTS.md`.** Confermato su `ai-sdk.dev`:
>
> - `useChat` si importa da `@ai-sdk/react` (non da `ai`) — pacchetto non ancora installato, va aggiunto (§Dependencies). `DefaultChatTransport`/`TextStreamChatTransport` si importano da `ai`.
> - La route `03a` ritorna testo semplice via `createTextStreamResponse`/`toTextStream` (protocollo _text stream_, non il _data stream_/SSE che è il default di `useChat`). Per consumarlo va passato esplicitamente `transport: new TextStreamChatTransport({ api: "/api/chat" })` — **limite dichiarato in doc**: il protocollo text-stream non porta tool call, `usage`, `finishReason` né una parte strutturata "sources" nei `message.parts`. Non è un problema qui: Invariant #12 (citazione fonte) è già coperto in `03a` istruendo il modello a citare `heading_path`/`source_file` **dentro il testo della risposta** (vedi `lib/rag/prompt.ts::buildSystemPrompt`), non come metadato separato — la UI si limita a renderizzare il testo del messaggio così com'è, nessuna UI di citazione strutturata (deciso qui, chiudendo il punto lasciato aperto in `03a-chat-api.md` §Scope Limits).
> - `useChat` gestisce lo stato tramite `messages` (formato `UIMessage`, con `parts`, non `content` stringa), `sendMessage`, `status` (`"submitted" | "streaming" | "ready" | "error"`), `error`, `stop`, `regenerate`.
> - **Limite noto confermato in doc, non solo per analogia con `03a`**: con il text stream protocol, un fallimento a metà stream (es. Gemini cade dopo l'invio degli header) **non** porta `status` a `"error"` né popola `error` — lo stream finisce semplicemente prima, `status` torna a `"ready"` come se fosse andato tutto bene. Coerente con l'open question già in `progress-tracker.md`: la UI deve trattare esplicitamente una risposta assistente vuota/troncata come caso di errore, il transport non lo segnala da solo (vedi §Implementation punto 4).
> - `next-intl` (`next-intl.dev`, verificato ago 2026) supporta un setup **senza i18n routing** (nessun segmento `[locale]`, nessun middleware di routing) — locale letta da un cookie (`NEXT_LOCALE` di default) invece che dall'URL, cambiata via un piccolo switch lato client che aggiorna il cookie e forza un refresh. Scelto questo setup, non il routing con `[locale]` nell'URL — vedi §Implementation punto 1 per il perché.

---

## Validation

Usa lo schema Zod `ChatRequestSchema` definito in `tech-spec.md` §Data Models — non ridefinirlo qui né altrove, e **non modificarlo**: resta `{ messages: { role: "user" | "assistant", content: string }[] }`, esattamente come chiuso in `03a`. `useChat` produce `UIMessage[]` (formato `parts`), non `ChatRequestSchema["messages"]` direttamente — la conversione tra i due è responsabilità di questa unit (vedi §Implementation punto 2), non della route.

---

## Design

Una singola pagina (`app/page.tsx`, sostituisce lo scaffold di `create-next-app`), nessun routing aggiuntivo, coerente con `project-overview.md` ("nessun design system complesso: UI minimale, componenti shadcn/ui di default").

**Layout:**

- Header minimale: titolo del tool + switch lingua UI (IT/EN, due bottoni o un toggle — nessun dropdown complesso).
- Area messaggi: lista verticale scrollabile, bolla utente vs bolla assistente distinte solo da allineamento/colore token (Invariant #10 — niente colori raw), testo della risposta assistente renderizzato come testo semplice (nessun parser Markdown — fuori scope, vedi §Scope Limits).
- Stato di streaming: mentre `status === "streaming"`, mostra un indicatore semplice (es. tre puntini o spinner shadcn) sull'ultimo messaggio assistente in costruzione — non un componente custom elaborato.
- Input: singolo campo testo + bottone invio in fondo alla pagina, disabilitato quando `status !== "ready"` (coerente col pattern documentato di `useChat`).
- Errore: se `status === "error"` (fallimento di rete/trasporto) o se la UI rileva una risposta assistente vuota dopo la fine dello stream (vedi nota sul limite del text-stream protocol sopra), mostra un messaggio di errore inline sotto l'ultimo messaggio, non un toast/modal.

**Componenti shadcn/ui da aggiungere** (solo `button.tsx` è presente oggi, via `npx shadcn@latest add <nome>` — verificare i nomi esatti dei componenti disponibili in `base-nova` al momento dell'implementazione, non assumerli dal training data): un componente input testo e un componente per lo scroll dell'area messaggi. Nessun componente aggiuntivo oltre a questi due + `button` già presente — niente card, niente avatar, niente componenti decorativi non richiesti.

**Cosa NON include questo design:** nessun tema chiaro/scuro selezionabile dall'utente (il progetto usa già `dark:` di Tailwind per `prefers-color-scheme`, non serve un toggle dedicato), nessuna sidebar/cronologia conversazioni multiple (una sola conversazione per sessione, si perde al reload — non richiesto da `project-overview.md`), nessuna persistenza dei messaggi (né localStorage né DB).

---

## Testing

<!-- Vedi `feature-template.md` §Testing e `architecture-context.md` §Testing Policy: questa unit è
     in gran parte UI/componenti React (non testata automaticamente in questo progetto, vedi
     `architecture-context.md` §Testing Policy — nessun setup jsdom previsto), ma introduce due
     funzioni pure di conversione dati che vanno testate senza rete/UI. -->

- **`toChatRequestMessages(messages: UIMessage[]): ChatRequest["messages"]`** in `lib/chat/messages.ts` — converte i messaggi `UIMessage` (formato `parts`) prodotti da `useChat` nel formato `{ role, content }` atteso da `ChatRequestSchema`/`03a` (vedi §Implementation punto 2). Test in `lib/chat/messages.test.ts`:
  - un messaggio con una sola `part` di tipo `"text"` diventa `{ role, content: <testo della part> }`;
  - più `parts` di tipo `"text"` nello stesso messaggio vengono concatenate in un singolo `content` (comportamento che la UI di questa unit non produce mai da sola, dato che l'input è un singolo campo testo, ma la funzione non deve assumerlo — deve restare corretta per l'input che riceve);
  - un messaggio con `role` diverso da `"user"`/`"assistant"` (es. `"system"`, che `UIMessage` permette ma `ChatRequestSchema` no) viene scartato, non fatto fallire la validazione a valle;
  - un messaggio (di qualunque ruolo) il cui testo risulta vuoto/whitespace dopo la conversione viene **scartato dall'array risultato, non incluso come `content: ""`** — copre il bug multi-turno descritto sotto: `ChatRequestSchema.messages[].content` richiede `z.string().min(1)` (Invariant #3, chiuso in `03a`, non toccato qui); se un turno precedente produce una risposta assistant vuota/troncata (limite noto del text-stream protocol, vedi nota di apertura), quel messaggio resta comunque nello storico `useChat` — senza questo filtro, il turno _successivo_ lo rimanderebbe al server con `content: ""`, fallendo la validazione Zod e bloccando l'intera conversazione, non solo il turno fallito. Decisione esplicita (non un limite accettato in silenzio): i messaggi vuoti non vengono mai inviati al server, in nessuna posizione dello storico.
- **`isEmptyAssistantResponse(message: UIMessage): boolean`** in `lib/chat/messages.ts` — usata per rilevare lato client il caso "stream terminato senza contenuto" (vedi nota su limite text-stream protocol sopra e §Implementation punto 4). Test in `lib/chat/messages.test.ts`:
  - un messaggio assistente con `parts` vuoto o con solo testo vuoto/whitespace ritorna `true`;
  - un messaggio assistente con testo non vuoto ritorna `false`.

---

## Implementation

1. **`next-intl`** — setup **senza i18n routing** (nessun `[locale]` nell'URL, nessun middleware di routing — scelto perché il tool ha una singola pagina, nessun bisogno di URL localizzati per SEO, e `project-overview.md` richiede esplicitamente che la lingua sia "una preferenza utente esplicita, non auto-detected", non instradata via URL):
   - `messages/it.json` e `messages/en.json` con le poche stringhe UI necessarie (titolo, placeholder input, bottone invio, label errore, label switch lingua) — nessuna stringa per la risposta del modello (quella resta nella lingua della domanda, già gestito lato system prompt in `03a`).
   - File di request-config per next-intl (path esatto da confermare in base alla struttura del progetto — qui senza `src/`, verificare la convenzione corrente su `next-intl.dev` invece di assumerla) che legge il cookie locale (default `NEXT_LOCALE`) con fallback a `it` come lingua di default.
   - `next.config.ts` avvolto con il plugin next-intl.
   - `app/layout.tsx` avvolge `children` nel provider client di next-intl, passando i messaggi risolti server-side.

2. **`lib/chat/messages.ts`** (nuovo) — esporta `toChatRequestMessages` e `isEmptyAssistantResponse` (funzioni pure, vedi §Testing per i requisiti esatti). Nessuna dipendenza da rete/React qui — solo trasformazione dati, riusata sia dal componente chat (punto 3) sia dai test.
   - **Perché la conversione vive qui e non nella route (`03a`)**: `useChat` invia di default messaggi in formato `UIMessage` (`{ role, parts }`), mentre `ChatRequestSchema` — già chiuso e verificato in `03a` — si aspetta `{ role, content: string }`. La conversione avviene lato client, tramite l'opzione `prepareSendMessagesRequest` del transport (o equivalente — verificare l'API esatta su `ai-sdk.dev` al momento dell'implementazione, non assumerla dal training data), che chiama `toChatRequestMessages` prima di costruire il body della richiesta POST. Scelto per non riaprire `03a`/`tech-spec.md` (già chiusi e verificati end-to-end) per un cambio di formato che la UI può assorbire da sola.
   - **`toChatRequestMessages` scarta i messaggi con `content` vuoto dopo la conversione** (vedi §Testing per il caso esatto) — necessario perché una risposta assistant vuota/troncata (limite noto del text-stream protocol, punto 4 sotto) resta nello storico `useChat`; senza questo filtro verrebbe rimandata al server come `content: ""` al turno successivo, violando `z.string().min(1)` di `ChatRequestSchema` e bloccando ogni turno successivo, non solo quello fallito. Decisione esplicita, non un limite lasciato implicito.

3. **`app/page.tsx`** (sostituisce lo scaffold `create-next-app`) — `"use client"` (Invariant #1, eccezione esplicita: hook `useChat`, stato locale, event handler):
   - `useChat({ transport: new TextStreamChatTransport({ api: "/api/chat" }) })` con la trasformazione del punto 2 agganciata al transport.
   - Rendering della lista messaggi (`message.parts`, solo `part.type === "text"` — nessun altro tipo di part atteso con il text-stream protocol), input controllato, bottone di invio disabilitato quando `status !== "ready"` (vedi §Design).
   - Componente separato in `components/` solo se la UI cresce oltre una singola pagina gestibile — valuta a implementazione fatta, non decidere a priori una scomposizione in componenti non richiesta.

4. **Gestione risposta vuota/troncata** — dopo che `status` torna a `"ready"`, se l'ultimo messaggio è dell'assistente e `isEmptyAssistantResponse` (punto 2) ritorna `true`, mostra il messaggio di errore inline definito in §Design invece di lasciare una bolla assistente vuota — mitigazione lato client del limite noto del text-stream protocol (vedi nota di apertura e open question già in `progress-tracker.md`), non una vera propagazione dell'errore dal server (che resta un limite noto, non risolvibile qui).

5. **Switch lingua UI** — bottone/toggle che aggiorna il cookie locale letto dal punto 1 e forza un refresh della pagina (pattern esatto — Server Action vs client-side, nome cookie — da confermare su `next-intl.dev` al momento dell'implementazione, non assumerlo). Cambia solo le stringhe statiche della UI (punto 1); non invia alcun parametro di lingua a `/api/chat` (la lingua della risposta del modello segue la domanda dell'utente, non la lingua della UI — già deciso in `project-overview.md` §Aggiornamento scope — bilingue e implementato in `03a`).

---

## Dependencies

Installa: `@ai-sdk/react`, `next-intl`

---

## Scope Limits

- Nessuna modifica a `app/api/chat/route.ts`, `lib/rag/generation.ts`, `lib/rag/prompt.ts` o `ChatRequestSchema` — `03a` resta chiuso, la conversione di formato vive lato client (vedi §Implementation punto 2).
- Nessun rendering Markdown della risposta del modello — testo semplice. Se il modello produce Markdown nella risposta (es. liste, grassetto), appare come testo grezzo — accettabile per questo scope, riconsiderare solo se il risultato è illeggibile durante la verifica manuale.
- Nessuna UI di citazione strutturata separata dal testo (es. un elenco di fonti sotto la risposta, cliccabile) — l'Invariant #12 resta coperto dalla citazione inline nel testo generato da `03a`. Decisione esplicita che chiude il punto lasciato aperto in `03a-chat-api.md` §Scope Limits.
- Nessuna persistenza della conversazione (localStorage, DB, cronologia multi-sessione) — una sola conversazione per sessione, persa al reload.
- Nessun i18n routing (`[locale]` nell'URL, middleware next-intl) — solo cookie-based, vedi §Implementation punto 1 per il perché.
- Nessun rate limiting qui — arriva in `03c-rate-limiting.md` (Invariant #18 non ancora applicato).
- Nessun test automatico sui componenti React (`app/page.tsx`) — coerente con `architecture-context.md` §Testing Policy (nessun setup jsdom nel progetto ad oggi, e la logica di rendering non è la parte a rischio qui). Include invece test minimi per le due funzioni pure di `lib/chat/messages.ts` — vedi §Testing sopra.
- Resta focalizzato sulla UI di chat — non tocca retrieval, generazione o rate limiting.

---

## Check When Done

- `app/page.tsx` mostra una chat funzionante: scrivere una domanda in-corpus (es. "come funziona la gestione dei webhook?") produce una risposta in streaming visibile a schermo, con la fonte citata nel testo (`heading_path`/`source_file`).
- Una domanda fuori corpus produce la risposta di rifiuto del modello (Invariant #11), visibile in UI senza errori JS in console.
- Lo switch lingua UI cambia le stringhe statiche (titolo, placeholder, bottoni) tra IT/EN senza ricaricare in uno stato rotto.
- Simulando una risposta vuota/troncata (es. interrompendo manualmente la chiave API o la rete a metà stream durante un test manuale), la UI mostra il messaggio di errore inline invece di una bolla assistente vuota silenziosa (verifica manuale diretta del punto 4 di §Implementation).
- Dopo aver simulato un turno con risposta vuota/troncata come sopra, scrivere un **nuovo** messaggio nella stessa conversazione: la richiesta successiva ha successo (non un `400` per `content: ""` nello storico) — verifica manuale diretta del filtro in `toChatRequestMessages` (bug multi-turno, vedi §Testing).
- Input disabilitato/bottone invio disabilitato mentre `status !== "ready"`.
- `lib/chat/messages.ts` esporta `toChatRequestMessages`/`isEmptyAssistantResponse`, testate come da §Testing.
- `npm run test` passa.
- `npm run build` passa.
