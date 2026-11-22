import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { RULES, applyRename, forkNoteSpan, planRename } from "./rename-pi-names.mjs";

const scriptPath = fileURLToPath(new URL("./rename-pi-names.mjs", import.meta.url));

function makeFixtureRepo() {
  const root = mkdtempSync(path.join(os.tmpdir(), "theta-rename-lever-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
  return root;
}

function track(root, relativePath, content) {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
  execFileSync("git", ["add", relativePath], { cwd: root });
}

function read(root, relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const SCOPE_FIXTURES = {
  "src/app.ts": 'import x from "@pi-gui/session-driver";\nconst p = "@pi-gui/pi-sdk-driver";\n',
  "scripts/check.mjs":
    'const a = ["@pi-gui", "extension-ui", "dist"];\nassert.match(s, /--filter @pi-gui\\/desktop/);\n',
  "package.json":
    '{\n  "name": "pi-gui",\n  "scripts": {\n    "dev": "pnpm --filter @pi-gui/desktop dev"\n  }\n}\n',
  "video/package.json": '{\n  "name": "@pi-app/video"\n}\n',
  "root.test.mjs": "assert.match(s, /@pi-app\\/video run render/);\n",
};

const SCOPE_RENAMED = {
  "src/app.ts":
    'import x from "@theta-desktop/session-driver";\nconst p = "@theta-desktop/pi-sdk-driver";\n',
  "scripts/check.mjs":
    'const a = ["@theta-desktop", "extension-ui", "dist"];\nassert.match(s, /--filter @theta-desktop\\/desktop/);\n',
  "package.json":
    '{\n  "name": "theta-desktop",\n  "scripts": {\n    "dev": "pnpm --filter @theta-desktop/desktop dev"\n  }\n}\n',
  "video/package.json": '{\n  "name": "@theta-desktop/video"\n}\n',
  "root.test.mjs": "assert.match(s, /@theta-desktop\\/video run render/);\n",
};

function trackScopeFixtures(root) {
  for (const [file, content] of Object.entries(SCOPE_FIXTURES)) {
    track(root, file, content);
  }
}

test("a dry run lists every match in each form the scope takes, and writes nothing", async () => {
  const root = makeFixtureRepo();
  try {
    trackScopeFixtures(root);
    const plan = await planRename(root);
    const listed = plan.files.flatMap((file) =>
      file.edits.map(({ line, rule }) => `${file.relativePath}:${line}:${rule}`),
    );
    assert.deepEqual(plan.violations, []);
    assert.deepEqual(listed.sort(), [
      "package.json:2:root-package-name",
      "package.json:4:scope",
      "root.test.mjs:1:video-scope-in-regex",
      "scripts/check.mjs:1:scope-alone",
      "scripts/check.mjs:2:scope-in-regex",
      "src/app.ts:1:scope",
      "src/app.ts:2:scope",
      "video/package.json:2:video-scope",
    ]);
    for (const [file, content] of Object.entries(SCOPE_FIXTURES)) {
      assert.equal(read(root, file), content, `${file} was written by a dry run`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the applied result reads as intended, and a second run changes nothing", async () => {
  const root = makeFixtureRepo();
  try {
    trackScopeFixtures(root);
    const written = await applyRename(await planRename(root));
    assert.equal(written.length, Object.keys(SCOPE_FIXTURES).length);
    for (const [file, content] of Object.entries(SCOPE_RENAMED)) {
      assert.equal(read(root, file), content);
    }
    const again = await planRename(root);
    assert.deepEqual(again.files, []);
    assert.deepEqual(again.violations, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the run stops before it writes when a rule would touch a keep-list name", async () => {
  const root = makeFixtureRepo();
  try {
    track(root, "transcript.ts", 'const type = "pi-gui.card";\n');
    // The kept package name sits right after the scope. Adjacent is not a touch.
    track(root, "import.ts", 'import x from "@pi-gui/pi-sdk-driver";\n');
    const card = { unit: "test", id: "card", find: /pi-gui\.card/g, replace: "theta.card" };

    const plan = await planRename(root, [...RULES, card]);
    assert.deepEqual(plan.violations, [
      { file: "transcript.ts", rule: "card", line: 1, text: "pi-gui.card", keep: "pi-gui.card" },
    ]);
    await assert.rejects(() => applyRename(plan), /Refused to write: 1 keep-list matches/);
    assert.equal(read(root, "transcript.ts"), 'const type = "pi-gui.card";\n');
    assert.equal(read(root, "import.ts"), 'import x from "@pi-gui/pi-sdk-driver";\n');

    // Without the offending rule, the import renames and the transcript type stays.
    const clean = await planRename(root);
    assert.deepEqual(clean.violations, []);
    assert.deepEqual(
      clean.files.map((file) => file.relativePath),
      ["import.ts"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("forkNoteSpan covers the leading blockquote only", () => {
  const readme = "# theta-desktop\n\n> note `@pi-gui/*`\n> second line\n\nbody\n";
  const span = forkNoteSpan(readme);
  assert.equal(readme.slice(span[0], span[1]), "> note `@pi-gui/*`\n> second line\n");
  assert.equal(forkNoteSpan("# title\n\nbody\n"), null);
});

test("attribution, the plan, symlinks, binaries, and lockfiles are left alone", async () => {
  const root = makeFixtureRepo();
  try {
    track(root, "NOTICE.md", "- `@pi-gui/*` is recorded here.\n");
    track(root, "LICENSE", "Upstream package @pi-gui/desktop.\n");
    track(
      root,
      "README.md",
      "# theta-desktop\n\n> forked from `@pi-gui/*` upstream.\n\nRun pnpm --filter @pi-gui/desktop dev.\n",
    );
    track(root, "plans/plan.md", "R6 renames `@pi-gui/*`.\n");
    track(root, "pnpm-lock.yaml", "  '@pi-gui/desktop': {}\n");
    track(root, "binary.bin", "text @pi-gui/x\0more");
    track(root, "target.ts", 'export const a = "@pi-gui/session-driver";\n');
    symlinkSync(path.join(root, "target.ts"), path.join(root, "link.ts"));
    execFileSync("git", ["add", "link.ts"], { cwd: root });

    const plan = await planRename(root);
    // The old scope inside the fork note is attribution. It is out of scope, not a stop.
    assert.deepEqual(plan.violations, []);
    assert.deepEqual(
      plan.files.map((file) => file.relativePath),
      ["README.md", "target.ts"],
    );
    assert.equal(
      plan.files[0].next,
      "# theta-desktop\n\n> forked from `@pi-gui/*` upstream.\n\nRun pnpm --filter @theta-desktop/desktop dev.\n",
    );
    await applyRename(plan);
    assert.equal(lstatSync(path.join(root, "link.ts")).isSymbolicLink(), true);
    assert.equal(read(root, "NOTICE.md"), "- `@pi-gui/*` is recorded here.\n");
    assert.equal(read(root, "plans/plan.md"), "R6 renames `@pi-gui/*`.\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the CLI writes only with --write, and a second write reports nothing to do", () => {
  const root = makeFixtureRepo();
  try {
    track(root, "src/app.ts", 'import x from "@pi-gui/session-driver";\n');
    const run = (args) =>
      execFileSync(process.execPath, [scriptPath, "--root", root, ...args], {
        cwd: root,
        encoding: "utf8",
        timeout: 60_000,
      });

    const dry = run([]);
    assert.match(dry, /src\/app\.ts:1: scope: @pi-gui\/\n/);
    assert.match(dry, /Dry run: 1 matches in 1 files\./);
    assert.equal(read(root, "src/app.ts"), 'import x from "@pi-gui/session-driver";\n');

    assert.match(run(["--write"]), /Wrote 1 matches in 1 files\./);
    assert.equal(read(root, "src/app.ts"), 'import x from "@theta-desktop/session-driver";\n');

    assert.match(run(["--write"]), /Wrote 0 matches in 0 files\./);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
