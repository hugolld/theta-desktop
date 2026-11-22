import type {
  ExtensionViewOpenFile,
  DesktopExtensionViewInfo,
  OpenExtensionViewInput,
  ExtensionViewConnection,
  ExtensionViewMessage,
  ExtensionViewCatalogChange,
} from "./extension-views";
import type { RuntimeSettingsSnapshot } from "@theta-desktop/session-driver/runtime-types";
import type { ExtensionActionEffect, ExtensionActionRequest } from "./extension-actions";
import type {
  NavigateSessionTreeOptions,
  NavigateSessionTreeResult,
  SessionTreeSnapshot,
} from "@theta-desktop/session-driver/types";
import type { ClipboardImageRead } from "./composer-attachments";
import type { DesktopEditorList } from "./editors";
import type { SessionRef } from "@theta-desktop/session-driver/types";
import type { SaveTaskWorkbenchTemplateInput, TaskWorkbenchTemplate } from "./workbench";
import type {
  TurnChangesInput,
  TurnChangesResult,
  GetReviewInput,
  ReviewResult,
  ReviewFileInput,
  ReviewFileResult,
  SetReviewFileReviewedInput,
  SetReviewFileReviewedResult,
  ChangeReviewFileStageInput,
  ChangeReviewFileStageResult,
} from "./review";
import type {
  AppView,
  ComposerAttachment,
  CreateSessionInput,
  CreateWorktreeInput,
  DesktopAppState,
  ForkThreadInput,
  ModelSettingsScopeMode,
  NotificationPreferences,
  RemoveWorktreeInput,
  SendChildThreadFollowUpInput,
  SetChildSupervisionLoopInput,
  SelectedTranscriptPatch,
  SelectedTranscriptRecord,
  SessionExtensionUiUpdate,
  StartThreadInput,
  ThemePresetId,
  ThreadGrouping,
  WorkspaceSessionTarget,
  CreateScheduledTaskInput,
  UpdateScheduledTaskInput,
} from "./desktop-state";

export type DesktopNotificationPermissionStatus =
  "granted" | "denied" | "default" | "unsupported" | "unknown";

export interface CustomProviderModelConfig {
  readonly id: string;
  readonly contextWindow?: number;
}

export interface CustomProviderConfig {
  readonly providerId: string;
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly models: readonly CustomProviderModelConfig[];
}

export interface CustomProviderProbeInput {
  readonly baseUrl: string;
  readonly apiKey?: string;
}

export type CustomProviderProbeResult =
  | { readonly ok: true; readonly models: readonly string[] }
  | { readonly ok: false; readonly error: string };

export type McpServerScope = "global" | "project";

/** An `mcp.json` server as Settings shows it; `env`, `headers` and `oauth` never leave main. */
export interface McpServerRecord {
  readonly name: string;
  readonly scope: McpServerScope;
  readonly transport: "stdio" | "http";
  readonly command?: string;
  readonly args?: readonly string[];
  readonly url?: string;
  /** What the server offers, in a sentence; pi shows it to the model with the server. */
  readonly description?: string;
  readonly enabled: boolean;
  /** Environment variables, headers or sign-in config are set; their values never leave main. */
  readonly hasHiddenSettings: boolean;
}

export interface McpServersSnapshot {
  /** The global mcp.json new servers are saved to, with the home directory shown as `~`. */
  readonly globalConfigPath: string;
  readonly servers: readonly McpServerRecord[];
  /** mcp.json files that could not be read, and servers pi skips, with why. */
  readonly errors: readonly string[];
  /** Whether pi's global `defaultTools` switches code mode on. */
  readonly codemodeAlwaysOn: boolean;
}

export type NewMcpServerInput = { readonly name: string; readonly description?: string } & (
  { readonly command: string; readonly args: readonly string[] } | { readonly url: string }
);

