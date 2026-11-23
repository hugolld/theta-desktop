import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import {
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
  waitForWorkspaceByPath,
  writeProjectExtension,
} from "../helpers/electron-app";
import { expectExtensionViewReady } from "../helpers/desktop-extension-fixture";

const PROVIDER_ID = "notebook-test";
const MODEL_ID = "scripted";

const extensionDirectory = resolve(__dirname, "../../../../extensions/theta-notebook");

async function openNotebook(window: Page): Promise<FrameLocator> {
  const workbench = window.getByTestId("workbench");
  if (!(await workbench.isVisible())) await window.getByTestId("toggle-side-panel").click();
  const chooser = window.getByTestId("workbench-chooser");
  if (!(await chooser.isVisible())) await window.getByTestId("workbench-add-tab").click();
  await chooser.getByRole("button", { name: "Notebook", exact: true }).click();
  const frame = window.frameLocator('[data-testid="extension-view-frame"]');
  await expect(frame.getByRole("heading", { name: "Notebook", exact: true })).toBeVisible();
  await expectExtensionViewReady(window);
  return frame;
}

// The pane needs a running session (its watcher starts on session_start), not model
// output: the scripted provider only answers so the thread starts hermetically.
const scriptedProvider = String.raw`
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function scriptedProvider(pi) {
  pi.registerProvider("${PROVIDER_ID}", {
    baseUrl: "http://127.0.0.1:9/never-contact",
    apiKey: "LOCAL_TEST_CANARY",
    api: "${PROVIDER_ID}",
    models: [{
      id: "${MODEL_ID}",
      name: "Scripted notebook",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 4096,
    }],
    streamSimple(model) {
      const message = {
        role: "assistant",
        content: [{ type: "text", text: "Noted." }],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: {
          input: 10,
          output: 1,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 11,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "stop",
        timestamp: Date.now(),
      };
      const stream = createAssistantMessageEventStream();
      void (async () => {
        await wait(100);
        stream.push({ type: "start", partial: { ...message, content: [] } });
        stream.push({ type: "text_delta", contentIndex: 0, delta: "Noted.", partial: message });
        stream.push({ type: "done", reason: message.stopReason, message });
      })();
      return stream;
    },
  });
}
`;

const JOURNAL_LINES = [
  '{"id":"hyp-0001","type":"hypothesis","date":"2026-11-20T09:14:00Z","text":"Compound X inhibits kinase Y allosterically."}',
  '{"id":"obs-0001","type":"observation","date":"2026-11-20T10:02:00Z","grade":"cross-checked","text":"Docking pose places X in the allosteric pocket.","evidence":[{"source":"pubmed","retrieved":"2026-11-20T10:00:00Z","grade":"re-executed","job_id":"job-7","snapshot":".theta/evidence/ab12cd34.json"}]}',
  '{"id":"cnf-0001","type":"confidence","date":"2026-11-20T10:10:00Z","hypothesis":"hyp-0001","text":"High: pose and literature agree."}',
  '{"id":"obs-0002","type":"observation","date":"2026-11-20T10',
];
const journalLine = (id: string) => JOURNAL_LINES.find((line) => line.includes(`"${id}"`)) ?? "";
const METHOD_LINE =
  '{"id":"mth-0001","type":"method","date":"2026-11-20T10:30:00Z","text":"Dock with Vina at exhaustiveness 8."}';

async function launchWithNotebook(options: { readonly seed: boolean }) {
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspace = await makeWorkspace("notebook-pane");
  if (options.seed) {
    await mkdir(join(workspace, ".theta"), { recursive: true });
    await writeFile(
      join(workspace, ".theta", "notebook.jsonl"),
      `${JOURNAL_LINES.join("\n")}\n`,
      "utf8",
    );
  }
  await seedAgentDir(agentDir, { withOpenAiAuth: false, withDefaultModel: false });
  await writeFile(
    join(agentDir, "settings.json"),
    JSON.stringify({
      defaultProvider: PROVIDER_ID,
      defaultModel: MODEL_ID,
      enabledModels: [`${PROVIDER_ID}/${MODEL_ID}`],
      packages: [],
      extensions: [join(extensionDirectory, "index.ts")],
      cacheWarming: "off",
      compaction: { enabled: false },
    }),
  );
  await writeProjectExtension(workspace, "scripted-provider.ts", scriptedProvider);
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspace],
    scrubProviderEnv: true,
    testMode: "background",
  });
  return { harness, workspace };
}

