import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { isEmptyAssistantResponse, toChatRequestMessages } from "./messages";

function textMessage(role: UIMessage["role"], texts: string[]): UIMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: texts.map((text) => ({ type: "text" as const, text })),
  };
}

describe("toChatRequestMessages", () => {
  it("converte un messaggio con una sola part di testo in { role, content }", () => {
    const messages = [textMessage("user", ["come funziona la gestione dei webhook?"])];

    expect(toChatRequestMessages(messages)).toEqual([
      { role: "user", content: "come funziona la gestione dei webhook?" },
    ]);
  });

  it("concatena più part di testo nello stesso messaggio in un singolo content", () => {
    const messages = [textMessage("assistant", ["prima parte. ", "seconda parte."])];

    expect(toChatRequestMessages(messages)).toEqual([
      { role: "assistant", content: "prima parte. seconda parte." },
    ]);
  });

  it("scarta i messaggi con ruolo non supportato da ChatRequestSchema (es. system)", () => {
    const messages = [textMessage("system", ["istruzione di sistema"]), textMessage("user", ["domanda"])];

    expect(toChatRequestMessages(messages)).toEqual([{ role: "user", content: "domanda" }]);
  });

  it("scarta i messaggi con content vuoto dopo la conversione (bug multi-turno)", () => {
    const messages = [
      textMessage("user", ["prima domanda"]),
      textMessage("assistant", []), // risposta vuota/troncata, limite noto del text-stream protocol
      textMessage("user", ["seconda domanda"]),
    ];

    expect(toChatRequestMessages(messages)).toEqual([
      { role: "user", content: "prima domanda" },
      { role: "user", content: "seconda domanda" },
    ]);
  });

  it("scarta un messaggio il cui testo è solo whitespace", () => {
    const messages = [textMessage("assistant", ["   \n  "])];

    expect(toChatRequestMessages(messages)).toEqual([]);
  });
});

describe("isEmptyAssistantResponse", () => {
  it("ritorna true per un messaggio assistant senza parts", () => {
    expect(isEmptyAssistantResponse(textMessage("assistant", []))).toBe(true);
  });

  it("ritorna true per un messaggio assistant con solo testo vuoto/whitespace", () => {
    expect(isEmptyAssistantResponse(textMessage("assistant", ["   "]))).toBe(true);
  });

  it("ritorna false per un messaggio assistant con testo non vuoto", () => {
    expect(isEmptyAssistantResponse(textMessage("assistant", ["risposta"]))).toBe(false);
  });

  it("ritorna false per un messaggio user, indipendentemente dal contenuto", () => {
    expect(isEmptyAssistantResponse(textMessage("user", []))).toBe(false);
  });
});
