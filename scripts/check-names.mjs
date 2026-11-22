import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

// Exact strings that mark upstream pi-gui brand identity. An upstream merge that
// brings one of these back must fail `pnpm check` instead of silently renaming the
// product again. Names of the pi agent and the @pi-gui package scope are keep-list
// names and never match here; see NOTICE.md for the full rule.
const BANNED_STRINGS = [
  "com.pi-gui.",
  "productName: pi-gui",
  'app.setName("pi")',
  "<title>pi</title>",
  "pi-gui.app",
  "minghinmatthewlam/pi-gui/releases",
];

// Historical records and upstream's own surfaces keep their old names on purpose.
// AGENTS.md and CLAUDE.md quote the banned strings in their names rule.
const SKIPPED_PREFIXES = ["docs/", "plans/", "apps/website/"];
const SKIPPED_FILES = new Set([
  "LICENSE",
  "LICENSE-THETA.md",
  "NOTICE.md",
  "pnpm-lock.yaml",
  "AGENTS.md",
  "CLAUDE.md",
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
  if (lines[index]?.startsWith(">")) {
    let end = index;
    while (end < lines.length && lines[end].startsWith(">")) {
      end += 1;
    }
    return [...lines.slice(0, index), ...lines.slice(end)].join("\n");
  }
  return content;
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
    for (const banned of BANNED_STRINGS) {
      if (content.includes(banned)) {
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