export const desktopIpc = {
  extensionViewOpenFile: "theta-desktop:extension-view-open-file",
  listExtensionViews: "theta-desktop:list-extension-views",
  openExtensionView: "theta-desktop:open-extension-view",
  sendExtensionViewMessage: "theta-desktop:send-extension-view-message",
  closeExtensionView: "theta-desktop:close-extension-view",
  runExtensionAction: "theta-desktop:run-extension-action",
  extensionViewMessage: "theta-desktop:extension-view-message",
  extensionViewCatalogChanged: "theta-desktop:extension-view-catalog-changed",
  stateRequest: "theta-desktop:state-request",
  stateChanged: "theta-desktop:state-changed",
  getTaskWorkbenchTemplate: "theta-desktop:get-task-workbench-template",
  saveTaskWorkbenchTemplate: "theta-desktop:save-task-workbench-template",
  selectedTranscriptRequest: "theta-desktop:selected-transcript-request",
  selectedTranscriptChanged: "theta-desktop:selected-transcript-changed",
  selectedTranscriptResend: "theta-desktop:selected-transcript-resend",
  extensionUiChanged: "theta-desktop:extension-ui-changed",
  appCommand: "theta-desktop:app-command",
  workspacePicked: "theta-desktop:workspace-picked",
  clipboardImagePasted: "theta-desktop:clipboard-image-pasted",
  addWorkspacePath: "theta-desktop:add-workspace-path",
  pickWorkspace: "theta-desktop:pick-workspace",
  selectWorkspace: "theta-desktop:select-workspace",
  renameWorkspace: "theta-desktop:rename-workspace",
  removeWorkspace: "theta-desktop:remove-workspace",
  reorderWorkspaces: "theta-desktop:reorder-workspaces",
  reorderPinnedSessions: "theta-desktop:reorder-pinned-sessions",
  openWorkspaceInFinder: "theta-desktop:open-workspace-in-finder",
  listEditors: "theta-desktop:list-editors",
  setPreferredEditor: "theta-desktop:set-preferred-editor",
  openWorkspaceInEditor: "theta-desktop:open-workspace-in-editor",
  createWorktree: "theta-desktop:create-worktree",
  removeWorktree: "theta-desktop:remove-worktree",
  openSkillInFinder: "theta-desktop:open-skill-in-finder",
  openExtensionInFinder: "theta-desktop:open-extension-in-finder",
  syncCurrentWorkspace: "theta-desktop:sync-current-workspace",
  selectSession: "theta-desktop:select-session",
  renameSession: "theta-desktop:rename-session",
  archiveSession: "theta-desktop:archive-session",
  unarchiveSession: "theta-desktop:unarchive-session",
  markSessionRead: "theta-desktop:mark-session-read",
  setSessionPinned: "theta-desktop:set-session-pinned",
  createSession: "theta-desktop:create-session",
  startThread: "theta-desktop:start-thread",
  forkThread: "theta-desktop:fork-thread",
  sendChildThreadFollowUp: "theta-desktop:send-child-thread-follow-up",
  setChildSupervisionLoop: "theta-desktop:set-child-supervision-loop",
  createScheduledTask: "theta-desktop:create-scheduled-task",
  updateScheduledTask: "theta-desktop:update-scheduled-task",
  deleteScheduledTask: "theta-desktop:delete-scheduled-task",
  beginScheduledTaskInterview: "theta-desktop:begin-scheduled-task-interview",
  cancelCurrentRun: "theta-desktop:cancel-current-run",
  setActiveView: "theta-desktop:set-active-view",
  setSidebarCollapsed: "theta-desktop:set-sidebar-collapsed",
  setThreadGrouping: "theta-desktop:set-thread-grouping",
  setWorkspaceCollapsed: "theta-desktop:set-workspace-collapsed",
  refreshRuntime: "theta-desktop:refresh-runtime",
  setModelSettingsScopeMode: "theta-desktop:set-model-settings-scope-mode",
  setDefaultModel: "theta-desktop:set-default-model",
  setDefaultThinkingLevel: "theta-desktop:set-default-thinking-level",
  setSessionModel: "theta-desktop:set-session-model",
  setSessionThinkingLevel: "theta-desktop:set-session-thinking-level",
  loginProvider: "theta-desktop:login-provider",
  logoutProvider: "theta-desktop:logout-provider",
  setProviderApiKey: "theta-desktop:set-provider-api-key",
  listCustomProviders: "theta-desktop:list-custom-providers",
  setCustomProvider: "theta-desktop:set-custom-provider",
  deleteCustomProvider: "theta-desktop:delete-custom-provider",
  probeCustomProviderModels: "theta-desktop:probe-custom-provider-models",
  setEnableSkillCommands: "theta-desktop:set-enable-skill-commands",
  setScopedModelPatterns: "theta-desktop:set-scoped-model-patterns",
  setSkillEnabled: "theta-desktop:set-skill-enabled",
  setExtensionEnabled: "theta-desktop:set-extension-enabled",
  listMcpServers: "theta-desktop:list-mcp-servers",
  addMcpServer: "theta-desktop:add-mcp-server",
  removeMcpServer: "theta-desktop:remove-mcp-server",
  setMcpServerEnabled: "theta-desktop:set-mcp-server-enabled",
  setCodemodeAlwaysOn: "theta-desktop:set-codemode-always-on",
  respondToHostUiRequest: "theta-desktop:respond-to-host-ui-request",
  setNotificationPreferences: "theta-desktop:set-notification-preferences",
  setIntegratedTerminalShell: "theta-desktop:set-integrated-terminal-shell",
  setEnableTransparency: "theta-desktop:set-enable-transparency",
  terminalEnsurePanel: "theta-desktop:terminal-ensure-panel",
  terminalCreateSession: "theta-desktop:terminal-create-session",
  terminalSetActiveSession: "theta-desktop:terminal-set-active-session",
  terminalWrite: "theta-desktop:terminal-write",
  terminalResize: "theta-desktop:terminal-resize",
  terminalRestartSession: "theta-desktop:terminal-restart-session",
  terminalCloseSession: "theta-desktop:terminal-close-session",
  terminalSetTitle: "theta-desktop:terminal-set-title",
  terminalSetFocused: "theta-desktop:terminal-set-focused",
  sidePanelSetFocused: "theta-desktop:side-panel-set-focused",
  terminalData: "theta-desktop:terminal-data",
  terminalExit: "theta-desktop:terminal-exit",
  terminalError: "theta-desktop:terminal-error",
  getNotificationPermissionStatus: "theta-desktop:get-notification-permission-status",
  requestNotificationPermission: "theta-desktop:request-notification-permission",
  openSystemNotificationSettings: "theta-desktop:open-system-notification-settings",
  notificationPermissionStatusChanged: "theta-desktop:notification-permission-status-changed",
  pickComposerAttachments: "theta-desktop:pick-composer-attachments",
  readClipboardImage: "theta-desktop:read-clipboard-image",
  addComposerAttachments: "theta-desktop:add-composer-attachments",
  removeComposerAttachment: "theta-desktop:remove-composer-attachment",
  editQueuedComposerMessage: "theta-desktop:edit-queued-composer-message",
  cancelQueuedComposerEdit: "theta-desktop:cancel-queued-composer-edit",
  removeQueuedComposerMessage: "theta-desktop:remove-queued-composer-message",
  steerQueuedComposerMessage: "theta-desktop:steer-queued-composer-message",
  persistComposerDraft: "theta-desktop:persist-composer-draft",
  updateComposerDraft: "theta-desktop:update-composer-draft",
  flushPendingComposerDraft: "theta-desktop:flush-pending-composer-draft",
  pendingComposerDraftFlushed: "theta-desktop:pending-composer-draft-flushed",
  submitComposer: "theta-desktop:submit-composer",
  getSessionTree: "theta-desktop:get-session-tree",
  navigateSessionTree: "theta-desktop:navigate-session-tree",
  toggleWindowMaximize: "theta-desktop:toggle-window-maximize",
  minimizeWindow: "theta-desktop:minimize-window",
  closeWindow: "theta-desktop:close-window",
  listWorkspaceFiles: "theta-desktop:list-workspace-files",
  readWorkspaceFile: "theta-desktop:read-workspace-file",
  revealWorkspaceFile: "theta-desktop:reveal-workspace-file",
  getChangedFiles: "theta-desktop:get-changed-files",
  getFileDiff: "theta-desktop:get-file-diff",
  stageFile: "theta-desktop:stage-file",
  getTurnChanges: "theta-desktop:get-turn-changes",
  getReview: "theta-desktop:get-review",
  getReviewFile: "theta-desktop:get-review-file",
  setReviewFileReviewed: "theta-desktop:set-review-file-reviewed",
  changeReviewFileStage: "theta-desktop:change-review-file-stage",
  getThemeMode: "theta-desktop:get-theme-mode",
  getResolvedTheme: "theta-desktop:get-resolved-theme",
  setThemeMode: "theta-desktop:set-theme-mode",
  setThemePresetId: "theta-desktop:set-theme-preset-id",
  themeChanged: "theta-desktop:theme-changed",
  windowFocused: "theta-desktop:window-focused",
  ping: "app:ping",
  openExternal: "app:open-external",
  relaunchApplication: "theta-desktop:relaunch-application",
} as const;

