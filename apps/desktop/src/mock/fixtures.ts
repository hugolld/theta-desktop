import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type { SessionUsageSnapshot } from "@pi-gui/session-driver";
import type {
  ChildThreadLink,
  DesktopAppState,
  QueuedComposerMessage,
  ScheduledTaskRecord,
  SessionExtensionUiStateRecord,
  SessionRecord,
  WorkspaceRecord,
  WorktreeRecord,
} from "../../contracts/desktop-state";
import type { TranscriptMessage } from "../../contracts/timeline-types";
import type { SessionTreeNodeSnapshot } from "@pi-gui/session-driver/types";

/** Minutes ago → ISO timestamp, so fixture recency always looks fresh. */
function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function inMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export const MOCK_WORKSPACE_THETA = "mock-ws-theta";
export const MOCK_WORKSPACE_THETA_WT = "mock-ws-theta-wt";
export const MOCK_WORKSPACE_AGENT = "mock-ws-agent";
export const MOCK_SELECTED_SESSION = "mock-s-orchestra";

function session(partial: SessionRecord): SessionRecord {
  return partial;
}

export function buildWorkspaces(): WorkspaceRecord[] {
  return [
    {
      id: MOCK_WORKSPACE_THETA,
      name: "theta-desktop",
      path: "/Users/mock/Code/theta-desktop",
      lastOpenedAt: ago(3),
      kind: "primary",
      branchName: "main",
      sessions: [
        session({
          id: MOCK_SELECTED_SESSION,
          title: "Refactor transcript store",
          updatedAt: ago(2),
          pinnedAt: ago(600),
          lastViewedAt: ago(5),
          lastInteractedAt: ago(2),
          preview: "Split the patch reducer out of the window store so pushes stay cheap.",
          status: "idle",
          hasUnseenUpdate: true,
          config: { provider: "anthropic", modelId: "claude-opus-4-6", thinkingLevel: "medium" },
        }),
        session({
          id: "mock-s-styling",
          title: "Sidebar spacing pass",
          updatedAt: ago(95),
          lastViewedAt: ago(90),
          preview: "Tighten the folder-group paddings and align the pin badges.",
          status: "idle",
          hasUnseenUpdate: false,
          config: { provider: "anthropic", modelId: "claude-sonnet-4-6", thinkingLevel: "low" },
        }),
        session({
          id: "mock-s-archived",
          title: "Legacy drawer cleanup",
          updatedAt: ago(4000),
          archivedAt: ago(3000),
          preview: "Remove the replaced drawer layout.",
          status: "idle",
          hasUnseenUpdate: false,
        }),
      ],
    },
    {
      id: MOCK_WORKSPACE_THETA_WT,
      name: "theta-desktop/fix-recency",
      path: "/Users/mock/Code/theta-worktrees/fix-recency",
      lastOpenedAt: ago(50),
      kind: "worktree",
      rootWorkspaceId: MOCK_WORKSPACE_THETA,
      branchName: "fix/recency-sort",
      sessions: [
        session({
          id: "mock-s-wt-1",
          title: "Sort pinned threads first",
          updatedAt: ago(40),
          lastViewedAt: ago(45),
          preview: "Pinned threads should ignore the recency cutoff.",
          status: "idle",
          hasUnseenUpdate: false,
        }),
      ],
    },
    {
      id: MOCK_WORKSPACE_AGENT,
      name: "theta-agent",
      path: "/Users/mock/Code/theta-agent",
      lastOpenedAt: ago(20),
      kind: "primary",
      branchName: "develop",
      sessions: [
        session({
          id: "mock-s-agent-1",
          title: "Harden stream reconnect",
          updatedAt: ago(4),
          lastViewedAt: ago(30),
          lastInteractedAt: ago(4),
          preview: "Backoff loop for dropped SSE connections.",
          status: "running",
          runningSince: ago(4),
          hasUnseenUpdate: true,
          config: { provider: "openai", modelId: "gpt-5.4", thinkingLevel: "high" },
        }),
      ],
    },
  ];
}

export function buildWorktreesByWorkspace(): Record<string, WorktreeRecord[]> {
  return {
    [MOCK_WORKSPACE_THETA]: [
      {
        id: "mock-wt-recency",
        rootWorkspaceId: MOCK_WORKSPACE_THETA,
        linkedWorkspaceId: MOCK_WORKSPACE_THETA_WT,
        name: "fix-recency",
        path: "/Users/mock/Code/theta-worktrees/fix-recency",
        status: "ready",
        branchName: "fix/recency-sort",
        updatedAt: ago(50),
      },
    ],
  };
}

