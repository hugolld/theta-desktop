import { execFile } from "node:child_process";
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

// Rename lever for plans/pi-to-theta-rename/plan.md, units R6 to R10. Each unit adds
// its rows here. A rule matches exact names and never a prefix, because the pi agent
// owns names such as `PI_CODING_AGENT_DIR`.
//
//   node scripts/rename-pi-names.mjs            dry run: list every match, write nothing
//   node scripts/rename-pi-names.mjs --write    apply
//   node scripts/rename-pi-names.mjs --write --root <dir>
//
// A second run changes nothing. The run stops before it writes when a rule would touch
// a keep-list name.
export const RULES = [
  // R6 workspace scope.
  { unit: "R6", id: "scope", find: /@pi-gui\//g, replace: "@theta-desktop/" },
  // The same scope inside a regex literal, where the slash is escaped.
  { unit: "R6", id: "scope-in-regex", find: /@pi-gui\\\//g, replace: "@theta-desktop\\/" },
  // A path array that holds the scope and the package as separate strings.
  { unit: "R6", id: "scope-alone", find: /"@pi-gui"/g, replace: '"@theta-desktop"' },
  { unit: "R6", id: "video-scope", find: /@pi-app\/video/g, replace: "@theta-desktop/video" },
  {
    unit: "R6",
    id: "video-scope-in-regex",
    find: /@pi-app\\\/video/g,
    replace: "@theta-desktop\\/video",
  },
  {
    unit: "R6",
    id: "root-package-name",
    files: ["package.json"],
    find: /"name": "pi-gui"/g,
    replace: '"name": "theta-desktop"',
  },
  // R7 bridge identifiers and channel strings. The session-folder search of
  // 2026-11-22 found none of these strings in ~/.pi/agent/sessions, so none joins
  // the keep list.
  { unit: "R7", id: "bridge-global", find: /\bpiApp\b/g, replace: "thetaApp" },
  { unit: "R7", id: "window-type", find: /\bPiAppWindow\b/g, replace: "ThetaAppWindow" },
  // The type prefix inside names such as PiDesktopApi and PiDesktopStatePush.
  { unit: "R7", id: "type-prefix", find: /\bPiDesktop/g, replace: "ThetaDesktop" },
  { unit: "R7", id: "image-scheme", find: /pi-gui-image/g, replace: "theta-desktop-image" },
  // IPC channels and extension frame messages, in every quote style.
  { unit: "R7", id: "channel-prefix", find: /pi-gui:/g, replace: "theta-desktop:" },
  // R8 environment names. Exact names only, because the pi agent owns names such as
  // PI_CODING_AGENT_DIR. The session folder and the app data folder hold none of these
  // names (checked on 2026-11-22). PI_GUI_LEASE_SURFACE stays: it is a constant whose
  // value is the stored lease surface string, not an environment variable. Two names
  // are sentinels with leading underscores, so their rules match the full literal.
  {
    unit: "R8",
    id: "pi_app_capture_artifacts",
    find: /\bPI_APP_CAPTURE_ARTIFACTS\b/g,
    replace: "THETA_APP_CAPTURE_ARTIFACTS",
  },
  {
    unit: "R8",
    id: "pi_app_changed_files_proof_dir",
    find: /\bPI_APP_CHANGED_FILES_PROOF_DIR\b/g,
    replace: "THETA_APP_CHANGED_FILES_PROOF_DIR",
  },
  {
    unit: "R8",
    id: "pi_app_custom_endpoint_proof_dir",
    find: /\bPI_APP_CUSTOM_ENDPOINT_PROOF_DIR\b/g,
    replace: "THETA_APP_CUSTOM_ENDPOINT_PROOF_DIR",
  },
  {
    unit: "R8",
    id: "pi_app_dev_port",
    find: /\bPI_APP_DEV_PORT\b/g,
    replace: "THETA_APP_DEV_PORT",
  },
  {
    unit: "R8",
    id: "pi_app_dev_reload_markers",
    find: /\bPI_APP_DEV_RELOAD_MARKERS\b/g,
    replace: "THETA_APP_DEV_RELOAD_MARKERS",
  },
  // The renderer build reads the Vite-prefixed form. The rule above cannot reach it,
  // because the underscore before PI is a word character, so \b never opens there.
  {
    unit: "R8",
    id: "vite_dev_reload_markers",
    find: /\bVITE_PI_APP_DEV_RELOAD_MARKERS\b/g,
    replace: "VITE_THETA_APP_DEV_RELOAD_MARKERS",
  },
  {
    unit: "R8",
    id: "pi_app_initial_workspaces",
    find: /\bPI_APP_INITIAL_WORKSPACES\b/g,
    replace: "THETA_APP_INITIAL_WORKSPACES",
  },
  {
    unit: "R8",
    id: "pi_app_markdown_rendering_proof_dir",
    find: /\bPI_APP_MARKDOWN_RENDERING_PROOF_DIR\b/g,
    replace: "THETA_APP_MARKDOWN_RENDERING_PROOF_DIR",
  },
  {
    unit: "R8",
    id: "pi_app_notification_log_path",
    find: /\bPI_APP_NOTIFICATION_LOG_PATH\b/g,
    replace: "THETA_APP_NOTIFICATION_LOG_PATH",
  },
  {
    unit: "R8",
    id: "pi_app_open_devtools",
    find: /\bPI_APP_OPEN_DEVTOOLS\b/g,
    replace: "THETA_APP_OPEN_DEVTOOLS",
  },
  {
    unit: "R8",
    id: "pi_app_orchestration_proof_dir",
    find: /\bPI_APP_ORCHESTRATION_PROOF_DIR\b/g,
    replace: "THETA_APP_ORCHESTRATION_PROOF_DIR",
  },
  {
    unit: "R8",
    id: "pi_app_orchestration_supervision_interval_ms",
    find: /\bPI_APP_ORCHESTRATION_SUPERVISION_INTERVAL_MS\b/g,
    replace: "THETA_APP_ORCHESTRATION_SUPERVISION_INTERVAL_MS",
  },
  {
    unit: "R8",
    id: "pi_app_package_platform",
    find: /\bPI_APP_PACKAGE_PLATFORM\b/g,
    replace: "THETA_APP_PACKAGE_PLATFORM",
  },
  {
    unit: "R8",
    id: "pi_app_persistence_proof_dir",
    find: /\bPI_APP_PERSISTENCE_PROOF_DIR\b/g,
    replace: "THETA_APP_PERSISTENCE_PROOF_DIR",
  },
  {
    unit: "R8",
    id: "pi_app_profile_source_dir",
    find: /\bPI_APP_PROFILE_SOURCE_DIR\b/g,
    replace: "THETA_APP_PROFILE_SOURCE_DIR",
  },
  {
    unit: "R8",
    id: "pi_app_real_auth",
    find: /\bPI_APP_REAL_AUTH\b/g,
    replace: "THETA_APP_REAL_AUTH",
  },
  {
    unit: "R8",
    id: "pi_app_real_auth_source_dir",
    find: /\bPI_APP_REAL_AUTH_SOURCE_DIR\b/g,
    replace: "THETA_APP_REAL_AUTH_SOURCE_DIR",
  },
  {
    unit: "R8",
    id: "pi_app_recency_proof_dir",
    find: /\bPI_APP_RECENCY_PROOF_DIR\b/g,
    replace: "THETA_APP_RECENCY_PROOF_DIR",
  },
  {
    unit: "R8",
    id: "pi_app_sidebar_proof_dir",
    find: /\bPI_APP_SIDEBAR_PROOF_DIR\b/g,
    replace: "THETA_APP_SIDEBAR_PROOF_DIR",
  },
  {
    unit: "R8",
    id: "pi_app_takeover_proof_dir",
    find: /\bPI_APP_TAKEOVER_PROOF_DIR\b/g,
    replace: "THETA_APP_TAKEOVER_PROOF_DIR",
  },
  {
    unit: "R8",
    id: "pi_app_test_exact_path",
    find: /\bPI_APP_TEST_EXACT_PATH\b/g,
    replace: "THETA_APP_TEST_EXACT_PATH",
  },
  {
    unit: "R8",
    id: "test-hooks-sentinel",
    find: /__PI_APP_TEST_HOOKS/g,
    replace: "__THETA_APP_TEST_HOOKS",
  },
  {
    unit: "R8",
    id: "pi_app_test_lane",
    find: /\bPI_APP_TEST_LANE\b/g,
    replace: "THETA_APP_TEST_LANE",
  },
  {
    unit: "R8",
    id: "pi_app_test_mode",
    find: /\bPI_APP_TEST_MODE\b/g,
    replace: "THETA_APP_TEST_MODE",
  },
  {
    unit: "R8",
    id: "pi_app_test_notification_permission_helper_follows_request",
    find: /\bPI_APP_TEST_NOTIFICATION_PERMISSION_HELPER_FOLLOWS_REQUEST\b/g,
    replace: "THETA_APP_TEST_NOTIFICATION_PERMISSION_HELPER_FOLLOWS_REQUEST",
  },
  {
    unit: "R8",
    id: "pi_app_test_notification_permission_helper_status",
    find: /\bPI_APP_TEST_NOTIFICATION_PERMISSION_HELPER_STATUS\b/g,
    replace: "THETA_APP_TEST_NOTIFICATION_PERMISSION_HELPER_STATUS",
  },
  {
    unit: "R8",
    id: "pi_app_test_notification_permission_helper_status_file",
    find: /\bPI_APP_TEST_NOTIFICATION_PERMISSION_HELPER_STATUS_FILE\b/g,
    replace: "THETA_APP_TEST_NOTIFICATION_PERMISSION_HELPER_STATUS_FILE",
  },
  {
    unit: "R8",
    id: "pi_app_test_notification_permission_request_log_path",
    find: /\bPI_APP_TEST_NOTIFICATION_PERMISSION_REQUEST_LOG_PATH\b/g,
    replace: "THETA_APP_TEST_NOTIFICATION_PERMISSION_REQUEST_LOG_PATH",
  },
  {
    unit: "R8",
    id: "pi_app_test_notification_permission_request_result",
    find: /\bPI_APP_TEST_NOTIFICATION_PERMISSION_REQUEST_RESULT\b/g,
    replace: "THETA_APP_TEST_NOTIFICATION_PERMISSION_REQUEST_RESULT",
  },
  {
    unit: "R8",
    id: "pi_app_test_notification_permission_status",
    find: /\bPI_APP_TEST_NOTIFICATION_PERMISSION_STATUS\b/g,
    replace: "THETA_APP_TEST_NOTIFICATION_PERMISSION_STATUS",
  },
  {
    unit: "R8",
    id: "pi_app_test_notification_settings_log_path",
    find: /\bPI_APP_TEST_NOTIFICATION_SETTINGS_LOG_PATH\b/g,
    replace: "THETA_APP_TEST_NOTIFICATION_SETTINGS_LOG_PATH",
  },
  {
    unit: "R8",
    id: "pi_app_test_release_dir",
    find: /\bPI_APP_TEST_RELEASE_DIR\b/g,
    replace: "THETA_APP_TEST_RELEASE_DIR",
  },
  {
    unit: "R8",
    id: "session-visibility-sentinel",
    find: /__PI_APP_TEST_SESSION_VISIBILITY__/g,
    replace: "__THETA_APP_TEST_SESSION_VISIBILITY__",
  },
  {
    unit: "R8",
    id: "pi_app_test_workers",
    find: /\bPI_APP_TEST_WORKERS\b/g,
    replace: "THETA_APP_TEST_WORKERS",
  },
  {
    unit: "R8",
    id: "pi_app_theme_tour_dir",
    find: /\bPI_APP_THEME_TOUR_DIR\b/g,
    replace: "THETA_APP_THEME_TOUR_DIR",
  },
  {
    unit: "R8",
    id: "pi_app_theme_tour_pace",
    find: /\bPI_APP_THEME_TOUR_PACE\b/g,
    replace: "THETA_APP_THEME_TOUR_PACE",
  },
  {
    unit: "R8",
    id: "pi_app_thread_menu_proof_dir",
    find: /\bPI_APP_THREAD_MENU_PROOF_DIR\b/g,
    replace: "THETA_APP_THREAD_MENU_PROOF_DIR",
  },
  {
    unit: "R8",
    id: "pi_app_timeline_overflow_proof_dir",
    find: /\bPI_APP_TIMELINE_OVERFLOW_PROOF_DIR\b/g,
    replace: "THETA_APP_TIMELINE_OVERFLOW_PROOF_DIR",
  },
  {
    unit: "R8",
    id: "pi_app_user_data_dir",
    find: /\bPI_APP_USER_DATA_DIR\b/g,
    replace: "THETA_APP_USER_DATA_DIR",
  },
  {
    unit: "R8",
    id: "pi_gui_custom_provider_marker",
    find: /\bPI_GUI_CUSTOM_PROVIDER_MARKER\b/g,
    replace: "THETA_GUI_CUSTOM_PROVIDER_MARKER",
  },
  {
    unit: "R8",
    id: "pi_gui_marketing_allow_provider_env",
    find: /\bPI_GUI_MARKETING_ALLOW_PROVIDER_ENV\b/g,
    replace: "THETA_GUI_MARKETING_ALLOW_PROVIDER_ENV",
  },
  {
    unit: "R8",
    id: "pi_gui_marketing_model",
    find: /\bPI_GUI_MARKETING_MODEL\b/g,
    replace: "THETA_GUI_MARKETING_MODEL",
  },
  {
    unit: "R8",
    id: "pi_gui_marketing_provider",
    find: /\bPI_GUI_MARKETING_PROVIDER\b/g,
    replace: "THETA_GUI_MARKETING_PROVIDER",
  },
  {
    unit: "R8",
    id: "pi_gui_marketing_stage_dir",
    find: /\bPI_GUI_MARKETING_STAGE_DIR\b/g,
    replace: "THETA_GUI_MARKETING_STAGE_DIR",
  },
  { unit: "R8", id: "pi_gui_model", find: /\bPI_GUI_MODEL\b/g, replace: "THETA_GUI_MODEL" },
  {
    unit: "R8",
    id: "pi_gui_proof_dir",
    find: /\bPI_GUI_PROOF_DIR\b/g,
    replace: "THETA_GUI_PROOF_DIR",
  },
  {
    unit: "R8",
    id: "pi_gui_provider",
    find: /\bPI_GUI_PROVIDER\b/g,
    replace: "THETA_GUI_PROVIDER",
  },
  {
    unit: "R8",
    id: "pi_gui_tools_label",
    find: /\bPI_GUI_TOOLS_LABEL\b/g,
    replace: "THETA_GUI_TOOLS_LABEL",
  },
  {
    unit: "R8",
    id: "unsupported-host-ui-sentinel",
    find: /__PI_GUI_UNSUPPORTED_HOST_UI__/g,
    replace: "__THETA_GUI_UNSUPPORTED_HOST_UI__",
  },
  {
    unit: "R8",
    id: "pi_gui_workbench_canary",
    find: /\bPI_GUI_WORKBENCH_CANARY\b/g,
    replace: "THETA_GUI_WORKBENCH_CANARY",
  },
  // R9 stored names. R7's channel rule already moved the two colon-style localStorage
  // keys (locale, thread-switcher-order), so these two dot-style keys are the last
  // stored names. They join the colon-style namespace the other two renderer keys use.
  {
    unit: "R9",
    id: "stored-last-theme",
    find: /pi-gui\.last-theme/g,
    replace: "theta-desktop:last-theme",
  },
  {
    unit: "R9",
    id: "stored-review-tree-visible",
    find: /pi-gui\.review-tree-visible/g,
    replace: "theta-desktop:review-tree-visible",
  },
  // R10 remaining names for this app: the log prefix, prose, possessives, and quoted
  // temp-dir, fixture, and inline-extension names. The six keep-listed extension names
  // never match the quoted or inline rules, and no rule reaches a bare quoted
  // "pi-gui", so the stored lease surface value stays.
  { unit: "R10", id: "log-prefix", find: /\[pi-gui\]/g, replace: "[theta]" },
  { unit: "R10", id: "prose", find: /pi-gui /g, replace: "Theta " },
  { unit: "R10", id: "possessive", find: /pi-gui's/g, replace: "Theta's" },
  {
    unit: "R10",
    id: "quoted-name",
    find: /(['"`])pi-gui-(?!image|thread-orchestration|scheduled-tasks|desktop-views|plan-limits|transcript-identity|turn-capture)/g,
    replace: "$1theta-",
  },
  {
    unit: "R10",
    id: "inline-name",
    find: /<inline:pi-gui-(?!thread-orchestration|scheduled-tasks|desktop-views|plan-limits|transcript-identity|turn-capture)/g,
    replace: "<inline:theta-",
  },
  {
    unit: "R10",
    id: "stored-workbench-width",
    find: /pi-gui\.workbench-width/g,
    replace: "theta-desktop:workbench-width",
  },
  {
    unit: "R10",
    id: "stored-sidebar-width",
    find: /pi-gui\.sidebar-width/g,
    replace: "theta-desktop:sidebar-width",
  },
  {
    unit: "R10",
    id: "catalog-default-dir",
    find: /"\.pi-gui"/g,
    replace: '".theta-desktop"',
  },
];

// Names that the app writes outside its code, and names of the pi agent. A rule match
// that overlaps one of these literals stops the run. The bare `pi` name is too short to
// protect as a literal, so no rule may match it.
export const KEEP_LIST = [
  "pi-sdk-driver",
  "@earendil-works/pi-coding-agent",
  "~/.pi/agent",
  ".pi/settings.json",
  "PI_CODING_AGENT_DIR",
  "refs/pi-gui/snapshots/",
  "pi-gui-thread-orchestration",
  "pi-gui-scheduled-tasks",
  "pi-gui-desktop-views",
  "pi-gui-plan-limits",
  "pi-gui-transcript-identity",
  "pi-gui-turn-capture",
  "pi-gui.card",
  "pi-gui.pin",
  "<pi-gui-file-attachments>",
  "PI_GUI_LEASE_SURFACE",
];

// Upstream attribution keeps its names. The README fork note is protected by region.
const PROTECTED_FILES = new Set(["LICENSE", "NOTICE.md"]);

// The plan documents the old names on purpose. The examples are upstream-derived demo
// content: their fixtures carry upstream repo data, so their prose keeps upstream's
// name, like the website. A lockfile is regenerated by `pnpm install`. These two files
// hold the rule strings, and the names guard's source and test quote upstream by
// definition. The website keeps the upstream attribution names by decision, like the
// guard's exemption for it.
const SKIPPED_PREFIXES = ["plans/", "apps/website/", "examples/"];
const SKIPPED_FILES = new Set([
  "scripts/rename-pi-names.mjs",
  "scripts/rename-pi-names.test.mjs",
  "scripts/check-names.mjs",
  "scripts/check-names.test.mjs",
  // AGENTS.md quotes the banned identifiers in its names rule, like the guard does.
  "AGENTS.md",
]);

function isSkipped(relativePath) {
  return (
    SKIPPED_FILES.has(relativePath) ||
    PROTECTED_FILES.has(relativePath) ||
    relativePath.endsWith("pnpm-lock.yaml") ||
    SKIPPED_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
  );
}

// The README opens with the fork note, a blockquote that names upstream on purpose.
export function forkNoteSpan(content) {
  const lines = content.split("\n");
  let index = 0;
  if (lines[0]?.startsWith("# ")) {
    index = 1;
  }
  while (index < lines.length && lines[index].trim() === "") {
    index += 1;
  }
  if (!lines[index]?.startsWith(">")) {
    return null;
  }
  let end = index;
  while (end < lines.length && lines[end].startsWith(">")) {
    end += 1;
  }
  const offset = (count) => lines.slice(0, count).reduce((sum, line) => sum + line.length + 1, 0);
  return [offset(index), Math.min(offset(end), content.length)];
}

function lineOf(content, index) {
  return content.slice(0, index).split("\n").length;
}

function keepListSpans(content) {
  const spans = [];
  for (const keep of KEEP_LIST) {
    for (let at = content.indexOf(keep); at !== -1; at = content.indexOf(keep, at + 1)) {
      spans.push({ keep, start: at, end: at + keep.length });
    }
  }
  return spans;
}

// The README fork note is attribution. Matches inside it are out of scope, like the
// protected files, and no rule can reach them.
function ignoredSpan(relativePath, content) {
  return relativePath === "README.md" ? forkNoteSpan(content) : null;
}

// Plans the rename of one file. `edits` lists each match with its line in the source.
// `violations` lists each match that overlaps a keep-list name.
export function renameContent(content, relativePath, rules = RULES) {
  const spans = keepListSpans(content);
  const ignored = ignoredSpan(relativePath, content);
  const edits = [];
  const violations = [];
  for (const rule of rules) {
    if (rule.files && !rule.files.includes(relativePath)) {
      continue;
    }
    const flags = rule.find.flags.includes("g") ? rule.find.flags : `${rule.find.flags}g`;
    const find = new RegExp(rule.find.source, flags);
    const once = new RegExp(rule.find.source, flags.replace("g", ""));
    for (const match of content.matchAll(find)) {
      const start = match.index;
      const end = start + match[0].length;
      if (ignored && start >= ignored[0] && end <= ignored[1]) {
        continue;
      }
      const hit = spans.find((span) => start < span.end && span.start < end);
      const record = { rule: rule.id, line: lineOf(content, start), text: match[0] };
      if (hit) {
        violations.push({ ...record, keep: hit.keep });
      } else {
        edits.push({ ...record, start, end, replacement: match[0].replace(once, rule.replace) });
      }
    }
  }
  edits.sort((left, right) => left.start - right.start);
  let next = "";
  let cursor = 0;
  for (const edit of edits) {
    if (edit.start < cursor) {
      throw new Error(`Rules overlap in ${relativePath}:${edit.line} at "${edit.text}"`);
    }
    next += content.slice(cursor, edit.start) + edit.replacement;
    cursor = edit.end;
  }
  next += content.slice(cursor);
  return { next, edits, violations };
}

async function listTextFiles(rootDir) {
  const { stdout } = await execFileAsync("git", ["ls-files", "-z"], {
    cwd: rootDir,
    maxBuffer: 64 * 1024 * 1024,
  });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const files = [];
  for (const relativePath of stdout.split("\0").filter(Boolean)) {
    if (isSkipped(relativePath)) {
      continue;
    }
    const absolute = path.join(rootDir, relativePath);
    let bytes;
    try {
      // lstat, so a symlink such as CLAUDE.md is skipped and never replaced by a file.
      if (!(await lstat(absolute)).isFile()) {
        continue;
      }
      bytes = await readFile(absolute);
    } catch {
      // Removed between listing and reading.
      continue;
    }
    if (bytes.includes(0)) {
      continue;
    }
    try {
      files.push({ relativePath, absolute, content: decoder.decode(bytes) });
    } catch {
      // Not UTF-8 text.
    }
  }
  return files;
}

export async function planRename(rootDir = repoRoot, rules = RULES) {
  const files = [];
  const violations = [];
  for (const { relativePath, absolute, content } of await listTextFiles(rootDir)) {
    const { next, edits, violations: found } = renameContent(content, relativePath, rules);
    if (edits.length > 0) {
      files.push({ relativePath, absolute, next, edits });
    }
    for (const violation of found) {
      violations.push({ file: relativePath, ...violation });
    }
  }
  return { files, violations };
}

export async function applyRename(plan) {
  if (plan.violations.length > 0) {
    throw new Error(`Refused to write: ${plan.violations.length} keep-list matches`);
  }
  const written = [];
  for (const file of plan.files) {
    await writeFile(file.absolute, file.next, "utf8");
    written.push(file.relativePath);
  }
  return written;
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const rootIndex = args.indexOf("--root");
  const rootDir = rootIndex === -1 ? repoRoot : path.resolve(args[rootIndex + 1]);

  const plan = await planRename(rootDir);
  if (plan.violations.length > 0) {
    for (const { file, line, rule, keep } of plan.violations) {
      console.error(`  ${file}:${line}: rule ${rule} would touch "${keep}"`);
    }
    console.error("Stopped before any write. Narrow the rule, or edit that file by hand.");
    process.exitCode = 1;
    return;
  }
  let matches = 0;
  for (const file of plan.files) {
    for (const { line, rule, text } of file.edits) {
      console.log(`${file.relativePath}:${line}: ${rule}: ${text}`);
      matches += 1;
    }
  }
  if (!write) {
    console.log(
      `Dry run: ${matches} matches in ${plan.files.length} files. Pass --write to apply.`,
    );
    return;
  }
  const written = await applyRename(plan);
  console.log(`Wrote ${matches} matches in ${written.length} files.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
