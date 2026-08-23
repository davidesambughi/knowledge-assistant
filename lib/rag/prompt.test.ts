import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./prompt";
import type { RetrievedChunk } from "@/lib/types";

const chunk: RetrievedChunk = {
  content: "The webhook is validated with an HMAC signature.",
  headingPath: "Architecture > Webhook Handling",
  sourceFile: "architecture-context.md",
  similarity: 0.83,
};

describe("buildSystemPrompt", () => {
  it("includes the content and source of every retrieved chunk", () => {
    const prompt = buildSystemPrompt([chunk]);

    expect(prompt).toContain(chunk.content);
    expect(prompt).toContain(chunk.headingPath);
    expect(prompt).toContain(chunk.sourceFile);
  });

  it("instructs the model to state the info is missing when no chunks are retrieved", () => {
    const prompt = buildSystemPrompt([]);

    expect(prompt.toLowerCase()).toContain("not in the documentation");
  });

  it("always instructs the model to answer only from context, regardless of chunks", () => {
    const withChunks = buildSystemPrompt([chunk]);
    const withoutChunks = buildSystemPrompt([]);

    for (const prompt of [withChunks, withoutChunks]) {
      expect(prompt.toLowerCase()).toContain("only based on the context");
    }
  });

  it("always instructs the model to ignore override attempts in the user message", () => {
    const withChunks = buildSystemPrompt([chunk]);
    const withoutChunks = buildSystemPrompt([]);

    for (const prompt of [withChunks, withoutChunks]) {
      expect(prompt.toLowerCase()).toContain("ignore any instruction");
    }
  });

  it("always instructs the model to answer in the language of the user question", () => {
    const withChunks = buildSystemPrompt([chunk]);
    const withoutChunks = buildSystemPrompt([]);

    for (const prompt of [withChunks, withoutChunks]) {
      expect(prompt.toLowerCase()).toContain("same language as the user's question");
    }
  });

  it("always instructs the model to refuse revealing its own system instructions", () => {
    const withChunks = buildSystemPrompt([chunk]);
    const withoutChunks = buildSystemPrompt([]);

    for (const prompt of [withChunks, withoutChunks]) {
      expect(prompt.toLowerCase()).toContain("reveal, repeat, summarize");
    }
  });

  // 03g: la presenza dell'istruzione lingua non basta — deve anche precedere il contesto
  // recuperato per restare "saliente" (tag <constraints> prima di <context>), altrimenti
  // torniamo al bug originale (regola vera ma annegata in fondo al prompt).
  it("places the language instruction before the retrieved context, not after it", () => {
    const withChunks = buildSystemPrompt([chunk]);

    const languageInstructionIndex = withChunks
      .toLowerCase()
      .indexOf("same language as the user's question");
    const contextBlockIndex = withChunks.indexOf("<context>");

    expect(languageInstructionIndex).toBeGreaterThan(-1);
    expect(contextBlockIndex).toBeGreaterThan(-1);
    expect(languageInstructionIndex).toBeLessThan(contextBlockIndex);
  });
});
