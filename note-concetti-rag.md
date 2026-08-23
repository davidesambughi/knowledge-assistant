# Note & Concetti — Knowledge Assistant RAG
 
Appunti di studio, aggiornati man mano che procediamo nel progetto. Definizioni concise, per ripasso rapido.
 
---
 
## Chunk
Porzione di un documento in cui spezziamo il testo originale prima di indicizzarlo. Non è "una frase", ma una sezione con senso compiuto (nel nostro caso: per heading/sezione del markdown). Un chunk troppo grande diluisce il significato (mescola più concetti); un chunk troppo piccolo perde il contesto che gli dà senso.
 
## Embedding
Il *processo* di trasformare un testo in una rappresentazione numerica che ne cattura il significato semantico. Generato da un modello dedicato — non esiste un solo modello: le famiglie principali nel 2026 sono OpenAI (`text-embedding-3-small/large`), Google (`gemini-embedding-001`), Voyage AI, Cohere (`embed-v4`), e modelli open-source self-hosted (es. famiglia `bge`, `e5`). Differiscono per dimensionalità, lingue supportate, costo, e se richiedono API a pagamento o girano in locale. Nel nostro progetto: `gemini-embedding-001` di Google (scelto per avere un free tier reale, senza carta di credito — non per superiorità tecnica sugli altri).
 
## Vector
Il *risultato* dell'embedding: una lista di numeri a dimensione fissa (nel nostro caso, 1536 numeri) che rappresenta il significato del testo. "Embedding" e "vector" vengono spesso usati come sinonimi nella pratica, ma tecnicamente: embedding = processo, vector = prodotto.
 
## Similarity search (ricerca per similarità)
Il metodo per trovare, tra tutti i vector salvati, quelli più "vicini" matematicamente al vector di una domanda. Vicinanza matematica ≈ somiglianza di significato. Nel nostro caso useremo cosine similarity (tramite pgvector).
 
## heading_path (metadato di sezione)
Colonna separata dal testo del chunk (`content`) che contiene solo il percorso dell'heading (es. "Architettura > Gestione Webhook"). Serve per due scopi che il testo libero non permette facilmente:
1. Filtrare/interrogare senza fare ricerca semantica (query SQL diretta)
2. Mostrare la "fonte" della risposta in modo pulito, senza dover analizzare il testo
Fallback se una sezione non ha un heading esplicito: si usa il nome del file come heading_path (es. "README.md — introduzione").
 
## Indice HNSW (Hierarchical Navigable Small World)
Struttura dati che organizza i vector per rendere la similarity search veloce anche su grandi quantità di dati, evitando di confrontare la query con ogni singolo vector uno per uno (ricerca esatta → lenta su larga scala). Fa una ricerca approssimata ma velocissima, con perdita di precisione trascurabile. Per corpus piccoli (poche centinaia di chunk, come il nostro) non è strettamente necessario per le performance, ma è lo standard di produzione con pgvector.
 
## RAG semplice (naive RAG)
Pipeline lineare a un solo passaggio: domanda → retrieval (ricerca chunk simili) → generazione risposta. Nessuna decisione autonoma del modello su come/quanto cercare. È quello che stiamo costruendo come core del progetto.
 
## Agentic RAG
Livello sopra il RAG semplice: il modello può decidere autonomamente di fare più ricerche, riformulare la query, chiamare tool/fonti esterne oltre al retrieval documentale, autovalutare se il contesto trovato è sufficiente e ripetere la ricerca se non lo è. Potente ma costoso (3-10x più chiamate LLM per query) — ha senso solo se il retrieval di base è già solido; altrimenti si spende di più per sbagliare in modo più elaborato. Nel nostro progetto resta fuori scope per i 2 giorni, ma è la naturale evoluzione da menzionare nella narrativa portfolio.
 
## Agent Harness (harness engineering)
Infrastruttura software che circonda un modello LLM e lo trasforma in un agente funzionante: gestisce uso di strumenti, memoria, persistenza dello stato, cicli di feedback e guardrail — tutto ciò che non è il "ragionamento" grezzo del modello. Formula diventata standard nel 2026: **Agent = Model + Harness**. Metafora: il modello è il motore, l'harness è il resto dell'auto (ruote, sterzo, freni).
 
