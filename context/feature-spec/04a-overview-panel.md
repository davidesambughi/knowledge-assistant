# 04a — Overview Panel: Contenuto e Layout

Leggi `AGENTS.md` prima di iniziare (la reading order al suo interno copre già project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md). Dipende da `03e-ui-ux-polish.md` (dashboard corrente) e `03h` (rimozione `LocaleSwitch` — la UI generale resta fissa in inglese, non toccata da questa unit).

Aggiunge alla dashboard un pannello statico "Project Overview" (recruiter-facing) accanto alla chat — spiega cos'è il tool e i suoi punti tecnici chiave, con uno switch IT/EN indipendente e scoped solo a questo pannello.

---

## Validation

Nessuno schema Zod applicabile — questa unit non introduce alcun data boundary (nessun input utente, nessuna chiamata a Gemini/Supabase). Il contenuto è testo statico hardcoded, non validato a runtime.

---

## Design

### Layout
- Due colonne su desktop: chat (esistente, invariata) a sinistra, pannello overview a destra.
- Breakpoint: `lg:` (1024px) di Tailwind — sotto quella soglia il pannello si impila **sotto** la chat (mobile e tablet), non affiancato.
- Su desktop il pannello è `sticky` (resta visibile durante lo scroll della chat).
- Container esterno: da `max-w-3xl` (solo chat) a un contenitore più largo che ospita entrambe le colonne (es. `max-w-6xl`) — la card della chat mantiene le sue dimensioni/stile attuali, non viene ridisegnata.

### Struttura del pannello
- Card (stesso stile shadcn `border border-border bg-card rounded-xl` già usato altrove), coerente con `03e`.
- Header del pannello: titolo (es. "Project Overview") + toggle IT/EN in alto a destra, tramite `ToggleGroup`/`ToggleGroupItem` shadcn (`type="single"`) — primitive ufficiale per switch a due stati, non ancora installato nel progetto (vedi §Dependencies).
- Blocco "cos'è": paragrafo in linguaggio semplice, testo esatto approvato sotto in §Implementation punto 1.
- Lista dei 5 punti tecnici (Chunking, Hybrid Retrieval, Strict Grounding, Rate Limiting, Input Validation/Zod): ogni punto con un'etichetta breve + una riga di spiegazione, testo esatto approvato in §Implementation punto 1. Icone Lucide monocrome coerenti con lo stile esistente (facoltative, non richieste).
- Font: `font-sans` per prosa, `font-mono` per eventuali termini tecnici in evidenza (coerente con `03e`).

### Switch bilingue (scoped al pannello)
- Stato locale (`useState<"it" | "en">`) dentro il componente del pannello — nessun cookie, nessuna persistenza tra reload, nessun impatto sul resto della UI.
- Non usa `next-intl` — l'infrastruttura i18n del progetto resta come impostata in `03h` (default `"en"`, `SUPPORTED_LOCALES=["en"]`), non toccata da questa unit.
- Il contenuto bilingue vive in un file dati separato dal componente (vedi §Implementation punto 1), non inline nel JSX.

---

## Implementation

1. **`lib/content/overview-panel.ts`** — file dati puro, nessuna logica. Contiene:
   - Blocco "cos'è":
     ```typescript
     export const OVERVIEW_INTRO = {
       it: "Questo è un chatbot RAG (Retrieval-Augmented Generation): risponde solo leggendo una documentazione tecnica reale, non inventa. Cerca i passaggi più rilevanti nei documenti — il \"retrieval\" — e li usa per generare una risposta, basandosi solo su quelli. Se la risposta non è nei documenti, lo dice invece di inventarla.",
       en: "This is a RAG chatbot (Retrieval-Augmented Generation): it only answers from real technical documentation — it doesn't make things up. It finds the most relevant passages in the docs — the \"retrieval\" step — and uses them to generate an answer. If the answer isn't in the docs, it says so instead of guessing.",
     };
     ```
   - I 5 punti tecnici, struttura `{ id, it, en }` (`id` stabile per `key` React, non mostrato in UI):
     ```typescript
     export interface OverviewPoint {
       id: string;
       it: { label: string; description: string };
       en: { label: string; description: string };
     }

     export const OVERVIEW_POINTS: OverviewPoint[] = [
       {
         id: "chunking",
         it: { label: "Chunking", description: "Documentazione divisa per sezione (heading), non a lunghezza fissa — ogni frammento resta semanticamente coerente" },
         en: { label: "Chunking", description: "Docs split by heading section, not fixed length — each chunk stays semantically coherent" },
       },
       {
         id: "hybrid-retrieval",
         it: { label: "Hybrid Retrieval", description: "Ricerca vettoriale (similarity) + full-text search, fuse con Reciprocal Rank Fusion — non solo similarity coseno" },
         en: { label: "Hybrid Retrieval", description: "Vector similarity search + full-text search, fused via Reciprocal Rank Fusion — not similarity alone" },
       },
       {
         id: "strict-grounding",
         it: { label: "Strict Grounding", description: "Il modello risponde solo dal contesto recuperato, mai da conoscenza propria — nessuna eccezione" },
         en: { label: "Strict Grounding", description: "The model answers only from retrieved context, never from its own knowledge — no exceptions" },
       },
       {
         id: "rate-limiting",
         it: { label: "Rate Limiting", description: "Endpoint pubblico protetto per IP contro abuso di costo" },
         en: { label: "Rate Limiting", description: "Public endpoint protected per-IP against cost abuse" },
       },
       {
         id: "input-validation",
         it: { label: "Input Validation (Zod)", description: "Ogni richiesta validata a runtime prima di raggiungere retrieval/generazione — nessun input non tipato passa" },
         en: { label: "Input Validation (Zod)", description: "Every request validated at runtime before hitting retrieval/generation — no untyped input passes through" },
       },
     ];
     ```

