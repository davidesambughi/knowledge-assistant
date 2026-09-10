# 06 — Learning Synthesis (non-code)

<!-- Sintesi finale per portfolio / CV / colloqui. Ogni decisione architetturale chiave
     ri-spiegata con parole proprie, con Valore / Limite / Alternative.
     Fonti: project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md
     (§Completed, §Architecture Decisions, §Test grounding), feature-spec/*.
     Nessun fatto inventato: se un numero o un'alternativa non è nei documenti, non è qui. -->

Verifica del Success Criteria di `project-overview.md`: "Davide è in grado di rispiegare
con parole sue ogni decisione architetturale chiave senza guardare il codice".

---

## 0. Pitch in 30 secondi

Chatbot RAG standalone che risponde **solo** sulla base di un corpus di documentazione
tecnica markdown (il progetto Remote NIF), mai da conoscenza propria. Pipeline costruita
da zero in TypeScript: ingest (chunking strutturale + embedding) → storage su Postgres
con pgvector → retrieval ibrido (vettoriale + full-text fuso con RRF) → generazione in
streaming con grounding vincolato via system prompt. Tool pubblico, quindi con rate
limiting, validazione input a più livelli e security review dedicata (OWASP LLM Top 10).
Live su `kb.davidesambughi.dev`, deploy continuo da GitHub su Vercel.

**Perché esiste:** dimostrare competenza nel *costruire* una pipeline RAG (chunking,
embeddings, retrieval, generazione, guardrail), non solo nell'usare un chatbot con del
testo incollato nel system prompt — che non è verificabile, non scala, e non permette di
sapere cosa il modello "sa" davvero rispetto a cosa inventa.

---

## 1. Numeri chiave (cheat sheet)

| Cosa | Valore |
| --- | --- |
| Corpus | 8 file markdown piatti (ridotti da 151+ annidati), ~200 chunk |
| Embedding model | `gemini-embedding-001`, output 1536 dim (Matryoshka), batch da 20 |
| Vector store | Supabase Postgres + pgvector, indice HNSW (`vector_cosine_ops`) |
| Retrieval | naive cosine + hybrid (full-text `italian` + RRF lato SQL), top-k = 5 |
| Generation model | `gemini-3.1-flash-lite` via Vercel AI SDK 7 (`@ai-sdk/google`), streaming |
| Rate limit | 10 richieste / 10 min per IP (sliding window, Upstash Redis) |
| Limiti input (Zod) | 4.000 char/messaggio · 40 messaggi/richiesta · 12.000 char totali · body ≤ 20 KB |
| Test | 71/71 (Vitest), solo logica pura + invariant di sicurezza |
| Stack | Next.js 16.3, TypeScript ~6.0.x, Tailwind, shadcn/ui (Base UI) |
| Deploy | Vercel collegato a GitHub (auto-deploy), subdomain CNAME su Porkbun |

---

## 2. Chunking — structural / heading-based, fence-aware

**In due parole:** il markdown viene diviso per heading (una sezione = un chunk), non a
lunghezza fissa. Ogni chunk porta il proprio heading-path come prefisso; nessun blocco
fenced (```mermaid```, bash, ecc.) viene mai spezzato a metà. Nessuna soglia di lunghezza.

**Valore**
- Rispetta una struttura semantica **già presente** nella documentazione tecnica: un
  taglio a lunghezza fissa la ignorerebbe e spezzerebbe i concetti a metà.
- Nessuna chiamata LLM per decidere i tagli, nessuna euristica → deterministico e a costo zero.
- L'`heading_path` è riusato a valle come **citazione della fonte** (Invariant #12), non
  serve solo per il retrieval.
- La fence-awareness generalizzata evita che un `#` dentro un blocco bash venga letto
  come heading (bug reale evitato, confermato sul corpus).

**Limite**
- Forte **variabilità dimensionale** tra chunk (da poche righe a sezioni molto lunghe):
  un chunk lungo diluisce il segnale nel suo embedding e può occupare troppo contesto.
- **Nessun overlap** tra chunk → un concetto a cavallo di due sezioni può perdersi al confine.
- `chunk_index` è salvato per una futura espansione "contesto adiacente" (index±1) ma
  **non è ancora usato**.

**Alternative valutate**
- *Fixed-size + overlap* — lo standard dei tutorial RAG; scartato perché ignora la
  struttura del documento su un corpus piccolo e già ben organizzato.
- *Recursive character splitting* — compromesso, ma sempre guidato dalla lunghezza.
- *Semantic chunking* — taglia dove cambia il significato; richiede embeddings/LLM extra,
  sovradimensionato qui.
- *Hierarchical chunking* — parent/child; utile su corpus grandi, non su 8 file.

---

## 3. Embedding model — Gemini `gemini-embedding-001` a 1536 dimensioni

**In due parole:** partito da OpenAI `text-embedding-3-small`, spostato su Gemini dopo
aver scoperto che OpenAI non ha un free tier reale (billing richiesto dalla prima
chiamata). Output ridotto a 1536 dimensioni via Matryoshka Representation Learning
(parametro `outputDimensionality`).

**Valore**
- Free tier reale per embeddings **e** generazione, con una sola chiave (`GEMINI_API_KEY`)
  — lo zero-cost è un vincolo fisso del progetto.
- 1536 dim = stessa dimensione di `text-embedding-3-small` → lo schema `vector(1536)` di
  pgvector **non è cambiato** nel passaggio di provider, nessuna migrazione.
- Cross-linguale verificato (`03f`): query in inglese vs italiano equivalenti → stesso
  chunk top-1, similarity comparabile (0.68 vs 0.63). Corpus IT, domande anche EN: regge.

**Limite**
- La dimensione 1536 è trattata come **decisione irreversibile**: cambiarla obbligherebbe
  a ri-embeddare l'intero corpus.
- I rate limit del free tier Gemini **non sono documentati come garantiti** (Google stessa
  lo dice) → `batch = 20` è una scelta conservativa, non ottimizzata su numeri reali.
- Il timeout va forzato a mano con `AbortSignal.timeout()` perché
  `config.httpOptions.timeout` è rotto nell'SDK `@google/genai` 2.x (issue upstream aperte).
- Gestione errori **fail-loud**: nessun retry automatico, nessuno scarto silenzioso di
  elementi falliti nel batch (Invariant #13) — semplice, ma un errore transitorio fa
  fallire il run (successo al terzo tentativo durante l'ingest iniziale, senza modifiche).

**Alternative valutate**
- *OpenAI `text-embedding-3-small`* — scelta iniziale, scartata per il costo.
- *Modello self-hosted / open-source* — fuori scope: il progetto è TypeScript-only (niente
  Python) e senza infrastruttura propria, entro 1-2 giorni.
- Matryoshka consente anche 768 o 3072 dim — trade-off qualità/spazio/costo indice, non
  esplorato oltre 1536 (compatibilità schema).

---

## 4. Storage — Supabase Postgres + pgvector, indice HNSW, RLS senza policy

**In due parole:** un solo Postgres fa da database relazionale, vector store e motore
full-text. Tabella `document_chunks` con colonne separate per contenuto, heading-path,
file sorgente, indice del chunk, embedding e `tsvector` generato. Indice HNSW per la
ricerca vettoriale, GIN per il full-text. RLS abilitata **senza nessuna policy**.

**Valore**
- Nessun vector DB dedicato in più (Pinecone/Weaviate/Qdrant): un servizio solo, free tier.
- HNSW = ricerca per similarità approssimata veloce anche crescendo.
- **RLS senza policy = nega di default**: tutto l'accesso è server-side con
  `SUPABASE_SECRET_KEY` (che bypassa RLS); qualsiasi query con la chiave pubblica lato
  client viene rifiutata a livello DB. Rinforza l'Invariant #20 oltre il livello applicativo.
- Colonne separate (`source_file` distinto da `heading_path`) permettono filtri diretti
  (`where source_file = ...`) senza parsing di stringhe.

**Limite**
- HNSW è **approssimato**: il recall non è 100%, il vero top-k non è garantito.
- Il `tsvector` è generato con dizionario `italian` **fisso** → un corpus multilingue
  richiederebbe di ripensarlo.
- L'ingest **svuota l'intera tabella a ogni run** (`delete` + re-insert): garantisce
  idempotenza in sviluppo ma non è un aggiornamento incrementale → inadatto a un corpus
  grande o che cresce nel tempo (esplicitamente fuori scope).
- Dimensione `vector(1536)` hardcoded nello schema.

**Alternative valutate**
- *Vector DB dedicato* — scartato per non aggiungere un servizio e restare su un free tier.
- *pgvector con indice IVFFlat* invece di HNSW — build più rapida, query meno accurata;
  HNSW preferito per qualità di retrieval su corpus piccolo.

---

## 5. Retrieval — naive cosine come core, hybrid search (RRF) come upgrade

**In due parole:** il core è una similarity search cosine su pgvector (naive RAG). Sopra
c'è la hybrid search: si combina il ranking vettoriale con quello del full-text di
Postgres, fondendoli con **Reciprocal Rank Fusion** dentro una funzione SQL
(`hybrid_search`). Il top-k è una costante centralizzata (`TOP_K`), mai hardcoded due volte
(Invariant #14).

**Valore**
- Naive RAG resta il pezzo "da capire bene": è la base didattica del progetto.
- La hybrid search recupera match che il solo vettoriale **manca**: caso reale documentato
  — query `"Idempotency"`, il chunk giusto (`Flow 3 — Stripe Checkout`) non compare
  nemmeno nei primi 100 risultati vettoriali, ma è **#2** con la hybrid. L'embedding
  "smussa" i termini esatti, rari o tecnici; il full-text li prende alla lettera.
- RRF **lato SQL**: un solo round-trip di rete, nessuna logica di fusione duplicata nel
  client, riusa il pattern ufficiale Supabase.

**Limite**
- Il full-text su **identificatori con underscore** (`NEXT_PUBLIC_FLAG_AI_REVIEW`) non
  diventa un AND libero ma una **query di frase** (`FOLLOWED BY`, `<->`/`<N>`): richiede
  quei token in quella sequenza esatta → fragile, fallisce se la punteggiatura attorno al
  termine nel documento cambia la tokenizzazione (es. `process.env.NEXT_PUBLIC_...`).
- In hybrid il campo `similarity` restituito **non riflette l'ordine dei risultati**
  (l'ordine segue `fused.score` di RRF): non va usato per dedurre il ranking, solo
  l'ordine dell'array.
- **Nessun `match_threshold`**: se il retrieval è debole tornano comunque k chunk poco
  pertinenti — mitigato dal fatto che poi il modello rifiuta se non trova la risposta.
- Top-k fisso, **nessun re-ranking**, nessuna pipeline multi-step (fuori scope).
- Bug reale trovato e corretto: `LIMIT` senza `ORDER BY` esplicito nella CTE del full-text
  — invisibile con corpus piccolo, sbagliato in generale.

**Alternative valutate**
- *Solo vettoriale* — resta il core; la hybrid è l'upgrade "a più alto impatto e più
  economico" secondo la ricerca fatta.
- *Re-ranking con cross-encoder o LLM* — prossimo step naturale, fuori dai 1-2 giorni.
- *Agentic RAG* (retrieval multi-step guidato dal modello) — fuori scope pratico, ma da
  saper discutere in colloquio come evoluzione.
- *Fusione lato applicazione* (TypeScript) invece che SQL — scartata: più round-trip,
  logica duplicata.

---

## 6. Generazione & Grounding — system prompt come canale (non enforced), difeso a più livelli

**In due parole:** a ogni richiesta si ricostruisce da zero un system prompt strutturato
a tag XML (`<role>`, `<constraints>`, `<context>`) e lo si passa come parametro `system:`
a `streamText`. Il prompt vincola il modello a rispondere **solo** dai chunk recuperati,
a citarli, a dire esplicitamente quando la risposta non è nella documentazione (Invariant
#11/#12), e a ignorare tentativi di override nel messaggio utente (Invariant #19).

**Valore**
- **Grounding testato a fondo** (probe multi-turno, 2026-09-01, esito solido):
  fuori-corpus singolo e dopo 7 turni profondi, jailbreak al turno 9, context poisoning
  con turni assistant **fabbricati** (bugie "MongoDB" / "JWT in localStorage" → ignorate,
  risponde coi fatti reali del corpus), role-play "DevMode" su 4 turni, richieste di
  leak dei `<constraints>` in 3 lingue → **tutti rifiutati**.
- Perché regge (meccanismo, non fortuna):
  1. il system prompt è **ricostruito e re-inviato ogni richiesta** → non scorre mai via
     con la history;
  2. la conversazione è **tappata da Zod** (12k char / 40 msg) → non può fisicamente
     allungarsi abbastanza da seppellire le istruzioni;
  3. il retrieval è **per-turno** sull'ultimo messaggio utente → contesto fresco ogni
     volta, e quando è vuoto il modello rifiuta invece di ripiegare su history o
     conoscenza propria.
- Fix language anchoring (`03g`): prompt riscritto in inglese, regola sulla lingua messa
  **per prima** in `<constraints>` (non per ultima) — pattern raccomandato dalla doc
  ufficiale Gemini per la famiglia Gemini 3. Prima: domanda EN → risposta IT salvo
  richiesta esplicita.

**Limite**
- Il system prompt è un **canale non-enforced**: è un'istruzione, non un vincolo hard. Il
  grounding regge **empiricamente**, non c'è garanzia formale — un LLM può sempre in linea
  di principio deviare.
- Il **text-stream protocol** non ha canale d'errore: un fallimento di Gemini a metà
  streaming arriva al client come `200` con body vuoto/troncato (rischio residuo
  accettato; mitigato lato client trattando una risposta vuota come errore).
- `flash-lite` è un modello **piccolo** → qualità inferiore a un modello grande.
- I follow-up anaforici ("dimmi di più sul secondo") ricevono un "not found" brusco invece
  di "puoi riformulare?" — papercut UX, non di sicurezza.
- Deviazione forzata: `gemini-2.5-flash` (da spec, verificato attivo sulla doc pubblica)
  **rifiutato a runtime** con la chiave reale → diagnosticato via `GET /v1beta/models`,
  sostituito con `gemini-3.1-flash-lite`. Lezione: per lo stato per-account, una chiamata
  reale batte la doc pubblica.

**Alternative valutate**
- *`toUIMessageStreamResponse()`* (canale errore SSE) invece del text-stream — scartato in
  `03a` per la testabilità via curl; sarebbe il cambio se si volesse propagare gli errori
  mid-stream al client.
- *Modello più grande* (Gemini Pro) — costo e latenza maggiori.
- *Grounding "hard"* (constrained decoding, structured output) — non adatto a risposte
  discorsive / fuori scope.
- *Fine-tuning* — esplicitamente fuori scope.

---

## 7. Gestione errore quota Gemini — "peek" dello stream prima di rispondere

**In due parole:** `streamText()` **non lancia mai in modo sincrono** un errore di quota
Gemini — emerge come part `"error"` *dentro* lo stream. Quindi si sbircia il primo
elemento di `result.fullStream` prima di iniziare la risposta al client: se è un errore di
quota riconosciuto (`APICallError` 429 o `RESOURCE_EXHAUSTED`) si risponde `503` con un
messaggio pulito, altrimenti si procede normalmente.

**Valore**
- Un errore di quota davanti a un recruiter diventa "demo momentaneamente al limite
  gratuito" invece di uno stream vuoto o un 500 tecnico.
- Riconoscimento verificato leggendo i **sorgenti installati** (`ai`, `@ai-sdk/google`,
  `@ai-sdk/provider`), non la doc web.

**Limite**
- Il peek **consuma** il primo elemento dello stream: gestito (verificato che nessun chunk
  di risposta va perso), ma è logica delicata.
- Il ramo quota è stato verificato solo con `APICallError`/stream **fabbricati**, mai con
  una quota Gemini davvero esaurita.

**Alternative valutate**
- *Try/catch semplice attorno alla chiamata* — insufficiente: non cattura l'errore che
  vive dentro lo stream asincrono.

---

## 8. Validazione con Zod — un solo confine runtime, tre limiti di consumo

**In due parole:** ogni input esterno (payload di chat, risposte Gemini, righe Supabase,
env vars) passa per uno schema Zod; i tipi TypeScript sono **inferiti** dagli schema, mai
duplicati a mano (Invariant #7). Le env sono validate a startup, fail-fast (Invariant #5).

**Valore**
- Parsing e validazione + tipizzazione nello stesso punto: oltre il confine, i dati sono
  già sia validi che tipati.
- **Tre limiti anti "unbounded consumption"** (OWASP LLM10) su `/api/chat`:
  - `MAX_MESSAGE_LENGTH` = 4.000 char
  - `MAX_MESSAGES_PER_REQUEST` = 40
  - `MAX_TOTAL_REQUEST_LENGTH` = 12.000 char, applicato con `.refine()` sulla **somma**
  Il terzo chiude il worst-case combinato dei primi due: 4.000 × 40 = **160.000 char** per
  richiesta se si chiama l'endpoint direttamente (fuori dalla chat UI).
- Guardia **pre-parsing** sul `Content-Length` (`MAX_BODY_BYTES` = 20 KB → `413`): senza
  `proxy.ts` Next.js non impone limiti sui Route Handler e Vercel accetta fino a 100 MB —
  un body enorme veniva bufferizzato e parsato *prima* che lo schema lo rifiutasse.

**Limite**
- Zod valida **forma e limiti, non semantica**: 12k caratteri di spam passano comunque.
- La guardia sul `Content-Length` è **difesa in profondità, non definitiva** (dichiarato):
  l'header può mancare o mentire → assente/non numerico non viene mai trattato come oversize.
- La validazione runtime ha un costo (trascurabile a questa scala).

**Alternative valutate**
- *Validazione manuale / type assertion* — nessuna garanzia a runtime.
- *Altri validator* (yup, valibot) — non discussi, Zod già standard nello stack.

---

## 9. Rate limiting — sliding window per IP su Upstash Redis

**In due parole:** `@upstash/ratelimit` con **sliding window** 10 richieste / 10 minuti per
IP. L'IP si legge con `ipAddress()` di `@vercel/functions`. È il **primo step** del
`POST`, prima ancora di parsare il body → `429` + `Retry-After` oltre soglia (Invariant #18).

**Valore**
- Protezione minima **di costo** su un tool pubblico che paga (in free tier) ogni chiamata.
- Redis serverless: nessuna infrastruttura da gestire.
- Sliding window = niente raffica al reset di una finestra fissa.

**Limite**
- Per-IP → aggirabile con IP rotanti; e più utenti legittimi dietro lo stesso NAT si
  bloccano a vicenda.
- Deviazione dalla spec: `ipAddress()` legge solo `x-real-ip`, **non** `x-forwarded-for`
  come assunto (verificato nel sorgente del pacchetto).
- In locale l'IP è `"unknown"` condiviso → 10 req/10 min *totali* in sviluppo.
- `.env.local` punta allo **stesso Redis di produzione** → il reset del bucket in dev
  tocca lo stato live (innocuo per un tool personale, ma da sapere).
- Nessun limite **globale di budget**, solo per-IP.

**Alternative valutate**
- *Fixed window* — più semplice, ma raffica ammessa al confine tra due finestre.
- *Token bucket* — permette burst controllati, più stato da gestire.
- *Rate limit a livello edge/WAF di Vercel* — più robusto contro lo spoofing dell'IP.
- *Quota globale sul costo Gemini* — non implementata.

---

## 10. Security headers & CSP — verificati contro la doc del pacchetto installato

**In due parole:** header di sicurezza in `next.config.ts` (`poweredByHeader: false`, CSP,
`frame-ancestors 'none'` + `X-Frame-Options: DENY`, HSTS, `Permissions-Policy`,
`X-XSS-Protection: 0`). `'unsafe-eval'` incluso in `script-src` **solo in sviluppo**.
Controllo dell'`Origin` **auto-referenziale** (`lib/security.ts`): confronta l'Origin della
richiesta con l'URL della richiesta stessa, non una allowlist hardcoded.

**Valore**
- `'unsafe-eval'` condizionato a `isDev` — verificato sulla doc **del pacchetto Next.js
  16.3.1 realmente installato** (`node_modules/next/dist/docs/...`): "not required for
  production, neither React nor Next.js use `eval` in production by default". React lo usa
  solo in dev per ricostruire gli stack trace nel browser.
- Origin check auto-referenziale → nessuna env var da mantenere, copre anche
  `Origin: "null"` / valore malformato (→ `403`).
- Difesa contro prompt injection / leak su più livelli: rate limit, Origin check, limiti
  di lunghezza, tetto `maxOutputTokens`, errori generici al client (dettaglio solo nei
  log), system prompt rinforzato. `npm audit` pulito, nessun segreto nella git history.

**Limite**
- `'unsafe-inline'` resta sempre in `script-src` (inevitabile senza nonce/SRI, coerente
  con l'esempio ufficiale "Without Nonces") → CSP più debole del possibile.
- L'Origin check auto-referenziale **si rompe** se si mette davanti un proxy/CDN che
  cambia l'host.
- Nessun `proxy.ts`/nonce per scelta di semplicità.

**Alternative valutate**
- *CSP con nonce via `proxy.ts`/middleware* (esempio ufficiale "With Nonces") — più sicura,
  più complessa.
- *Allowlist esplicita di Origin* — più rigida, ma va mantenuta a mano.

---

## 11. Deploy — Vercel collegato a GitHub, subdomain dedicato

**In due parole:** progetto Vercel collegato al repo GitHub (non deploy manuale da CLI) →
ogni push rideploya. Subdomain `kb.davidesambughi.dev` via record CNAME su Porkbun, sullo
stesso dominio del portfolio ma progetto Vercel separato. Env vars sulla dashboard Vercel,
Invariant #20 riverificato (nessuna chiave privilegiata lato client, via grep).

**Valore**
- CI/CD gratis, preview URL per ogni PR, SSL automatico.
- Subdomain separato → nessuna interferenza con il portfolio già live.

**Limite**
- Leggero lock-in su Vercel: `ipAddress()` da `@vercel/functions`, l'Origin check assume
  deploy diretto senza proxy.
- Free tier con limiti di esecuzione/banda.

**Alternative valutate**
- *Deploy manuale da CLI* — nessun auto-deploy.
- *Self-hosting / Docker* — più controllo, molto più lavoro (fuori dai 1-2 giorni).

---

## 12. Testing policy — solo logica pura e invariant di sicurezza

**In due parole:** Vitest, file `*.test.ts` colocati. Si testano parsing, validazione,
trasformazioni dati e gli invariant di sicurezza. **Non** si testano chiamate reali a
Gemini o scritture reali su Supabase (servizio esterno live, anche se gratuito) → quelle
sono verificate manualmente e la verifica è documentata in ogni feature-spec. Se una
funzione mischia logica pura e I/O esterno, la logica pura va **estratta** e testata da sola.

**Valore**
- Regressioni su chunking / validazione / CSP / Origin check prese subito.
- Zero costo esterno nei test, nessun mock fragile di servizi di terzi.
- Politica nata da una richiesta esplicita dopo `01a`/`01b` (prima i test erano esclusi di
  default per il vincolo di tempo).

**Limite**
- **Nessun test end-to-end automatico** della pipeline (retrieval reale, generazione
  reale) → la verifica è manuale, non ripetibile in CI.
- Nessun test dei componenti React (jsdom non configurato).
- Copertura mirata per scelta, non esaustiva.

**Alternative valutate**
- *Mockare Gemini/Supabase* — scartato: testa il mock, non il sistema, ed è fragile.
- *E2E con Playwright + chiavi di test* — costo e complessità fuori scope.

---

## 13. i18n — la lingua che conta segue la domanda, non la UI

**In due parole:** `next-intl` senza i18n routing (cookie `NEXT_LOCALE`). Lo switch IT/EN
nell'header è stato **rimosso** (`03h`): cambiava solo le stringhe statiche della UI, mai
la lingua della risposta del modello — giudicato fuorviante. La UI è fissa in inglese; la
**risposta del modello segue la lingua della domanda** (`03g`), indipendente dalla UI.
Unica parte bilingue: il pannello overview recruiter-facing, con testo IT/EN dedicato.

**Valore**
- Ciò che davvero cambia per l'utente (la risposta) si adatta da solo alla domanda.
- Nessuna UI ingannevole che suggerisce di poter cambiare qualcosa che non cambia.
- Il corpus resta solo in italiano, non tradotto, nessun contenuto duplicato nel DB.

**Limite**
- `next-intl` resta installato per una feature (multi-locale completo) che non esiste →
  dipendenza tenuta "in prestito" per una possibile evoluzione.
- Il pannello overview ha la sua gestione bilingue separata, non riusabile altrove.

**Alternative valutate**
- *UI davvero bilingue completa* — scartata: sforzo alto, valore basso su un tool a
  pagina singola, single-user.
- *Rimuovere del tutto `next-intl`* — non fatto, per lasciare la porta aperta.
- *Auto-detect della lingua UI* — scartato: la lingua UI è una preferenza esplicita.

---

## 14. Metodo di lavoro (spendibile in colloquio)

- **Spec-first, una unit alla volta.** Ogni pezzo (00 → 06) ha una feature-spec scritta
  *prima* del codice; `progress-tracker.md` è aggiornato dopo ogni modifica → il lavoro
  riprende tra sessioni senza perdere contesto, e ogni decisione ha un audit trail.
- **Non fidarsi del training su librerie che evolvono in fretta.** Regola esplicita nel
  progetto: verificare la doc ufficiale aggiornata, e per il comportamento runtime/interno
  leggere il **sorgente del pacchetto installato** — fatto per: `toTextStreamResponse`
  deprecato in `ai@7.0.66`, `ipAddress()` che legge `x-real-ip`, il timeout rotto in
  `@google/genai`, `'unsafe-eval'` non necessario in produzione, `gemini-2.5-flash` non
  disponibile per l'account.
- **Revisioni esterne (altro LLM) verificate, non accettate a scatola chiusa.** Track
  record storico ~50/50 → ogni correttiva proposta è stata riverificata con ricerca
  propria prima di applicarla (`03a`, `03d`, `03i`).
- **Quando tocco un file di una unit già chiusa, dichiaro cosa c'è di preesistente**, non
  solo il mio diff (regola nata da un caso reale in `03c`).

---

## 15. Cosa direi come "prossimi step" (evoluzione naturale)

1. **Evaluation framework (LLM eval)** — il prossimo step più citato. Oggi il grounding è
   verificato da `scripts/grounding-probe.ts`: utile, ma **binario** (rifiuta / non
   rifiuta) e **manuale** (l'output lo leggo io). L'evoluzione: un **golden dataset** di
   domande sul corpus Remote NIF (con risposta attesa e/o chunk attesi), 3-5 **metriche
   RAG** calcolate in automatico — *faithfulness* (la risposta è supportata dai chunk?
   = Invariant #11 misurato con un numero), *answer relevancy*, *context precision* (i
   chunk recuperati sono pertinenti?), *context recall* (il retrieval li ha trovati
   **tutti**? — qui rientrano il caso "Idempotency" e il limite "HNSW approssimato") —
   con uno scoring **LLM-as-a-judge** (un modello più forte che vota 1-5 su rubrica,
   versione pinnata, spot-check umano sul ~10%), il tutto agganciato alla **CI** per
   bloccare le regressioni oltre una soglia. Framework di riferimento: **RAGAS**
   (specifico per RAG), **DeepEval** (general-purpose). Valore per il progetto: le
   affermazioni argomentate a parole in questo documento ("hybrid > naive", "top-k = 5
   è il compromesso giusto") diventerebbero decisioni **misurate** ("+0.14 di context
   recall sul golden set"). Il grounding probe è già un primo passo consapevole in
   questa direzione.
2. **Re-ranking** dei risultati del retrieval con un cross-encoder o un LLM re-rank —
   l'upgrade di qualità più ovvio dopo la hybrid search.
3. **Agentic RAG**: lasciare che il modello decida se e come cercare, con più passi di
   retrieval e tool use verso una fonte esterna (bonus già tracciato, mai costruito).
4. **Ingest incrementale** invece di svuotare la tabella a ogni run → necessario per un
   corpus che cresce.
5. **Contesto adiacente**: usare `chunk_index` per allegare chunk index±1 a quello
   recuperato, recuperando il contesto perso dall'assenza di overlap.
6. **CSP con nonce** via `proxy.ts` per eliminare `'unsafe-inline'`.
7. **Canale d'errore nello streaming** (`toUIMessageStreamResponse`) per mostrare al
   client i fallimenti Gemini a metà risposta.

---

## 16. Glossario dei concetti (per il ripasso)

**HNSW (Hierarchical Navigable Small World)** — il tipo di indice che pgvector usa per la
ricerca vettoriale. Senza indice dovresti confrontare il vettore-domanda con *tutti* i
chunk (scansione lineare). HNSW costruisce un grafo a più livelli: i livelli alti hanno
pochi nodi con "salti lunghi", quelli bassi tutti i nodi con collegamenti corti. La
ricerca parte dall'alto, si avvicina in fretta alla zona giusta, poi raffina scendendo →
tempo ~logaritmico invece che lineare. Alternativa in pgvector: **IVFFlat** (divide lo
spazio in cluster, cerca solo nei più vicini; build più rapida, meno preciso).

**Approssimato / recall / "vero top-k non garantito"** — *recall* = quanti dei risultati
davvero corretti riesci a recuperare. Una ricerca esatta guarda tutti i vettori e
restituisce i 5 realmente più vicini, garantito. HNSW naviga il grafo e si ferma prima di
aver visto tutti i nodi → ogni tanto un risultato giusto sfugge (recall < 100%) e al suo
posto arriva il "quasi-giusto". Trade-off accettato: perdi una frazione di precisione,
guadagni ordini di grandezza in velocità. Su 200 chunk l'effetto pratico è trascurabile.

**Top-k** — *k* = quanti chunk il retrieval restituisce da passare al modello come
contesto. Nel progetto **k = 5**, centralizzato nella costante `TOP_K` (Invariant #14).
Trade-off: k troppo basso → rischi di escludere il chunk con la risposta; k troppo alto →
diluisci il contesto con roba poco pertinente, più token, più confusione.

**Batch** — il gruppo di elementi processati insieme in una sola chiamata API. All'ingest
ci sono ~200 chunk da embeddare: invece di 200 chiamate HTTP separate, se ne mandano **20
per volta** (`EMBEDDING_BATCH_SIZE = 20`) → 10 chiamate. 20 e non di più = scelta
conservativa, i limiti del free tier Gemini non sono garantiti.

**Full-text search di Postgres** — la ricerca "per parole chiave" nativa di Postgres, che
nella hybrid search affianca quella vettoriale. Postgres trasforma ogni chunk in un
`tsvector` (termini normalizzati: minuscole, stopword rimosse, ridotti alla radice) —
nel progetto è la colonna `fts`, generata dal `content` con dizionario `italian`,
indicizzata con un indice **GIN**. La query utente diventa un `tsquery` e Postgres
ordina per rilevanza (`ts_rank`). Valore: prende i termini esatti/rari/tecnici che
l'embedding "smussa" (caso reale: "Idempotency" — chunk fuori dai primi 100 vettoriali).

**RRF (Reciprocal Rank Fusion)** — la formula che fonde due classifiche in una. La hybrid
search produce due liste per la stessa domanda (una vettoriale, una full-text) con score
**non confrontabili** (cosine 0–1 vs `ts_rank` a scala arbitraria). RRF ignora gli score
grezzi e usa la **posizione**: `score(chunk) = 1/(k + rank_lista_A) + 1/(k + rank_lista_B)`
con `k` costante (~60). Semplice, nessun tuning, robusto. Calcolato dentro la funzione SQL
`hybrid_search` → un solo round-trip, nessuna logica duplicata in TypeScript.

**`heading_path` e `chunk_index`** (colonne di `document_chunks`) — `heading_path` è la
posizione gerarchica del chunk ricostruita dagli heading che lo contengono (es.
`"Architettura > Gestione Webhook"`): serve a **citare la fonte** (Invariant #12) e a
filtrare; mai passato al modello di embedding. `chunk_index` è la posizione ordinale del
chunk nel file (0, 1, 2…): **non ancora usato attivamente**, previsto per debug e per il
"contesto adiacente" (allegare chunk index±1 a quello recuperato). `source_file` è tenuto
separato da `heading_path` per query dirette (`WHERE source_file = ...`) senza parsing.

**Identificatori con underscore nel full-text** — cercare `NEXT_PUBLIC_FLAG_AI_REVIEW`
*non* dà un AND libero tra le parole. Postgres lo tratta come parola composta e lo traduce
in una **query di frase**: i lessemi devono comparire in quella sequenza esatta e
consecutivi. Operatori: `<->` = "immediatamente seguito da", `<N>` = "seguito da a
distanza N". Sul DB reale diventa `'next' <-> 'public' <-> 'flag' <2> 'review'` (il `<2>`
per la stopword italiana "ai" scartata che lascia un buco di posizione). Conseguenza: se
nel documento il termine appare come `process.env.NEXT_PUBLIC_FLAG_AI_REVIEW`, il `.`
cambia la tokenizzazione, la sequenza attesa si rompe, il match fallisce **pur essendo il
termine presente**. Solo per gli identificatori con underscore; parole singole (anche
tecniche) non hanno il problema. Non risolto (fuori scope) — da sapere come limite.

**Sliding window (rate limiting)** — modo di contare le richieste per "10 ogni 10 min".
*Fixed window*: blocchi netti (12:00–12:10, 12:10–12:20…), contatore azzerato di colpo al
confine → si possono fare 10 richieste a 12:09:30 e 10 a 12:10:30 = 20 in un minuto.
*Sliding window*: la finestra è sempre "gli ultimi 10 minuti da adesso", scorre in
continuo, non si azzera mai di scatto → niente raffica al confine. Costa un po' di più
(traccia i timestamp recenti, non solo un contatore) ma è più equo. È quello che usa
`@upstash/ratelimit`. *Token bucket* (terza opzione): secchio di gettoni che si rigenerano
a ritmo costante, permette burst controllati, più stato da gestire.

**Security headers** — intestazioni HTTP che dicono al browser di applicare regole di
sicurezza sulla pagina. Nel progetto (`next.config.ts`): **HSTS** (solo HTTPS d'ora in
poi), **`X-Frame-Options: DENY`** / **`frame-ancestors 'none'`** (nessuno può metterti in
un iframe → anti-clickjacking), **`X-Content-Type-Options: nosniff`** (non indovinare il
tipo dei file), **`Permissions-Policy`** (disattiva webcam/microfono/geolocalizzazione non
usati), **`X-XSS-Protection: 0`** (disattiva un vecchio filtro browser ormai dannoso),
**`poweredByHeader: false`** (non annunciare "Next.js" a un attaccante).

**LLM eval / evaluation framework** — l'infrastruttura per misurare in modo **ripetibile**
la qualità di un'app LLM, invece di giudicarla "a occhio". Serve perché un LLM è non
deterministico e le risposte non hanno un giusto/sbagliato secco come un test unitario.
Tre pezzi: (1) **golden dataset** — 100-500 esempi curati (domanda + risposta/chunk
attesi), il banco di prova fisso; (2) **metriche task-specific** — per il RAG:
*faithfulness* (risposta supportata dai chunk, senza invenzioni), *answer relevancy*,
*context precision* (chunk recuperati pertinenti?), *context recall* (recuperati **tutti**
quelli rilevanti?); (3) **scoring** — per metriche senza formula si usa **LLM-as-a-judge**:
un secondo LLM (più forte, versione pinnata) vota 1-5 su rubrica, con spot-check umano sul
~10%. Si aggancia alla **CI**: a ogni push gli eval girano e bloccano il merge se una
metrica peggiora oltre soglia (~5%). Framework: **RAGAS** (specifico RAG, ha definito
queste metriche), **DeepEval** (general-purpose). Nel progetto: `scripts/grounding-probe.ts`
è una versione primitiva (binaria, manuale) di questa idea.

**CSP (Content-Security-Policy)** — l'header di sicurezza più importante: una whitelist di
cosa la pagina può caricare ed eseguire (`script-src`, `style-src`, `img-src`,
`connect-src`, `frame-ancestors`…). Se un attaccante inietta uno `<script>` malevolo
(XSS), il browser si rifiuta di eseguirlo perché non è nella whitelist. Nel progetto:
`'unsafe-eval'` (permesso di usare `eval()`) è attivo **solo in sviluppo** — React lo usa
lì per ricostruire gli stack trace, in produzione né React né Next.js chiamano `eval`,
quindi permetterlo sarebbe superficie d'attacco gratuita (verificato sulla doc del
pacchetto Next.js installato). `'unsafe-inline'` è rimasto sempre: eliminarlo richiede i
*nonce* e un `proxy.ts`, complessità non aggiunta di proposito.
