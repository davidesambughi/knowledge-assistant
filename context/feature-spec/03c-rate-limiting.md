# 03c — Rate Limiting

Leggi `AGENTS.md` prima di iniziare (la reading order al suo interno copre già project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md). Dipende da `03a-chat-api.md` (route `app/api/chat/route.ts` già esistente e verificata).

Protegge `/api/chat` da abuso di costo con un rate limit per IP (Invariant #18), usando Upstash Redis — le env var (`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) sono già dichiarate in `tech-spec.md` e in `lib/env.ts`, non ancora usate da nessun codice.

---

## Validation

Nessuno schema Zod nuovo. Il body della richiesta resta validato da `ChatRequestSchema` (già in `03a`) — questa unit aggiunge un controllo *prima* di quella validazione, non la sostituisce.

---

## Testing

- `getClientIp` (funzione pura data una `Request` in input, nessuna chiamata esterna) — coperta perché implementa un invariant di sicurezza (#18: il rate limit deve poter identificare un IP anche quando l'header atteso manca, altrimenti la protezione si disattiva silenziosamente).
  - Con header `x-real-ip` presente (unico header letto da `ipAddress()` — verificato nel sorgente installato di `@vercel/functions`, non `x-forwarded-for` come inizialmente assunto in fase di spec) → ritorna quel valore.
  - Senza header (es. `req.headers` vuoti, come in locale senza passare per l'edge network Vercel) → ritorna il valore sentinella `"unknown"`, non `undefined`/eccezione.
- **Non testato automaticamente:** `ratelimit.limit(...)` (chiamata reale a Upstash Redis, servizio esterno live) — verificato manualmente in `Check When Done`, coerente con `architecture-context.md` §Testing Policy.

---

## Implementation

1. Installa `@vercel/functions` (funzione `ipAddress()` — verificato su `vercel.com/docs/functions/functions-api-reference/vercel-functions-package`, ago 2026: legge l'IP dagli header impostati dalla piattaforma Vercel a partire da una `Request` semplice, nessun bisogno di `NextRequest`. Necessario perché `NextRequest.ip`/`.geo` sono stati rimossi da Next.js 15+, confermato in `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-15.md`).

2. Crea `lib/rate-limit.ts`:
   - Istanzia il client Redis con `new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })` (`@upstash/redis`, stesso pattern di `lib/supabase/admin.ts`: env validato via `lib/env.ts`, non `process.env` diretto).
   - Istanzia `export const ratelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "10 m") })` (`@upstash/ratelimit`) a livello di modulo (non dentro l'handler — necessario perché la cache in-memory della libreria funzioni tra invocazioni sulla stessa istanza serverless).
   - Esporta `getClientIp(req: Request): string` — usa `ipAddress(req)` da `@vercel/functions`; se ritorna `undefined` (es. sviluppo locale, richiesta non passata dall'edge network Vercel), fallback a `"unknown"`.
   - Esporta `checkRateLimit(req: Request)` — chiama `ratelimit.limit(getClientIp(req))`, ritorna `{ success, reset }` (solo i campi effettivamente usati dalla route).

3. In `app/api/chat/route.ts`, aggiungi il controllo come primo step di `POST`, prima del parsing del body:
   - Se `checkRateLimit` ritorna `success: false`, ritorna `Response.json({ error: "Troppe richieste. Riprova tra qualche minuto." }, { status: 429 })` con header `Retry-After` calcolato da `reset` (secondi rimanenti alla fine della finestra) — stesso pattern di errore strutturato già usato per i `400`/`500` esistenti nella route (nessuno stream, nessun 500 generico).

---

## Dependencies

Installa: `@upstash/ratelimit`, `@upstash/redis`, `@vercel/functions`

---

## Scope Limits

- Nessuna UI dedicata per il rate limit (es. countdown visibile, messaggio diverso da un refusal generico) — il messaggio 429 arriva come JSON, la gestione lato client (se emerge un bisogno reale) è fuori scope qui.
- Nessuna analytics/dashboard Upstash abilitata (`analytics: true`) — non richiesta da nessun invariant, aggiunge scrittura extra su Redis senza beneficio dichiarato per questo tool a singolo utente pubblico; riconsiderare solo se emerge un bisogno concreto di osservabilità sugli abusi.
- Nessun deny-list/protezione IP automatica di Upstash (`enableProtection: true`) — fuori scope, il rate limit di per sé copre l'Invariant #18 ("protezione minima").
- Nessuna differenziazione di limite per tipo di utente/tier (`free`/`paid` o simili) — un solo limite fisso per IP, coerente con "nessuna autenticazione/utenti multipli" di `project-overview.md`.
- Il comportamento di fail-open della libreria se Redis non risponde entro il timeout di default (5s) non viene modificato — una richiesta legittima passa comunque se Upstash è irraggiungibile, invece di bloccare l'intero tool per un problema infrastrutturale scollegato da Gemini/Supabase. Deciso qui esplicitamente, non lasciato come comportamento di libreria implicito.
- Resta focalizzato sulla protezione dell'endpoint `/api/chat` — nessun rate limit su altre route (nessun'altra route accetta input costoso in questo progetto).

---

## Check When Done

- `lib/rate-limit.ts` esiste con `ratelimit`, `getClientIp`, `checkRateLimit`.
- `app/api/chat/route.ts` ritorna `429` con `{ error }` e header `Retry-After` all'11ª richiesta entro 10 minuti dallo stesso IP (verificato manualmente con richieste ripetute reali, es. `curl` in loop).
- Sotto la soglia (10 richieste/10 min), il comportamento della route resta identico a `03a`/`03b` — nessuna regressione sullo streaming.
- `getClientIp` ritorna un IP valido quando l'header è presente e `"unknown"` quando assente (verificato dai test).
- `npm run test` passa (vedi `architecture-context.md` §Testing Policy).
- `npm run build` passa.