export function buildChildThreadLinks(): ChildThreadLink[] {
  return [
    {
      id: "mock-child-runner",
      parentWorkspaceId: MOCK_WORKSPACE_THETA,
      parentSessionId: MOCK_SELECTED_SESSION,
      childWorkspaceId: MOCK_WORKSPACE_THETA,
      childSessionId: "mock-s-child-runner",
      title: "Extract patch reducer",
      status: "running",
    },
    {
      id: "mock-child-tests",
      parentWorkspaceId: MOCK_WORKSPACE_THETA,
      parentSessionId: MOCK_SELECTED_SESSION,
      childWorkspaceId: MOCK_WORKSPACE_THETA,
      childSessionId: "mock-s-child-tests",
      title: "Update store unit tests",
      status: "complete",
    },
  ];
}

function runtimeForTheta(): RuntimeSnapshot {
  return {
    workspace: {
      workspaceId: MOCK_WORKSPACE_THETA,
      path: "/Users/mock/Code/theta-desktop",
      displayName: "theta-desktop",
    },
    providers: [
      {
        id: "anthropic",
        name: "Anthropic",
        hasAuth: true,
        authType: "oauth",
        authSource: "oauth",
        oauthSupported: true,
        apiKeySetupSupported: true,
      },
      {
        id: "openai",
        name: "OpenAI",
        hasAuth: true,
        authType: "api_key",
        authSource: "env",
        oauthSupported: false,
        apiKeySetupSupported: true,
      },
      {
        id: "google",
        name: "Google",
        hasAuth: false,
        authType: "none",
        authSource: "none",
        oauthSupported: true,
        apiKeySetupSupported: true,
      },
    ],
    models: [
      {
        providerId: "anthropic",
        providerName: "Anthropic",
        modelId: "claude-opus-4-6",
        label: "Claude Opus 4.6",
        available: true,
        authType: "oauth",
        reasoning: true,
        supportsImages: true,
        scope: "all",
      },
      {
        providerId: "anthropic",
        providerName: "Anthropic",
        modelId: "claude-sonnet-4-6",
        label: "Claude Sonnet 4.6",
        available: true,
        authType: "oauth",
        reasoning: true,
        supportsImages: true,
        scope: "all",
      },
      {
        providerId: "openai",
        providerName: "OpenAI",
        modelId: "gpt-5.4",
        label: "GPT-5.4",
        available: true,
        authType: "api_key",
        reasoning: true,
        supportsImages: true,
        scope: "all",
      },
      {
        providerId: "google",
        providerName: "Google",
        modelId: "gemini-3-pro",
        label: "Gemini 3 Pro",
        available: false,
        authType: "none",
        reasoning: true,
        supportsImages: true,
        scope: "off",
      },
    ],
    skills: [
      {
        name: "verify-theta-desktop",
        description: "Verify Theta conversation flows through the visible Electron UI.",
        filePath: "/Users/mock/Code/theta-desktop/.agents/skills/verify-theta-desktop/SKILL.md",
        baseDir: "/Users/mock/Code/theta-desktop/.agents/skills/verify-theta-desktop",
        source: "project",
        scope: "project",
        enabled: true,
        disableModelInvocation: false,
        slashCommand: "/verify-theta-desktop",
      },
      {
        name: "docling-pdf",
        description: "Convert PDF files to clean markdown with the docling CLI.",
        filePath: "/Users/mock/.pi/skills/docling-pdf/SKILL.md",
        baseDir: "/Users/mock/.pi/skills/docling-pdf",
        source: "user",
        scope: "user",
        enabled: true,
        disableModelInvocation: false,
        slashCommand: "/docling-pdf",
      },
    ],
    extensions: [
      {
        path: "/Users/mock/Code/theta-desktop/examples/desktop-extensions/github",
        displayName: "GitHub",
        description: "PR review cards and repo actions.",
        enabled: true,
        sourceInfo: {
          path: "/Users/mock/Code/theta-desktop/examples/desktop-extensions/github",
          source: "project",
          scope: "project",
          origin: "top-level",
        },
        commands: ["/github-pr"],
        tools: [{ name: "github_pr_summary", label: "PR summary", replacesPiTool: false }],
        flags: ["dry-run"],
        flagDetails: [{ name: "dry-run", type: "boolean", default: false }],
        shortcuts: [],
        diagnostics: [],
      },
    ],
    settings: {
      defaultProvider: "anthropic",
      defaultModelId: "claude-opus-4-6",
      defaultThinkingLevel: "medium",
      enableSkillCommands: true,
      enabledModelPatterns: [],
    },
  };
}

