import type { ThetaDesktopApi } from "../../contracts/ipc";
import type {
  ChildThreadLink,
  ComposerAttachment,
  DesktopAppState,
  ScheduledTaskRecord,
  SelectedTranscriptRecord,
  SessionRecord,
  WorkspaceSessionTarget,
} from "../../contracts/desktop-state";
import type { DesktopEditorList } from "../../contracts/editors";
import type { TranscriptMessage } from "../../contracts/timeline-types";
import type { ThetaDesktopStatePush } from "../../contracts/ipc";
import type { SessionRef } from "@theta-desktop/session-driver/types";
import {
  buildFixtureState,
  buildSessionTree,
  buildTranscripts,
  buildWorkspaceFiles,
} from "./fixtures";

type StateListener = (state: ThetaDesktopStatePush) => void;
type TranscriptListener = (payload: SelectedTranscriptRecord | null) => void;
type Unsubscribe = () => void;

function nowIso(): string {
  return new Date().toISOString();
}

function previewOf(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > 90 ? `${collapsed.slice(0, 90)}…` : collapsed;
}

/**
 * In-memory `window.thetaApp` for browser-mode UI development (no Electron, no pi).
 * Installed by `installMockBridge` only in dev builds when the real preload bridge
 * is absent, so the packaged app never sees it. State lives in fixtures.ts; a
 * submit streams a scripted turn through the same push channels main uses.
 */
export class MockThetaDesktopApi implements ThetaDesktopApi {
  platform: NodeJS.Platform = "darwin";
  drawsWindowControls = true;
  versions = {
    node: "22.0.0-mock",
    chrome: "mock",
    electron: "mock",
  } as unknown as NodeJS.ProcessVersions;

  private state: DesktopAppState = buildFixtureState();
  private transcripts: Map<string, TranscriptMessage[]> = buildTranscripts();
  private stateListeners = new Set<StateListener>();
  private transcriptListeners = new Set<TranscriptListener>();
  private streamTimers: ReturnType<typeof setTimeout>[] = [];

  // ---------------------------------------------------------------- plumbing

  private pushState(): DesktopAppState {
    this.state = { ...this.state, revision: this.state.revision + 1 };
    for (const listener of this.stateListeners) {
      listener(this.state);
    }
    return this.state;
  }

  private pushTranscript(): void {
    const record = this.selectedTranscript();
    for (const listener of this.transcriptListeners) {
      listener(record);
    }
  }

  private selectedTranscript(): SelectedTranscriptRecord | null {
    const rows = this.transcripts.get(this.state.selectedSessionId);
    if (!rows) {
      return null;
    }
    return {
      workspaceId: this.state.selectedWorkspaceId,
      sessionId: this.state.selectedSessionId,
      transcript: rows,
    };
  }

