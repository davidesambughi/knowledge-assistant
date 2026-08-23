import { z } from "zod";

// Validazione env a startup (Invariant #5) — fail fast se mancanti/malformate.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Chiave unica Gemini (AI Studio) — usata sia per embeddings (@google/genai, 01b)
  // sia per la generazione (@ai-sdk/google, 03a). Nessun prefisso fisso verificato
  // per le chiavi Gemini, a differenza di "sk-" per OpenAI — solo non-vuota.
  GEMINI_API_KEY: z.string().min(1),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),

  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
