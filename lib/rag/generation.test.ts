import { APICallError } from "ai";
import { describe, expect, it } from "vitest";
import {
  GENERATION_FAILED_MESSAGE,
  QUOTA_EXCEEDED_MESSAGE,
  isQuotaExceededError,
  resolveChatStream,
} from "./generation";

function makeApiCallError(overrides: { statusCode?: number; data?: unknown }): APICallError {
  return new APICallError({
    message: "Gemini API error",
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    requestBodyValues: {},
    statusCode: overrides.statusCode,
    data: overrides.data,
  });
}

describe("isQuotaExceededError", () => {
  it("returns true for an APICallError with statusCode 429", () => {
    expect(isQuotaExceededError(makeApiCallError({ statusCode: 429 }))).toBe(true);
  });

  it("returns true for an APICallError with data.error.status RESOURCE_EXHAUSTED, regardless of statusCode", () => {
    expect(
      isQuotaExceededError(
        makeApiCallError({ statusCode: 403, data: { error: { status: "RESOURCE_EXHAUSTED" } } }),
      ),
    ).toBe(true);
  });

  it("returns false for an APICallError with an unrelated statusCode and no quota data", () => {
    expect(isQuotaExceededError(makeApiCallError({ statusCode: 500 }))).toBe(false);
  });

  it("returns false for a generic Error", () => {
    expect(isQuotaExceededError(new Error("network down"))).toBe(false);
  });

  it("returns false for undefined/null", () => {
    expect(isQuotaExceededError(undefined)).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
  });
});

// Simula result.fullStream con uno stream fabbricato — nessuna chiamata reale a Gemini
// (coerente con architecture-context.md §Testing Policy).
function fakeResultFromParts<T>(parts: T[]) {
  return {
    fullStream: new ReadableStream<T>({
      start(controller) {
        for (const part of parts) controller.enqueue(part);
        controller.close();
      },
    }),
  };
}

describe("resolveChatStream", () => {
  it("returns a quota error result when the first part is a quota error", async () => {
    const error = makeApiCallError({ statusCode: 429 });
    const result = fakeResultFromParts([{ type: "error", error }]);

    const resolution = await resolveChatStream(result);

    expect(resolution).toEqual({ ok: false, message: QUOTA_EXCEEDED_MESSAGE });
  });

  it("returns a generic error result when the first part is an unrelated error", async () => {
    const result = fakeResultFromParts([{ type: "error", error: new Error("boom") }]);

    const resolution = await resolveChatStream(result);

    expect(resolution).toEqual({ ok: false, message: GENERATION_FAILED_MESSAGE });
  });

  it("reconstructs the full stream, without losing the first chunk, when there is no error", async () => {
    const parts = [
      { type: "text-delta", text: "Hello" },
      { type: "text-delta", text: " world" },
    ];
    const result = fakeResultFromParts(parts);

    const resolution = await resolveChatStream(result);

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error("expected ok resolution");

    const collected: unknown[] = [];
    const reader = resolution.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(value);
    }

    expect(collected).toEqual(parts);
  });
});