  private patchSession(sessionId: string, patch: Partial<SessionRecord>): void {
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map((workspace) => ({
        ...workspace,
        sessions: workspace.sessions.map((session) =>
          session.id === sessionId ? { ...session, ...patch } : session,
        ),
      })),
    };
  }

  ping(): Promise<string> {
    return Promise.resolve("mock-bridge");
  }

  // ------------------------------------------------------------------- state

  getState(): Promise<DesktopAppState> {
    return Promise.resolve(this.state);
  }

  onStateChanged(listener: StateListener): Unsubscribe {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  getSelectedTranscript(): Promise<SelectedTranscriptRecord | null> {
    return Promise.resolve(this.selectedTranscript());
  }

  onSelectedTranscriptChanged(listener: TranscriptListener): Unsubscribe {
    this.transcriptListeners.add(listener);
    return () => {
      this.transcriptListeners.delete(listener);
    };
  }

  resendSelectedTranscript(): void {
    this.pushTranscript();
  }

  getTaskWorkbenchTemplate(): Promise<null> {
    return Promise.resolve(null);
  }

  saveTaskWorkbenchTemplate(): Promise<void> {
    return Promise.resolve();
  }

  onExtensionUiChanged(): Unsubscribe {
    return () => {};
  }

  onCommand(): Unsubscribe {
    return () => {};
  }

  onWorkspacePicked(): Unsubscribe {
    return () => {};
  }

  onClipboardImagePasted(): Unsubscribe {
    return () => {};
  }

  getPathForFile(file: File): string {
    return `/mock-uploads/${file.name}`;
  }

  // -------------------------------------------------------------- workspaces

  addWorkspacePath(path: string): Promise<DesktopAppState> {
    const id = `mock-ws-${this.state.workspaces.length + 1}`;
    const name = path.split("/").filter(Boolean).at(-1) ?? "workspace";
    this.state = {
      ...this.state,
      workspaces: [
        ...this.state.workspaces,
        {
          id,
          name,
          path,
          lastOpenedAt: nowIso(),
          kind: "primary",
          sessions: [],
        },
      ],
      workspaceOrder: [...this.state.workspaceOrder, id],
    };
    return Promise.resolve(this.pushState());
  }

  pickWorkspace(): Promise<DesktopAppState> {
    return Promise.resolve(this.addWorkspacePath("/Users/mock/Code/mock-repo"));
  }

  selectWorkspace(workspaceId: string): Promise<DesktopAppState> {
    const workspace = this.state.workspaces.find((entry) => entry.id === workspaceId);
    if (!workspace) {
      return Promise.resolve(this.state);
    }
    this.state = {
      ...this.state,
      selectedWorkspaceId: workspaceId,
      selectedSessionId: workspace.sessions.find((session) => !session.archivedAt)?.id ?? "",
      activeView: "threads",
    };
    this.pushState();
    this.pushTranscript();
    return Promise.resolve(this.state);
  }

  renameWorkspace(workspaceId: string, displayName: string): Promise<DesktopAppState> {
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map((workspace) =>
        workspace.id === workspaceId ? { ...workspace, name: displayName } : workspace,
      ),
    };
    return Promise.resolve(this.pushState());
  }

  removeWorkspace(workspaceId: string): Promise<DesktopAppState> {
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.filter((workspace) => workspace.id !== workspaceId),
      workspaceOrder: this.state.workspaceOrder.filter((id) => id !== workspaceId),
    };
    return Promise.resolve(this.pushState());
  }

  reorderWorkspaces(workspaceOrder: readonly string[]): Promise<DesktopAppState> {
    this.state = { ...this.state, workspaceOrder: [...workspaceOrder] };
    return Promise.resolve(this.pushState());
  }

  reorderPinnedSessions(pinnedSessionOrder: readonly string[]): Promise<DesktopAppState> {
    this.state = { ...this.state, pinnedSessionOrder: [...pinnedSessionOrder] };
    return Promise.resolve(this.pushState());
  }

  openWorkspaceInFinder(): Promise<void> {
    return Promise.resolve();
  }

  private editorList(): DesktopEditorList {
    return {
      editors: [{ id: "vscode", label: "Visual Studio Code", shortLabel: "vscode" }],
      preferredEditorId: "vscode",
    };
  }

  listEditors(): Promise<DesktopEditorList> {
    return Promise.resolve(this.editorList());
  }

  setPreferredEditor(_editorId: string): Promise<DesktopEditorList> {
    return Promise.resolve(this.editorList());
  }

  openWorkspaceInEditor(_workspaceId: string, _editorId: string): Promise<DesktopEditorList> {
    return Promise.resolve(this.editorList());
  }

  // --------------------------------------------------------- scheduled tasks

  createScheduledTask(
    input: Omit<ScheduledTaskRecord, "id" | "createdAt" | "updatedAt" | "runs">,
  ): Promise<DesktopAppState> {
    const id = `mock-task-${Date.now()}`;
    const task: ScheduledTaskRecord = {
      ...input,
      id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      runs: [],
    };
    this.state = { ...this.state, scheduledTasks: [...this.state.scheduledTasks, task] };
    return Promise.resolve(this.pushState());
  }

  updateScheduledTask(id: string, patch: Partial<ScheduledTaskRecord>): Promise<DesktopAppState> {
    this.state = {
      ...this.state,
      scheduledTasks: this.state.scheduledTasks.map((task) =>
        task.id === id ? { ...task, ...patch, updatedAt: nowIso() } : task,
      ),
    };
    return Promise.resolve(this.pushState());
  }

  deleteScheduledTask(id: string): Promise<DesktopAppState> {
    this.state = {
      ...this.state,
      scheduledTasks: this.state.scheduledTasks.filter((task) => task.id !== id),
    };
    return Promise.resolve(this.pushState());
  }

  beginScheduledTaskInterview(): Promise<DesktopAppState> {
    return Promise.resolve(this.pushState());
  }

  // ---------------------------------------------------------------- sessions

  selectSession(target: WorkspaceSessionTarget): Promise<DesktopAppState> {
    this.state = {
      ...this.state,
      selectedWorkspaceId: target.workspaceId,
      selectedSessionId: target.sessionId,
      activeView: "threads",
    };
    this.patchSession(target.sessionId, {
      hasUnseenUpdate: false,
      lastViewedAt: nowIso(),
    });
    this.pushState();
    this.pushTranscript();
    return Promise.resolve(this.state);
  }

  renameSession(target: WorkspaceSessionTarget, title: string): Promise<DesktopAppState> {
    this.patchSession(target.sessionId, { title });
    return Promise.resolve(this.pushState());
  }

  archiveSession(target: WorkspaceSessionTarget): Promise<DesktopAppState> {
    this.patchSession(target.sessionId, { archivedAt: nowIso() });
    return Promise.resolve(this.pushState());
  }

  unarchiveSession(target: WorkspaceSessionTarget): Promise<DesktopAppState> {
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map((workspace) => ({
        ...workspace,
        sessions: workspace.sessions.map((session) => {
          if (session.id !== target.sessionId) {
            return session;
          }
          const { archivedAt: _dropped, ...rest } = session;
          return rest;
        }),
      })),
    };
    return Promise.resolve(this.pushState());
  }

  markSessionRead(target: WorkspaceSessionTarget): Promise<DesktopAppState> {
    this.patchSession(target.sessionId, { hasUnseenUpdate: false });
    return Promise.resolve(this.pushState());
  }

  setSessionPinned(target: WorkspaceSessionTarget, pinned: boolean): Promise<DesktopAppState> {
    this.patchSession(target.sessionId, { pinnedAt: pinned ? nowIso() : undefined });
    const order = pinned
      ? [target.sessionId, ...this.state.pinnedSessionOrder.filter((id) => id !== target.sessionId)]
      : this.state.pinnedSessionOrder.filter((id) => id !== target.sessionId);
    const nextPinned: Record<string, string> = { ...this.state.pinnedAtBySession };
    if (pinned) {
      nextPinned[target.sessionId] = nowIso();
    } else {
      delete nextPinned[target.sessionId];
    }
    this.state = {
      ...this.state,
      pinnedSessionOrder: order,
      pinnedAtBySession: nextPinned,
    };
    return Promise.resolve(this.pushState());
  }

  createSession(input: {
    readonly workspaceId: string;
    readonly title?: string;
  }): Promise<DesktopAppState> {
    const id = `mock-s-new-${Date.now()}`;
    const session: SessionRecord = {
      id,
      title: input.title ?? "New thread",
      updatedAt: nowIso(),
      preview: "",
      status: "idle",
      hasUnseenUpdate: false,
    };
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map((workspace) =>
        workspace.id === input.workspaceId
          ? { ...workspace, sessions: [session, ...workspace.sessions] }
          : workspace,
      ),
      selectedWorkspaceId: input.workspaceId,
      selectedSessionId: id,
      activeView: "threads",
    };
    this.transcripts.set(id, []);
    this.pushState();
    this.pushTranscript();
    return Promise.resolve(this.state);
  }

  startThread(input: {
    readonly rootWorkspaceId: string;
    readonly prompt?: string;
  }): Promise<DesktopAppState> {
    this.createSession({
      workspaceId: input.rootWorkspaceId,
      title: input.prompt?.slice(0, 40) ?? "New thread",
    }).catch(() => {});
    if (input.prompt) {
      this.submitComposer(input.prompt).catch(() => {});
    }
    return Promise.resolve(this.state);
  }

  forkThread(): Promise<DesktopAppState> {
    return Promise.resolve(this.state);
  }

  sendChildThreadFollowUp(input: {
    readonly childThreadId: string;
    readonly text: string;
  }): Promise<DesktopAppState> {
    this.state = {
      ...this.state,
      childThreadLinks: this.state.childThreadLinks.map((link) =>
        link.id === input.childThreadId ? { ...link, status: "running" as const } : link,
      ),
    };
    return Promise.resolve(this.pushState());
  }

  setChildSupervisionLoop(input: {
    readonly childThreadId: string;
    readonly gate: "continue" | "stop";
  }): Promise<DesktopAppState> {
    const status: ChildThreadLink["status"] = input.gate === "stop" ? "complete" : "running";
    this.state = {
      ...this.state,
      childThreadLinks: this.state.childThreadLinks.map((link) =>
        link.id === input.childThreadId ? { ...link, status } : link,
      ),
    };
    return Promise.resolve(this.pushState());
  }

  // ------------------------------------------------------- composer + turns

  submitComposer(
    text: string,
    options?: { readonly deliverAs?: "steer" | "followUp" },
  ): Promise<DesktopAppState> {
    const sessionId = this.state.selectedSessionId;
    const session = this.findSession(sessionId);
    if (!session || text.trim().length === 0) {
      return Promise.resolve(this.state);
    }
    if (session.status === "running" || options?.deliverAs) {
      const queued = {
        id: `mock-queued-${Date.now()}`,
        mode: (options?.deliverAs ?? "steer") as "steer" | "followUp",
        text,
        attachments: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      this.state = {
        ...this.state,
        queuedComposerMessages: [...this.state.queuedComposerMessages, queued],
      };
      return Promise.resolve(this.pushState());
    }
    this.runMockTurn(sessionId, text);
    return Promise.resolve(this.state);
  }

  cancelCurrentRun(): Promise<DesktopAppState> {
    this.clearStreamTimers();
    const sessionId = this.state.selectedSessionId;
    const rows = this.transcripts.get(sessionId);
    if (rows) {
      const next = [...rows];
      this.transcripts.set(sessionId, next);
      for (let index = next.length - 1; index >= 0; index -= 1) {
        const row = next[index]!;
        if (row.kind === "tool" && row.status === "running") {
          next[index] = { ...row, status: "error", label: `${row.label} (cancelled)` };
          break;
        }
      }
    }
    this.patchSession(sessionId, { status: "idle", runningSince: undefined });
    this.pushTranscript();
    return Promise.resolve(this.pushState());
  }

  private findSession(sessionId: string): SessionRecord | undefined {
    return this.state.workspaces
      .flatMap((workspace) => workspace.sessions)
      .find((session) => session.id === sessionId);
  }

  /**
   * A scripted turn: user row, a tool probe, a streaming reply, a closing card.
   * Pushes full transcript records on the same channel main uses, so the
   * timeline, working indicator and composer queue render realistically.
   */
  private runMockTurn(sessionId: string, text: string): void {
    const rows = this.transcripts.get(sessionId) ?? [];
    const turnId = Date.now();
    const userRow: TranscriptMessage = {
      kind: "message",
      role: "user",
      text,
      createdAt: nowIso(),
      id: `mock-turn-${turnId}-user`,
    };
    const streamTarget = sessionId;
    const toolRow: TranscriptMessage = {
      kind: "tool",
      id: `mock-turn-${turnId}-tool`,
      callId: `call-${turnId}`,
      toolName: "read",
      status: "running",
      label: "Inspecting workspace",
      detail: "apps/desktop/src",
      createdAt: nowIso(),
    };
    const next = [...rows, userRow, toolRow];
    this.transcripts.set(streamTarget, next);
    this.patchSession(sessionId, {
      status: "running",
      runningSince: nowIso(),
      preview: previewOf(text),
      updatedAt: nowIso(),
    });
    this.state = {
      ...this.state,
      lastInteractedAtBySession: { ...this.state.lastInteractedAtBySession, [sessionId]: nowIso() },
    };
    this.pushState();
    this.pushTranscript();

    const schedule = (delay: number, step: () => void) => {
      this.streamTimers.push(setTimeout(step, delay));
    };
    const replyChunks = [
      "Looking at the current shape first",
      " — the push path is already patch-based",
      ", so the extraction only needs a pure function plus re-exports",
      ". I will keep the resync contract identical.",
    ];

    // Rows are replaced, never edited in place: the window memoizes on array
    // identity, so every step stores a fresh array before pushing.
    const copyTranscript = (sessionId: string): TranscriptMessage[] => {
      const current = [...(this.transcripts.get(sessionId) ?? [])];
      this.transcripts.set(sessionId, current);
      return current;
    };

    schedule(900, () => {
      const current = copyTranscript(streamTarget);
      const index = current.findIndex((row) => row.id === toolRow.id);
      if (index >= 0) {
        current[index] = { ...toolRow, status: "success" as const, output: { files: 4 } };
      }
      this.pushTranscript();
    });

    const streamingRowId = `mock-turn-${turnId}-assistant`;
    const streamAt = (offset: number, textSoFar: string) =>
      schedule(offset, () => {
        const current = copyTranscript(streamTarget);
        const index = current.findIndex((row) => row.id === streamingRowId);
        const streamingRow: TranscriptMessage = {
          kind: "message",
          role: "assistant",
          text: textSoFar,
          createdAt: nowIso(),
          id: streamingRowId,
        };
        if (index >= 0) {
          current[index] = streamingRow;
        } else {
          current.push(streamingRow);
        }
        this.pushTranscript();
      });

    let elapsed = 1500;
    let streamed = "";
    for (const chunk of replyChunks) {
      streamed += chunk;
      streamAt(elapsed, streamed);
      elapsed += 550;
    }

    schedule(elapsed + 400, () => {
      const current = copyTranscript(streamTarget);
      current.push({
        kind: "card",
        id: `mock-turn-${turnId}-card`,
        createdAt: nowIso(),
        card: {
          key: `turn-${turnId}`,
          title: "Turn complete",
          tone: "success",
          rows: [
            { label: "Response", value: `${streamed.length} chars streamed` },
            { label: "Mode", value: "mock turn (no provider)" },
          ],
          actions: [],
        },
      });
      this.patchSession(sessionId, {
        status: "idle",
        runningSince: undefined,
        updatedAt: nowIso(),
        preview: previewOf(streamed),
      });
      this.pushTranscript();
      this.pushState();
    });
  }

  private clearStreamTimers(): void {
    for (const timer of this.streamTimers) {
      clearTimeout(timer);
    }
    this.streamTimers = [];
  }

  updateComposerDraft(composerDraft: string, _target: SessionRef): Promise<DesktopAppState> {
    this.state = {
      ...this.state,
      composerDraft,
      composerDraftSyncSource: "command",
      composerDraftSyncNonce: this.state.composerDraftSyncNonce + 1,
    };
    return Promise.resolve(this.pushState());
  }

  persistComposerDraft(): Promise<void> {
    return Promise.resolve();
  }

  onPendingComposerDraftFlush(): Unsubscribe {
    return () => {};
  }

  editQueuedComposerMessage(messageId: string): Promise<DesktopAppState> {
    this.state = { ...this.state, editingQueuedMessageId: messageId };
    return Promise.resolve(this.pushState());
  }

  cancelQueuedComposerEdit(): Promise<DesktopAppState> {
    this.state = { ...this.state, editingQueuedMessageId: undefined };
    return Promise.resolve(this.pushState());
  }

  removeQueuedComposerMessage(messageId: string): Promise<DesktopAppState> {
    this.state = {
      ...this.state,
      queuedComposerMessages: this.state.queuedComposerMessages.filter(
        (message) => message.id !== messageId,
      ),
      editingQueuedMessageId: undefined,
    };
    return Promise.resolve(this.pushState());
  }

  steerQueuedComposerMessage(messageId: string): Promise<DesktopAppState> {
    this.state = {
      ...this.state,
      queuedComposerMessages: this.state.queuedComposerMessages.filter(
        (message) => message.id !== messageId,
      ),
    };
    return Promise.resolve(this.pushState());
  }

  pickComposerAttachments(): Promise<DesktopAppState> {
    return Promise.resolve(this.state);
  }

  readClipboardImage(): { readonly ok: false; readonly message?: string } {
    return { ok: false, message: "Clipboard images are unavailable in mock mode." };
  }

  addComposerAttachments(attachments: readonly ComposerAttachment[]): Promise<DesktopAppState> {
    this.state = { ...this.state, composerAttachments: [...attachments] };
    return Promise.resolve(this.pushState());
  }

  removeComposerAttachment(attachmentId: string): Promise<DesktopAppState> {
    this.state = {
      ...this.state,
      composerAttachments: this.state.composerAttachments.filter(
        (attachment) => attachment.id !== attachmentId,
      ),
    };
    return Promise.resolve(this.pushState());
  }

  // ------------------------------------------------------------------- views

  setActiveView(view: DesktopAppState["activeView"]): Promise<DesktopAppState> {
    this.state = { ...this.state, activeView: view };
    return Promise.resolve(this.pushState());
  }

  setSidebarCollapsed(collapsed: boolean): Promise<DesktopAppState> {
    this.state = { ...this.state, sidebarCollapsed: collapsed };
    return Promise.resolve(this.pushState());
  }

  setThreadGrouping(grouping: DesktopAppState["threadGrouping"]): Promise<DesktopAppState> {
    this.state = { ...this.state, threadGrouping: grouping };
    return Promise.resolve(this.pushState());
  }

  setWorkspaceCollapsed(workspaceId: string, collapsed: boolean): Promise<DesktopAppState> {
    const collapsedIds = collapsed
      ? [...this.state.collapsedWorkspaceIds, workspaceId]
      : this.state.collapsedWorkspaceIds.filter((id) => id !== workspaceId);
    this.state = { ...this.state, collapsedWorkspaceIds: collapsedIds };
    return Promise.resolve(this.pushState());
  }

  getSessionTree(): Promise<{
    readonly nodes: ReturnType<typeof buildSessionTree>;
    readonly leafId: string;
  }> {
    const nodes = buildSessionTree();
    return Promise.resolve({ nodes, leafId: nodes[nodes.length - 1]!.id });
  }

  navigateSessionTree(
    target: WorkspaceSessionTarget,
    targetId: string,
  ): Promise<{
    readonly state: DesktopAppState;
    readonly result: { readonly cancelled: boolean };
  }> {
    void target;
    void targetId;
    return Promise.resolve({ state: this.state, result: { cancelled: true } });
  }

  // ------------------------------------------------------------------ trees

  createWorktree(): Promise<DesktopAppState> {
    return Promise.resolve(this.state);
  }

  removeWorktree(): Promise<DesktopAppState> {
    return Promise.resolve(this.state);
  }

  openSkillInFinder(): Promise<void> {
    return Promise.resolve();
  }

  openExtensionInFinder(): Promise<void> {
    return Promise.resolve();
  }

  syncCurrentWorkspace(): Promise<DesktopAppState> {
    return Promise.resolve(this.pushState());
  }

  refreshRuntime(): Promise<DesktopAppState> {
    return Promise.resolve(this.pushState());
  }

  // ------------------------------------------------------------- model config

  setModelSettingsScopeMode(
    mode: DesktopAppState["modelSettingsScopeMode"],
  ): Promise<DesktopAppState> {
    this.state = { ...this.state, modelSettingsScopeMode: mode };
    return Promise.resolve(this.pushState());
  }

  setDefaultModel(
    workspaceId: string,
    provider: string,
    modelId: string,
  ): Promise<DesktopAppState> {
    const runtime = this.state.runtimeByWorkspace[workspaceId];
    if (runtime) {
      this.state = {
        ...this.state,
        runtimeByWorkspace: {
          ...this.state.runtimeByWorkspace,
          [workspaceId]: {
            ...runtime,
            settings: { ...runtime.settings, defaultProvider: provider, defaultModelId: modelId },
          },
        },
      };
    }
    return Promise.resolve(this.pushState());
  }

  setDefaultThinkingLevel(
    workspaceId: string,
    thinkingLevel: "off" | "low" | "medium" | "high",
  ): Promise<DesktopAppState> {
    const runtime = this.state.runtimeByWorkspace[workspaceId];
    if (runtime) {
      this.state = {
        ...this.state,
        runtimeByWorkspace: {
          ...this.state.runtimeByWorkspace,
          [workspaceId]: {
            ...runtime,
            settings: { ...runtime.settings, defaultThinkingLevel: thinkingLevel },
          },
        },
      };
    }
    return Promise.resolve(this.pushState());
  }

  setSessionModel(
    workspaceId: string,
    sessionId: string,
    provider: string,
    modelId: string,
  ): Promise<DesktopAppState> {
    void workspaceId;
    this.patchSession(sessionId, { config: { provider, modelId } });
    return Promise.resolve(this.pushState());
  }

  setSessionThinkingLevel(
    workspaceId: string,
    sessionId: string,
    thinkingLevel: "off" | "low" | "medium" | "high",
  ): Promise<DesktopAppState> {
    void workspaceId;
    const session = this.findSession(sessionId);
    this.patchSession(sessionId, {
      config: {
        provider: session?.config?.provider,
        modelId: session?.config?.modelId,
        thinkingLevel,
      },
    });
    return Promise.resolve(this.pushState());
  }

  loginProvider(workspaceId: string, providerId: string): Promise<DesktopAppState> {
    return Promise.resolve(this.setProviderAuth(workspaceId, providerId, true));
  }

  logoutProvider(workspaceId: string, providerId: string): Promise<DesktopAppState> {
    return Promise.resolve(this.setProviderAuth(workspaceId, providerId, false));
  }

  private setProviderAuth(
    workspaceId: string,
    providerId: string,
    hasAuth: boolean,
  ): DesktopAppState {
    const runtime = this.state.runtimeByWorkspace[workspaceId];
    if (!runtime) {
      return this.state;
    }
    this.state = {
      ...this.state,
      runtimeByWorkspace: {
        ...this.state.runtimeByWorkspace,
        [workspaceId]: {
          ...runtime,
          providers: runtime.providers.map((provider) =>
            provider.id === providerId
              ? {
                  ...provider,
                  hasAuth,
                  authType: hasAuth ? ("api_key" as const) : ("none" as const),
                }
              : provider,
          ),
          models: runtime.models.map((model) =>
            model.providerId === providerId
              ? {
                  ...model,
                  available: hasAuth,
                  scope: hasAuth ? ("all" as const) : ("off" as const),
                }
              : model,
          ),
        },
      },
    };
    return this.pushState();
  }

  setProviderApiKey(workspaceId: string, providerId: string): Promise<DesktopAppState> {
    return Promise.resolve(this.setProviderAuth(workspaceId, providerId, true));
  }

  listCustomProviders(): Promise<readonly []> {
    return Promise.resolve([]);
  }

  setCustomProvider(): Promise<DesktopAppState> {
    return Promise.resolve(this.state);
  }

  deleteCustomProvider(): Promise<DesktopAppState> {
    return Promise.resolve(this.state);
  }

  probeCustomProviderModels(): Promise<{ readonly ok: true; readonly models: readonly string[] }> {
    return Promise.resolve({ ok: true, models: ["mock-custom-model"] });
  }

  setEnableSkillCommands(workspaceId: string, enabled: boolean): Promise<DesktopAppState> {
    return Promise.resolve(
      this.patchRuntimeSettings(workspaceId, { enableSkillCommands: enabled }),
    );
  }

  setScopedModelPatterns(
    workspaceId: string,
    patterns: readonly string[],
  ): Promise<DesktopAppState> {
    return Promise.resolve(
      this.patchRuntimeSettings(workspaceId, { enabledModelPatterns: [...patterns] }),
    );
  }

  setSkillEnabled(
    workspaceId: string,
    filePath: string,
    enabled: boolean,
  ): Promise<DesktopAppState> {
    return Promise.resolve(
      this.patchRuntime(workspaceId, (runtime) => ({
        ...runtime,
        skills: runtime.skills.map((skill) =>
          skill.filePath === filePath ? { ...skill, enabled } : skill,
        ),
      })),
    );
  }

  setExtensionEnabled(
    workspaceId: string,
    filePath: string,
    enabled: boolean,
  ): Promise<DesktopAppState> {
    return Promise.resolve(
      this.patchRuntime(workspaceId, (runtime) => ({
        ...runtime,
        extensions: runtime.extensions.map((extension) =>
          extension.path === filePath ? { ...extension, enabled } : extension,
        ),
      })),
    );
  }

  private patchRuntimeSettings(
    workspaceId: string,
    patch: Partial<DesktopAppState["runtimeByWorkspace"][string]["settings"]>,
  ): DesktopAppState {
    return this.patchRuntime(workspaceId, (runtime) => ({
      ...runtime,
      settings: { ...runtime.settings, ...patch },
    }));
  }

  private patchRuntime(
    workspaceId: string,
    patch: (
      runtime: NonNullable<DesktopAppState["runtimeByWorkspace"][string]>,
    ) => NonNullable<DesktopAppState["runtimeByWorkspace"][string]>,
  ): DesktopAppState {
    const runtime = this.state.runtimeByWorkspace[workspaceId];
    if (!runtime) {
      return this.state;
    }
    this.state = {
      ...this.state,
      runtimeByWorkspace: { ...this.state.runtimeByWorkspace, [workspaceId]: patch(runtime) },
    };
    return this.pushState();
  }

  // -------------------------------------------------------------------- mcp

  listMcpServers(): Promise<{
    readonly globalConfigPath: string;
    readonly servers: readonly [];
    readonly errors: readonly [];
    readonly codemodeAlwaysOn: boolean;
  }> {
    return Promise.resolve({
      globalConfigPath: "~/.pi/mcp.json (mock)",
      servers: [],
      errors: [],
      codemodeAlwaysOn: false,
    });
  }

  addMcpServer(): Promise<DesktopAppState> {
    return Promise.resolve(this.state);
  }

  removeMcpServer(): Promise<DesktopAppState> {
    return Promise.resolve(this.state);
  }

  setMcpServerEnabled(): Promise<DesktopAppState> {
    return Promise.resolve(this.state);
  }

  setCodemodeAlwaysOn(): Promise<DesktopAppState> {
    return Promise.resolve(this.state);
  }

  respondToHostUiRequest(): Promise<DesktopAppState> {
    return Promise.resolve(this.state);
  }

  // ---------------------------------------------------------- notifications

  setNotificationPreferences(
    preferences: Partial<DesktopAppState["notificationPreferences"]>,
  ): Promise<DesktopAppState> {
    this.state = {
      ...this.state,
      notificationPreferences: { ...this.state.notificationPreferences, ...preferences },
    };
    return Promise.resolve(this.pushState());
  }

  setIntegratedTerminalShell(shell: string): Promise<DesktopAppState> {
    this.state = { ...this.state, integratedTerminalShell: shell };
    return Promise.resolve(this.pushState());
  }

  setEnableTransparency(enabled: boolean): Promise<DesktopAppState> {
    this.state = { ...this.state, enableTransparency: enabled };
    return Promise.resolve(this.pushState());
  }

  setThemePresetId(presetId: DesktopAppState["themePresetId"]): Promise<DesktopAppState> {
    this.state = { ...this.state, themePresetId: presetId };
    return Promise.resolve(this.pushState());
  }

  // --------------------------------------------------------------- terminal

  private terminalSnapshot(workspaceId: string): {
    readonly workspaceId: string;
    readonly rootKey: string;
    readonly activeSessionId: string;
    readonly sessions: readonly {
      readonly id: string;
      readonly workspaceId: string;
      readonly cwd: string;
      readonly shell: string;
      readonly title: string;
      readonly status: "running";
      readonly replay: string;
      readonly truncated: boolean;
    }[];
  } {
    const id = `${workspaceId}-mock-terminal`;
    return {
      workspaceId,
      rootKey: workspaceId,
      activeSessionId: id,
      sessions: [
        {
          id,
          workspaceId,
          cwd: "/Users/mock/Code/theta-desktop",
          shell: this.state.integratedTerminalShell || "zsh",
          title: "mock",
          status: "running",
          replay: "mock@theta-desktop % _",
          truncated: false,
        },
      ],
    };
  }

  ensureTerminalPanel(workspaceId: string) {
    return Promise.resolve(this.terminalSnapshot(workspaceId));
  }

  createTerminalSession(workspaceId: string) {
    return Promise.resolve(this.terminalSnapshot(workspaceId));
  }

  setActiveTerminalSession(workspaceId: string, _terminalScopeId: string, terminalId: string) {
    const snapshot = this.terminalSnapshot(workspaceId);
    return Promise.resolve({ ...snapshot, activeSessionId: terminalId });
  }

  private terminalDataListeners = new Set<
    (event: { readonly terminalId: string; readonly data: string }) => void
  >();

  writeTerminal(terminalId: string, data: string): Promise<void> {
    for (const listener of this.terminalDataListeners) {
      listener({ terminalId, data: data === "\r" ? "\r\nmock % " : data });
    }
    return Promise.resolve();
  }

  resizeTerminal(): Promise<void> {
    return Promise.resolve();
  }

  restartTerminalSession(workspaceId: string) {
    return Promise.resolve(this.terminalSnapshot(workspaceId));
  }

  closeTerminalSession(workspaceId: string) {
    return Promise.resolve(this.terminalSnapshot(workspaceId));
  }

  setTerminalTitle(): Promise<void> {
    return Promise.resolve();
  }

  setTerminalFocused(): Promise<void> {
    return Promise.resolve();
  }

  setSidePanelFocused(): Promise<void> {
    return Promise.resolve();
  }

  onTerminalData(
    listener: (event: { readonly terminalId: string; readonly data: string }) => void,
  ): Unsubscribe {
    this.terminalDataListeners.add(listener);
    return () => {
      this.terminalDataListeners.delete(listener);
    };
  }

  onTerminalExit(): Unsubscribe {
    return () => {};
  }

  onTerminalError(): Unsubscribe {
    return () => {};
  }

  // ---------------------------------------------------------- notifications

  getNotificationPermissionStatus() {
    return Promise.resolve("granted" as const);
  }

  requestNotificationPermission() {
    return Promise.resolve("granted" as const);
  }

  openSystemNotificationSettings(): Promise<void> {
    return Promise.resolve();
  }

  onNotificationPermissionStatusChanged(): Unsubscribe {
    return () => {};
  }

  // ------------------------------------------------------------ file access

  listWorkspaceFiles(): Promise<string[]> {
    return Promise.resolve(buildWorkspaceFiles());
  }

  readWorkspaceFile(
    _workspaceId: string,
    filePath: string,
  ): Promise<{
    readonly path: string;
    readonly content: string;
    readonly truncated: boolean;
    readonly binary: boolean;
    readonly sizeBytes: number;
  }> {
    const content = `// mock preview of ${filePath}\n// Real file contents are unavailable in mock mode.\n`;
    return Promise.resolve({
      path: filePath,
      content,
      truncated: false,
      binary: false,
      sizeBytes: content.length,
    });
  }

  revealWorkspaceFile(): Promise<void> {
    return Promise.resolve();
  }

  getChangedFiles(): Promise<{
    readonly state: "available";
    readonly files: readonly {
      readonly path: string;
      readonly status: "modified" | "added";
      readonly staged: boolean;
    }[];
  }> {
    return Promise.resolve({
      state: "available",
      files: [
        { path: "apps/desktop/src/app/desktop-app-state.ts", status: "modified", staged: false },
        { path: "apps/desktop/contracts/transcript-patch.ts", status: "added", staged: true },
      ],
    });
  }

  getFileDiff(_workspaceId: string, filePath: string): Promise<string> {
    return Promise.resolve(
      [
        `--- a/${filePath}`,
        `+++ b/${filePath}`,
        "@@ -1,3 +1,4 @@",
        " // mock diff header",
        "+const mock = true;",
        " export const existing = 1;",
      ].join("\n"),
    );
  }

  stageFile(): Promise<void> {
    return Promise.resolve();
  }

  // ------------------------------------------------------- extension views

  onExtensionViewOpenFile(): Unsubscribe {
    return () => {};
  }

  runExtensionAction(): Promise<null> {
    return Promise.resolve(null);
  }

  listExtensionViews(): Promise<readonly []> {
    return Promise.resolve([]);
  }

  openExtensionView(): Promise<{ readonly connectionId: string; readonly frameUrl: string }> {
    return Promise.resolve({ connectionId: `mock-conn-${Date.now()}`, frameUrl: "about:blank" });
  }

  sendExtensionViewMessage(): Promise<void> {
    return Promise.resolve();
  }

  closeExtensionView(): Promise<void> {
    return Promise.resolve();
  }

  onExtensionViewMessage(): Unsubscribe {
    return () => {};
  }

  onExtensionViewCatalogChanged(): Unsubscribe {
    return () => {};
  }

  // ----------------------------------------------------------------- review

  getTurnChanges(): Promise<{ readonly state: "available"; readonly turns: readonly [] }> {
    return Promise.resolve({ state: "available", turns: [] });
  }

  private reviewIssue() {
    return {
      state: "unavailable" as const,
      code: "mock-mode",
      message: "Review needs a real checkout; unavailable in mock mode.",
    };
  }

  getReview() {
    return Promise.resolve(this.reviewIssue());
  }

  getReviewFile() {
    return Promise.resolve(this.reviewIssue());
  }

  setReviewFileReviewed() {
    return Promise.resolve(this.reviewIssue());
  }

  changeReviewFileStage() {
    return Promise.resolve(this.reviewIssue());
  }

  // ----------------------------------------------------------------- window

  toggleWindowMaximize(): Promise<void> {
    return Promise.resolve();
  }

  minimizeWindow(): void {
    // Browser tab has no window controls.
  }

  closeWindow(): void {
    // Browser tab has no window controls.
  }

  openExternal(url: string): Promise<void> {
    window.open(url, "_blank", "noopener,noreferrer");
    return Promise.resolve();
  }

  getThemeMode(): Promise<"system" | "light" | "dark"> {
    return Promise.resolve(this.state.themeMode);
  }

  getResolvedTheme(): Promise<"light" | "dark"> {
    return Promise.resolve(resolvedTheme(this.state.themeMode));
  }

  setThemeMode(mode: "system" | "light" | "dark"): Promise<DesktopAppState> {
    this.state = { ...this.state, themeMode: mode };
    return Promise.resolve(this.pushState());
  }

  onThemeChanged(callback: (theme: "light" | "dark") => void): Unsubscribe {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      callback(media.matches ? "dark" : "light");
    };
    media.addEventListener("change", handler);
    return () => {
      media.removeEventListener("change", handler);
    };
  }

  onWindowFocused(listener: () => void): Unsubscribe {
    window.addEventListener("focus", listener);
    return () => {
      window.removeEventListener("focus", listener);
    };
  }

  relaunchApplication(): Promise<void> {
    window.location.reload();
    return Promise.resolve();
  }
}

function resolvedTheme(mode: "system" | "light" | "dark"): "light" | "dark" {
  if (mode !== "system") {
    return mode;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
