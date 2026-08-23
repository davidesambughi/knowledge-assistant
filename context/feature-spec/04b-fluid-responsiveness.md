# 04b — Fluid Responsiveness & Mobile Tab Switcher

Leggi `AGENTS.md` prima di iniziare (la reading order al suo interno copre già project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md). Dipende da `04a-overview-panel.md`.

Audita e aggiorna la responsiveness dell'intera applicazione secondo le best practice di Tailwind CSS v4 e shadcn v4 (agosto 2026), introducendo dynamic viewport height (`dvh`), container queries (`@container`) e un Mobile Tab Switcher (`< lg`) per eliminare lo scroll doppio ed evitare misure fisse rigide su schermi mobile e desktop.

---

## Validation

Non ridefinisce schemi Zod. La unit agisce sui componenti presentazionali della UI (`app/page.tsx`, `components/chat/*`, `components/overview/*`).

---

## Design

- **Layout Mobile (< lg):**
  - Mostra in alto una bar di selezione a tab fissa ("Chat" | "Overview Panel").
  - **Tab "Chat":** La chat box occupa l'intero schermo disponibile (`h-[calc(100dvh-4.5rem)]`) senza far scorrere la pagina principale; lo scroll resta confinato internamente a `ScrollArea`.
  - **Tab "Overview":** L'Overview Panel occupa lo schermo in modalità card espansa con scroll verticale fluido.
- **Layout Desktop (lg+):**
  - La tab bar mobile è nascosta (`hidden lg:hidden`).
  - Layout flessibile a due colonne affiancate (`lg:flex-row lg:items-stretch`):
    - Chat box flessibile (`flex-1 min-w-0 h-[calc(100dvh-2.5rem)]`).
    - Overview Panel sidebar fluida (`lg:w-80 xl:w-90 lg:shrink-0 lg:sticky lg:top-5`).
- **Dynamic Viewport Height (`dvh`):** Sostituzione completa di `100vh` con `100dvh` (`h-dvh` / `h-[calc(100dvh-...)]`) per evitare salti o tagli di layout dovuti alla comparsa/scomparsa della barra degli indirizzi su browser mobile (iOS Safari / Android Chrome).
- **Fluid Typography & Spacing con `clamp()`:** Uso di funzioni `clamp(min, val, max)` (configurate in `@theme` dentro `app/globals.css` o via sintassi arbitraria Tailwind `text-[clamp(...)]`, `p-[clamp(...)]`, `gap-[clamp(...)]`) per garantire che tipografia, padding e gap scalino in modo continuo e fluido tra schermi stretti e schermi ampi, senza fare affidamento su scatti rigidi di breakpoint (`sm:`, `md:`, `lg:`).
- **Tailwind v4 Container Queries (`@container`):** Applicate su `ChatHeader` e `OverviewPanel` in modo che badge, indicatore di stato, titoli e controlli si riadattino in base alla larghezza del loro contenitore padre (`@sm:flex-row`, `@sm:items-center`), rendendoli completamente modulari.
- **Touch Targets & Safe-area Insets:** Dimensionamento dei controlli interattivi (input chat, bottoni di invio, chip di prova) a target touch-friendly (`min-h-11` / `44px`) con spaziatura fluida gestita da `clamp()`.

---

## Testing

Questa unit modifica unicamente l'aspetto ed il layout dei componenti React presentazionali. Non introduce nuova logica di business deterministica astratta da testare con Vitest. La verifica automatizzata si basa sulla suite di 62 unit test esistenti che deve rimanere integra senza regressioni.

---

## Implementation

0. Modifica `app/globals.css`:
   - Definisci variabili e utility di spaziatura/font fluidi tramite `clamp()` (es. `--spacing-fluid-xs`, `--spacing-fluid-sm`, `--spacing-fluid-md`, `--spacing-fluid-lg` e `--text-fluid-xs`, `--text-fluid-sm`, `--text-fluid-base`, `--text-fluid-lg`) dentro `@theme` per l'uso nativo in Tailwind CSS v4.

1. Modifica `app/page.tsx`:
   - Aggiungi lo stato locale `mobileTab: "chat" | "overview"` (default `"chat"`).
   - Renderizza in alto il selettore di tab mobile su schermi `< lg` (`ToggleGroup` / `button` styled con token shadcn).
   - Aggiorna il contenitore radice con altezza viewport dinamica (`min-h-dvh`), padding fluido `p-[clamp(0.625rem,2vw,1.25rem)]` / `--spacing-fluid-sm`, max width flessibile (`max-w-7xl`).
   - Gestisci la visibilità condizionale dei componenti su mobile in base a `mobileTab`, mantenendoli entrambi affiancati su desktop (`lg:flex`).

2. Modifica `components/chat/chat-header.tsx`:
   - Aggiungi la classe `@container` al tag `<header>`.
   - Applica classi container query (`@sm:flex-row`, `@sm:items-center`) e font/spaziature fluide `gap-[clamp(0.5rem,1.5vw,0.75rem)]` per disporre titolo, status indicator e badge in modo fluido quando il contenitore si stringe o espande.

3. Modifica `components/chat/chat-input-form.tsx`:
   - Migliora la fruibilità mobile impostando target di tocco adeguati (`min-h-11` per l'Input e per il Button di invio).
   - Usa spaziatura fluida `p-[clamp(0.75rem,2vw,1rem)]`.

4. Modifica `components/chat/chat-empty-state.tsx`:
   - Sostituisci l'altezza minima fissa (`min-h-[340px]`) con un layout flex fluido (`flex-1 flex flex-col justify-center py-[clamp(1rem,3vw,2rem)] px-[clamp(0.75rem,2vw,1.5rem)]`).
   - Assicura che i chip di query campione tronchino il testo correttamente su schermi stretti (`< 360px`).

5. Modifica `components/chat/chat-message-item.tsx`:
   - Regola la larghezza massima delle bolle per schermi piccoli (`max-w-[92%] sm:max-w-[85%]`).
   - Assicura che i blocchi di codice markdown (`pre`) gestiscano lo scroll orizzontale senza interrompere il contenitore flex (`min-w-0`).

6. Modifica `components/overview/overview-panel.tsx`:
   - Adatta la Card per occupare l'altezza fluida del contenitore mobile tab con scroll interno se necessario (`h-full flex flex-col overflow-y-auto`).
   - Aggiungi `@container` sul wrapper per gestire il titolo ed il Toggle Group IT/EN su contenitori stretti con spaziatura e font fluidi `clamp()`.

---

## Dependencies

Nessuna dipendenza esterna da installare (`@tailwindcss/postcss` v4 e `@base-ui/react` sono già installati e configurati nel progetto).

---

## Scope Limits

- Nessuna modifica alle API route backend (`app/api/chat/route.ts`), agli helper RAG (`lib/rag/*`), o al database Supabase.
- Nessuna modifica alle chiavi i18n o alle istruzioni del system prompt (`lib/rag/prompt.ts`).
- Nessuna alterazione delle logiche di rate limiting o sicurezza.
- Resta strettamente focalizzato sull'adattamento fluido alla responsiveness e sulla rimozione di misure rigide anti-pattern.

---

## Check When Done

- `npm run lint` passa senza errori o avvisi.
- `npm run test` passa con 62/62 test verdi (nessuna regressione sui test esistenti).
- `npm run build` passa pulito.