function runtimeLight(workspaceId: string, path: string, displayName: string): RuntimeSnapshot {
  const full = runtimeForTheta();
  return {
    ...full,
    workspace: { workspaceId, path, displayName },
    models: full.models.map((model) => ({
      ...model,
      available: model.providerId !== "google",
      scope: model.providerId === "google" ? "off" : "all",
    })),
  };
}

export function buildRuntimeByWorkspace(): Record<string, RuntimeSnapshot> {
  return {
    [MOCK_WORKSPACE_THETA]: runtimeForTheta(),
    [MOCK_WORKSPACE_THETA_WT]: runtimeLight(
      MOCK_WORKSPACE_THETA_WT,
      "/Users/mock/Code/theta-worktrees/fix-recency",
      "theta-desktop/fix-recency",
    ),
    [MOCK_WORKSPACE_AGENT]: runtimeLight(
      MOCK_WORKSPACE_AGENT,
      "/Users/mock/Code/theta-agent",
      "theta-agent",
    ),
  };
}

export function buildSessionUsage(): Record<string, SessionUsageSnapshot> {
  return {
    [MOCK_SELECTED_SESSION]: {
      context: { tokens: 84_200, contextWindow: 200_000, compactAtTokens: 160_000 },
      lastTurn: { input: 12_400, output: 1_850, cacheRead: 71_900, cacheWrite: 3_300 },
      cache: { lifetimeSeconds: 300, nextRefreshAt: inMinutes(4) },
      totals: {
        input: 240_000,
        output: 22_400,
        cacheRead: 1_902_000,
        cacheWrite: 88_000,
        cost: 6.41,
      },
      subscription: true,
    },
  };
}

export function buildSessionExtensionUi(): Record<string, SessionExtensionUiStateRecord> {
  return {
    [MOCK_SELECTED_SESSION]: {
      instanceId: "mock-ext-ui-1",
      statuses: [{ key: "github", text: "GitHub: watching pr-review" }],
      widgets: [
        {
          key: "pr-summary",
          lines: ["PR #302: cross-project messaging", "2 checks pending"],
          placement: "aboveComposer",
        },
      ],
      pendingDialogs: [],
      notices: [
        {
          id: "mock-notice-1",
          level: "info",
          message: "Extension GitHub attached to this thread.",
          createdAt: ago(25),
        },
      ],
      title: "GitHub",
    },
  };
}

export function buildQueuedMessages(): QueuedComposerMessage[] {
  return [
    {
      id: "mock-queued-1",
      mode: "followUp",
      text: "After the reducer lands, rerun the desktop unit tests.",
      attachments: [],
      createdAt: ago(7),
      updatedAt: ago(7),
    },
  ];
}

export function buildScheduledTasks(): ScheduledTaskRecord[] {
  return [
    {
      id: "mock-task-1",
      title: "Nightly dependency audit",
      instruction: "Run the dependency audit and summarize findings.",
      status: "active",
      schedule: { kind: "daily", hour: 8, minute: 30, timeZone: "Asia/Shanghai" },
      target: { kind: "new-thread", workspaceId: MOCK_WORKSPACE_THETA },
      createdAt: ago(8000),
      updatedAt: ago(1400),
      nextRunAt: inMinutes(600),
      lastRunAt: ago(1400),
      runs: [],
    },
  ];
}

