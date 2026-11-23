# Theta Notebook

A file-based Pi extension that shows the project's research notebook as a live
desktop pane. The notebook is theta-agent's provenance journal (ADR 0003): an
append-only `.theta/notebook.jsonl` in the session's project directory, written
by the recorder skill as the agent works. This extension is read-only — it adds
no tools, changes nothing the model sees, and writes nothing. The journal stays
the one store; the pane is a view of it.

The pane renders five card groups — hypotheses, methods, observations,
decisions, confidence — with filter chips and counts. Observations and evidence
items carry their grade marks (`asserted`, `cross-checked`, `re-executed`); a
grade rates the source, never the researcher's judgment. Confidence entries
name the hypothesis they judge. Evidence snapshots appear as paths recorded
under `.theta/evidence/`; the pane shows them and never opens files. Lines that
do not parse as entries are never rendered and never silently dropped — the
header counts them. New entries append live without moving the pane's scroll
or focus.

The entry schema is cited from theta-agent (`extensions/notebook-cards.ts` and
the recorder `skills/theta-notebook/scripts/notebook.py`), duplicated as types
in `contract.ts` because theta-desktop takes no dependency on theta-agent. The
shape may not fork (theta-agent ADR 0002).

## Build and register

From the repository root, after the normal dependency setup
(`@theta-desktop/extension-ui` is a private local workspace package):

```sh
pnpm --filter @theta-desktop/extension-ui build
node extensions/theta-notebook/build.mjs
```

Add the absolute path to the existing `extensions` array in the target
project's `.pi/settings.json`, or `~/.pi/agent/settings.json` for user-wide
availability. For example:

```json
{
  "extensions": ["/absolute/path/to/theta-desktop/extensions/theta-notebook/index.ts"]
}
```

This is Pi's normal local extension configuration. Do not register
`desktop.ts` or `dist/desktop.js` as Pi extensions.

## Checks

```sh
pnpm --dir extensions/theta-notebook test
pnpm --dir extensions/theta-notebook typecheck
node extensions/theta-notebook/build.mjs --check
```

`test/notebook.test.mts` covers the parser (valid entries, malformed lines,
byte-identity dedupe) and `test/watcher.test.mts` covers the live tail
(creation follow, append, mid-append holdback, stop). Both run chord-free.
The repository chains in the root `package.json` (`typecheck:extension-examples`,
`test:extension-examples`) include this extension, so `pnpm check` covers it.
