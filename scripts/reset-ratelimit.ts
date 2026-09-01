// Svuota le chiavi del rate limit su Upstash Redis — SOLO per testare in locale.
// Il rate limit di /api/chat (lib/rate-limit.ts) è 10 req / 10 min, e in locale la chiave
// identificativa è "unknown" (ipAddress() torna undefined senza l'edge network Vercel):
// tutte le richieste locali condividono lo stesso bucket, quindi una batteria di test lo
// esaurisce dopo 10 chiamate. Questo script cancella le chiavi @upstash/ratelimit:* così
// si può ripartire da zero tra un batch e l'altro. Nessuna modifica al codice di produzione.

import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

async function main() {
  // Prefisso di default di @upstash/ratelimit. Scan esplicito invece di flushdb per non
  // toccare eventuali altre chiavi nello stesso database.
  const keys = await redis.keys("@upstash/ratelimit:*");

  if (keys.length === 0) {
    console.log("Nessuna chiave di rate limit da cancellare.");
    return;
  }

  await redis.del(...keys);
  console.log(`Cancellate ${keys.length} chiavi di rate limit:`, keys);
}

main();