2. **`components/overview/overview-panel.tsx`** (client component):
   - `"use client"`, `useState<"it" | "en">("en")` come lingua di default del pannello (coerente col resto della UI fissa in inglese).
   - Importa `OVERVIEW_INTRO`/`OVERVIEW_POINTS` da `lib/content/overview-panel.ts`.
   - Renderizza: header con titolo + `ToggleGroup type="single"` (valore `"it"`/`"en"`, `onValueChange` aggiorna lo stato locale — ignora `onValueChange(undefined)`/deselezione, il toggle deve restare sempre su uno dei due stati) con due `ToggleGroupItem` ("IT"/"EN"), paragrafo intro, lista dei 5 punti (label in grassetto + descrizione).
   - Nessuna props richiesta dall'esterno — componente autosufficiente.

3. **`app/page.tsx`** — modifica di layout:
   - Il container esterno passa da singola colonna centrata a un wrapper flex/grid a due colonne (`flex-col lg:flex-row`), che ospita la card chat esistente (invariata) + `<OverviewPanel />`.
   - Il pannello ha `lg:sticky lg:top-5` (o equivalente) solo su desktop; su mobile è un blocco normale sotto la chat nel flusso del documento.
   - Nessuna modifica alla logica chat esistente (`useChat`, gestione errori, ecc.) — solo il markup del layout attorno.

4. **`progress-tracker.md`**:
   - Registrare la unit `04a — Overview Panel` in §Completed a fine implementazione, coerente con lo stile delle voci esistenti (cosa creato, deviazioni se presenti, verifica fatta).

5. **Verifica**:
   - `npm run lint` (0 warning/errori).
   - `npm run build` (compilazione pulita).
   - Verifica manuale nel dev server: toggle IT/EN cambia solo il testo del pannello (non la chat), layout a due colonne su viewport desktop, pannello impilato sotto la chat su viewport mobile, sticky funzionante durante lo scroll della chat.

---

## Dependencies

Installa il primitive shadcn `toggle-group` (`npx shadcn@latest add toggle-group`, include `toggle` come dipendenza del primitive) — non ancora presente in `components/ui/`. Riusa inoltre `lucide-react` (icone opzionali) e `components/ui/card.tsx` già presenti.

---

## Scope Limits

- Nessuna modifica a `app/api/chat/route.ts`, a `lib/rag/*`, o a qualunque Invariant RAG-specific.
- Nessun reintroduzione di `next-intl`/`LocaleSwitch` a livello di UI generale — resta come fissato in `03h`. Lo switch di questa unit è locale al pannello, non collegato all'infrastruttura i18n del progetto.
- Nessuna persistenza della scelta di lingua del pannello (no cookie, no localStorage) — resta stato locale del componente, si resetta a `"en"` a ogni reload/mount.
- Contenuto del pannello è quello esatto approvato in §Implementation punto 1 — non va riformulato, esteso o abbreviato in fase di implementazione.
- Nessuna sezione §Testing: questa unit è puro contenuto statico + markup di presentazione, nessuna logica deterministica da testare (nessuna trasformazione dati, nessun invariant di sicurezza coinvolto) — esclusione dichiarata esplicitamente, non omessa in silenzio.
- Resta focalizzata sul contenuto e layout del pannello — nessuna nuova pipeline dati, nessuna chiamata a servizi esterni.

---

## Check When Done

- `lib/content/overview-panel.ts` esiste con `OVERVIEW_INTRO` e i 5 `OVERVIEW_POINTS`, testo IT/EN identico a quello approvato in §Implementation.
- `components/overview/overview-panel.tsx` esiste, renderizza intro + 5 punti, toggle IT/EN funzionante e scoped al pannello.
- `app/page.tsx` mostra layout a due colonne su desktop (chat + pannello, pannello sticky) e impilato su mobile, senza alterare il comportamento della chat esistente.
- Nessuna regressione: `npm run test` (62/62 test esistenti) passa invariato.
- `npm run lint` passa senza warning/errori.
- `npm run build` passa.
