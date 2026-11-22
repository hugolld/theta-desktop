/**
 * Startup cost probe. Not a regression test by default: it launches the built app
 * several times, prints STARTUP_RESULT, and writes startup.json.
 *
 *   pnpm --filter @theta-desktop/desktop run test:perf:startup
 *
 * STARTUP_OUT=<file> copies the result there. STARTUP_BASELINE=<file> compares the run
 * with an earlier result and fails past these margins: a startup minimum above the
 * baseline minimum times 1.15, or a ping mean above the baseline mean times 2.
 *
 * The minimum decides, because other processes on the machine slow a launch and never
 * speed one up. The medians are printed for information.
 */
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
  seedNamedTextSessionFixture,
  waitForWorkspaceByPath,
  type PiAppWindow,
} from "../helpers/electron-app";

const WARMUP_RUNS = 1;
const MEASURED_RUNS = Number(process.env.STARTUP_RUNS ?? 9);
const PING_COUNT = 200;
const STARTUP_MARGIN = 1.15;
const PING_MARGIN_FACTOR = 2;

interface RunResult {
  readonly startupMs: number;
  readonly readyMs: number;
  readonly pingMs: number;
}

interface Summary {
  readonly median: number;
  readonly min: number;
  readonly max: number;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Number((Math.round(value * factor) / factor).toFixed(digits));
}

function summarize(values: readonly number[], digits = 1): Summary {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  return {
    median: round(median, digits),
    min: round(sorted[0]!, digits),
    max: round(sorted.at(-1)!, digits),
  };
}

/**
 * Mean round trip of `count` sequential bridge calls, from the total time. The renderer
 * clock moves in steps of 0.1 ms, so one call is too short to time on its own.
 */
async function meanPing(window: Page, count: number): Promise<number> {
  return window.evaluate(async (pingCount) => {
    const app = (globalThis.window as PiAppWindow).piApp;
    if (!app) {
      throw new Error("piApp IPC bridge is unavailable");
    }
    await app.ping();
    const startedAt = performance.now();
    for (let index = 0; index < pingCount; index += 1) {
      await app.ping();
    }
    return (performance.now() - startedAt) / pingCount;
  }, count);
}

async function measureOnce(
  workspacePath: string,
  agentDir: string,
): Promise<RunResult & { readonly electron: string }> {
  const userDataDir = await makeUserDataDir("startup-user-data-");
  const startedAt = performance.now();
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    agentDir,
    testMode: "background",
  });
  try {
    const window = await harness.firstWindow();
    const startupMs = performance.now() - startedAt;
    await waitForWorkspaceByPath(window, workspacePath);
    const readyMs = performance.now() - startedAt;
    const pingMs = await meanPing(window, PING_COUNT);
    const electron = await harness.electronApp.evaluate(() => process.versions.electron ?? "");
    return { startupMs, readyMs, pingMs, electron };
  } finally {
    await harness.close();
  }
}

test("startup time and bridge ping", async ({}, info) => {
  test.setTimeout(300_000);

  const workspacePath = await makeWorkspace("startup-probe");
  // One agent dir for every run, seeded before the first launch so the seeding is not
  // measured. The fixture session makes the workspace restore read one thread.
  const agentDir = await mkdtemp(join(tmpdir(), "startup-probe-agent-"));
  await seedAgentDir(agentDir);
  await seedNamedTextSessionFixture(agentDir, workspacePath, {
    title: "Startup fixture thread",
    userText: "Startup probe",
    assistantText: "Startup probe answer",
  });

  const runs: Array<RunResult & { readonly electron: string }> = [];
  for (let index = 0; index < WARMUP_RUNS + MEASURED_RUNS; index += 1) {
    runs.push(await measureOnce(workspacePath, agentDir));
  }
  const measured = runs.slice(WARMUP_RUNS);

  const result = {
    label: process.env.STARTUP_LABEL ?? "checkout",
    platform: `${process.platform} ${process.arch}`,
    node: process.version,
    electron: measured[0]!.electron,
    warmupRuns: WARMUP_RUNS,
    measuredRuns: measured.length,
    pingCount: PING_COUNT,
    startupMs: summarize(measured.map((run) => run.startupMs)),
    readyMs: summarize(measured.map((run) => run.readyMs)),
    pingMs: summarize(
      measured.map((run) => run.pingMs),
      3,
    ),
    runs: measured.map((run) => ({
      startupMs: round(run.startupMs),
      readyMs: round(run.readyMs),
      pingMs: round(run.pingMs, 3),
    })),
  };

  console.log("STARTUP_RESULT " + JSON.stringify(result));
  const json = `${JSON.stringify(result, null, 2)}\n`;
  const resultPath = info.outputPath("startup.json");
  await writeFile(resultPath, json, "utf8");
  await info.attach("startup.json", { path: resultPath, contentType: "application/json" });
  if (process.env.STARTUP_OUT) {
    await mkdir(dirname(process.env.STARTUP_OUT), { recursive: true });
    await writeFile(process.env.STARTUP_OUT, json, "utf8");
  }

  const baselinePath = process.env.STARTUP_BASELINE?.trim();
  if (baselinePath) {
    const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as {
      startupMs: Summary;
      pingMs: Summary;
    };
    const startupLimit = baseline.startupMs.min * STARTUP_MARGIN;
    const pingLimit = baseline.pingMs.median * PING_MARGIN_FACTOR;
    console.log(
      `STARTUP_LIMITS ${JSON.stringify({ baseline: baselinePath, startupLimit: round(startupLimit), pingLimit: round(pingLimit, 3) })}`,
    );
    expect(result.startupMs.min, "startup minimum against the baseline").toBeLessThanOrEqual(
      startupLimit,
    );
    expect(result.pingMs.median, "ping mean against the baseline").toBeLessThanOrEqual(pingLimit);
  }
});
