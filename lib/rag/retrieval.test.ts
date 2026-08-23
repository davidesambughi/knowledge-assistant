import { describe, expect, it } from "vitest";
import { mapRowToRetrievedChunk } from "./retrieval";

describe("mapRowToRetrievedChunk", () => {
  it("maps a snake_case RPC row to a camelCase RetrievedChunk field by field", () => {
    const row = {
      id: "11111111-1111-1111-1111-111111111111",
      source_file: "architecture-context.md",
      heading_path: "Architettura > Gestione Webhook",
      content: "Il webhook viene validato con la firma HMAC.",
      similarity: 0.83,
    };

    expect(mapRowToRetrievedChunk(row)).toEqual({
      content: "Il webhook viene validato con la firma HMAC.",
      headingPath: "Architettura > Gestione Webhook",
      sourceFile: "architecture-context.md",
      similarity: 0.83,
    });
  });

  it("does not leak the row id into the mapped chunk", () => {
    const row = {
      id: "22222222-2222-2222-2222-222222222222",
      source_file: "a.md",
      heading_path: "A",
      content: "body",
      similarity: 0.5,
    };

    expect(mapRowToRetrievedChunk(row)).not.toHaveProperty("id");
  });
});