export const desktopCommands = {
  openSettings: "open-settings",
  openNewThread: "open-new-thread",
  toggleTerminal: "toggle-terminal",
  toggleSidePanel: "toggle-side-panel",
  toggleReview: "toggle-review",
  newSidePanelTab: "new-side-panel-tab",
  closeFocusedSurface: "close-focused-surface",
  toggleSidebar: "toggle-sidebar",
  openCommandPalette: "open-command-palette",
  openFilePalette: "open-file-palette",
  renameThread: "rename-thread",
  archiveThread: "archive-thread",
  selectRecentThread1: "select-recent-thread-1",
  selectRecentThread2: "select-recent-thread-2",
  selectRecentThread3: "select-recent-thread-3",
  selectRecentThread4: "select-recent-thread-4",
  selectRecentThread5: "select-recent-thread-5",
  selectRecentThread6: "select-recent-thread-6",
  selectRecentThread7: "select-recent-thread-7",
  selectRecentThread8: "select-recent-thread-8",
  selectRecentThread9: "select-recent-thread-9",
  selectSidePanelTab1: "select-side-panel-tab-1",
  selectSidePanelTab2: "select-side-panel-tab-2",
  selectSidePanelTab3: "select-side-panel-tab-3",
  selectSidePanelTab4: "select-side-panel-tab-4",
  selectSidePanelTab5: "select-side-panel-tab-5",
  selectSidePanelTab6: "select-side-panel-tab-6",
  selectSidePanelTab7: "select-side-panel-tab-7",
  selectSidePanelTab8: "select-side-panel-tab-8",
  selectSidePanelTab9: "select-side-panel-tab-9",
} as const;

const RECENT_THREAD_COMMANDS = [
  desktopCommands.selectRecentThread1,
  desktopCommands.selectRecentThread2,
  desktopCommands.selectRecentThread3,
  desktopCommands.selectRecentThread4,
  desktopCommands.selectRecentThread5,
  desktopCommands.selectRecentThread6,
  desktopCommands.selectRecentThread7,
  desktopCommands.selectRecentThread8,
  desktopCommands.selectRecentThread9,
] as const;

export const THREAD_SHORTCUT_SLOT_COUNT = RECENT_THREAD_COMMANDS.length;

export function isRecentThreadCommand(command: ThetaDesktopCommand | undefined): boolean {
  return (RECENT_THREAD_COMMANDS as readonly (ThetaDesktopCommand | undefined)[]).includes(command);
}

const SIDE_PANEL_TAB_COMMANDS = [
  desktopCommands.selectSidePanelTab1,
  desktopCommands.selectSidePanelTab2,
  desktopCommands.selectSidePanelTab3,
  desktopCommands.selectSidePanelTab4,
  desktopCommands.selectSidePanelTab5,
  desktopCommands.selectSidePanelTab6,
  desktopCommands.selectSidePanelTab7,
  desktopCommands.selectSidePanelTab8,
  desktopCommands.selectSidePanelTab9,
] as const;

export const SIDE_PANEL_TAB_SHORTCUT_SLOT_COUNT = SIDE_PANEL_TAB_COMMANDS.length;