test("the Notebook pane renders the project journal and appends live", async () => {
  test.setTimeout(90_000);
  const { harness, workspace } = await launchWithNotebook({ seed: true });
  try {
    const window = await harness.firstWindow();
    await waitForWorkspaceByPath(window, workspace);
    await window
      .getByRole("complementary")
      .getByRole("button", { name: "New thread", exact: true })
      .click();
    await window.getByLabel("New thread prompt", { exact: true }).fill("Start the research log");
    await window.getByRole("button", { name: "Start thread", exact: true }).click();
    await expect(window.locator(".chat-header__title")).toBeVisible();
    await expect(window.locator(".timeline-item--assistant .message__content").last()).toHaveText(
      "Noted.",
    );

    const frame = await openNotebook(window);
    const cards = frame.getByTestId("notebook-card");

    // Seeded journal: three typed entries render grouped, the malformed line only counts.
    await expect(frame.getByTestId("notebook-status")).toHaveText("3 entries · 1 line not shown");
    await expect(cards).toHaveCount(3);
    await expect(frame.getByRole("heading", { name: "Hypotheses · 1" })).toBeVisible();
    await expect(frame.getByRole("heading", { name: "Observations · 1" })).toBeVisible();
    await expect(frame.getByRole("heading", { name: "Confidence · 1" })).toBeVisible();

    const observation = cards.filter({ hasText: "obs-0001" });
    await expect(observation.locator(".grade")).toHaveText(["cross-checked", "re-executed"]);
    await expect(observation.locator(".ev-snap")).toContainText(".theta/evidence/");
    await expect(observation.locator(".ev-meta")).toContainText("job job-7");
    await expect(cards.filter({ hasText: "cnf-0001" }).locator(".judges")).toHaveText(
      "judges hyp-0001",
    );

    // A recorder append lands in the pane live, in place.
    await appendFile(join(workspace, ".theta", "notebook.jsonl"), `${METHOD_LINE}\n`);
    await expect(cards).toHaveCount(4);
    await expect(frame.getByRole("heading", { name: "Methods · 1" })).toBeVisible();
    await expect(frame.getByTestId("notebook-status")).toHaveText("4 entries · 1 line not shown");

    // The filter chips scope the pane to one type and back.
    await frame.locator('[data-filter="method"]').click();
    await expect(cards).toHaveCount(1);
    await expect(frame.getByRole("heading", { name: "Hypotheses · 1" })).toHaveCount(0);
    await frame.locator('[data-filter="all"]').click();
    await expect(cards).toHaveCount(4);
  } finally {
    await harness.close();
  }
});

test("the Notebook pane shows an empty state and follows the journal's creation", async () => {
  test.setTimeout(90_000);
  const { harness, workspace } = await launchWithNotebook({ seed: false });
  try {
    const window = await harness.firstWindow();
    await waitForWorkspaceByPath(window, workspace);
    await window
      .getByRole("complementary")
      .getByRole("button", { name: "New thread", exact: true })
      .click();
    await window.getByLabel("New thread prompt", { exact: true }).fill("Start the research log");
    await window.getByRole("button", { name: "Start thread", exact: true }).click();
    await expect(window.locator(".chat-header__title")).toBeVisible();

    const frame = await openNotebook(window);
    const empty = frame.getByTestId("notebook-empty");
    await expect(empty).toContainText("No notebook in this project yet.");

    // Creating the journal while the pane is open is followed live.
    await mkdir(join(workspace, ".theta"), { recursive: true });
    await writeFile(
      join(workspace, ".theta", "notebook.jsonl"),
      `${journalLine("hyp-0001")}\n`,
      "utf8",
    );
    await expect(frame.getByTestId("notebook-card")).toHaveCount(1);
    await expect(frame.getByTestId("notebook-status")).toHaveText("1 entry");
    await expect(empty).toHaveCount(0);
  } finally {
    await harness.close();
  }
});
