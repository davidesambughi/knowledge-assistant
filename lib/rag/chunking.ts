// Chunking Markdown per heading (Invariant #16/#17). Nessuna chiamata esterna, nessuna
// scrittura — solo trasformazione testo -> chunk grezzi, usata da ingest.ts.

export type RawChunk = {
  sourceFile: string;
  headingPath: string;
  content: string;
  chunkIndex: number;
};

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const FENCE_OPEN_RE = /^(`{3,}|~{3,})/;

type Section = {
  headingPath: string;
  lines: string[];
};

// Divide il contenuto di un file markdown in chunk per heading. Un blocco fenced
// (``` o ~~~, qualunque linguaggio) non viene mai spezzato: mentre il parser è dentro
// un fence, ignora qualunque marker di heading incontrato (Mermaid è un caso
// particolare di questa regola più generale, non un caso a parte).
export function chunkMarkdownFile(filePath: string, content: string): RawChunk[] {
  const sourceFile = filePath.split(/[/\\]/).pop() ?? filePath;
  const lines = content.split(/\r?\n/);

  const sections: Section[] = [];
  let headingStack: string[] = [];
  let current: Section = { headingPath: sourceFile, lines: [] };
  let inFence = false;
  let fenceChar = "";

  const flush = () => {
    if (current.lines.some((line) => line.trim() !== "")) {
      sections.push(current);
    }
  };

  for (const line of lines) {
    if (inFence) {
      current.lines.push(line);
      const closeMatch = line.trim().match(new RegExp(`^\\${fenceChar}{3,}$`));
      if (closeMatch) inFence = false;
      continue;
    }

    const fenceMatch = line.trim().match(FENCE_OPEN_RE);
    if (fenceMatch) {
      inFence = true;
      fenceChar = fenceMatch[1][0];
      current.lines.push(line);
      continue;
    }

    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      flush();
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      headingStack = headingStack.slice(0, level - 1);
      headingStack[level - 1] = title;
      current = {
        headingPath: headingStack.filter(Boolean).join(" > "),
        lines: [line],
      };
      continue;
    }

    current.lines.push(line);
  }
  flush();

  return sections.map((section, index) => ({
    sourceFile,
    headingPath: section.headingPath,
    content: `${section.headingPath}\n\n${section.lines.join("\n").trim()}`,
    chunkIndex: index,
  }));
}
