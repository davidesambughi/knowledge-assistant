# 03e — UI/UX Polish: Technical Knowledge Dashboard & Grounding First

Leggi `AGENTS.md` prima di iniziare (la reading order al suo interno copre già project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md). Dipende da `03b-chat-ui.md`.

Rifinisce la UI/UX trasformando la Chat UI in un **Technical Knowledge Dashboard** sobrio ed essenziale. L'interfaccia mette al centro la trasparenza del RAG (citazione delle fonti recuperate, visibilità dei vincoli in-corpus, e guardrail anti-allucinazione Invariant #11), comunicando la qualità tecnica dell'architettura sottostante senza ricorrere a pattern generici ("AI slop").

---

## Validation

Usa lo schema Zod `ChatRequestSchema` definito in `tech-spec.md` §Data Models — non ridefinirlo qui né altrove. Nessuna modifica ai data boundary.

---

## Design

### 1. Visual Workbench & Pair Tipografico
- **Coppia Tipografica Esplicita**:
  - **Testo e Titoli principali**: `Inter` (`font-sans`, già configurata in `app/layout.tsx` da `03b`).
  - **Codice, File Paths, Heading e Metadata**: `Geist Mono` (`font-mono`, già configurata in `app/layout.tsx`).
- **No Emojis (Monochrome Iconography)**: Sostituite tutte le emoji con icone monocrome di `lucide-react` stilitate tramite i token CSS del tema (`text-muted-foreground`, `text-primary`), mantenendo un'estetica rigorosa da developer tool.
- **Card Shell**: Container centrale (`max-w-3xl`, `border border-border bg-card rounded-xl shadow-xs h-[calc(100vh-3rem)] my-6 mx-auto flex flex-col`).

