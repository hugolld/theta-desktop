import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

// Old brand identifiers. After the keep names below are removed from a file, any
// occurrence of one of these fails `pnpm check`. An upstream merge that brings a
// renamed identifier back must fail here instead of silently renaming the product
// again. Names of the pi agent itself never match; see NOTICE.md for the full rule.
const BANNED_STRINGS = [
  'app.setName("pi")',
  "<title>pi</title>",
  "pi-gui",
  "piApp",
  "PiDesktop",
  "PI_APP_",
  "PI_GUI_",
];

// Names that stay pi by decision: the pi agent's own names, stored values it reads,
// and upstream attribution. A file is checked with every occurrence of these removed,
// so a sanctioned name never trips the banned strings above.
const KEEP_NAMES = [
  "@earendil-works/pi-coding-agent",
  "PI_CODING_AGENT_DIR",
  "$pi-gui-computer-use-smoke",
  "minghinmatthewlam/pi-gui/issues/",
  "minghinmatthewlam/pi-gui/pull/",
  '"minghinmatthewlam/pi-gui"',
  "</pi-gui-file-attachments>",
  "<pi-gui-file-attachments>",
  "PI_GUI_LEASE_SURFACE",
  'surface: "pi-gui"',
  "refs/pi-gui/",
  "pi-gui.com",
  "pi-gui.json",
  "pi-gui.card",
  "pi-gui.pin",
  "pi-gui-desktop-views",
  "pi-gui-transcript-identity",
  "pi-gui-turn-capture",
  "pi-gui-thread-orchestration",
  "pi-gui-scheduled-tasks",
  "pi-gui-plan-limits",
  "pi-sdk-driver",
  '"pi-gui"',
];

// Historical records and upstream's own surfaces keep their old names on purpose.
// AGENTS.md and CLAUDE.md quote the banned strings in their names rule. The guard's
// own source and test, the rename lever's, and the two install-copy verifiers carry
// the strings by definition — rule data and absence assertions live in their sources.
const SKIPPED_PREFIXES = ["docs/", "plans/", "apps/website/", "examples/"];
const SKIPPED_FILES = new Set([
  "LICENSE",
  "LICENSE-THETA.md",
  "NOTICE.md",
  "pnpm-lock.yaml",
  "AGENTS.md",
  "CLAUDE.md",
  "scripts/check-names.mjs",
  "scripts/check-names.test.mjs",
  "scripts/rename-pi-names.mjs",
  "scripts/rename-pi-names.test.mjs",
  "scripts/verify-install-copy.mjs",
  "scripts/verify-homebrew-flow.mjs",
]);

// README's leading blockquote is the fork note: it names upstream on purpose. The
// rest of the README is checked like every other file.
export function stripForkNote(content) {
  const lines = content.split("\n");
  let index = 0;
  if (lines[0]?.startsWith("# ")) {
    index = 1;
  }
  while (index < lines.length && lines[index].trim() === "") {
    index += 1;
  }
  if (!lines[index]?.startsWith(">")) {
    return content;
  }
  let end = index;
  while (end < lines.length && lines[end].startsWith(">")) {
    end += 1;
  }
  return [...lines.slice(0, index), ...lines.slice(end)].join("\n");
}

/** Removes every keep-name occurrence, longest first so a longer name wins. */
export function stripKeepNames(content) {
  let next = content;
  for (const keep of [...KEEP_NAMES].sort((left, right) => right.length - left.length)) {
    next = next.split(keep).join("");
  }
  return next;
}

function isSkipped(relativePath) {
  return (
    SKIPPED_FILES.has(relativePath) ||
    SKIPPED_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
  );
}

export async function collectViolations(rootDir = repoRoot) {
  const { stdout } = await execFileAsync("git", ["ls-files"], {
    cwd: rootDir,
    maxBuffer: 64 * 1024 * 1024,
  });
  const files = stdout.split("\n").filter(Boolean);
  const violations = [];
  for (const relativePath of files) {
    if (isSkipped(relativePath)) {
      continue;
    }
    let content;
    try {
      content = await readFile(path.join(rootDir, relativePath), "utf8");
    } catch {
      // Removed between listing and reading, or not valid text; nothing to check.
      continue;
    }
    if (relativePath === "README.md") {
      content = stripForkNote(content);
    }
    const stripped = stripKeepNames(content);
    for (const banned of BANNED_STRINGS) {
      if (stripped.includes(banned)) {
        violations.push({ file: relativePath, banned });
      }
    }
  }
  return violations;
}

function usage() {
  const rootIndex = process.argv.indexOf("--root");
  if (rootIndex !== -1) {
    return process.argv[rootIndex + 1];
  }
  return repoRoot;
}

async function main() {
  const violations = await collectViolations(usage());
  if (violations.length > 0) {
    const details = violations
      .map(({ file, banned }) => `  ${file}: contains "${banned}"`)
      .join("\n");
    console.error(`Upstream brand names found in tracked files:\n${details}`);
    process.exitCode = 1;
    return;
  }
  console.log("No upstream brand names in tracked files.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
