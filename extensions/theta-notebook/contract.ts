import { defineService, type ReplicatedState } from "@earendil-works/chord";

/**
 * The notebook payload schema is theta-agent's (MIT):
 * theta-agent/extensions/notebook-cards.ts and the recorder script
 * theta-agent/skills/theta-notebook/scripts/notebook.py are the source of
 * truth (theta-agent ADR 0003, "provenance is a project notebook"). The
 * types here are a deliberate duplicate for the pane — theta-desktop takes
 * no dependency on theta-agent, and the shape may not fork (ADR 0002's
 * "do not invent a parallel schema").
 */

/** The five entry types (ADR 0003) and the id prefix each sequences under. */
export const TYPE_PREFIX = {
  hypothesis: "hyp",
  method: "mth",
  observation: "obs",
  decision: "dec",
  confidence: "cnf",
} as const;

export type EntryType = keyof typeof TYPE_PREFIX;

/** The evidence grades (GLOSSARY): the trust mark on a source, never on judgment. */
export const GRADES = ["asserted", "cross-checked", "re-executed"] as const;

export type EvidenceGrade = (typeof GRADES)[number];

/** One evidence item as the recorder writes it — connector output or job record. */
export interface EvidenceItem {
  source: string;
  endpoints?: string[];
  query?: string | null;
  retrieved: string;
  grade: EvidenceGrade;
  snapshot?: string;
  supports?: string;
  job_id?: string;
  template?: string | null;
  state?: string;
}

/** A provenance entry as the recorder writes it — the card's input shape. */
export interface NotebookEntry {
  id: string;
  type: EntryType;
  date: string;
  text: string;
  /** The observation's own grade — an observation is itself a source claim. */
  grade?: EvidenceGrade;
  /** The hypothesis a confidence entry judges — judgment's named subject. */
  hypothesis?: string;
  evidence?: EvidenceItem[];
}

/** What the pane renders: the parsed journal, oldest first, plus what it could not render. */
export interface NotebookState {
  /** False when no `.theta/notebook.jsonl` exists in this project — the pane shows an empty state. */
  present: boolean;
  entries: NotebookEntry[];
  /** Lines that did not parse as a typed entry; never rendered, always counted. */
  skipped: number;
}

export interface NotebookService {
  state: ReplicatedState<NotebookState>;
}

export const Notebook = defineService<NotebookService>("theta.notebook.v1");