function baseTranscript(): TranscriptMessage[] {
  return [
    {
      kind: "message",
      role: "user",
      text: "Split the selected-transcript patch reducer out of the window store. Keep behavior identical; the window must still resync when a patch does not fit.",
      createdAt: ago(120),
      id: "mock-msg-u1",
    },
    {
      kind: "message",
      role: "assistant",
      text: "I traced the flow: main pushes `SelectedTranscriptPatch` rows; the window applies them only when `receivedPushedTranscript` is set. I will extract the reducer and keep that contract.",
      createdAt: ago(118),
      id: "mock-msg-a1",
    },
    {
      kind: "tool",
      id: "mock-tool-1",
      callId: "call-mock-1",
      toolName: "read",
      status: "success",
      label: "Read desktop-app-state.ts",
      detail: "apps/desktop/src/app/desktop-app-state.ts",
      createdAt: ago(117),
      input: { path: "apps/desktop/src/app/desktop-app-state.ts" },
      output: { lines: 560 },
    },
    {
      kind: "activity",
      id: "mock-act-1",
      createdAt: ago(116),
      label: "Spawned child thread",
      detail: "Extract patch reducer",
      tone: "neutral",
    },
    {
      kind: "custom",
      id: "mock-custom-1",
      createdAt: ago(110),
      customType: "plan",
      text: "**Plan**\n1. Extract `selectedTranscriptPatch` and `applySelectedTranscriptPatch`.\n2. Rewire the hydration reducer.\n3. Re-run unit tests.",
    },
    {
      kind: "tool",
      id: "mock-tool-2",
      callId: "call-mock-2",
      toolName: "edit",
      status: "success",
      label: "Edit contracts/transcript-patch.ts",
      createdAt: ago(100),
      input: { path: "apps/desktop/contracts/transcript-patch.ts" },
    },
    {
      kind: "tool",
      id: "mock-tool-3",
      callId: "call-mock-3",
      toolName: "bash",
      status: "error",
      label: "Run store tests",
      detail: "exit 1: 2 assertions failed before the fix",
      createdAt: ago(95),
      input: { command: "pnpm test:desktop-unit" },
      output: { exitCode: 1 },
    },
    {
      kind: "card",
      id: "mock-card-1",
      createdAt: ago(90),
      card: {
        key: "review-verdict",
        title: "Review verdict",
        subtitle: "Extracted reducer",
        tone: "success",
        rows: [
          { label: "Files", value: "2 changed" },
          { label: "Tests", value: "14/14 passing" },
          { label: "Risk", value: "low" },
        ],
        actions: [],
      },
    },
    {
      kind: "message",
      role: "assistant",
      text: "Reducer extracted into `contracts/transcript-patch.ts`. Window behavior unchanged; patches that do not fit still trigger a full resync. Two child threads finished their parts.",
      createdAt: ago(85),
      id: "mock-msg-a2",
    },
    {
      kind: "summary",
      id: "mock-sum-1",
      createdAt: ago(84),
      label: "Compacted: earlier tool output trimmed",
      presentation: "divider",
    },
    {
      kind: "message",
      role: "user",
      text: "Good. Now check whether the resend path can double-apply a stale patch.",
      createdAt: ago(10),
      id: "mock-msg-u2",
    },
  ];
}

function stylingTranscript(): TranscriptMessage[] {
  return [
    {
      kind: "message",
      role: "user",
      text: "Tighten the folder-group paddings in the sidebar and align the pin badges with the timestamps.",
      createdAt: ago(94),
      id: "mock-style-u1",
    },
    {
      kind: "pin",
      id: "pin:style-target",
      createdAt: ago(90),
      card: {
        key: "style-target",
        title: "Styling target",
        tone: "neutral",
        rows: [{ label: "Surface", value: "Sidebar folder groups" }],
        actions: [],
      },
    },
    {
      kind: "message",
      role: "assistant",
      text: "The folder-group rows use two separate spacing tokens. I will collapse them to one 8px step and baseline-align the badge row.",
      createdAt: ago(92),
      id: "mock-style-a1",
    },
    {
      kind: "tool",
      id: "mock-style-tool-1",
      callId: "call-style-1",
      toolName: "edit",
      status: "success",
      label: "Edit sidebar.css",
      createdAt: ago(91),
    },
  ];
}

function smallTranscript(firstUserText: string, minutesAgo: number): TranscriptMessage[] {
  return [
    {
      kind: "message",
      role: "user",
      text: firstUserText,
      createdAt: ago(minutesAgo),
      id: `mock-small-u-${minutesAgo}`,
    },
    {
      kind: "message",
      role: "assistant",
      text: "On it — I will report back with the first result shortly.",
      createdAt: ago(minutesAgo - 1),
      id: `mock-small-a-${minutesAgo}`,
    },
  ];
}

export function buildTranscripts(): Map<string, TranscriptMessage[]> {
  return new Map<string, TranscriptMessage[]>([
    [MOCK_SELECTED_SESSION, baseTranscript()],
    ["mock-s-styling", stylingTranscript()],
    ["mock-s-archived", smallTranscript("Remove the replaced drawer layout.", 4000)],
    ["mock-s-wt-1", smallTranscript("Pinned threads should ignore the recency cutoff.", 42)],
    [
      "mock-s-agent-1",
      smallTranscript("Add an exponential backoff loop for dropped SSE connections.", 5),
    ],
    ["mock-s-child-runner", smallTranscript("Extract the patch reducer.", 30)],
    ["mock-s-child-tests", smallTranscript("Cover the patch reducer with tests.", 60)],
  ]);
}

