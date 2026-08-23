import { describe, expect, it } from "vitest";
import {
  ChatRequestSchema,
  EmbeddingResultSchema,
  MAX_MESSAGE_LENGTH,
  MAX_MESSAGES_PER_REQUEST,
  MAX_TOTAL_REQUEST_LENGTH,
} from "./types";

describe("EmbeddingResultSchema", () => {
  it("accepts a 1536-length array of numbers", () => {
    const embedding = Array.from({ length: 1536 }, () => 0.1);
    expect(() => EmbeddingResultSchema.parse({ embedding })).not.toThrow();
  });

  it("rejects an array with the wrong length", () => {
    const embedding = Array.from({ length: 1000 }, () => 0.1);
    expect(() => EmbeddingResultSchema.parse({ embedding })).toThrow();
  });

  it("rejects an array with non-numeric elements", () => {
    const embedding = Array.from({ length: 1536 }, () => "not-a-number");
    expect(() => EmbeddingResultSchema.parse({ embedding })).toThrow();
  });
});

describe("ChatRequestSchema", () => {
  it("accepts a valid payload under all three limits", () => {
    const payload = { messages: [{ role: "user", content: "Come funziona il retrieval?" }] };
    expect(() => ChatRequestSchema.parse(payload)).not.toThrow();
  });

  it("rejects an empty messages array", () => {
    // Gap segnalato da revisione esterna: verificato che app/api/chat/route.ts aveva già un
    // guard a valle per questo caso (nessun crash, 400 pulito) — ma il vincolo va comunque
    // dichiarato qui, al confine di validazione, non lasciato solo alla business logic.
    expect(() => ChatRequestSchema.parse({ messages: [] })).toThrow();
  });

  it("rejects a message with content longer than MAX_MESSAGE_LENGTH", () => {
    const payload = {
      messages: [{ role: "user", content: "a".repeat(MAX_MESSAGE_LENGTH + 1) }],
    };
    expect(() => ChatRequestSchema.parse(payload)).toThrow();
  });

  it("rejects a request with more than MAX_MESSAGES_PER_REQUEST messages", () => {
    const payload = {
      messages: Array.from({ length: MAX_MESSAGES_PER_REQUEST + 1 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: "ciao",
      })),
    };
    expect(() => ChatRequestSchema.parse(payload)).toThrow();
  });

  it("rejects a request whose combined content length exceeds MAX_TOTAL_REQUEST_LENGTH, even when each message and the array length are individually within limits", () => {
    // Ogni messaggio e il conteggio totale rispettano i propri limiti singolarmente — solo la
    // somma li supera. Senza il .refine() sul totale, questo payload passerebbe (worst-case
    // combinato quantificato in 03d-security-review.md §Ricerca).
    const messageLength = MAX_MESSAGE_LENGTH - 500;
    const messageCount = Math.ceil(MAX_TOTAL_REQUEST_LENGTH / messageLength) + 1;
    const payload = {
      messages: Array.from({ length: messageCount }, () => ({
        role: "user" as const,
        content: "a".repeat(messageLength),
      })),
    };
    expect(() => ChatRequestSchema.parse(payload)).toThrow();
  });
});
