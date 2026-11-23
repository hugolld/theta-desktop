import {
  GRADES,
  TYPE_PREFIX,
  type EntryType,
  type EvidenceGrade,
  type NotebookEntry,
} from "./contract.ts";

/**
 * The notebook parser. The caller owns the complete-lines guarantee: pass
 * only text up to the last newline, so a line a writer is still appending is
 * never parsed early. Line bytes are the identity (theta-agent's cards
 * doctrine): the same line twice parses once. Malformed lines never render —
 * they are counted in `skipped` so the pane can say the journal is not
 * silently lossy. An empty file or absent file is the caller's concern
 * (`present` in the state); parsing empty text yields empty entries.
 */

export interface NotebookParseResult {
  entries: NotebookEntry[];
  /** Non-empty lines that did not parse as a typed entry. */
  skipped: number;
}

const ENTRY_TYPES: ReadonlySet<string> = new Set(Object.keys(TYPE_PREFIX));
const GRADE_VALUES: ReadonlySet<string> = new Set(GRADES);

function evidenceShapeIsValid(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  for (const item of value) {
    if (typeof item !== "object" || item === null) return false;
    const record = item as Record<string, unknown>;
    if (typeof record.source !== "string" || typeof record.retrieved !== "string") return false;
    if (typeof record.grade !== "string" || !GRADE_VALUES.has(record.grade)) return false;
  }
  return true;
}

function parseEntry(line: string): NotebookEntry | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id === "") return null;
  if (typeof record.type !== "string" || !ENTRY_TYPES.has(record.type)) return null;
  if (typeof record.date !== "string" || record.date === "") return null;
  if (typeof record.text !== "string") return null;
  if (record.evidence !== undefined && !evidenceShapeIsValid(record.evidence)) return null;
  if (
    record.grade !== undefined &&
    (typeof record.grade !== "string" || !GRADE_VALUES.has(record.grade))
  ) {
    return null;
  }
  if (record.hypothesis !== undefined && typeof record.hypothesis !== "string") return null;
  return {
    id: record.id,
    type: record.type as EntryType,
    date: record.date,
    text: record.text,
    ...(record.grade !== undefined ? { grade: record.grade as EvidenceGrade } : {}),
    ...(record.hypothesis !== undefined ? { hypothesis: record.hypothesis } : {}),
    ...(record.evidence !== undefined
      ? { evidence: record.evidence as NotebookEntry["evidence"] }
      : {}),
  };
}

export function parseNotebook(text: string): NotebookParseResult {
  const entries: NotebookEntry[] = [];
  const seenLines = new Set<string>();
  let skipped = 0;
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    if (seenLines.has(line)) continue;
    seenLines.add(line);
    const entry = parseEntry(line);
    if (entry === null) {
      skipped += 1;
      continue;
    }
    entries.push(entry);
  }
  return { entries, skipped };
}
