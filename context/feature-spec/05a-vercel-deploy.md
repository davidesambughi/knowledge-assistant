# 05a — Deploy su Vercel e App Security Headers

Leggi `AGENTS.md` prima di iniziare (la reading order al suo interno copre già project-overview.md, architecture-context.md, tech-spec.md, progress-tracker.md). Dipende da `03d` (Security Review), `03i` (Quota Error Handling), `04a` (Overview Panel) e `04b` (Fluid Responsiveness).

Hardening di sicurezza Next.js via HTTP Security Headers in `next.config.ts`, preparazione e validazione delle variabili d'ambiente di produzione, e guida passo-passo al deploy su Vercel collegato al repo GitHub con custom subdomain via Porkbun.

---

## Validation

Usa lo schema Zod `EnvSchema` definito in `tech-spec.md` §Data Models — non ridefinirlo qui né altrove.

---

## Testing

Questa unit aggiunge la configurazione degli HTTP Security Headers a `next.config.ts`.
Testare con Vitest:
- Test unitario su `next.config.ts` per verificare che la funzione `headers()` restituisca gli header di sicurezza obbligatori (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`) applicati alla rotta `/:path*`.

---

## Implementation

1. **Configurazione Security Headers in `next.config.ts`**:
   - Disabilitare l'header di fingerprinting tecnologico: `poweredByHeader: false`.
   - Aggiungere un blocco `headers()` asincrono nel file `next.config.ts` applicato a tutte le route (`source: '/:path*'`).
   - Includere gli header raccomandati dalle linee guida OWASP / Vercel (agosto 2026):
     - `Content-Security-Policy`:
       - `default-src 'self'`
       - `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (necessario per React hydration e dev tooling)
       - `style-src 'self' 'unsafe-inline'`
       - `img-src 'self' data: blob:`
       - `font-src 'self' data:`
       - `object-src 'none'` (impedisce l'esecuzione di plugin legacy Flash/Java)
       - `base-uri 'self'` (impedisce l'injection del tag `<base>`)
       - `frame-ancestors 'none'` (versione moderna CSP-compliant per impedire l'embedding in iframe)
       - `connect-src 'self'` (il client interagisce solo con `/api/chat`; le chiamate a Supabase e Gemini sono eseguite esclusivamente server-side)
       - `form-action 'self'`
       - `upgrade-insecure-requests` (forza HTTPS in produzione)
     - `X-Frame-Options: DENY` (compatibilità legacy per clickjacking).
     - `X-Content-Type-Options: nosniff` (impedisce il MIME-type sniffing).
     - `Referrer-Policy: strict-origin-when-cross-origin`.
     - `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`.
     - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HSTS).
     - `X-XSS-Protection: 0` (standard OWASP 2026: disabilita i vecchi XSS auditor dei browser che introducevano vulnerabilità di side-channel, delegando interamente a CSP).

2. **Lista e Validazione delle Variabili d'Ambiente per la Produzione**:
   - Verificare l'elenco esatto delle env vars richieste dal progetto per la dashboard Vercel:
     - `NEXT_PUBLIC_SUPABASE_URL` (URL pubblico del progetto Supabase)
     - `SUPABASE_SECRET_KEY` (Secret Key server-only per bypassare RLS durante ingest/retrieval)
     - `GEMINI_API_KEY` (Chiave API per embeddings `gemini-embedding-001` e generazione `gemini-3.1-flash-lite`)
     - `UPSTASH_REDIS_REST_URL` (Endpoint Upstash Redis per rate limiting)
     - `UPSTASH_REDIS_REST_TOKEN` (Token di autenticazione Upstash Redis)
     - `ALLOWED_ORIGIN` (Opzionale: URL del dominio di produzione per la guardia `isAllowedOrigin` in `lib/security.ts`)

3. **Guida al Deploy su Vercel (Esecuzione Utente)**:
   - Accedere alla dashboard di Vercel ([vercel.com](https://vercel.com)).
   - Importare il repository GitHub `davidesambughi/knowledge-assistant`.
   - Inserire le variabili d'ambiente di produzione registrate al punto 2 nella sezione *Environment Variables*.
   - Avviare il primo deploy di produzione.

4. **Configurazione Custom Subdomain su Porkbun (Esecuzione Utente)**:
   - Nella sezione *Settings* -> *Domains* del progetto Vercel, aggiungere il sottodominio (es. `kb.davidesambughi.dev`).
   - Copiare le istruzioni DNS fornite da Vercel (record `CNAME` con valore `cname.vercel-dns.com`).
   - Accedere al pannello DNS di Porkbun per il dominio `davidesambughi.dev` e aggiungere il record CNAME corrispondente:
     - **Type**: `CNAME`
     - **Host**: `kb`
     - **Answer**: `cname.vercel-dns.com`

5. **Smoke Test di Produzione ed End-to-End Audit**:
   - Verificare che il dominio `kb.davidesambughi.dev` sia attivo e che il certificato SSL/TLS venga emesso correttamente da Vercel.
   - Effettuare uno smoke test completo in browser e via curl:
     - Test domanda in-corpus (verifica dello streaming e delle citazioni).
     - Test domanda fuori-corpus (verifica del rifiuto educato in tono neutro, Invariant #11).
     - Test rate-limiting (verifica risposta HTTP 429 in caso di chiamate frequenti).
     - Verifica degli HTTP Security Headers tramite devtools o `curl -I`.

---

## Dependencies

Nessuna nuova dipendenza npm richiesta.

---

## Scope Limits

- Non modifica i componenti React della chat UI o del pannello Overview.
- Non modifica gli script di Ingest o le funzioni di retrieval hybrid search già verificate.
- L'inserimento manuale delle chiavi nella dashboard Vercel e la modifica dei DNS su Porkbun sono a carico dell'utente tramite interfaccia web; l'agente fornisce la guida passo-passo e la validazione del codice.
- Resta focalizzato sull'hardening di sicurezza lato Next.js, sulla verifica delle configurazioni e sul deploy di produzione.

---

## Check When Done

- [ ] `next.config.ts` aggiornato con l'implementazione degli HTTP Security Headers.
- [ ] Test unitario su `next.config.ts` aggiunto e superato in Vitest (`npm run test`).
- [ ] `npm run lint` passa senza warning o errori.
- [ ] `npm run build` passa con successo in locale.
- [ ] Elenco delle variabili d'ambiente per Vercel preparato e confermato con l'utente.
- [ ] Deploy su Vercel completato con successo.
- [ ] Record CNAME su Porkbun configurato e sottodominio `kb.davidesambughi.dev` attivo con HTTPS.
- [ ] Smoke test su ambiente live superato con esito positivo.
