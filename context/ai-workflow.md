# AI Workflow Rules

<!-- Queste regole definiscono come il lavoro di sviluppo viene scoping-ato e consegnato.
     Non sono suggerimenti — l'agente deve seguirle per restare in controllo del progetto. -->

> ⚠️ **Regola fondamentale non ripetuta qui**: prima di implementare, verifica sempre la documentazione ufficiale aggiornata ad agosto 2026 per Vercel AI SDK / Supabase pgvector / Gemini embeddings e generazione — non fidarti della sola memoria di training. Vedi `AGENTS.md` per il dettaglio completo (elenco librerie aggiornato dopo il passaggio da OpenAI a Gemini in `01b`, vedi `progress-tracker.md`).

---

## Approccio

Costruisci in modo incrementale seguendo un workflow spec-driven. I context file definiscono cosa costruire, come costruirlo, e lo stato attuale di avanzamento. Implementa sempre seguendo queste spec — non inferire o inventare comportamento da zero.

Quando qualcosa manca dalle spec, viene loggato come open question in `progress-tracker.md` e risolto prima di continuare l'implementazione.

---

## Regole di Scoping

- Lavora su una feature unit o subsystem alla volta.
- Preferisci incrementi piccoli e verificabili a cambi grandi e speculativi.
- Non combinare system boundary non correlati in un singolo step di implementazione.
- Una feature unit è abbastanza piccola se può essere verificata end-to-end in una sessione.

---

## Quando Dividere il Lavoro

Dividi uno step di implementazione se combina:

- Cambi UI e cambi di persistenza dati
- Più API route non correlate
- Stato client-side e logica server-side
- Comportamento non chiaramente definito nei context file
- Più di una schermata o user flow

Se non riesci a verificare rapidamente che un cambio funziona end-to-end, lo scope è troppo ampio — dividilo.

---

## Gestione dei Requisiti Mancanti

- Non inventare comportamento di prodotto non definito nei context file.
- Se un requisito è ambiguo, scrivi l'interpretazione risolta nel context file rilevante prima di implementare.
- Se un requisito manca, aggiungilo come open question in `progress-tracker.md` prima di continuare.
- Non prendere mai silenziosamente una decisione di prodotto — se una decisione è stata presa, va scritta da qualche parte.

---

## Velocità di Decisione

Non tutte le decisioni hanno lo stesso costo di reversibilità. La profondità dell'iterazione deve essere proporzionale a quanto è costoso tornare indietro.

**Irreversibili — vanno chiuse bene prima di costruire:**

- Data models e schema del database (incluso schema pgvector)
- Retrieval strategy (chunking, top-k, similarity threshold)
- API contracts (route, forme di request/response)
- Invarianti architetturali e system boundary

Sono costose da correggere dopo che il codice esiste. Itera finché non sei sicuro, prima di scrivere codice che dipende da queste decisioni.

**Reversibili — decidi in fretta, blocca, vai avanti:**

- Colori e tipografia (un aggiornamento di token sistema tutto)
- Copy: label dei bottoni, titoli, messaggi di errore
- Varianti dei componenti e dettagli di layout
- Se un elemento UI appare, è nascosto, o è stilizzato diversamente

Costo quasi zero da cambiare una volta che design token, componenti e tipi sono a posto. Scegli l'opzione migliore sul tavolo. Blocca la decisione. Costruisci. Se è sbagliata, cambi un token.

**Regola:** Non spendere mai più di 30 minuti a decidere una cosa reversibile. Se dopo 30 minuti l'esplorazione è ancora aperta, scegli l'opzione leader e vai avanti — impari di più costruendo una schermata che confrontando cinque opzioni.

---

## Componenti Protetti

Non modificare quanto segue a meno che un task non lo richieda esplicitamente:

- `components/ui/*` — componenti shadcn/ui. Generati, versionati, devono restare default e riusabili.
- Internals di librerie di terze parti.

Styling specifico del progetto, cambi di layout e logica di feature vanno implementati in componenti a livello app, non modificando i componenti protetti.

---

## Tenere i Doc Sincronizzati

Aggiorna il context file rilevante ogni volta che l'implementazione cambia:

- Architettura di sistema, boundary o decisioni di storage → `architecture-context.md`
- Scope di una feature (dentro o fuori scope) → `project-overview.md`
- Progresso, open question, o decisioni architetturali → `progress-tracker.md`

Lo stato di avanzamento deve riflettere lo stato reale dell'implementazione, non quello previsto.

---

## Prima di Passare alla Prossima Feature Unit

Tutte e tre le condizioni devono essere vere prima di iniziare la prossima unit:

1. La unit attuale funziona end-to-end nel suo scope definito.
2. Nessuna invariant definita in `architecture-context.md` è stata violata.
3. `progress-tracker.md` riflette il lavoro completato e ogni decisione presa.
