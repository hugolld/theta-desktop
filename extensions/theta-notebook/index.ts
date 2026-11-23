import { defineFacet } from "@earendil-works/chord";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerDesktopView } from "@theta-desktop/extension-ui";
import { Notebook, type NotebookState } from "./contract.ts";
import { NotebookWatcher } from "./watcher.ts";

export default function thetaNotebookExtension(pi: ExtensionAPI): void {
  // One watcher per extension instance; the session cwd is stable within it.
  let watcher: NotebookWatcher | null = null;
  const listeners = new Set<(next: NotebookState) => void>();

  const publish = (state: NotebookState) => {
    for (const listener of listeners) listener(state);
  };

  const startWatcher = (cwd: string) => {
    watcher?.stop();
    watcher = new NotebookWatcher(cwd, publish, (error) => {
      console.error("[theta-notebook] notebook watch failed", error);
    });
    void watcher.start();
  };

  pi.on("session_start", (_event, ctx) => {
    startWatcher(ctx.cwd);
  });
  pi.on("session_shutdown", () => {
    watcher?.stop();
    watcher = null;
  });

  registerDesktopView(pi, {
    id: "theta-notebook",
    title: "Notebook",
    source: import.meta.url,
    frontend: new URL("./dist/desktop.js", import.meta.url),
    backend: () =>
      defineFacet({
        id: "theta.notebook.backend",
        setup(env) {
          const replicated = env.replicatedState(
            watcher?.snapshot() ?? { present: false, entries: [], skipped: 0 },
          );
          const listener = (next: NotebookState) => replicated.replace(BACKGROUND_CONTEXT, next);
          listeners.add(listener);
          env.own(() => {
            listeners.delete(listener);
          });
          env.provide(Notebook, { state: replicated });
        },
      }),
  });
}