/** The zero-based side panel tab a command selects, or undefined for other commands. */
export function sidePanelTabIndex(command: ThetaDesktopCommand | undefined): number | undefined {
  const index = (SIDE_PANEL_TAB_COMMANDS as readonly (ThetaDesktopCommand | undefined)[]).indexOf(
    command,
  );
  return index < 0 ? undefined : index;
}

/**
 * The side panel tab modifier: Control on macOS, where Command switches threads,
 * and Alt elsewhere, where Control does. It must be the only modifier held.
 */
export function sidePanelTabModifierHeld(
  platform: NodeJS.Platform,
  input: {
    readonly meta: boolean;
    readonly control: boolean;
    readonly alt: boolean;
    readonly shift: boolean;
  },
): boolean {
  if (input.shift || input.meta) return false;
  return platform === "darwin" ? input.control && !input.alt : input.alt && !input.control;
}

/**
 * Control+1-9 on macOS and Alt+1-9 elsewhere select side panel tab N. Keypad
 * digits are left alone so Windows Alt codes keep typing characters.
 */
export function getSidePanelTabCommand(
  platform: NodeJS.Platform,
  input: {
    readonly meta: boolean;
    readonly control: boolean;
    readonly alt: boolean;
    readonly shift: boolean;
    readonly key: string;
    readonly code?: string;
  },
): ThetaDesktopCommand | undefined {
  if (!sidePanelTabModifierHeld(platform, input) || input.code?.startsWith("Numpad")) {
    return undefined;
  }
  const digit = input.code?.match(/^Digit([1-9])$/)?.[1] ?? input.key.match(/^[1-9]$/)?.[0];
  return digit ? SIDE_PANEL_TAB_COMMANDS[Number(digit) - 1] : undefined;
}

export function getSidePanelTabShortcutLabel(platform: NodeJS.Platform, slot: number): string {
  return `${platform === "darwin" ? "⌃" : "Alt+"}${slot}`;
}

export function getDesktopShortcutLabel(platform: NodeJS.Platform, key: string): string {
  return `${platform === "darwin" ? "⌘" : "Ctrl+"}${key.toUpperCase()}`;
}

export function formatShortcut(
  platform: NodeJS.Platform,
  key: string,
  modifiers: { readonly shift?: boolean; readonly alt?: boolean } = {},
): string {
  if (platform === "darwin") {
    return `${modifiers.alt ? "⌥" : ""}${modifiers.shift ? "⇧" : ""}⌘${key.toUpperCase()}`;
  }
  return `Ctrl+${modifiers.alt ? "Alt+" : ""}${modifiers.shift ? "Shift+" : ""}${key.toUpperCase()}`;
}

export function getSidePanelToggleShortcutLabel(platform: NodeJS.Platform): string {
  return platform === "darwin" ? "⌘⌥B" : "Ctrl+Alt+B";
}

// A state push leaves out the model catalog (`runtimeByWorkspace`) when it is unchanged
// since the last push to that window; the window keeps the one it has.
export type ThetaDesktopStatePush = Omit<DesktopAppState, "runtimeByWorkspace"> & {
  readonly runtimeByWorkspace?: DesktopAppState["runtimeByWorkspace"];
};
export type ThetaDesktopStateListener = (state: ThetaDesktopStatePush) => void;
export type ThetaDesktopSelectedTranscriptListener = (
  payload: SelectedTranscriptRecord | SelectedTranscriptPatch | null,
) => void;
export type ThetaDesktopExtensionUiListener = (update: SessionExtensionUiUpdate) => void;
export type ThetaDesktopCommand = (typeof desktopCommands)[keyof typeof desktopCommands];

export type ChangedFileStatus =
  "added" | "copied" | "deleted" | "modified" | "renamed" | "untracked";

export interface ChangedFileEntry {
  readonly path: string;
  readonly previousPath?: string;
  readonly stagingSourcePath?: string;
  readonly status: ChangedFileStatus;
  readonly staged: boolean;
}

export type ChangedFilesErrorCode =
  "git-status-failed" | "git-status-invalid" | "workspace-unavailable";

export interface ChangedFilesError {
  readonly code: ChangedFilesErrorCode;
  readonly message: string;
}

export type ChangedFilesResult =
  | {
      readonly state: "available";
      readonly files: readonly ChangedFileEntry[];
    }
  | {
      readonly state: "unavailable";
      readonly error: ChangedFilesError;
    };

export interface WorkspaceFilePreview {
  readonly path: string;
  readonly content: string;
  readonly truncated: boolean;
  readonly binary: boolean;
  readonly sizeBytes: number;
}

export interface TerminalSize {
  readonly cols: number;
  readonly rows: number;
}

export type TerminalSessionStatus = "running" | "exited" | "error";

export interface TerminalSessionSnapshot {
  readonly id: string;
  readonly workspaceId: string;
  readonly cwd: string;
  readonly shell: string;
  readonly title: string;
  readonly status: TerminalSessionStatus;
  readonly replay: string;
  readonly truncated: boolean;
  readonly exitCode?: number;
  readonly signal?: number;
}

export interface TerminalPanelSnapshot {
  readonly workspaceId: string;
  readonly rootKey: string;
  readonly activeSessionId: string;
  readonly sessions: readonly TerminalSessionSnapshot[];
}

export interface TerminalDataEvent {
  readonly terminalId: string;
  readonly data: string;
}

