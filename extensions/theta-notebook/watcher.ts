import { watch, type FSWatcher } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseNotebook } from "./notebook.ts";
import type { NotebookEntry, NotebookState } from "./contract.ts";

/**
 * Tails the project notebook at `<cwd>/.theta/notebook.jsonl`. Read-only and
 * live: the watcher re-reads the file on change and republishes a full state
 * snapshot. The journal is append-only, so a full re-read of a small file is
 * the simplest honest projection — no offsets to corrupt, no second store.
 *
 * A writer may be mid-append when the change fires, so only text up to the
 * last newline is parsed — unless the trailing partial line already parses as
 * a valid entry, which means the line is complete and merely lacks its final
 * newline. An unparsable trailing line is held back, not counted as skipped;
 * it becomes an entry or a skipped line once the writer finishes it.
 *
 * The watcher follows the file's creation: `.theta/` may not exist yet when a
 * session starts. `onWatchError` reports watcher failures; reading failures
 * surface as `present: false` (a missing file is a normal empty state, never
 * an error).
 */

const DEBOUNCE_MS = 300;

export class NotebookWatcher {
  private notebookPath: string | null = null;
  private thetaPath: string | null = null;
  private watchingCwd = false;
  private cwdWatcher: FSWatcher | null = null;
  private fileWatcher: FSWatcher | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private state: NotebookState = { present: false, entries: [], skipped: 0 };
  private acceptOffset = 0;
  private entries: NotebookEntry[] = [];
  private skipped = 0;
  private readonly cwd: string;
  private readonly onChange: (state: NotebookState) => void;
  private readonly onWatchError: (error: unknown) => void;

  constructor(
    cwd: string,
    onChange: (state: NotebookState) => void,
    onWatchError: (error: unknown) => void = () => {},
  ) {
    this.cwd = cwd;
    this.onChange = onChange;
    this.onWatchError = onWatchError;
  }

  snapshot(): NotebookState {
    return this.state;
  }

  async start(): Promise<void> {
    this.thetaPath = path.join(this.cwd, ".theta");
    this.notebookPath = path.join(this.thetaPath, "notebook.jsonl");
    await this.reread();
    this.armWatcher();
  }

  stop(): void {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.cwdWatcher?.close();
    this.fileWatcher?.close();
    this.cwdWatcher = null;
    this.fileWatcher = null;
  }

  private armWatcher(): void {
    if (this.closed) return;
    if (this.thetaPath && this.watchingCwd === false && this.fileWatcher === null) {
      // The file may not exist yet; watch its directory until it does, and the
      // project directory until `.theta` itself appears.
      stat(this.thetaPath)
        .then((thetaStat) => {
          if (thetaStat.isDirectory()) {
            this.watchNotebookDir();
          } else {
            this.watchProjectDir();
          }
        })
        .catch(() => this.watchProjectDir());
      return;
    }
  }

  private watchProjectDir(): void {
    if (this.closed || this.cwdWatcher || !this.cwd) return;
    this.watchingCwd = true;
    try {
      this.cwdWatcher = watch(this.cwd, { persistent: false }, (_event, fileName) => {
        if (fileName === ".theta" || fileName === null) this.scheduleReread();
      });
      this.cwdWatcher.on("error", (error) => this.onWatchError(error));
    } catch (error) {
      this.watchingCwd = false;
      this.onWatchError(error);
    }
  }

  private watchNotebookDir(): void {
    if (this.closed || this.fileWatcher || !this.thetaPath) return;
    this.watchingCwd = false;
    this.cwdWatcher?.close();
    this.cwdWatcher = null;
    try {
      this.fileWatcher = watch(this.thetaPath, { persistent: false }, (_event, fileName) => {
        if (fileName === null || fileName === "notebook.jsonl") this.scheduleReread();
      });
      this.fileWatcher.on("error", (error) => this.onWatchError(error));
    } catch (error) {
      this.fileWatcher = null;
      this.onWatchError(error);
    }
  }

  private scheduleReread(): void {
    if (this.closed) return;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.reread();
    }, DEBOUNCE_MS);
  }

  private async reread(): Promise<void> {
    if (this.closed || !this.notebookPath) return;
    if (this.fileWatcher === null && !this.watchingCwd) this.armWatcher();
    let text: string;
    try {
      text = await readFile(this.notebookPath, "utf8");
    } catch {
      // No notebook yet (or unreadable): the honest empty state, never an error.
      this.acceptOffset = 0;
      this.entries = [];
      this.skipped = 0;
      this.publish({ present: false, entries: [], skipped: 0 });
      if (this.fileWatcher === null && !this.watchingCwd) this.watchProjectDir();
      return;
    }
    this.publish(this.projectState(text));
    // The file may have appeared between arming and reading; make sure the
    // watcher follows its directory now that `.theta` exists.
    if (this.fileWatcher === null && !this.watchingCwd) this.watchNotebookDir();
  }

  private projectState(text: string): NotebookState {
    // The journal is append-only, so an offset marks how much of the file this
    // projection has already accepted; each re-read parses only the remainder.
    if (text.length < this.acceptOffset) {
      // The file shrank: it was replaced or truncated. Reparse from scratch.
      this.acceptOffset = 0;
      this.entries = [];
      this.skipped = 0;
    }
    const remainder = text.slice(this.acceptOffset);
    const lastNewline = remainder.lastIndexOf("\n");
    const complete = lastNewline === -1 ? "" : remainder.slice(0, lastNewline + 1);
    let tail = lastNewline === -1 ? remainder : remainder.slice(lastNewline + 1);
    // The trailing line may be a finished append whose newline has not landed.
    // Parse it provisionally: a valid entry is accepted now; garbage stays
    // unaccepted for the next tick instead of being counted as skipped.
    let tailEntry = "";
    if (tail.trim() !== "") {
      const provisional = parseNotebook(tail);
      if (provisional.skipped === 0 && provisional.entries.length === 1) {
        tailEntry = tail;
        tail = "";
      }
    }
    this.acceptOffset += complete.length + tailEntry.length;
    const fresh = parseNotebook(complete + (tailEntry ? tailEntry + "\n" : ""));
    this.entries.push(...fresh.entries);
    this.skipped += fresh.skipped;
    // Publish a copy: the accumulators keep growing, and a published state that
    // aliases them would make every change check compare the array with itself.
    return { present: true, entries: [...this.entries], skipped: this.skipped };
  }

  private publish(state: NotebookState): void {
    const previous = this.state;
    // The journal is append-only and ids are unique, so ids plus the counters
    // decide whether anything the pane renders has changed.
    const changed =
      previous.present !== state.present ||
      previous.skipped !== state.skipped ||
      previous.entries.length !== state.entries.length ||
      previous.entries.some((entry, index) => entry.id !== state.entries[index].id);
    this.state = state;
    if (changed) this.onChange(state);
  }
}
