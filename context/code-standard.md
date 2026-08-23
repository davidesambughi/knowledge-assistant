# Code Standards

<!-- Regole di scrittura codice specifiche di questo stack.
     Non ripete le Invariants (vedi architecture-context.md) — quelle sono vincoli di sistema,
     qui ci sono solo convenzioni di come il codice viene scritto e organizzato. -->

---

## Generali

- Moduli piccoli e a responsabilità singola.
- Risolvi la causa radice — non impilare workaround sopra un comportamento rotto.
- Non mischiare concern non correlati in un singolo componente o route.
- Nomina i file in base alla responsabilità che contengono, non alla tecnologia usata.

---

## TypeScript

- Strict mode obbligatorio in tutto il progetto.
- Mai `any`. Interfacce esplicite o generics a scope ristretto.
- `interface` per contratti di oggetti (props, forme di dati, risultati query).
- `type` per union, intersection, e tipi derivati.

> Per la validazione input esterno e l'inferenza tipi da Zod, vedi `architecture-context.md` §Invariants (#3, #7) — non ripetuto qui.

---

## Next.js

- Route handler focalizzati su una singola responsabilità: valida → esegui → rispondi.
- Non fare fetch di dati in un client component quando un server component può farlo.

> Per RSC-default, Server Actions vs API routes, e dove vive ogni file, vedi `architecture-context.md` §Invariants e §Project Structure — non ripetuto qui.

---

## Streaming (Vercel AI SDK)

- Verifica il pattern di streaming corrente sulla documentazione ufficiale prima di implementare (vedi banner in `AGENTS.md` — API in evoluzione, non fidarsi del training).

---

## Styling

- Solo i token di default di shadcn/ui — nessun token custom, nessun valore raw (vedi `architecture-context.md` §Invariants #10).
- Non scrivere CSS custom a meno che le utility Tailwind non riescano a ottenere il risultato.
