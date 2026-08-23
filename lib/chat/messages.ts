// Conversione tra i messaggi UIMessage prodotti da useChat e il formato { role, content }
// atteso da ChatRequestSchema (03a, chiuso e non toccato qui) — vedi 03b-chat-ui.md §Implementation punto 2.
// Funzioni pure, nessuna dipendenza da rete/React (testate in messages.test.ts).

import type { UIMessage } from "ai";
import type { ChatRequest } from "@/lib/types";

// Estrae e concatena tutte le part di tipo "text" di un messaggio in una singola stringa.
function extractText(message: UIMessage): string {
  return message.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

// Converte i messaggi UIMessage nel formato ChatRequest["messages"], scartando:
// - i ruoli non supportati da ChatRequestSchema (es. "system", che UIMessage permette);
// - i messaggi il cui testo risulta vuoto/whitespace dopo la conversione — necessario perché
//   una risposta assistant vuota/troncata (limite noto del text-stream protocol, vedi
//   isEmptyAssistantResponse sotto) resta nello storico useChat; senza questo filtro verrebbe
//   rimandata al server come content: "" al turno successivo, violando z.string().min(1) di
//   ChatRequestSchema e bloccando l'intera conversazione, non solo il turno fallito.
export function toChatRequestMessages(messages: UIMessage[]): ChatRequest["messages"] {
  const result: ChatRequest["messages"] = [];

  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") continue;

    const content = extractText(message).trim();
    if (content.length === 0) continue;

    result.push({ role: message.role, content });
  }

  return result;
}

// Rileva un messaggio assistant senza contenuto testuale — il text-stream protocol non porta
// un canale errore per un fallimento a metà stream (status torna a "ready", non "error"),
// quindi la UI deve trattare esplicitamente questo caso come errore (vedi 03b-chat-ui.md
// §Implementation punto 4).
export function isEmptyAssistantResponse(message: UIMessage): boolean {
  if (message.role !== "assistant") return false;
  return extractText(message).trim().length === 0;
}
