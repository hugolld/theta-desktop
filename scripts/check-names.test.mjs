import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { collectViolations, stripForkNote, stripKeepNames } from "./check-names.mjs";

const scriptPath = fileURLToPath(new URL("./check-names.mjs", import.meta.url));

function makeFixtureRepo() {
  const root = mkdtempSync(path.join(os.tmpdir(), "theta-names-guard-"));
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

test("stripForkNote keeps the README body but removes the leading fork note", () => {
  const readme = [
    "# theta-desktop",
    "",
    "> **This fork is `theta-desktop`** — forked from",
    "> [pi-gui](https://github.com/minghinmatthewlam/pi-gui). Upstream's build installs",
    "> `pi-gui.app`.",
    "",
    "Theta runs on macOS.",
  ].join("\n");
  const stripped = stripForkNote(readme);
  assert.match(stripped, /Theta runs on macOS\./);
  assert.doesNotMatch(stripped, /pi-gui\.app/);
});

test("stripForkNote leaves a README without a fork note unchanged", () => {
  const readme = "# title\n\nbody text\n";
  assert.equal(stripForkNote(readme), readme);
});

test("stripKeepNames removes sanctioned names and keeps other text", () => {
  const content = [
    'export const PI_GUI_LEASE_SURFACE = "pi-gui";',
    "const end = '</pi-gui-file-attachments>';",
    "const refs = 'refs/pi-gui/snapshots/';",
    "See pi-gui.com and docs.",
    "const broken = pi-gui;",
  ].join("\n");
  const stripped = stripKeepNames(content);
  assert.equal(
    stripped,
    "export const  = ;\n" +
      "const end = '';\n" +
      "const refs = 'snapshots/';\n" +
      "See  and docs.\n" +
      "const broken = pi-gui;",
  );
});

test("a clean tree passes and keep-list names never match", async () => {
  const root = makeFixtureRepo();
  try {
    track(
      root,
      "src/app.ts",
      'import x from "@theta-desktop/session-driver";\napp.setName("Theta");\n',
    );
    track(root, "README.md", "# theta-desktop\n\nSee pi-gui.com and upstream's site.\n");
    const violations = await collectViolations(root);
    assert.deepEqual(violations, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("each renamed identifier in a tracked file fails, and exempt paths pass", async () => {
  const root = makeFixtureRepo();
  try {
    track(root, "src/identity.ts", 'app.setName("pi");\n');
    track(root, "electron/preload.ts", 'contextBridge.exposeInMainWorld("piApp", {});\n');
    track(root, "src/types.ts", "export type PiAppWindow = Window & { piApp?: PiDesktopApi };\n");
    track(root, "src/env.ts", "const lane = process.env.PI_APP_TEST_LANE;\n");
    track(root, "index.html", "<html><title>pi</title></html>\n");
    track(root, "docs/install.md", "Drag pi-gui.app into Applications.\n");
    track(
      root,
      "README.md",
      "# theta-desktop\n\n> fork note: minghinmatthewlam/pi-gui/releases\n\nTheta body.\n",
    );

    const violations = await collectViolations(root);
    const reported = violations.map(({ file, banned }) => `${file}: ${banned}`);
    assert.equal(violations.length, 6, `unexpected set: ${reported.join("; ")}`);
    assert.ok(reported.some((entry) => entry.startsWith("src/identity.ts: app.setName")));
    assert.ok(reported.some((entry) => entry.startsWith("electron/preload.ts: piApp")));
    assert.ok(reported.some((entry) => entry.startsWith("src/types.ts: PiDesktop")));
    assert.equal(reported.filter((entry) => entry.startsWith("src/types.ts:")).length, 2);
    assert.ok(reported.some((entry) => entry.startsWith("src/env.ts: PI_APP_")));
    assert.ok(reported.some((entry) => entry.startsWith("index.html: <title>pi</title>")));
    // docs/ is exempt and the README hit sits inside the fork note.
    assert.ok(!reported.some((entry) => entry.startsWith("docs/")));
    assert.ok(!reported.some((entry) => entry.startsWith("README.md")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a renamed name outside the README fork note still fails", async () => {
  const root = makeFixtureRepo();
  try {
    track(
      root,
      "README.md",
      "# theta-desktop\n\n> fork note\n\nInstall: brew install --cask from minghinmatthewlam/pi-gui/releases.\n",
    );
    const violations = await collectViolations(root);
    assert.deepEqual(violations, [{ file: "README.md", banned: "pi-gui" }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("keep names in a product file pass: the lease, the attachments tag, and upstream links", async () => {
  const root = makeFixtureRepo();
  try {
    track(
      root,
      "packages/pi-sdk-driver/src/session-lease.ts",
      'export const PI_GUI_LEASE_SURFACE = "pi-gui";\n',
    );
    track(
      root,
      "packages/session-driver/src/transcript.ts",
      "const end = '</pi-gui-file-attachments>';\nconst refs = 'refs/pi-gui/snapshots/';\n",
    );
    track(
      root,
      "apps/desktop/tests/core/message-markdown.spec.ts",
      'const url = "https://github.com/minghinmatthewlam/pi-gui/issues/19";\n',
    );
    track(
      root,
      "apps/desktop/tests/AGENTS.md",
      "If the local Codex skill `$pi-gui-computer-use-smoke` is installed, use it only for sweeps.\n",
    );
    const violations = await collectViolations(root);
    assert.deepEqual(violations, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the CLI exits 1 on a planted name and 0 on the keep list", () => {
  const root = makeFixtureRepo();
  try {
    track(root, "clean.ts", 'const label = "@theta-desktop/desktop";\n');
    const clean = execFileSync(process.execPath, [scriptPath, "--root", root], {
      cwd: root,
      encoding: "utf8",
      timeout: 60_000,
    });
    assert.match(clean, /No upstream brand names/);

    track(root, "dirty.ts", "appId: com.pi-gui.desktop\n");
    let failed = false;
    try {
      execFileSync(process.execPath, [scriptPath, "--root", root], {
        cwd: root,
        encoding: "utf8",
        stdio: "pipe",
        timeout: 60_000,
      });
    } catch (error) {
      failed = true;
      assert.match(String(error.stderr), /dirty\.ts: contains "pi-gui"/);
      assert.equal(error.status, 1);
    }
    assert.equal(failed, true, "the guard should have failed on the planted name");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
