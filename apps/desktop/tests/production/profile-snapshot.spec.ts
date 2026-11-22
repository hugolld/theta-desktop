/**
 * Snapshot of what the app restores from a data folder. Opt-in. It copies the folder at
 * PI_APP_PROFILE_SOURCE_DIR, launches the app on the copy as a normal launch, and writes
 * the restored state, localStorage, and the root settings files as one JSON file.
 *
 *   PI_APP_PROFILE_SOURCE_DIR=/absolute/path/to/data-folder \
 *     pnpm --filter @theta-desktop/desktop run test:prod:profile-snapshot
 *
 * The source folder is read once and never modified. PROFILE_OUT=<file> copies the
 * result there. PROFILE_BASELINE=<file> compares the `profile` object with that earlier
 * file and fails when they differ. The `identity` object is reported and not compared,
 * because it holds the app name, the window title, and the data path.
 */
import { cp, mkdir, mkdtemp, readFile, realpath, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  getDesktopState,
  launchDesktop,
  seedAgentDir,
  type DesktopHarness,
} from "../helpers/electron-app";

type RestoredState = Record<string, unknown>;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Set ${name}=/absolute/path/to/data-folder. No profile snapshot ran.`);
  }
  return resolve(value);
}

function withoutRevision(state: Awaited<ReturnType<typeof getDesktopState>>): RestoredState {
  const record: RestoredState = { ...state };
  delete record.revision;
  return record;
}

/** Waits until two state reads agree, so the snapshot is not taken mid-restore. */
async function waitForRestoredState(window: Page): Promise<void> {
  let previous = "";
  await expect
    .poll(
      async () => {
        const current = JSON.stringify(withoutRevision(await getDesktopState(window)));
        const stable = current === previous;
        previous = current;
        return stable;
      },
      { timeout: 15_000, intervals: [250] },
    )
    .toBe(true);
}

async function readStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const entries: Record<string, string> = {};
    const storage = globalThis.localStorage;
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key !== null) {
        entries[key] = storage.getItem(key) ?? "";
      }
    }
    return Object.fromEntries(
      Object.entries(entries).sort(([left], [right]) => (left < right ? -1 : 1)),
    );
  });
}

async function readIdentity(harness: DesktopHarness): Promise<{
  readonly appName: string;
  readonly userData: string;
}> {
  return harness.electronApp.evaluate(({ app }) => ({
    appName: app.getName(),
    userData: app.getPath("userData"),
  }));
}

/** The settings files in the data folder root, read after the app has quit. */
async function readRootJsonFiles(dataDir: string): Promise<Record<string, unknown>> {
  const files: Record<string, unknown> = {};
  const entries = await readdir(dataDir, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => (left.name < right.name ? -1 : 1))) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      files[entry.name] = JSON.parse(await readFile(join(dataDir, entry.name), "utf8"));
    }
  }
  return files;
}

test("restores a copied data folder", async ({}, info) => {
  test.setTimeout(120_000);
  const sourceDir = requiredEnv("PI_APP_PROFILE_SOURCE_DIR");

  const root = await realpath(await mkdtemp(join(tmpdir(), "profile-snapshot-")));
  const dataDir = join(root, "data");
  const agentDir = join(root, "agent");
  await cp(sourceDir, dataDir, { recursive: true });
  await seedAgentDir(agentDir);

  const harness = await launchDesktop(dataDir, {
    agentDir,
    // A normal launch: no test hooks and no test window mode.
    envOverrides: { PI_APP_TEST_MODE: undefined },
  });
  let state: RestoredState;
  let storage: Record<string, string>;
  let identity: { readonly appName: string; readonly userData: string; readonly title: string };
  try {
    const window = await harness.firstWindow();
    await waitForRestoredState(window);
    state = withoutRevision(await getDesktopState(window));
    storage = await readStorage(window);
    identity = { ...(await readIdentity(harness)), title: await window.title() };
    expect(identity.userData, "the app must open the copy").toBe(dataDir);
  } finally {
    await harness.close();
  }
  const files = await readRootJsonFiles(dataDir);

  const profile = { state, localStorage: storage, files };
  // Copies live under a different temporary folder each run.
  const normalized = JSON.parse(
    JSON.stringify(profile).split(root).join("<tmp>"),
  ) as typeof profile;
  const snapshot = { identity, profile: normalized };

  console.log(
    `PROFILE_RESULT ${JSON.stringify({ identity, stateKeys: Object.keys(state), localStorageKeys: Object.keys(storage), files: Object.keys(files) })}`,
  );
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  const resultPath = info.outputPath("profile.json");
  await writeFile(resultPath, json, "utf8");
  await info.attach("profile.json", { path: resultPath, contentType: "application/json" });
  if (process.env.PROFILE_OUT) {
    await mkdir(dirname(process.env.PROFILE_OUT), { recursive: true });
    await writeFile(process.env.PROFILE_OUT, json, "utf8");
  }

  const baselinePath = process.env.PROFILE_BASELINE?.trim();
  if (baselinePath) {
    const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as {
      profile: typeof profile;
    };
    expect(normalized, `restored profile against ${baselinePath}`).toEqual(baseline.profile);
  }
});
