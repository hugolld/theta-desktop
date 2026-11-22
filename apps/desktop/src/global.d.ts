import type { ThetaDesktopApi } from "../contracts/ipc";

export {};

declare global {
  interface Window {
    thetaApp?: ThetaDesktopApi;
  }
}
