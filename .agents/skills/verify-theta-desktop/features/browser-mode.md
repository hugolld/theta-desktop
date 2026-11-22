# Browser mode (mock bridge)

In dev builds, opening the renderer URL (`http://localhost:5173` by default) in a plain browser tab installs a fixture-backed mock of the `window.thetaApp` bridge, so the real interface renders with fixture workspaces, transcripts and a scripted streaming turn. It exists for UI iteration (layout, styling, spacing, visuals) in an agent's browser — for example Cursor's browser with Annotate — where no Electron preload exists. It never proves conversation correctness, provider behavior, IPC, or persistence; those stay gated on the real Electron surface per root `AGENTS.md`.

Source: `apps/desktop/src/mock/` (`index.ts` installs, `mock-bridge.ts` implements every `ThetaDesktopApi` method, `fixtures.ts` holds the data). The install is guarded by `import.meta.env.DEV` and `window.thetaApp` presence, so the Electron window in the same dev launch always uses the real bridge, and the production bundle tree-shakes the module out entirely.

## Sub-features

- `browser-mode-boot`: fixtures render in a plain browser tab (workspaces, sessions, child links, transcript rows of every kind).
- `browser-mode-turn`: submitting in the composer runs a scripted turn — user row, running tool that flips to done, streamed assistant text, completion card, session back to idle.
- `browser-mode-switch`: selecting another thread swaps the transcript and state pushes.
- `browser-mode-optout`: `?piMock=0` skips the install and shows the bridge-missing shell.

## How to get to it (user POV)

- Run `pnpm --filter @theta-desktop/desktop dev`; open `http://localhost:5173` in a browser. The same launch opens the real Electron window, which must keep using the real bridge.
- `?piMock=0` opts out; the app shows its "Couldn't restore sessions" disconnected shell, proving the guard works.

## Driving it with Playwright

Preconditions: dev server on :5173, plain browser context (UA must not be Electron), no provider auth needed.

- **Doctor:** `window.thetaApp` exists and `ping()` returns `mock-bridge`; `getState()` shows the fixture workspaces; console has no errors beyond the known favicon 404. Check the UA is not Electron — the mock must never install inside Electron.
- **Scripted turn:** submit through the composer textbox, then poll `getState()` (session `status` running → idle, `revision` climbing) and `getSelectedTranscript()` (last rows become message/tool/message/card). Screenshot the completed turn.
- **Timing:** the whole scripted turn finishes in roughly 3.5 s, and a Playwright-driven screenshot usually lands after it completes. Observe the streaming window through state JSON, not screenshots; the running tool row is visible in the UI for under a second around the 900 ms mark.
- **Transcript identity:** rows are replaced, never edited in place. If timeline rows freeze after the first push, the mock (or a future main change) is mutating arrays in place — that is a bug, not a rendering quirk.

## Gotchas

- This surface consumes no provider usage and creates no session files. A green browser-mode run says nothing about real sending, streaming, tools, stop, drafts, or restart.
- The mock returns stubs for review, extension views, terminal, and file contents; those surfaces render but do not exercise deep flows. Do not use browser mode to verify them.
- Mutators return the new `DesktopAppState` and push updates on the same channels main uses; if the UI stops applying pushes, suspect the copy-on-write contract first.
- The fixture timestamps are relative to load time, so recency groups always look fresh; do not assert exact clock strings.
