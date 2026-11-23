import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseNotebook } from "../notebook.ts";

const fixture = readFileSync(
  fileURLToPath(new URL("./fixtures/notebook.jsonl", import.meta.url)),
  "utf8",
);

test("parses every typed entry in file order, oldest first", () => {
  const { entries, skipped } = parseNotebook(fixture);
  assert.deepEqual(
    entries.map((entry) => entry.id),
    ["hyp-0001", "mth-0001", "obs-0001", "dec-0001", "cnf-0001", "obs-0002", "mth-0004"],
  );
  assert.equal(entries[0].evidence?.[0].grade, "asserted");
  // Evidence passes through verbatim, extra fields included.
  assert.deepEqual(entries[0].evidence?.[0].endpoints, ["pubmed"]);
  assert.deepEqual(entries[2].evidence, [
    {
      source: "theta-compute",
      retrieved: "2026-11-20T10:01:00Z",
      grade: "re-executed",
      job_id: "job-8c42",
      snapshot: "evidence/5b7d02/vina-redock.json",
    },
  ]);
  assert.equal(entries[2].grade, "re-executed");
  assert.equal(entries[4].hypothesis, "hyp-0001");
  assert.equal(skipped, 3);
});

test("line bytes are the identity: the duplicated line parses once", () => {
  const { entries, skipped } = parseNotebook(fixture);
  const firsts = entries.filter((entry) => entry.id === "hyp-0001");
  assert.equal(firsts.length, 1);
  assert.equal(skipped, 3);
});

test("malformed lines never parse and are counted, blank lines are ignored", () => {
  const { entries, skipped } = parseNotebook(fixture);
  assert.equal(
    entries.some((entry) => entry.id === "obs-0003"),
    false,
  );
  assert.equal(
    entries.some((entry) => (entry.type as string) === "transformed"),
    false,
  );
  assert.equal(
    entries.some((entry) => entry.id === "mth-0003"),
    false,
  );
  assert.equal(skipped, 3);
});

test("empty and whitespace-only journals parse to empty state", () => {
  assert.deepEqual(parseNotebook(""), { entries: [], skipped: 0 });
  assert.deepEqual(parseNotebook("\n  \n\t\n"), { entries: [], skipped: 0 });
});

test("a partial line parses or skips; it never throws", () => {
  assert.deepEqual(parseNotebook('{"id":"hyp-0009","type":"hyp'), { entries: [], skipped: 1 });
});
