# NOTICE — two-tier licensing in this fork

`theta-desktop` is the Theta campaign's desktop scientist surface: a fork of
[pi-gui](https://github.com/minghinmatthewlam/pi-gui) (Matthew Lam), created 2026-11-22.

The repository carries two license tiers:

1. **Upstream pi-gui code — MIT.** The [LICENSE](./LICENSE) file (Copyright (c) 2026
   Matthew Lam) is preserved unchanged. Files originating from upstream, and the unmodified
   upstream portions of files this fork touches, remain available under those MIT terms.

2. **Theta-authored code — PolyForm Noncommercial 1.0.0.** Files that did not exist
   upstream, and Theta's changes to existing files, are licensed under the
   [PolyForm Noncommercial License 1.0.0](./LICENSE-THETA.md)
   (Required Notice: Copyright 2026 Theta contributors). In short: use, change, and share
   them for noncommercial purposes; commercial use requires a license from the Theta
   owner. Academic and educational use is a permitted purpose under the license's own
   "Noncommercial Organizations" clause.

Which tier applies to a file:

- New Theta files carry `SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0` in their
  header where the file format allows it.
- Upstream files keep their upstream form and MIT availability; Theta modifications to them
  are Theta-authored and fall under tier 2, while the upstream portions stay MIT.
- When in doubt, compare against upstream pi-gui at the fork point recorded in the git
  history.

Outside contributions to Theta-authored files are not being accepted yet. Contributor terms
(a CLA) will be added before that changes, so the Theta owner can keep granting commercial
licenses for the whole of Theta's code.

The `theta` name and marks are reserved by the Theta project; this notice is not a trademark
license.

## Names that stay pi

The pi agent and its integration names never change in this fork. Renaming them breaks the
pi integration or orphans stored values. In particular:

- The `pi` agent itself and its paths: `pi`, `@earendil-works/pi-coding-agent`,
  `~/.pi/agent`, `.pi/settings.json`, `PI_CODING_AGENT_DIR`.
- `packages/pi-sdk-driver`: the adapter over the pi SDK.
- The `refs/pi-gui/snapshots/` git refs in user repositories, and the `pi-gui` lease
  surface value stored in session leases.

Brand names that this fork did change: the display name (Theta), the app and data folder
name, the bundle ID, installer and executable names, the update source, the workspace
package scope (now `@theta-desktop/*`), the preload bridge global (`piApp` is now
`thetaApp`), the `PiDesktop*` type names, the `pi-gui:` IPC channel, frame-message, and
`pi-gui-image` scheme strings, and the `PI_APP_*`/`PI_GUI_*` environment variable names
(now `THETA_APP_*`/`THETA_GUI_*`; the pi agent's own `PI_CODING_AGENT_DIR` keeps its name).