Non è in contrapposizione al RAG — è un layer diverso, complementare: il RAG è COSA il sistema recupera e come genera la risposta, l'harness è l'infrastruttura che tiene in piedi il ciclo (specialmente quando il RAG diventa agentic/multi-agent, vedi sotto). Più un sistema è agentic, più serve un harness solido, altrimenti il ciclo si perde, ripete lavoro a caso, o va fuori controllo.
 
**Collegamento diretto al nostro modo di lavorare:** il nostro `AGENTS.md` (nel metodo spec-driven) È un pezzo di harness engineering — è la "guida" che dice all'agente Claude Code cosa leggere e come comportarsi. Gli "Invariants" in `architecture-context.md` (es. "mermaid non si spezza mai") sono vincoli comportamentali, stesso principio.
 
## Multi-agent RAG
Evoluzione oltre l'agentic RAG a singolo agente: invece di un solo agente che fa tutto il loop (cerca → valuta → ri-cerca), più agenti specializzati collaborano. Due approcci principali:
- **Centralizzato**: un agente "orchestratore" coordina agenti worker specializzati (es. uno recupera da un DB relazionale, un altro da un document store)
- **Decentralizzato**: agenti con ruoli diversi collaborano senza gerarchia rigida, ciascuno sfrutta le proprie competenze specifiche
Territorio di ricerca attiva nel 2026, rilevante per conversazioni da colloquio, ma ben oltre lo scope di un progetto da 2 giorni.
 
## Scala evolutiva completa RAG + Agenti (per contesto/colloqui)
1. **Naive RAG** — pipeline lineare. ✅ Il nostro core.
2. **Advanced/Hybrid RAG** — + hybrid search, reranking. 🔲 Il nostro upgrade in scope.
3. **Agentic RAG** — un agente ragiona in loop (cerca/valuta/ri-cerca); qui inizia a servire un harness minimo per gestire il loop e la memoria tra un passaggio e l'altro.
4. **Multi-agent RAG** — più agenti specializzati collaborano invece di uno solo che fa tutto.
5. **Harness engineering** — layer trasversale che rende 3 e 4 affidabili in produzione (memoria, strumenti, stato, guardrail). Non è un "livello sopra" nella stessa scala, è l'infrastruttura che serve quando la scala sale.
**Nota anti-hype (utile per colloqui):** nel 2025 si era parlato di "morte del RAG" con l'arrivo di modelli con context window >1M token (si pensava bastasse caricare tutto il documento). Nel 2026 il RAG resta lo standard di produzione per 3 motivi concreti: costo (100x più economico recuperare poche centinaia di chunk che processare 1M token ogni query), latenza, e freschezza dei dati (aggiornabile senza retraining).
 
---
Con naive RAG, l'intera domanda dell'utente diventa UN SOLO vector per UNA SOLA ricerca — anche se è lunga o complessa. Se la domanda tocca più argomenti insieme (es. "come funziona l'autenticazione E come gestite i webhook di Stripe?"), il vector risultante è una "media sfocata" dei due intenti, e il retrieval fatica a trovare chunk ottimi per entrambi (stesso problema della diluizione, applicato alla query invece che al chunk).
 
