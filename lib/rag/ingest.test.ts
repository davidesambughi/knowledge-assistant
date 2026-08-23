import { describe, expect, it } from "vitest";
import { buildDocumentRows } from "./ingest";
import type { RawChunk } from "./chunking";

const chunk = (overrides: Partial<RawChunk> = {}): RawChunk => ({
  sourceFile: "doc.md",
  headingPath: "Title > Section",
  content: "Title > Section\n\nbody",
  chunkIndex: 0,
  ...overrides,
});

describe("buildDocumentRows", () => {
  it("maps each RawChunk + embedding to a document_chunks row field by field", () => {
    const chunks = [chunk()];
    const embeddings = [[0.1, 0.2, 0.3]];

    expect(buildDocumentRows(chunks, embeddings)).toEqual([
      {
        source_file: "doc.md",
        heading_path: "Title > Section",
        content: "Title > Section\n\nbody",
        chunk_index: 0,
        embedding: [0.1, 0.2, 0.3],
      },
    ]);
  });

  it("preserves order across multiple chunks", () => {
    const chunks = [chunk({ chunkIndex: 0 }), chunk({ chunkIndex: 1, headingPath: "Title > Other" })];
    const embeddings = [[1], [2]];

    const rows = buildDocumentRows(chunks, embeddings);
    expect(rows[0].chunk_index).toBe(0);
    expect(rows[1].chunk_index).toBe(1);
    expect(rows[1].heading_path).toBe("Title > Other");
  });

  it("throws on chunks/embeddings length mismatch", () => {
    const chunks = [chunk(), chunk({ chunkIndex: 1 })];
    const embeddings = [[1]];

    expect(() => buildDocumentRows(chunks, embeddings)).toThrow(/disallineamento/);
  });
});
