import assert from "node:assert/strict";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import type { NotebookState } from "../contract.ts";
import { NotebookWatcher } from "../watcher.ts";

/** The recorder's own append: one JSON line plus its newline. */
const LINE = {
  hypothesis:
    '{"id":"hyp-0001","type":"hypothesis","date":"2026-11-20T09:14:00Z","text":"Compound X inhibits kinase Y allosterically."}',
  method:
    '{"id":"mth-0001","type":"method","date":"2026-11-20T09:20:00Z","text":"Dock with Vina at exhaustiveness 8."}',
  malformed: '{"id":"obs-0009","type":"observation","date":"2026-11-20T10',
};

function makeProject(): string {
  return mkdtempSync(path.join(tmpdir(), "theta-notebook-watch-"));
}

/** Waits past the debounce and a watcher-event beat, then returns the latest snapshot. */
async function settle(watcher: NotebookWatcher, ms = 600): Promise<NotebookState> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return watcher.snapshot();
}

let project: string;

beforeEach(() => {
  project = makeProject();
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

test("no notebook yet: the empty state publishes once, present false", async () => {
  const states: NotebookState[] = [];
  const watcher = new NotebookWatcher(project, (state) => states.push(state));
  await watcher.start();
  const snapshot = await settle(watcher);
  assert.equal(snapshot.present, false);
  assert.deepEqual(snapshot.entries, []);
  assert.equal(snapshot.skipped, 0);
  watcher.stop();
});

test("creating the journal later is followed; entries render live", async () => {
  const states: NotebookState[] = [];
  const watcher = new NotebookWatcher(project, (state) => states.push(state));
  await watcher.start();
  mkdirSync(path.join(project, ".theta"));
  writeFileSync(path.join(project, ".theta", "notebook.jsonl"), `${LINE.hypothesis}\n`, "utf8");
  const snapshot = await settle(watcher);
  assert.equal(snapshot.present, true);
  assert.deepEqual(
    snapshot.entries.map((entry) => entry.id),
    ["hyp-0001"],
  );
  watcher.stop();
});

test("appends render without duplicating; malformed complete lines count as skipped", async () => {
  const notebook = path.join(project, ".theta", "notebook.jsonl");
  mkdirSync(path.join(project, ".theta"));
  writeFileSync(notebook, `${LINE.hypothesis}\n`, "utf8");
  const watcher = new NotebookWatcher(project, () => {});
  await watcher.start();
  appendFileSync(notebook, `${LINE.method}\n${LINE.malformed}\n`, "utf8");
  const snapshot = await settle(watcher);
  assert.deepEqual(
    snapshot.entries.map((entry) => entry.id),
    ["hyp-0001", "mth-0001"],
  );
  assert.equal(snapshot.skipped, 1);
  watcher.stop();
});

test("a mid-append line without its newline is held back, then renders once complete", async () => {
  const notebook = path.join(project, ".theta", "notebook.jsonl");
  mkdirSync(path.join(project, ".theta"));
  writeFileSync(notebook, LINE.hypothesis, "utf8");
  const watcher = new NotebookWatcher(project, () => {});
  await watcher.start();
  const held = await settle(watcher);
  // The finished line without its trailing newline still renders.
  assert.deepEqual(
    held.entries.map((entry) => entry.id),
    ["hyp-0001"],
  );

  // A writer appends the next line in two pieces; the first event sees a partial line.
  appendFileSync(notebook, LINE.method.slice(0, 30), "utf8");
  const partial = await settle(watcher);
  assert.deepEqual(
    partial.entries.map((entry) => entry.id),
    ["hyp-0001"],
  );
  assert.equal(partial.skipped, 0);

  appendFileSync(notebook, `${LINE.method.slice(30)}\n`, "utf8");
  const complete = await settle(watcher);
  assert.deepEqual(
    complete.entries.map((entry) => entry.id),
    ["hyp-0001", "mth-0001"],
  );
  assert.equal(complete.skipped, 0);
  watcher.stop();
});

test("stop ends the watch: later appends publish nothing", async () => {
  const notebook = path.join(project, ".theta", "notebook.jsonl");
  mkdirSync(path.join(project, ".theta"));
  writeFileSync(notebook, `${LINE.hypothesis}\n`, "utf8");
  const states: NotebookState[] = [];
  const watcher = new NotebookWatcher(project, (state) => states.push(state));
  await watcher.start();
  watcher.stop();
  const count = states.length;
  appendFileSync(notebook, `${LINE.method}\n`, "utf8");
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.equal(states.length, count);
});