Soluzioni (entrambe oltre il naive RAG, tipiche dell'Advanced/Agentic RAG):
- **Query decomposition**: un LLM spezza la domanda complessa in sotto-domande più semplici, fa retrieval separato per ciascuna, poi combina i risultati. Comportamento già "agentic" — richiede una chiamata LLM in più prima del retrieval.
- **Query rewriting/expansion**: riformulare la domanda originale in una versione più chiara/esplicita prima di trasformarla in vector — meno invasivo della decomposizione, ma sempre un passaggio LLM in più.
Nel nostro progetto (naive RAG + hybrid search, non agentic) questo caso NON viene gestito — è un limite noto e accettato, utile da citare in colloquio come esempio di "dove naive RAG mostra il limite, e dove agentic RAG sarebbe il fix naturale".
 
## Hybrid Search (ricerca ibrida)
Il primo e più efficace upgrade rispetto al naive RAG puro. Combina due tipi di ricerca in parallelo:
- **Dense/vettoriale** (quella che stiamo già costruendo): trova somiglianza di *significato*
- **Sparse/lessicale (keyword, es. BM25 o Postgres full-text search)**: trova corrispondenze *esatte* di parole (nomi, termini tecnici, codici)
Poi i risultati delle due ricerche vengono fusi (es. con Reciprocal Rank Fusion). Motivo: la ricerca vettoriale pura perde i match testuali esatti, la ricerca a parole chiave pura perde il significato — insieme coprono i punti deboli l'una dell'altra. È l'upgrade più economico e ad alto impatto rispetto al naive RAG, prima di considerare qualsiasi cosa più complessa (reranking, agentic).
 
## Scala di complessità RAG (dove ci troviamo)
1. **Naive RAG** — pipeline lineare: query → embedding → similarity search → generazione. ✅ Costruiamo questo come core del progetto (necessario per capire le basi).
2. **Advanced/Hybrid RAG** — aggiunge hybrid search (dense + keyword) e/o reranking. 🔲 Obiettivo realistico da aggiungere nei 2 giorni: hybrid search con Postgres full-text search (nativo in Supabase, nessun servizio esterno).
3. **Agentic RAG** — ciclo autonomo di ricerca/valutazione/ri-ricerca, tool use. ⏸️ Fuori scope per ora, menzionato come prossimo step naturale.
4. **GraphRAG** — retrieval su grafo di entità/relazioni, utile per corpus con ragionamento multi-hop. Non rilevante per il nostro caso (corpus piccolo, domande dirette).
---
 
## Schema tabella Supabase (bozza in discussione)
 
```sql
create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  source_file text not null,          -- es. "architecture.md"
  heading_path text not null,         -- es. "Architettura > Gestione Webhook"
  content text not null,              -- il testo del chunk (heading-prefix + corpo)
  chunk_index int not null,           -- posizione del chunk nel file originale
  embedding vector(1536) not null,    -- generato da gemini-embedding-001
  created_at timestamptz default now()
);
 
create index on document_chunks
  using hnsw (embedding vector_cosine_ops);
```
 
- `content` → dato al modello di embedding (per generare il vector) e al modello di generazione (per rispondere)
- `heading_path` → mai passato al modello di embedding; usato per filtri e citazione fonte

## Strategie di chunking — panoramica (non tutte usate in questo progetto)

Non esiste UN metodo di chunking "giusto" — si sceglie in base al formato del documento e a cosa serve al retrieval. Non è invenzione libera per progetto: sono pattern abbastanza standardizzati, spesso combinati/adattati insieme nello stesso pipeline (uno per tipo di file, se il corpus è eterogeneo).

- **Fixed-size**: taglio a lunghezza fissa (es. ogni 500 token), ignora la struttura del testo. Semplice ma rischia di spezzare frasi/blocchi di codice a metà.
- **Sliding window / overlap**: variante di fixed-size — i chunk si sovrappongono parzialmente per non perdere contesto al confine di taglio. Si combina CON fixed-size, non è alternativa a sé.
- **Recursive character splitting**: come fixed-size ma prova prima a tagliare su paragrafi/frasi prima di arrivare al taglio per caratteri — più pulito, ma ignora comunque la struttura logica del documento.
- **Semantic chunking**: un modello confronta embedding di frasi consecutive e taglia dove la similarità scende (dove "cambia argomento"). Costoso (chiamate LLM/embedding extra), overkill su documenti già ben strutturati.
- **Structural chunking (generalizzazione di "per heading")**: taglio sui confini nativi del formato — heading in markdown (il nostro caso), tag in HTML, funzioni/classi nel codice, slide in un PDF. Riusa gratis una struttura logica già esistente nel documento.
- **Hierarchical / parent-child**: chunk piccoli per la precisione nel retrieval, collegati a un "genitore" più grande (sezione/documento intero) recuperato per dare contesto quando il figlio matcha. Risolve il compromesso "chunk piccolo = preciso ma povero di contesto".
- **Agentic chunking**: un LLM legge il documento e decide dove tagliare in base al significato, ragionando sulla struttura concettuale (non solo similarità tra frasi come nel semantic). Usato quando il documento non ha già una struttura data (testo grezzo).
- **Late chunking**: si genera l'embedding dell'intero documento (o finestre lunghe) PRIMA di tagliare, poi si derivano i vector dei singoli chunk da quello — ogni chunk "eredita" contesto globale invece di essere embeddato isolato. Richiede modelli di embedding che lo supportano esplicitamente.

**La nostra scelta ("per heading")** è il caso `structural chunking` applicato a markdown: il corpus Remote NIF è già ben strutturato con heading semantici, quindi tagliare sui confini di sezione riusa gratis un lavoro di organizzazione già fatto — nessuna euristica (fixed-size) o costo aggiuntivo (semantic/agentic) necessari.

## Redis / Upstash
Redis è un database in-memory (RAM, non disco): letture/scritture velocissime, dati volatili — adatto a dati che non devono sopravvivere per sempre (contatori, cache, sessioni), non al dato "vero" del progetto (quello resta su Supabase/Postgres). Upstash è Redis-as-a-service, senza server da gestire.

**Perché serve per il rate limit su Vercel:** le funzioni serverless girano su istanze isolate che non condividono RAM tra loro. Un contatore tenuto in una variabile JS sarebbe diverso per ogni istanza — un attaccante distribuito su più istanze bucherebbe il limite. Upstash vive fuori dal processo serverless (raggiunto via REST HTTP), quindi tutte le istanze leggono/scrivono lo stesso contatore condiviso.

## MCP (Model Context Protocol)
Protocollo che dà a un agente AI (Claude Code) accesso diretto alle azioni di un servizio esterno (es. Supabase: eseguire SQL, leggere schema, cercare nella doc ufficiale), non solo output testuale da copiare a mano. "L'agente ha le mani sul servizio, non solo la conoscenza di come usarlo."

## gemini-embedding-001 (Google) — il nostro modello
Modello embedding scelto per il progetto. Supporta output a dimensionalità variabile (768/1536/3072) tramite Matryoshka Representation Learning — una tecnica che permette di "tagliare" un vettore più lungo mantenendo la qualità semantica, invece di dover riaddestrare un modello per ogni dimensione. Limite: max 2048 token per singolo input (contro gli 8192 di OpenAI `text-embedding-3-small`) — un dettaglio che conta se i chunk possono essere lunghi. Free tier reale (nessuna carta di credito richiesta) fino a un tetto di richieste/token al minuto — oltre quel tetto serve un account a pagamento.

**Perché non è "il migliore in assoluto", è la scelta per QUESTO progetto:** ogni modello embedding ha trade-off diversi (costo, dimensionalità, lingue, limite token, latenza). La scelta giusta dipende dai vincoli del progetto (qui: budget zero), non da una classifica universale.

## Dimensioni (embedding)
Un embedding di "N dimensioni" è una lista di N numeri floating-point (positivi o negativi, es. 0.0234, -0.1872) che insieme rappresentano il significato del testo. Ogni numero è una coordinata astratta decisa dal modello durante il training — non interpretabile isolatamente da un umano; il significato emerge solo dalla combinazione di tutti i numeri insieme e dal confronto (similarity search) con altri vettori. La dimensionalità dipende dal modello: es. 1536 per `text-embedding-3-small` (OpenAI, fissa), 768/1536/3072 per `gemini-embedding-001` (Google, variabile via Matryoshka — vedi sopra). Più dimensioni ≈ più informazione catturata ma più storage/calcolo; la colonna `vector(N)` in Postgres deve corrispondere esattamente al modello scelto — cambiare modello embedding dopo aver popolato il DB richiede ri-embedding di tutto il corpus, non solo un cambio di configurazione.

## tsx
Strumento che esegue file TypeScript direttamente da riga di comando, senza un passaggio di compilazione manuale separato (niente `tsc` prima, niente file `.js` intermedi da gestire). Usato nel progetto per far girare script standalone (es. `lib/rag/ingest.ts`) fuori dal ciclo di vita di Next.js — via `npx tsx percorso/file.ts`. Differenza da tenere a mente: **Next.js carica `.env.local` automaticamente, `tsx` no** — uno script lanciato con `tsx` deve caricare le env vars esplicitamente (`tsx --env-file=.env.local ...`), altrimenti la validazione Zod in `lib/env.ts` fallisce a import-time per variabili "mancanti" che in realtà esistono solo nel contesto Next.js.