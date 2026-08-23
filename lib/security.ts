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
