import { describe, expect, it } from "vitest";
import { chunkMarkdownFile } from "./chunking";

describe("chunkMarkdownFile", () => {
  it("builds a hierarchical headingPath across nested heading levels", () => {
    const content = ["# Title", "intro", "## Section A", "body A", "### Subsection", "body sub"].join("\n");
    const chunks = chunkMarkdownFile("doc.md", content);

    expect(chunks.map((c) => c.headingPath)).toEqual(["Title", "Title > Section A", "Title > Section A > Subsection"]);
  });

  it("resets deeper heading levels when a shallower heading follows", () => {
    const content = ["# A", "## A1", "### A1a", "## A2"].join("\n");
    const chunks = chunkMarkdownFile("doc.md", content);

    expect(chunks.map((c) => c.headingPath)).toEqual(["A", "A > A1", "A > A1 > A1a", "A > A2"]);
  });

  it("prefixes chunk content with its own headingPath (Invariant #17)", () => {
    const content = ["# Title", "## Section", "body text"].join("\n");
    const chunks = chunkMarkdownFile("doc.md", content);
    const sectionChunk = chunks.find((c) => c.headingPath === "Title > Section");

    expect(sectionChunk?.content.startsWith("Title > Section")).toBe(true);
    expect(sectionChunk?.content).toContain("body text");
  });

  it("assigns sequential 0-based chunkIndex and the file basename as sourceFile", () => {
    const content = ["# A", "## B", "## C"].join("\n");
    const chunks = chunkMarkdownFile("some/dir/doc.md", content);

    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1, 2]);
    expect(chunks.every((c) => c.sourceFile === "doc.md")).toBe(true);
  });

  it("never splits a fenced block across chunks, even with a heading marker inside (Invariant #16, generalized)", () => {
    const content = [
      "# Title",
      "## Bash example",
      "```bash",
      "# Install dependencies",
      "npm install",
      "# Start dev server",
      "npm run dev",
      "```",
      "## Next section",
      "text",
    ].join("\n");
    const chunks = chunkMarkdownFile("doc.md", content);

    const bashChunk = chunks.find((c) => c.headingPath === "Title > Bash example");
    expect(bashChunk?.content).toContain("# Install dependencies");
    expect(bashChunk?.content).toContain("# Start dev server");
    expect(bashChunk?.content).toContain("npm run dev");
    expect(chunks.map((c) => c.headingPath)).toEqual(["Title", "Title > Bash example", "Title > Next section"]);
  });

  it("never splits a mermaid block across chunks (Invariant #16)", () => {
    const content = [
      "# Title",
      "## Diagram",
      "```mermaid",
      "graph TD",
      "  A --> B",
      "```",
      "## After",
      "text",
    ].join("\n");
    const chunks = chunkMarkdownFile("doc.md", content);
    const diagramChunk = chunks.find((c) => c.headingPath === "Title > Diagram");

    expect(diagramChunk?.content).toContain("graph TD");
    expect(diagramChunk?.content).toContain("A --> B");
    expect(chunks.map((c) => c.headingPath)).toEqual(["Title", "Title > Diagram", "Title > After"]);
  });

  it("skips a leading preamble with no content before the first heading", () => {
    const content = ["", "   ", "# Title", "body"].join("\n");
    const chunks = chunkMarkdownFile("doc.md", content);

    expect(chunks.map((c) => c.headingPath)).toEqual(["Title"]);
  });
});
