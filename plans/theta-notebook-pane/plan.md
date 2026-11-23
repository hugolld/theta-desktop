# Theta notebook pane (M7b-1, first desktop increment)

Status: in progress (started 2026-11-23). Owner approved the approach
(desktop-extension tab) and this plan on 2026-11-23.

## Decision record

- The pane set and order come from T14 (2026-11-21) as carried to this chassis
  by T15 (2026-11-22, vault: Project_AgenticDev_Theta/record/). Notebook pane
  first: its payload exists today (theta-agent ADR 0003:
  `.theta/notebook.jsonl`, five entry types, `evidence/` snapshots).
- Carrier: a desktop extension with a workbench tab — T15 D4's recorded
  carrier, the pattern `examples/desktop-extensions/` proves (chord service,
  replicated state, sandboxed extension view). No new app IPC; the
  renderer/main boundary stays untouched.
- Placement: `extensions/theta-notebook/` (repo root) — Theta-owned product
  surface, not upstream-derived demo content like `examples/`.
- Payload schema is theta-agent's `extensions/notebook-cards.ts` (MIT), cited
  in `contract.ts`; types are duplicated deliberately — theta-desktop takes no
  dependency on theta-agent, and ADR 0002's "no parallel schema" rule binds
  the shape, not the repo.
- Rules: read-only, live (tail-fed), never a second store; byte-identity
  dedupe; malformed lines never render (counted in a visible `skipped`
  badge — a small honest deviation from the cards' silent skip, owner-approved
  in the plan); no notebook → inert service, visible empty state, never an
  error.
- Out of scope (v1): opening snapshot files (paths shown only), any write
  path, editing, and the plan/viewer/canvas panes (their payload order is
  recorded in the vault; plan pane waits on theta-agent's plan object).
- Fix during U4 proof (2026-11-23): the watcher published its internal
  accumulator array, so the pane's change check compared the array with
  itself and live appends never reached the view. Published states are now
  copies; the regression test asserts the listener fires and earlier states
  stay frozen. Found by the real-Electron spec, not by the unit suite —
  the original tests asserted final snapshots, never that the callback fired.

## Units

- [x] U1 Contract + fixtures — `contract.ts` (state + service, chord),
      `notebook.ts` parser (complete-lines caller contract, dedupe by line
      bytes, shape validation, skipped count), fixture notebook, tests.
- [x] U2 Host service — session-cwd resolution, initial read, fs.watch tail
      (debounced, complete lines only), delta push over the view bridge.
- [x] U3 Desktop view — grouped cards, type filters, grade marks, confidence
      naming its hypothesis, snapshot paths, live append, empty state.
- [x] U4 Packaging + proof — build.mjs (+ committed dist, build:check),
      README with `.pi/settings.json` registration, root test chain extended,
      `pnpm check` green, real-Electron verification: seeded workspace → pane
      renders → live append from bash → pane updates.
