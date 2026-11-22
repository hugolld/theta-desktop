import React from "react";
import ReactDOM from "react-dom/client";
import { earlyModifierChords, getSidePanelTabCommand } from "../contracts/ipc";
import App from "./app/App";
import { RendererErrorBoundary } from "./app/desktop-recovery";
import { WindowFrame } from "./app/window-titlebar";
import { I18nProvider } from "./i18n";
import { installMockBridge } from "./mock";
import { applyLastTheme } from "./ui/active-theme";
import "./dev-reload-hook";
import "./styles.css";

window.addEventListener(
  "keydown",
  (event) => {
    // Control+digit on macOS selects a side panel tab, not a thread; main queues it.
    const platform = window.thetaApp?.platform ?? "linux";
    const chord = {
      meta: event.metaKey,
      control: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      key: event.key,
      code: event.code,
    };
    if (getSidePanelTabCommand(platform, chord)) return;
    earlyModifierChords.note({
      modifier: event.metaKey || event.ctrlKey,
      shift: event.shiftKey,
      key: event.key,
      code: event.code,
    });
  },
  true,
);

applyLastTheme();

// Browser-mode UI development: fixture-backed bridge when no preload exists.
// Dev-only; Vite removes the branch from production builds.
if (import.meta.env.DEV) {
  installMockBridge();
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <WindowFrame api={window.thetaApp}>
        <RendererErrorBoundary
          onRelaunch={() => {
            window.thetaApp?.relaunchApplication()?.catch((error: unknown) => {
              console.error("[renderer] relaunchApplication failed", error);
            });
          }}
        >
          <App />
        </RendererErrorBoundary>
      </WindowFrame>
    </I18nProvider>
  </React.StrictMode>,
);