export interface TerminalExitEvent {
  readonly terminalId: string;
  readonly exitCode?: number;
  readonly signal?: number;
}

export interface TerminalErrorEvent {
  readonly terminalId: string;
  readonly message: string;
}

export interface DesktopShortcutInput {
  readonly modifier: boolean;
  readonly alt?: boolean;
  readonly shift: boolean;
  readonly key: string;
  readonly code?: string;
}

/** Command on macOS, Control on Windows and Linux. */
export function platformShortcutModifier(
  platform: NodeJS.Platform,
  input: { readonly meta: boolean; readonly control: boolean },
): boolean {
  return platform === "darwin" ? input.meta : input.control;
}

const MAX_QUEUED_DESKTOP_COMMANDS = 16;

/**
 * Delivers main-process shortcuts to the renderer.
 * A chord can arrive before React subscribes, or in the gap while a listener
 * is swapped. Those commands are kept until the next subscriber.
 */
export function createDesktopCommandSubscription() {
  let listener: ((command: ThetaDesktopCommand) => void) | null = null;
  const queued: ThetaDesktopCommand[] = [];
  return {
    subscribe(next: (command: ThetaDesktopCommand) => void): () => void {
      listener = next;
      const pending = queued.splice(0, queued.length);
      for (const command of pending) next(command);
      return () => {
        if (listener === next) listener = null;
      };
    },
    deliver(command: ThetaDesktopCommand): void {
      if (listener) {
        listener(command);
        return;
      }
      queued.push(command);
      if (queued.length > MAX_QUEUED_DESKTOP_COMMANDS) queued.shift();
    },
  };
}

/** Collapses a repeated keydown from one physical chord so a toggle stays open. */
export const SEARCH_CHORD_TOGGLE_MS = 200;
export const REVIEW_TOGGLE_DEDUPE_MS = 8;

export type ChordSource = "main" | "renderer";

/**
 * Collapses one chord that reaches the renderer twice, once forwarded by the main
 * process and once as a keydown. Repeats from the same source are separate presses.
 */
export function createChordPairGate(windowMs = REVIEW_TOGGLE_DEDUPE_MS) {
  let last: { readonly source: ChordSource; readonly at: number } | undefined;
  return (source: ChordSource, now: number): boolean => {
    if (last && last.source !== source && now - last.at < windowMs) {
      last = undefined;
      return false;
    }
    last = { source, at: now };
    return true;
  };
}

export function createChordToggleGate(windowMs = SEARCH_CHORD_TOGGLE_MS) {
  let last = Number.NEGATIVE_INFINITY;
  return (now: number): boolean => {
    if (now - last < windowMs) return false;
    last = now;
    return true;
  };
}

export interface EarlyModifierChord {
  readonly key: string;
  readonly code: string;
}

function isBufferedModifierChord(key: string, code?: string): boolean {
  const lower = key.toLowerCase();
  if (lower === "f" || code === "KeyF") return true;
  if (lower === "," || code === "Comma") return true;
  if (lower === "r" || code === "KeyR") return true;
  return /^[1-9]$/.test(key) || /^Digit[1-9]$/.test(code ?? "");
}

/**
 * Keeps Command/Ctrl chords that arrive before the React shortcut listener
 * exists. Search, settings, Review, and thread digits are replayed.
 */
export function createEarlyModifierChordBuffer() {
  const pending: EarlyModifierChord[] = [];
  let ready = false;
  return {
    note(
      input: EarlyModifierChord & { readonly modifier: boolean; readonly shift: boolean },
    ): void {
      if (ready || !input.modifier || input.shift) return;
      if (!isBufferedModifierChord(input.key, input.code)) return;
      pending.push({ key: input.key, code: input.code });
      if (pending.length > 8) pending.shift();
    },
    arm(): readonly EarlyModifierChord[] {
      ready = true;
      return pending.splice(0, pending.length);
    },
  };
}

export const earlyModifierChords = createEarlyModifierChordBuffer();

export function getDesktopCommandFromShortcut(
  input: DesktopShortcutInput,
): ThetaDesktopCommand | undefined {
  if (!input.modifier) {
    return undefined;
  }

  const lowerKey = input.key.toLowerCase();
  const isComma = input.key === "," || input.code === "Comma";
  const isB = lowerKey === "b" || input.code === "KeyB";
  const isJ = lowerKey === "j" || input.code === "KeyJ";
  const isR = lowerKey === "r" || input.code === "KeyR";
  const isK = lowerKey === "k" || input.code === "KeyK";
  const isP = lowerKey === "p" || input.code === "KeyP";
  const isN = lowerKey === "n" || input.code === "KeyN";
  const isT = lowerKey === "t" || input.code === "KeyT";
  const isShiftO = input.shift && (lowerKey === "o" || input.code === "KeyO");
  const isShiftR = input.shift && isR;
  const isShiftA = input.shift && (lowerKey === "a" || input.code === "KeyA");

  if (input.alt) {
    if (!input.shift && isB) {
      return desktopCommands.toggleSidePanel;
    }
    return undefined;
  }

  if (!input.shift && isComma) {
    return desktopCommands.openSettings;
  }

  if (!input.shift && isJ) {
    return desktopCommands.toggleTerminal;
  }

  if (!input.shift && isR) {
    return desktopCommands.toggleReview;
  }

  if (!input.shift && isB) {
    return desktopCommands.toggleSidebar;
  }

  if (!input.shift && isK) {
    return desktopCommands.openCommandPalette;
  }

  if (!input.shift && isP) {
    return desktopCommands.openFilePalette;
  }

  if (!input.shift && isT) {
    return desktopCommands.newSidePanelTab;
  }

  if ((!input.shift && isN) || isShiftO) {
    return desktopCommands.openNewThread;
  }

  if (isShiftR) {
    return desktopCommands.renameThread;
  }

  if (isShiftA) {
    return desktopCommands.archiveThread;
  }

  if (!input.shift) {
    const digitFromKey = /^[1-9]$/.test(input.key) ? input.key : undefined;
    const digitFromCode = input.code?.match(/^Digit([1-9])$/)?.[1];
    const digit = digitFromKey ?? digitFromCode;
    if (digit) {
      return RECENT_THREAD_COMMANDS[Number(digit) - 1];
    }
  }

  return undefined;
}