### 2. Header: Trasparenza Architetturale
- Titolo: **Knowledge Assistant** (`font-sans font-semibold text-lg`)
- Badge Architetturale: `Remote NIF Docs` | `Hybrid Search (Vector + FTS RRF)`
- Indicatore del Vincolo: `Strict In-Corpus Grounding` (dichiara il vincolo d'ambito).
- `LocaleSwitch` integrato a destra.

### 3. Empty State: Trasparenza dei Vincoli & Test Guardrail
Quando `messages.length === 0`, mostrare una vista di benvenuto orientata all'architettura:
- **Titolo & Principio**: *"Assistente Tecnico ancorato alla documentazione di Remote NIF"*.
- **Spiegazione dei Vincoli**: *"Risponde esclusivamente dai file del corpus. Se l'informazione non è presente nella documentazione, il sistema rifiuta esplicitamente di rispondere per prevenire allucinazioni (Invariant #11)."*
- **Chip di Prova (Icone Lucide Monocrome)**:
  - Icona `FlaskConical` + testo: *"Come funziona la gestione e la firma dei webhook?"*
  - Icona `FlaskConical` + testo: *"Quali sono i flow di Stripe Checkout?"*
  - Icona `ShieldQuestion` + testo: *"Qual è la capitale della Francia?"* (Test Invariant #11).

### 4. Visualizzazione Risposte: Fonti e Guardrail Informativo
- **Bolla Utente**: Pulita (`bg-primary text-primary-foreground rounded-lg p-3 text-sm font-sans`).
- **Bolla Assistant**: Strutturata in stile blocco tecnico:
  - **Header Fonti Verificate**: In cima o in fondo alla risposta, un blocco dedicato visualmente distinto con stile console (`bg-muted/60 border border-border/80 rounded-md p-2.5 text-xs text-muted-foreground space-y-1`):
    - Icona `FileCode` / `BookOpen` (Lucide)
    - Lista di `source_file` e `heading_path` usati come contesto dal retrieval in `font-mono`.
  - **Corpo della Risposta**: Rendering Markdown via `react-markdown`.
  - **Callout di Rifiuto Invariant #11 (Stile Informativo/Neutro, non Error/Destructive)**:
    - Quando la risposta è il rifiuto da fuori-corpus, viene mostrata con uno stile neutro e informativo (`bg-muted/80 border border-border text-muted-foreground rounded-lg p-3 text-sm flex items-start gap-2.5`), accompagnata da un'icona `ShieldCheck` di Lucide.
    - **Nota di design**: Il rifiuto **NON** usa lo stile rosso `destructive`, perché il rifiuto da fuori-corpus è il comportamento *corretto e previsto* dell'Invariant #11, non un malfunzionamento.

### 5. Input Bar
- Floating bar pulita (`border border-border bg-background rounded-lg focus-within:ring-1 focus-within:ring-ring p-1.5 flex items-center gap-2`).
- Pulsante di invio iconico (`SendHorizontal`), disabilitato durante streaming o input vuoto.
- Didascalia tecnica a piè di pagina (`text-xs text-muted-foreground font-mono`): *"Corpus: Remote NIF Docs • Retrieval: Hybrid pgvector (k=5) • Generazione: Gemini 3.1"*.

---

## Testing

I test esistenti in `lib/chat/messages.test.ts` (9 test) e l'intera suite del progetto (46 test) devono continuare a passare senza regressioni (`npm run test`).
Se vengono create funzioni helper per estrarre o formattare i riferimenti alle fonti dalla risposta dell'assistant, esse devono essere collaudate con unit test dedicati in `lib/chat/ui-helpers.test.ts`.

---

## Implementation

1. **Primitive shadcn/ui**:
   - Eseguire `npx shadcn@latest add badge card avatar` per disporre dei primitive base.

2. **Traduzioni i18n (`messages/it.json` e `messages/en.json`)**:
   - Aggiungere le stringhe orientate ai vincoli per l'Empty State (spiegazione grounding, etichetta guardrail test, chip 1, chip 2, chip guardrail 3).

3. **Helper di parsing fonti / UI**:
   - (Se opportuno) creare una utility pura `lib/chat/ui-helpers.ts` per l'estrazione e formattazione delle citazioni fonti.

4. **Componenti Chat (`components/chat/`)**:
   - Refactor pulito di `app/page.tsx` con componenti dedicati:
     - `chat-header.tsx`: Titolo tecnico (`font-sans`), badge architettura RRF, vincolo grounding, selector lingua.
     - `chat-empty-state.tsx`: Welcome orientato all'architettura con chip di prova (icone `FlaskConical` e `ShieldQuestion`).
     - `chat-message-item.tsx`: Rendering bolla con fonti in evidenza `font-mono` e callout informativo neutro (`ShieldCheck`, `bg-muted/80`) per l'Invariant #11.
     - `chat-input-form.tsx`: Input bar con didascalia tecnica (`font-mono`).

5. **Progress Tracker**:
   - Registrare la nuova unit `03e — UI/UX Polish (Technical Knowledge Dashboard)` in `context/progress-tracker.md` prima del deploy `04a`.

6. **Verifica**:
   - `npm run test` (46+ test passano).
   - `npm run lint` (0 warning/errori).
   - `npm run build` (compilazione pulita).
   - Manual verification nel dev server.

---

## Dependencies

`lucide-react`, `react-markdown`, `next-intl`, `@ai-sdk/react`. Primitive shadcn `badge`, `card`, `avatar`.

---

## Scope Limits

- Nessuna modifica all'endpoint backend `app/api/chat/route.ts` o al database Supabase.
- Nessuna violazione degli Invariants (Invariant #10 sui colori raw, Invariant #11 sul rifiuto fuori corpus).
- Mantieni l'interfaccia sobria, tecnica, priva di emoji e priva di finti messaggi di errore su comportamenti corretti.

---

## Check When Done

- L'interfaccia comunica chiaramente l'architettura (Hybrid RAG, Strict Grounding) con la coppia tipografica `Inter` (titoli/corpo) e `Geist Mono` (code/fonti).
- L'Empty State usa icone monocrome `lucide-react` (`FlaskConical`, `ShieldQuestion`) senza emoji colorate.
- Le risposte mostrano le fonti in un blocco `font-mono` evidenziato in stile developer tool.
- I messaggi di rifiuto fuori-corpus usano uno stile neutro/informativo (`ShieldCheck`, `bg-muted/80`) e non uno stile rosso di errore (`destructive`).
- `progress-tracker.md` è stato aggiornato con la unit `03e` prima di `04a`.
- `npm run test`, `npm run lint` e `npm run build` passano con successo.
