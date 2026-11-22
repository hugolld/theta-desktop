import { MockThetaDesktopApi } from "./mock-bridge";

/**
 * Installs the mock `window.thetaApp` bridge for browser-mode UI development.
 * Runs only in dev builds and only when the real preload bridge is absent
 * (a plain browser tab), so the packaged Electron app is never affected.
 * `?piMock=0` opts out to inspect the bridge-missing shell.
 */
export function installMockBridge(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get("piMock") === "0") {
    return;
  }
  if (window.thetaApp) {
    return;
  }
  window.thetaApp = new MockThetaDesktopApi();
  console.info("[mock] thetaApp bridge installed — fixture data active (dev browser mode)");
}