/**
 * Callers accept palette commands only from the platform modifier, so macOS
 * Control+K and Control+P stay with text fields, and only from a first press.
 */
export function isPaletteCommand(command: ThetaDesktopCommand | undefined): boolean {
  return (
    command === desktopCommands.openCommandPalette || command === desktopCommands.openFilePalette
  );
}

/**
 * Commands that act once per press and only from the platform modifier. macOS
 * Control chords stay with text fields, and off macOS the terminal keeps Control
 * chords. Holding Archive would otherwise archive each next thread in turn, and
 * holding Review would flicker the panel. New Tab is the exception in the terminal,
 * where the shell keeps it to open another terminal.
 */
export function isSinglePressCommand(command: ThetaDesktopCommand | undefined): boolean {
  return (
    isPaletteCommand(command) ||
    command === desktopCommands.toggleReview ||
    command === desktopCommands.newSidePanelTab ||
    command === desktopCommands.renameThread ||
    command === desktopCommands.archiveThread
  );
}

export function isCloseFocusedSurfaceShortcut(input: {
  readonly meta: boolean;
  readonly control: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  readonly key: string;
  readonly code?: string;
  readonly platform: NodeJS.Platform;
}): boolean {
  if (input.alt || input.shift) {
    return false;
  }
  const platformModifier = input.platform === "darwin" ? input.meta : input.control;
  const otherModifier = input.platform === "darwin" ? input.control : input.meta;
  if (!platformModifier || otherModifier) {
    return false;
  }
  return input.key.toLowerCase() === "w" || input.code === "KeyW";
}

/**
 * Main passes this to the renderer when the window is frameless and the app
 * must draw its own title bar with minimize, maximize and close (Linux).
 */
export const drawWindowControlsArgument = "--pi-draw-window-controls";

