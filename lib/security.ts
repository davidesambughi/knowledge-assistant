// Controllo leggero sull'header Origin (03d-security-review.md) — rende più costoso per un altro
// sito richiamare /api/chat dal browser di visitatori terzi, bypassando il rate limit per-IP
// (03c), che per costruzione non protegge da richieste distribuite su molti IP diversi.

// Confronto auto-referenziale (contro l'origin della request stessa), non un allowlist hardcoded
// (a differenza dell'esempio canonico nella doc Next.js) — funziona automaticamente su ogni preview
// deployment Vercel senza allowlist da aggiornare ad ogni PR. Sicuro SOLO perché il deploy è diretto
// su Vercel (04a), dove l'URL della request riflette il dominio effettivamente instradato dalla
// piattaforma, non manipolabile da un proxy intermedio non fidato — non varrebbe dietro un reverse
// proxy self-hosted custom che inoltra un Host interno diverso da quello pubblico.
export function isAllowedOrigin(originHeader: string | null, requestUrl: string): boolean {
  if (originHeader === null) {
    // Nessun modo affidabile di sfruttare l'assenza dell'header per abuso — molti client
    // legittimi (curl, Postman, usati anche nella verifica manuale di questa unit) non lo inviano.
    return true;
  }

  try {
    return new URL(originHeader).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

// Guardia early sulla dimensione del body dichiarata (OWASP LLM10 — Unbounded Consumption),
// verificata prima di bufferizzare/parsare la richiesta in app/api/chat/route.ts. Funzione pura:
// isola solo il confronto/parsing numerico, non l'accesso a req.headers (I/O), per restare testabile.
// Content-Length assente (null) non viene mai considerato oversized qui — un client senza questo
// header (o con transfer-encoding chunked) non deve essere bloccato da questo controllo: resta comunque
// vincolato dal limite definitivo di ChatRequestSchema dopo il parsing.
export function isOversizedContentLength(contentLength: string | null, maxBytes: number): boolean {
  if (contentLength === null) return false;
  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed > maxBytes;
}
