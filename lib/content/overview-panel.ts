export const OVERVIEW_INTRO = {
  it: "Questo è un chatbot RAG (Retrieval-Augmented Generation): risponde solo leggendo una documentazione tecnica reale, non inventa. Cerca i passaggi più rilevanti nei documenti — il \"retrieval\" — e li usa per generare una risposta, basandosi solo su quelli. Se la risposta non è nei documenti, lo dice invece di inventarla.",
  en: "This is a RAG chatbot (Retrieval-Augmented Generation): it only answers from real technical documentation — it doesn't make things up. It finds the most relevant passages in the docs — the \"retrieval\" step — and uses them to generate an answer. If the answer isn't in the docs, it says so instead of guessing.",
};

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
