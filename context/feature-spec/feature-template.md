# [NN] — [Feature Unit Name]

<!-- Naming convention: NN è un numero a due cifre che definisce l'ordine di build.
     Il numero È la catena di dipendenza — i numeri più bassi devono essere completi prima che partano i più alti.
     Nomina il file in base alla responsabilità, non alla tecnologia.
     Esempi in questo progetto: 01-ingest.md, 02-retrieval.md, 03-chat-ui.md -->

<!-- Riga di apertura (obbligatoria): dice all'agente quali context file leggere prima di iniziare.
     Includi sempre AGENTS.md (impone la reading order) — AGENTS.md a sua volta rimanda a
     project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md.
     Aggiungi qui solo eventuali feature-specs precedenti da cui questa unit dipende. -->

Leggi `AGENTS.md` prima di iniziare (la reading order al suo interno copre già project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md). [+ eventuali feature-specs precedenti da cui questa unit dipende]

<!-- Sintesi in una riga (obbligatoria): cosa fa questa unit, in linguaggio semplice.
     Scrivila come risultato, non come lista di task. -->

[Una frase che descrive cosa fa questa unit e perché esiste a questo punto della build.]

---

## Validation

<!-- Ogni feature-spec di questo progetto usa uno degli schema Zod già definiti in tech-spec.md.
     Non farne ridefinire uno nuovo dall'agente: riferiscilo per nome. -->

Usa lo schema Zod `[NomeSchema]` definito in `tech-spec.md` §Data Models — non ridefinirlo qui né altrove.

---

## Design

<!-- Includi questa sezione SOLO se questa unit coinvolge UI dove servono decisioni visive
     (in questo progetto: solo 03-chat-ui.md). Se non c'è UI, elimina l'intera sezione — non lasciarla vuota.
     Sii preciso: layout, cosa NON includere. Il silenzio viene interpretato come permesso — se non
     vuoi qualcosa, va detto esplicitamente (es. niente i18n/next-intl in questo progetto). -->

[Descrivi le decisioni di layout specifiche di questa unit. Elimina la sezione se non c'è UI.]

---

## Testing

<!-- Includi questa sezione SOLO se questa unit produce logica deterministica testabile senza costi
     esterni (parsing, validazione, trasformazioni dati) o copre un invariant di sicurezza — non è più
     escluso di default (vedi `architecture-context.md` §Testing Policy per framework e convenzioni).
     Se la unit è puro I/O verso servizi esterni a pagamento (chiamate OpenAI, scritture Supabase) o
     puro setup/scaffold senza logica propria, elimina l'intera sezione — non lasciarla vuota.
     Se una unit mischia logica pura e I/O esterno (es. una funzione che chiama OpenAI), separa la
     logica deterministica in una funzione pura testabile e testa solo quella — non mockare servizi
     esterni per soddisfare questa sezione. -->

[Elenca cosa va testato con unit/integration test — funzione per funzione, non "tutto il file". Elimina la sezione se non si applica.]

---

## Implementation

<!-- Step numerati. Ogni step è un'azione discreta: crea un file, aggiungi una route, ecc.
     L'ordine conta — gli step vengono eseguiti in sequenza.
     Sii specifico: nome del file, nome della funzione, nome del campo.
     Descrivi COSA creare e COSA deve fare, non COME implementarlo (l'agente lo sa già). -->

1. [Prima azione discreta — file, route o funzione specifica]

2. [Seconda azione]
   - [sub-step]
   - [sub-step]

3. [Continua secondo necessità]

---

## Dependencies

<!-- Includi solo se questa unit richiede nuovi pacchetti. Nomi esatti, nessun pinning di versione
     a meno che una versione specifica sia richiesta esplicitamente (vedi banner in AGENTS.md
     sulla verifica doc ufficiale ago 2026). Non elencare pacchetti già presenti nel progetto. -->

Installa: `package-name`, `other-package`

---

## Scope Limits

<!-- Obbligatoria. La sezione più importante per prevenire lo scope creep.
     Elenca tutto ciò che NON fa parte di questa unit — anche cose apparentemente correlate.
     L'agente costruirà cose adiacenti se non gli viene detto esplicitamente di non farlo. -->

- [Cosa è esplicitamente escluso da questa unit]
- [Cosa è esplicitamente escluso da questa unit]
- Se questa unit produce logica deterministica testabile senza costi esterni (parsing, validazione, trasformazioni dati) o copre un invariant di sicurezza, include unit/integration test minimi prima di considerarsi "fatta" — non è più escluso di default (vedi §Testing sopra). Se non si applica nessuno di questi casi (puro I/O esterno a pagamento, puro setup/scaffold), dichiaralo esplicitamente qui con la motivazione, invece di ometterlo in silenzio.
- Resta focalizzato su [la responsabilità stretta di questa unit].

---

## Check When Done

<!-- Obbligatoria. Condizioni verificabili che definiscono "fatto" per questa unit.
     Ogni voce deve essere controllabile — non "sembra giusto" ma "questo file esiste",
     "questa route ritorna X", "la build passa". Termina sempre con: npm run build passa. -->

- [Condizione specifica e verificabile]
- [Condizione specifica e verificabile]
- [Condizione specifica e verificabile]
- Se questa unit ha una sezione §Testing: `npm run test` passa (vedi `architecture-context.md` §Testing Policy).
- `npm run build` passa.