export function buildSessionTree(): SessionTreeNodeSnapshot[] {
  return [
    {
      id: "mock-node-u1",
      parentId: null,
      kind: "message",
      timestamp: ago(120),
      role: "user",
      title: "Split the patch reducer out",
    },
    {
      id: "mock-node-a1",
      parentId: "mock-node-u1",
      kind: "message",
      timestamp: ago(118),
      role: "assistant",
      title: "I traced the flow: main pushes patches…",
    },
    {
      id: "mock-node-a2",
      parentId: "mock-node-a1",
      kind: "message",
      timestamp: ago(85),
      role: "assistant",
      title: "Reducer extracted into contracts/transcript-patch.ts…",
    },
    {
      id: "mock-node-a2b",
      parentId: "mock-node-a1",
      kind: "message",
      timestamp: ago(80),
      role: "assistant",
      title: "Alternative: keep reducer in the store…",
    },
  ];
}

export function buildWorkspaceFiles(): string[] {
  return [
    "apps/desktop/src/app/App.tsx",
    "apps/desktop/src/app/desktop-app-state.ts",
    "apps/desktop/src/styles.css",
    "apps/desktop/electron/main.ts",
    "package.json",
    "README.md",
  ];
}

export function buildChangedFilesResult(): {
  readonly state: "available";
  readonly files: readonly {
    readonly path: string;
    readonly status: string;
    readonly staged: boolean;
  }[];
} {
  return {
    state: "available",
    files: [
      { path: "apps/desktop/src/app/desktop-app-state.ts", status: "modified", staged: false },
      { path: "apps/desktop/contracts/transcript-patch.ts", status: "added", staged: true },
      { path: "README.md", status: "modified", staged: false },
    ],
  };
}

/** Base state the mock bridge starts from; timestamps are relative to call time. */
export function buildFixtureState(): DesktopAppState {
  const workspaces = buildWorkspaces();
  const theta = workspaces[0]!;
  const selected = theta.sessions[0]!;
  return {
    workspaces,
    worktreesByWorkspace: buildWorktreesByWorkspace(),
    selectedWorkspaceId: MOCK_WORKSPACE_THETA,
    selectedSessionId: MOCK_SELECTED_SESSION,
    activeView: "threads",
    composerDraft: "",
    composerDraftSyncSource: "state",
    composerDraftSyncNonce: 0,
    composerAttachments: [],
    queuedComposerMessages: buildQueuedMessages(),
    runtimeByWorkspace: buildRuntimeByWorkspace(),
    sessionCommandsBySession: {
      [MOCK_SELECTED_SESSION]: [
        {
          name: "verify-theta-desktop",
          description: "Verify the desktop conversation flows.",
          source: "skill",
          sourceInfo: {
            path: "/Users/mock/Code/theta-desktop/.agents/skills/verify-theta-desktop/SKILL.md",
            source: "project",
            scope: "project",
            origin: "top-level",
          },
        },
      ],
    },
    sessionUsageBySession: buildSessionUsage(),
    sessionExtensionUiBySession: buildSessionExtensionUi(),
    extensionCommandCompatibilityByWorkspace: {},
    extensionFlagsByWorkspace: {},
    extensionFlagsBySession: {},
    // Main's state pushes leave this empty; the window reads childThreadLinks.
    orchestrationChildren: [],
    childThreadLinks: buildChildThreadLinks(),
    scheduledTasks: buildScheduledTasks(),
    notificationPreferences: {
      backgroundCompletion: true,
      backgroundFailure: true,
      attentionNeeded: true,
    },
    integratedTerminalShell: "zsh",
    lastViewedAtBySession: { [selected.id]: ago(5) },
    lastInteractedAtBySession: { [selected.id]: ago(2) },
    pinnedAtBySession: { [selected.id]: ago(600) },
    pinnedSessionOrder: [selected.id],
    workspaceOrder: [MOCK_WORKSPACE_THETA, MOCK_WORKSPACE_THETA_WT, MOCK_WORKSPACE_AGENT],
    modelSettingsScopeMode: "app-global",
    globalModelSettings: {
      defaultProvider: "anthropic",
      defaultModelId: "claude-opus-4-6",
      defaultThinkingLevel: "medium",
      enabledModelPatterns: [],
    },
    themeMode: "system",
    themePresetId: "default",
    sidebarCollapsed: false,
    threadGrouping: "time",
    collapsedWorkspaceIds: [],
    enableTransparency: false,
    startupDiagnostics: [
      {
        scope: "workspace",
        message: "Mock mode: one extension failed its last probe (fixture).",
        workspacePath: "/Users/mock/Code/theta-desktop",
      },
    ],
    revision: 1,
  };
}
