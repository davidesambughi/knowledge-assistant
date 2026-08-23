# Technical Specification — Knowledge Assistant

<!-- Riferimento permanente per data layer ed env config.
     Solo tipi/dati e variabili d'ambiente — il resto vive nelle feature specs e nel codice.
     Non aggiungere qui Server Actions, API routes, o descrizioni di feature — quelle vanno in feature-specs/*.md. -->

---

## Data Models

Non esiste un domain model applicativo (no User/Order/Payment come in un SaaS classico) — solo i tipi che passano nella pipeline RAG.

### RetrievedChunk

```typescript
const RetrievedChunkSchema = z.object({
  content: z.string(),
  headingPath: z.string(),
  sourceFile: z.string(),
  similarity: z.number(),
});

type RetrievedChunk = z.infer<typeof RetrievedChunkSchema>;
```

Risultato di una similarity search su `document_chunks` (schema in `architecture-context.md` §Storage Model). `similarity` è lo score di cosine similarity restituito da pgvector — usato per eventuale soglia/filtro, non persistito.

> **Nota — `similarity` in hybrid search non riflette l'ordine dei risultati.** In `hybridRetrieveChunks` (`02-retrieval.md`), l'ordine dei chunk restituiti è determinato da `fused.score` (Reciprocal Rank Fusion, vettoriale + full-text), mentre `similarity` resta la cosine similarity pura, ricalcolata separatamente solo per il campo — le due cose possono divergere: un chunk può comparire prima di un altro con `similarity` numerico più alto, se ha vinto per match full-text esatto. Non è un bug (lo schema non garantisce che l'ordine segua `similarity`), ma va tenuto a mente leggendo/mostrando i risultati — non usare `similarity` per dedurre il ranking in hybrid search, solo l'ordine dell'array.

### ChatRequest

```typescript
const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES_PER_REQUEST = 40;
const MAX_TOTAL_REQUEST_LENGTH = 12000;

const ChatRequestSchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(MAX_MESSAGE_LENGTH),
        }),
      )
      .min(1)
      .max(MAX_MESSAGES_PER_REQUEST),
  })
  .refine(
    (data) => data.messages.reduce((sum, m) => sum + m.content.length, 0) <= MAX_TOTAL_REQUEST_LENGTH,
    { message: `La somma dei messaggi supera ${MAX_TOTAL_REQUEST_LENGTH} caratteri.` },
  );

type ChatRequest = z.infer<typeof ChatRequestSchema>;
```

Payload validato in ingresso su `app/api/chat/route.ts` prima di procedere a retrieval + generazione (Invariant #3).

> **Nota — limiti anti unbounded-consumption (`03d-security-review.md`, OWASP LLM10):** `MAX_MESSAGE_LENGTH` e `MAX_MESSAGES_PER_REQUEST` da soli permettono un worst-case combinato di 4.000 × 40 = **160.000 caratteri per singola richiesta** (chi chiama l'endpoint direttamente non è vincolato dall'uso naturale della chat UI) — un volume di costo Gemini reale, combinato con le 10 richieste/10 min del rate limit (`03c`). `MAX_TOTAL_REQUEST_LENGTH` (vincolo sulla somma di tutti i `content`, applicato via `.refine()`) chiude questo worst-case a **12.000 caratteri per richiesta**, indipendentemente da come i caratteri sono distribuiti tra i messaggi.

### EmbeddingResult

```typescript
const EmbeddingResultSchema = z.object({
  embedding: z.array(z.number()).length(1536),
});

type EmbeddingResult = z.infer<typeof EmbeddingResultSchema>;
```

Forma validata della risposta Gemini embeddings (`gemini-embedding-001`, 1536 dimensioni via output configurabile — vedi `architecture-context.md` §Stack), usata sia in ingest (`lib/rag/ingest.ts`) sia in query-time (embedding della domanda utente prima del retrieval).

---

## Feature Specs (elenco)

<!-- Lista rimossa (era stale: nomi file non corrispondenti a feature-spec/*.md reali, numerazione
     ferma a 03). L'elenco autoritativo e aggiornato vive in feature-spec/feature-list.md — non
     duplicarlo qui, si disallinea silenziosamente ad ogni rinumerazione. -->

Vedi `feature-spec/feature-list.md` per l'elenco completo e aggiornato delle unit, in ordine di build/dipendenza. Il dettaglio di ciascuna vive nel proprio file in `feature-spec/`.

---

## Environment Variables

### Required

| Variable                                | Purpose                                                                                                     | Dove trovarla                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `GEMINI_API_KEY`                        | embeddings (ingest + query-time, `01b`) e generazione risposta (`03a`) — chiave unica Gemini               | aistudio.google.com → Get API key       |
| `NEXT_PUBLIC_SUPABASE_URL`              | Supabase project URL                                                                                         | Supabase dashboard → Settings → API     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`  | chiave pubblica client-side (`sb_publishable_...`), rispetta RLS                                            | Supabase dashboard → Settings → API     |
| `SUPABASE_SECRET_KEY`                   | scrittura da script di ingest, bypassa RLS (`sb_secret_...`) — **mai esposta lato client** (Invariant #20)  | Supabase dashboard → Settings → API     |
| `UPSTASH_REDIS_REST_URL`                | rate limit endpoint di chat (Invariant #18)                                                                 | upstash.com → Redis database → REST API |
| `UPSTASH_REDIS_REST_TOKEN`              | rate limit endpoint di chat (Invariant #18)                                                                 | upstash.com → Redis database → REST API |

> **Nota (verificato ago 2026):** dal novembre 2025 i nuovi progetti Supabase non forniscono più le legacy `anon`/`service_role` key — solo `sb_publishable_...` (sostituisce `anon`, rispetta RLS) e `sb_secret_...` (sostituisce `service_role`, bypassa RLS). Nomi env var sopra allineati alla convenzione ufficiale Supabase per Next.js. Fonte: [Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Migrating to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).
>
> **Nota — passaggio da OpenAI a Gemini:** deciso dopo aver scoperto che l'API OpenAI richiede billing attivo (nessun free tier reale) — vedi `progress-tracker.md` §Architecture Decisions per il dettaglio. `GEMINI_API_KEY` sostituisce `OPENAI_API_KEY` come unica chiave, condivisa tra embeddings (`01b`, SDK `@google/genai`) e generazione (`03a`, `@ai-sdk/google` — **da verificare su doc ufficiale quando si arriva a quello spec**, banner `AGENTS.md`). Nessun prefisso fisso verificato per le chiavi Gemini (a differenza di `sk-` per OpenAI) — validazione Zod solo su non-vuoto.

### Zod Schema (`lib/env.ts`)

```typescript
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  GEMINI_API_KEY: z.string().min(1),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),

  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
```

### `.env.local` Template

```bash
# App
NODE_ENV=development

# Gemini (AI Studio)
GEMINI_API_KEY=...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...

# Rate limit (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```
