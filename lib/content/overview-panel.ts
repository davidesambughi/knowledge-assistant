export const OVERVIEW_INTRO = {
  it: "Questo è un chatbot RAG (Retrieval-Augmented Generation): risponde solo leggendo una documentazione tecnica reale, non inventa. Cerca i passaggi più rilevanti nei documenti — il \"retrieval\" — e li usa per generare una risposta, basandosi solo su quelli. Se la risposta non è nei documenti, lo dice invece di inventarla.",
  en: "This is a RAG chatbot (Retrieval-Augmented Generation): it only answers from real technical documentation — it doesn't make things up. It finds the most relevant passages in the docs — the \"retrieval\" step — and uses them to generate an answer. If the answer isn't in the docs, it says so instead of guessing.",
};

export interface OverviewPoint {
  id: string;
  it: { label: string; description: string };
  en: { label: string; description: string };
}

// Ogni punto mostra la decisione E il perché rispetto alle alternative — non un'etichetta
// generica. I fatti (metriche, limiti numerici) sono verificati contro progress-tracker.md.
export const OVERVIEW_POINTS: OverviewPoint[] = [
  {
    id: "chunking",
    it: {
      label: "Chunking per heading (structural)",
      description:
        "Il corpus è documentazione Markdown già divisa in sezioni semanticamente coerenti, quindi si taglia sugli heading invece che a lunghezza fissa con overlap: nessuna euristica di lunghezza, nessuna chiamata LLM per decidere i tagli. Costo accettato: chunk di dimensione molto variabile. Il parsing è fence-aware — un # dentro un blocco di codice non viene mai scambiato per un titolo.",
    },
    en: {
      label: "Heading-based (structural) chunking",
      description:
        "The corpus is Markdown docs already split into semantically coherent sections, so chunks are cut on headings rather than fixed length with overlap: no length heuristic, no LLM call to decide the splits. Accepted trade-off: highly variable chunk size. Parsing is fence-aware — a # inside a code block is never mistaken for a heading.",
    },
  },
  {
    id: "hybrid-retrieval",
    it: {
      label: "Hybrid retrieval (vettoriale + full-text, RRF)",
      description:
        "Similarity coseno su pgvector fusa con la full-text search di Postgres tramite Reciprocal Rank Fusion, lato SQL in un solo round-trip. La sola similarity vettoriale manca i match esatti su termini e identificatori: la query \"Idempotency\" non entra nei primi 100 risultati vettoriali, ma è seconda con l'hybrid. Top-k = 5, centralizzato.",
    },
    en: {
      label: "Hybrid retrieval (vector + full-text, RRF)",
      description:
        "Cosine similarity on pgvector fused with Postgres full-text search via Reciprocal Rank Fusion, in SQL, one round-trip. Vector similarity alone misses exact term and identifier matches: the query \"Idempotency\" isn't in the top 100 vector results, yet ranks second with hybrid. Top-k = 5, set in one place.",
    },
  },
  {
    id: "strict-grounding",
    it: {
      label: "Strict grounding",
      description:
        "Il system prompt (in inglese, struttura a tag XML) vincola il modello ai soli chunk recuperati, impone la citazione della fonte e il rifiuto esplicito quando l'informazione non c'è. Il prompt non è una garanzia hard, quindi è rinforzato su più livelli contro prompt injection e tentativi di far rivelare le istruzioni.",
    },
    en: {
      label: "Strict grounding",
      description:
        "The system prompt (English, XML-tag structure) constrains the model to the retrieved chunks only, requires source citation, and forces an explicit refusal when the answer isn't there. A prompt is not a hard guarantee, so it's hardened at several levels against prompt injection and attempts to leak the instructions.",
    },
  },
  {
    id: "rate-limiting",
    it: {
      label: "Rate limiting (sliding window)",
      description:
        "Redis su Upstash, 10 richieste / 10 minuti per IP. Sliding window invece di fixed window per evitare il picco di traffico doppio al confine tra due finestre; non un token bucket, perché qui non servono burst legittimi ma solo un tetto di costo su un endpoint pubblico.",
    },
    en: {
      label: "Rate limiting (sliding window)",
      description:
        "Redis on Upstash, 10 requests / 10 minutes per IP. Sliding window rather than fixed window to avoid the double-traffic spike at the boundary between two windows; not a token bucket, since there's no legitimate burst to allow here — just a cost ceiling on a public endpoint.",
    },
  },
  {
    id: "input-validation",
    it: {
      label: "Input validation (Zod)",
      description:
        "Ogni richiesta passa da uno schema Zod prima di retrieval e generazione: ruolo, lunghezza per messaggio (4.000 caratteri), numero di messaggi (40) e somma totale (12.000 caratteri). L'ultimo vincolo chiude il worst-case dei primi due — 4.000 × 40 = 160.000 caratteri da un client che chiama l'endpoint direttamente.",
    },
    en: {
      label: "Input validation (Zod)",
      description:
        "Every request goes through a Zod schema before retrieval and generation: role, per-message length (4,000 chars), message count (40), and total sum (12,000 chars). That last bound closes the worst case of the first two — 4,000 × 40 = 160,000 chars from a client calling the endpoint directly.",
    },
  },
];
