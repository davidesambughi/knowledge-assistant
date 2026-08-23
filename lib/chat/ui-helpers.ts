// Utility pure per la UI della Chat (03e-ui-ux-polish.md).
// Identifica se la risposta dell'assistant è un rifiuto guidato dall'Invariant #11 (fuori corpus).

// Estrae il messaggio d'errore reale da una risposta non-2xx di /api/chat (03i). useChat/
// TextStreamChatTransport propagano il body grezzo della risposta come Error.message
// (verificato in node_modules/ai, HttpChatTransport.sendMessages: `new Error(await
// response.text())`) — per il formato { error: string } usato da route.ts, questo è il
// JSON stringificato, non il messaggio già pulito. Ritorna undefined se il parsing fallisce
// o il messaggio non ha la forma attesa, cosicché il chiamante possa ricadere su un
// messaggio generico invece di mostrare JSON grezzo all'utente.
export function extractServerErrorMessage(rawMessage: string | undefined): string | undefined {
  if (!rawMessage) return undefined;
  try {
    const parsed = JSON.parse(rawMessage);
    return typeof parsed?.error === "string" ? parsed.error : undefined;
  } catch {
    return undefined;
  }
}

export function isGuardrailRefusal(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  const normalized = text.toLowerCase();
  return (
    normalized.includes("non ho trovato questa informazione") ||
    normalized.includes("non è presente nella documentazione") ||
    normalized.includes("non presente nella documentazione") ||
    normalized.includes("non si trova nella documentazione") ||
    normalized.includes("non è contenuta nella documentazione") ||
    normalized.includes("not found in the documentation") ||
    normalized.includes("could not find this information") ||
    normalized.includes("does not contain this information")
  );
}