export interface ThetaDesktopApi {
  platform: NodeJS.Platform;
  /** True when the window has no native title bar and the app draws its own. */
  drawsWindowControls: boolean;
  versions: NodeJS.ProcessVersions;
  ping(): Promise<string>;
  getState(): Promise<DesktopAppState>;
  getTaskWorkbenchTemplate(target: SessionRef): Promise<TaskWorkbenchTemplate | null>;
  saveTaskWorkbenchTemplate(input: SaveTaskWorkbenchTemplateInput): Promise<void>;
  onStateChanged(listener: ThetaDesktopStateListener): () => void;
  getSelectedTranscript(): Promise<SelectedTranscriptRecord | null>;
  onSelectedTranscriptChanged(listener: ThetaDesktopSelectedTranscriptListener): () => void;
  resendSelectedTranscript(): void;
  onExtensionUiChanged(listener: ThetaDesktopExtensionUiListener): () => void;
  onCommand(listener: (command: ThetaDesktopCommand) => void): () => void;
  onWorkspacePicked(listener: (workspaceId: string) => void): () => void;
  onClipboardImagePasted(listener: (result: ClipboardImageRead) => void): () => void;
  getPathForFile(file: File): string;
  addWorkspacePath(path: string): Promise<DesktopAppState>;
  pickWorkspace(): Promise<DesktopAppState>;
  selectWorkspace(workspaceId: string): Promise<DesktopAppState>;
  renameWorkspace(workspaceId: string, displayName: string): Promise<DesktopAppState>;
  removeWorkspace(workspaceId: string): Promise<DesktopAppState>;
  reorderWorkspaces(workspaceOrder: readonly string[]): Promise<DesktopAppState>;
  reorderPinnedSessions(pinnedSessionOrder: readonly string[]): Promise<DesktopAppState>;
  openWorkspaceInFinder(workspaceId: string): Promise<void>;
  listEditors(): Promise<DesktopEditorList>;
  setPreferredEditor(editorId: string): Promise<DesktopEditorList>;
  openWorkspaceInEditor(workspaceId: string, editorId: string): Promise<DesktopEditorList>;
  createWorktree(input: CreateWorktreeInput): Promise<DesktopAppState>;
  removeWorktree(input: RemoveWorktreeInput): Promise<DesktopAppState>;
  openSkillInFinder(workspaceId: string, filePath: string): Promise<void>;
  openExtensionInFinder(workspaceId: string, filePath: string): Promise<void>;
  syncCurrentWorkspace(): Promise<DesktopAppState>;
  selectSession(target: WorkspaceSessionTarget): Promise<DesktopAppState>;
  renameSession(target: WorkspaceSessionTarget, title: string): Promise<DesktopAppState>;
  archiveSession(target: WorkspaceSessionTarget): Promise<DesktopAppState>;
  unarchiveSession(target: WorkspaceSessionTarget): Promise<DesktopAppState>;
  markSessionRead(target: WorkspaceSessionTarget): Promise<DesktopAppState>;
  setSessionPinned(target: WorkspaceSessionTarget, pinned: boolean): Promise<DesktopAppState>;
  createSession(input: CreateSessionInput): Promise<DesktopAppState>;
  startThread(input: StartThreadInput): Promise<DesktopAppState>;
  forkThread(input: ForkThreadInput): Promise<DesktopAppState>;
  sendChildThreadFollowUp(input: SendChildThreadFollowUpInput): Promise<DesktopAppState>;
  setChildSupervisionLoop(input: SetChildSupervisionLoopInput): Promise<DesktopAppState>;
  createScheduledTask(input: CreateScheduledTaskInput): Promise<DesktopAppState>;
  updateScheduledTask(id: string, patch: UpdateScheduledTaskInput): Promise<DesktopAppState>;
  deleteScheduledTask(id: string): Promise<DesktopAppState>;
  beginScheduledTaskInterview(): Promise<DesktopAppState>;
  cancelCurrentRun(): Promise<DesktopAppState>;
  setActiveView(view: AppView): Promise<DesktopAppState>;
  setSidebarCollapsed(collapsed: boolean): Promise<DesktopAppState>;
  setThreadGrouping(grouping: ThreadGrouping): Promise<DesktopAppState>;
  setWorkspaceCollapsed(workspaceId: string, collapsed: boolean): Promise<DesktopAppState>;
  refreshRuntime(workspaceId?: string): Promise<DesktopAppState>;
  setModelSettingsScopeMode(mode: ModelSettingsScopeMode): Promise<DesktopAppState>;
  setDefaultModel(workspaceId: string, provider: string, modelId: string): Promise<DesktopAppState>;
  setDefaultThinkingLevel(
    workspaceId: string,
    thinkingLevel: RuntimeSettingsSnapshot["defaultThinkingLevel"],
  ): Promise<DesktopAppState>;
  setSessionModel(
    workspaceId: string,
    sessionId: string,
    provider: string,
    modelId: string,
  ): Promise<DesktopAppState>;
  setSessionThinkingLevel(
    workspaceId: string,
    sessionId: string,
    thinkingLevel: NonNullable<RuntimeSettingsSnapshot["defaultThinkingLevel"]>,
  ): Promise<DesktopAppState>;
  loginProvider(workspaceId: string, providerId: string): Promise<DesktopAppState>;
  logoutProvider(workspaceId: string, providerId: string): Promise<DesktopAppState>;
  setProviderApiKey(
    workspaceId: string,
    providerId: string,
    apiKey: string,
  ): Promise<DesktopAppState>;
  listCustomProviders(): Promise<readonly CustomProviderConfig[]>;
  setCustomProvider(workspaceId: string, config: CustomProviderConfig): Promise<DesktopAppState>;
  deleteCustomProvider(workspaceId: string, providerId: string): Promise<DesktopAppState>;
  probeCustomProviderModels(input: CustomProviderProbeInput): Promise<CustomProviderProbeResult>;
  setEnableSkillCommands(workspaceId: string, enabled: boolean): Promise<DesktopAppState>;
  setScopedModelPatterns(
    workspaceId: string,
    patterns: readonly string[],
  ): Promise<DesktopAppState>;
  setSkillEnabled(
    workspaceId: string,
    filePath: string,
    enabled: boolean,
  ): Promise<DesktopAppState>;
  setExtensionEnabled(
    workspaceId: string,
    filePath: string,
    enabled: boolean,
  ): Promise<DesktopAppState>;
  listMcpServers(workspaceId: string): Promise<McpServersSnapshot>;
  addMcpServer(workspaceId: string, server: NewMcpServerInput): Promise<DesktopAppState>;
  removeMcpServer(workspaceId: string, name: string): Promise<DesktopAppState>;
  setMcpServerEnabled(
    workspaceId: string,
    scope: McpServerScope,
    name: string,
    enabled: boolean,
  ): Promise<DesktopAppState>;
  setCodemodeAlwaysOn(workspaceId: string, alwaysOn: boolean): Promise<DesktopAppState>;
  respondToHostUiRequest(
    workspaceId: string,
    sessionId: string,
    response:
      | { readonly requestId: string; readonly value: string }
      | { readonly requestId: string; readonly confirmed: boolean }
      | { readonly requestId: string; readonly cancelled: true },
  ): Promise<DesktopAppState>;
  setNotificationPreferences(
    preferences: Partial<NotificationPreferences>,
  ): Promise<DesktopAppState>;
  setIntegratedTerminalShell(shell: string): Promise<DesktopAppState>;
  setEnableTransparency(enabled: boolean): Promise<DesktopAppState>;
  setThemePresetId(presetId: ThemePresetId): Promise<DesktopAppState>;
  ensureTerminalPanel(
    workspaceId: string,
    terminalScopeId: string,
    size?: Partial<TerminalSize>,
  ): Promise<TerminalPanelSnapshot>;
  createTerminalSession(
    workspaceId: string,
    terminalScopeId: string,
    size?: Partial<TerminalSize>,
  ): Promise<TerminalPanelSnapshot>;
  setActiveTerminalSession(
    workspaceId: string,
    terminalScopeId: string,
    terminalId: string,
  ): Promise<TerminalPanelSnapshot>;
  writeTerminal(terminalId: string, data: string): Promise<void>;
  resizeTerminal(terminalId: string, size: TerminalSize): Promise<void>;
  restartTerminalSession(
    terminalId: string,
    size?: Partial<TerminalSize>,
  ): Promise<TerminalPanelSnapshot>;
  closeTerminalSession(terminalId: string): Promise<TerminalPanelSnapshot | null>;
  setTerminalTitle(terminalId: string, title: string): Promise<void>;
  setTerminalFocused(focused: boolean): Promise<void>;
  setSidePanelFocused(focused: boolean): Promise<void>;
  onTerminalData(listener: (event: TerminalDataEvent) => void): () => void;
  onTerminalExit(listener: (event: TerminalExitEvent) => void): () => void;
  onTerminalError(listener: (event: TerminalErrorEvent) => void): () => void;
  getNotificationPermissionStatus(): Promise<DesktopNotificationPermissionStatus>;
  requestNotificationPermission(): Promise<DesktopNotificationPermissionStatus>;
  openSystemNotificationSettings(): Promise<void>;
  onNotificationPermissionStatusChanged(
    callback: (status: DesktopNotificationPermissionStatus) => void,
  ): () => void;
  pickComposerAttachments(): Promise<DesktopAppState>;
  readClipboardImage(): ClipboardImageRead;
  addComposerAttachments(attachments: readonly ComposerAttachment[]): Promise<DesktopAppState>;
  removeComposerAttachment(attachmentId: string): Promise<DesktopAppState>;
  editQueuedComposerMessage(messageId: string, currentDraft?: string): Promise<DesktopAppState>;
  cancelQueuedComposerEdit(): Promise<DesktopAppState>;
  removeQueuedComposerMessage(messageId: string): Promise<DesktopAppState>;
  steerQueuedComposerMessage(messageId: string): Promise<DesktopAppState>;
  persistComposerDraft(input: {
    readonly target: SessionRef;
    readonly draft: string;
  }): Promise<void>;
  /** Saves the draft typed in `target`, even if another task is selected by the time it lands. */
  updateComposerDraft(composerDraft: string, target: SessionRef): Promise<DesktopAppState>;
  /**
   * Runs `handler` when the window is about to close or the app to quit; it should resolve
   * once the debounced draft has been saved. Main waits a bounded time for it.
   */
  onPendingComposerDraftFlush(handler: () => Promise<void>): () => void;
  submitComposer(
    text: string,
    options?: { readonly deliverAs?: "steer" | "followUp" },
  ): Promise<DesktopAppState>;
  getSessionTree(target: WorkspaceSessionTarget): Promise<SessionTreeSnapshot>;
  navigateSessionTree(
    target: WorkspaceSessionTarget,
    targetId: string,
    options?: NavigateSessionTreeOptions,
  ): Promise<{ readonly state: DesktopAppState; readonly result: NavigateSessionTreeResult }>;
  listWorkspaceFiles(
    workspaceId: string,
    options?: { readonly force?: boolean },
  ): Promise<string[]>;
  readWorkspaceFile(workspaceId: string, filePath: string): Promise<WorkspaceFilePreview>;
  revealWorkspaceFile(workspaceId: string, filePath: string): Promise<void>;
  getChangedFiles(workspaceId: string): Promise<ChangedFilesResult>;
  getFileDiff(workspaceId: string, filePath: string): Promise<string>;
  stageFile(workspaceId: string, filePath: string, stagingSourcePath?: string): Promise<void>;
  onExtensionViewOpenFile(listener: (event: ExtensionViewOpenFile) => void): () => void;
  /** Runs a card button's action for its thread, which must be the window's selected one. */
  runExtensionAction(request: ExtensionActionRequest): Promise<ExtensionActionEffect | null>;
  listExtensionViews(target: SessionRef): Promise<readonly DesktopExtensionViewInfo[]>;
  openExtensionView(input: OpenExtensionViewInput): Promise<ExtensionViewConnection>;
  sendExtensionViewMessage(input: ExtensionViewMessage): Promise<void>;
  closeExtensionView(connectionId: string): Promise<void>;
  onExtensionViewMessage(listener: (event: ExtensionViewMessage) => void): () => void;
  onExtensionViewCatalogChanged(listener: (event: ExtensionViewCatalogChange) => void): () => void;
  getTurnChanges(input: TurnChangesInput): Promise<TurnChangesResult>;
  getReview(input: GetReviewInput): Promise<ReviewResult>;
  getReviewFile(input: ReviewFileInput): Promise<ReviewFileResult>;
  setReviewFileReviewed(input: SetReviewFileReviewedInput): Promise<SetReviewFileReviewedResult>;
  changeReviewFileStage(input: ChangeReviewFileStageInput): Promise<ChangeReviewFileStageResult>;
  toggleWindowMaximize(): Promise<void>;
  minimizeWindow(): void;
  closeWindow(): void;
  openExternal(url: string): Promise<void>;
  getThemeMode(): Promise<"system" | "light" | "dark">;
  getResolvedTheme(): Promise<"light" | "dark">;
  setThemeMode(mode: "system" | "light" | "dark"): Promise<DesktopAppState>;
  onThemeChanged(callback: (theme: "light" | "dark") => void): () => void;
  /** The window came back to the foreground, so outside changes (edits, git) may need rereading. */
  onWindowFocused(listener: () => void): () => void;
  relaunchApplication(): Promise<void>;
}
