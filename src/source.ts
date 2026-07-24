import { dirname, resolve } from "node:path";

const FRONT_MATTER_PATTERN = /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/;
const DEPENDENCY_PATTERN = /^(?:data|evidence|path):\s*(.+?)\s*$/gm;

export function looksLikeReportMarkdown(text: string): boolean {
  const match = FRONT_MATTER_PATTERN.exec(text);
  if (!match?.[1]) return false;
  const frontMatter = match[1];
  return /^generated-at:\s*\S+/m.test(frontMatter)
    && /^status:\s*\S+/m.test(frontMatter)
    && (/^data:\s*\S+/m.test(frontMatter) || /^evidence:\s*\S+/m.test(frontMatter));
}

export type PreviewTarget = "report" | "ordinary-markdown" | "unsupported";

export function classifyPreviewTarget(
  languageId: string,
  fileName: string,
  text: string
): PreviewTarget {
  if (languageId === "auditable-report" || looksLikeReportMarkdown(text)) return "report";
  if (languageId === "markdown" || /\.md$/i.test(fileName)) return "ordinary-markdown";
  return "unsupported";
}

export function reportDependencies(documentPath: string, text: string): readonly string[] {
  const base = dirname(documentPath);
  const dependencies = new Set<string>();
  let match: RegExpExecArray | null;
  DEPENDENCY_PATTERN.lastIndex = 0;
  while ((match = DEPENDENCY_PATTERN.exec(text)) !== null) {
    const raw = match[1]?.trim().replace(/^["']|["']$/g, "");
    if (!raw || /^(?:[a-z]+:|[\\/])/i.test(raw) || raw.includes("..")) continue;
    dependencies.add(resolve(base, raw));
  }
  return [...dependencies];
}

export function diagnosticLine(message: string): number | undefined {
  const match = /\bline\s+(\d+):/i.exec(message);
  if (!match?.[1]) return undefined;
  const oneBased = Number.parseInt(match[1], 10);
  return Number.isFinite(oneBased) && oneBased > 0 ? oneBased - 1 : undefined;
}
