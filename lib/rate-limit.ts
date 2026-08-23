// Rate limit per IP su /api/chat (Invariant #18) — protezione minima contro abuso di costo
// su un tool pubblico. Istanze a livello di modulo (non dentro l'handler), necessario perché
// la cache in-memory di @upstash/ratelimit funzioni tra invocazioni sulla stessa istanza serverless.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { ipAddress } from "@vercel/functions";
import { env } from "@/lib/env";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 m"),
});

// ipAddress() legge l'IP dagli header impostati dalla piattaforma Vercel (NextRequest.ip/.geo
// sono stati rimossi da Next.js 15+). In locale (nessun edge network Vercel davanti) ritorna
// undefined — fallback esplicito, mai lasciare il rate limit senza una chiave identificativa.
export function getClientIp(req: Request): string {
  return ipAddress(req) ?? "unknown";
}

export async function checkRateLimit(req: Request) {
  const { success, reset } = await ratelimit.limit(getClientIp(req));
  return { success, reset };
}
