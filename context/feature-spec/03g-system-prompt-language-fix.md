# 03g — System Prompt Language Anchoring Fix

Leggi `AGENTS.md` prima di iniziare (la reading order al suo interno copre già project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md). Dipende da `03a-chat-api.md` (definisce `buildSystemPrompt`) e `03f-open-questions-cleanup.md` (ultima unit che ha toccato `lib/rag/prompt.ts`).

Corregge un bug di comportamento (non di schema/dati): il modello risponde in italiano anche quando la domanda dell'utente è in inglese, a meno che l'utente non richieda esplicitamente "answer in English" — viola project-overview.md §Aggiornamento scope — bilingue ("risposta del modello nella lingua della domanda dell'utente").

---

## Diagnosi (già verificata, non da rifare)

`BASE_INSTRUCTIONS` in `lib/rag/prompt.ts` è scritto interamente in prosa italiana (5 paragrafi); l'istruzione di rispondere nella lingua della domanda è solo l'ultima frase. Questo produce language anchoring verso l'italiano: un segnale debole (una frase in fondo a un prompt monolingua) perde contro la lingua dominante del contesto, mentre una richiesta esplicita nel messaggio utente è un segnale abbastanza forte da vincere l'anchoring — coerente con quanto osservato.

Verificato su doc ufficiale Google (`ai.google.dev/gemini-api/docs/prompting-strategies`, aggiornata 10 giugno 2026, sezione "Gemini 3" — applicabile perché il progetto usa `gemini-3.1-flash-lite`): Google raccomanda esplicitamente di strutturare il system prompt con tag XML (`<role>`, `<constraints>`, `<context>`, `<task>`) invece di prosa, e di mettere i vincoli comportamentali critici (qui: la lingua) in cima/nella sezione dedicata — non in fondo a un paragrafo — per massimizzarne la salience.

next-intl è stato escluso come causa/fix: il locale UI (cookie `NEXT_LOCALE`, `lib/i18n/locale.ts`) non viene mai passato a `buildSystemPrompt`/`streamChatResponse` — catena verificata, nessun collegamento.

---

## Validation

Nessuno schema Zod coinvolto — `buildSystemPrompt` resta una funzione pura `(RetrievedChunk[]) => string`, firma invariata.

---

## Testing

`lib/rag/prompt.test.ts` va esteso, non solo riscritto: il problema originale era che i test verificavano solo la *presenza* della stringa istruzione-lingua nel prompt, non la sua posizione/salience — un difetto di per sé, indipendente dal fix del prompt.

- I test esistenti (contenuto/fonte chunk, istruzione "solo dal contesto", istruzione anti-injection, istruzione anti-leak, presenza istruzione lingua) restano validi nella forma "il prompt contiene X" — aggiornare le stringhe cercate se il testo cambia lingua/formato (es. i marker diventano tag XML tipo `<constraints>`).
- Nuovo test esplicito: l'istruzione sulla lingua compare dentro il blocco `<constraints>` (o equivalente) e non nell'ultima porzione del prompt — verifica di posizione, non solo di presenza. Esempio: indice di `<constraints>`/istruzione-lingua deve essere minore dell'indice del blocco `<context>`.
- Resta escluso dai test automatici (invariato da `architecture-context.md` §Testing Policy): la verifica che il modello *effettivamente* risponda nella lingua giusta — quella resta manuale via dev server (curl o UI), come ogni altro comportamento di generazione reale.

---

## Implementation

1. Riscrivi `BASE_INSTRUCTIONS` in `lib/rag/prompt.ts` usando struttura a tag XML invece di prosa italiana continua, seguendo lo schema ufficiale Gemini 3 (`<role>`, `<constraints>`, `<context>` per i chunk recuperati — già gestito da `buildSystemPrompt`, `<task>` se utile per introdurre il turno). Contenuto invariato nel merito (Invariant #11 — solo dal contesto —, #19 — anti-injection —, anti-leak delle istruzioni, citazione fonte) — cambia solo lingua (inglese) e formato (tag), non le regole stesse.
   - La regola sulla lingua ("rispondi nella stessa lingua della domanda dell'utente") va nella prima posizione utile dentro `<constraints>`, non come ultima frase.
2. Aggiorna `formatChunk`/l'assemblaggio del `<context>` se necessario per restare coerente col nuovo formato a tag (es. il blocco contesto recuperato resta dentro `<context>...</context>`, non appeso dopo un "Contesto:" in italiano).
3. Aggiorna `lib/rag/prompt.test.ts`: adegua le stringhe cercate al nuovo testo/formato, aggiungi il test di posizione descritto in §Testing.
4. Verifica manuale via dev server (non automatizzabile, vedi §Testing): domanda EN senza richiesta esplicita di lingua → risposta EN; domanda IT → risposta IT; domanda EN con richiesta esplicita "answer in English" (comportamento già corretto oggi) → invariato. Controlla anche che Invariant #11/#19 e l'anti-leak restino rispettati col nuovo prompt (stesso set di casi già verificato in `03a`/`03d`, solo riverificato dopo il cambio di formato).

---

## Scope Limits

- Nessun cambiamento a `app/api/chat/route.ts`, `lib/rag/generation.ts` (oltre all'uso di `buildSystemPrompt`, invariato nella firma) o alla UI (`03b`/`03e`) — solo `lib/rag/prompt.ts` e il suo test.
- Nessuna propagazione del locale UI (`NEXT_LOCALE`) alla generazione — resta fuori scope, come già deciso in `project-overview.md` ("nessun rilevamento lingua lato UI... preferenza esplicita").
- Nessun retrieval re-test: il retrieval cross-linguale è già stato verificato in `03f` e non è toccato da questa unit (il bug è nella generazione, non nel recupero dei chunk).
- Include unit test minimi prima di essere considerata "fatta" (funzione pura, nessun costo esterno) — vedi §Testing sopra.
- Resta focalizzata sulla struttura/lingua del system prompt in `lib/rag/prompt.ts`, non su altre istruzioni di generazione.

---

## Check When Done

- `lib/rag/prompt.ts`: `BASE_INSTRUCTIONS` in inglese, struttura a tag XML (`<role>`, `<constraints>`, `<context>`), istruzione lingua in prima posizione dentro `<constraints>`.
- `lib/rag/prompt.test.ts`: test aggiornati alle nuove stringhe + nuovo test di posizione dell'istruzione lingua.
- Verifica manuale dev server: domanda EN → risposta EN senza richiesta esplicita; domanda IT → risposta IT; Invariant #11/#19/anti-leak ancora rispettati.
- `npm run test` passa.
- `npm run build` passa.
