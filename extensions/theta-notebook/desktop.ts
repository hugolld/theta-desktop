import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { DesktopViewContext } from "@theta-desktop/extension-ui/browser";
import {
  Notebook,
  TYPE_PREFIX,
  type EntryType,
  type EvidenceItem,
  type NotebookEntry,
  type NotebookState,
} from "./contract.ts";

const STYLES = `
*{box-sizing:border-box}
html,body{margin:0;background:var(--background)}
.notebook{
  --fg:var(--foreground);
  --muted:color-mix(in srgb,var(--fg) 56%,transparent);
  --faint:color-mix(in srgb,var(--fg) 36%,transparent);
  --line:color-mix(in srgb,var(--fg) 10%,transparent);
  --hover:color-mix(in srgb,var(--fg) 5%,transparent);
  --track:color-mix(in srgb,var(--fg) 7%,transparent);
  --chip-active:color-mix(in srgb,var(--accent) 12%,transparent);
  --g-cross:#3f7be0;
  --g-reexec:#3d9c74;
  font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;
  font-size:13px;line-height:1.45;color:var(--fg);background:var(--background);
  padding:20px 20px 28px;min-height:100vh;-webkit-font-smoothing:antialiased;
}
button{font:inherit;color:inherit}
h1{font-size:15px;font-weight:600;margin:0}
h2{font-size:12px;font-weight:500;color:var(--muted);margin:0;padding-bottom:6px;border-bottom:1px solid var(--line)}
.muted{color:var(--muted)}
.status{margin:6px 0 0;color:var(--muted)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.chips[hidden]{display:none}
.chip{border:1px solid var(--line);background:none;border-radius:999px;padding:2px 10px;cursor:pointer;color:var(--muted)}
.chip:hover{background:var(--hover)}
.chip[aria-pressed=true]{background:var(--chip-active);border-color:color-mix(in srgb,var(--accent) 45%,transparent);color:var(--fg)}
.chip:focus-visible{outline:2px solid color-mix(in srgb,var(--accent) 70%,transparent);outline-offset:-2px}
.chip .n{font-variant-numeric:tabular-nums;color:var(--faint);margin-left:4px}
section{margin-top:22px}
.cards{display:grid;gap:8px;margin-top:8px}
.card{border:1px solid var(--line);border-radius:8px;padding:9px 12px;background:color-mix(in srgb,var(--fg) 3%,transparent)}
.card-head{display:flex;align-items:center;gap:8px;min-width:0}
.card-head .id{font:11px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);background:var(--track);padding:0 6px;border-radius:4px}
.card-head .when{margin-left:auto;color:var(--faint);font-size:11px;white-space:nowrap}
.judges{font-size:11px;padding:0 6px;border-radius:4px;color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent);white-space:nowrap}
.grade{font-size:11px;padding:0 6px;border-radius:4px;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.grade::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--gc)}
.grade[data-g=asserted]{--gc:color-mix(in srgb,var(--fg) 34%,transparent);color:var(--muted);background:var(--track)}
.grade[data-g=cross-checked]{--gc:var(--g-cross);color:var(--g-cross);background:color-mix(in srgb,var(--g-cross) 12%,transparent)}
.grade[data-g=re-executed]{--gc:var(--g-reexec);color:var(--g-reexec);background:color-mix(in srgb,var(--g-reexec) 12%,transparent)}
.card-text{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.evidence{list-style:none;margin:8px 0 0;padding:8px 0 0;border-top:1px dashed var(--line);display:grid;gap:6px}
.ev-row{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.ev-src{font:11px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
.ev-meta{color:var(--faint);font-size:11px}
.ev-snap{display:block;font:11px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);overflow-wrap:anywhere;margin-top:2px}
.note{color:var(--faint);font-size:12px;margin:12px 0 0}
.empty{padding:28px 0}
.empty p{margin:0 0 4px}
`;

type Child = Node | string | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string | number | boolean | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (name === "class") node.className = String(value);
    else node.setAttribute(name, value === true ? "" : String(value));
  }
  for (const child of children)
    if (child !== null && child !== undefined && child !== false) node.append(child);
  return node;
}

type Filter = EntryType | "all";

const TYPES = Object.keys(TYPE_PREFIX) as EntryType[];

const PLURAL: Record<EntryType, string> = {
  hypothesis: "Hypotheses",
  method: "Methods",
  observation: "Observations",
  decision: "Decisions",
  confidence: "Confidence",
};

function formatWhen(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : at.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export async function mount(root: HTMLElement, host: DesktopViewContext): Promise<() => void> {
  host.signal.throwIfAborted();
  const style = h("style");
  style.textContent = STYLES;
  const view = h("main", { class: "notebook" });
  // The frame document sets --background/--foreground/--accent and updates them on theme changes.
  root.replaceChildren(style, view);

  let state: NotebookState | null = null;
  let filter: Filter = "all";
  let error = "";
  let disposed = false;

  const status = h("p", { class: "status", "data-testid": "notebook-status" });
  const chips = h("div", {
    class: "chips",
    role: "group",
    "aria-label": "Filter by entry type",
    "data-testid": "notebook-filters",
  });
  const body = h("div", {});
  view.append(h("header", {}, h("h1", {}, "Notebook"), status), chips, body);

  // Filter chips are built once and only re-labelled, so a live append never
  // steals focus from the chip the user just clicked.
  const chipButtons = new Map<Filter, HTMLButtonElement>();
  for (const key of ["all", ...TYPES] as Filter[]) {
    const button = h(
      "button",
      { class: "chip", "aria-pressed": String(filter === key), "data-filter": key },
      h("span", { class: "label" }, key === "all" ? "All" : PLURAL[key]),
      h("span", { class: "n" }, "0"),
    );
    button.onclick = () => {
      filter = key;
      render();
    };
    chipButtons.set(key, button);
    chips.append(button);
  }

  const gradeBadge = (grade: string) => h("span", { class: "grade", "data-g": grade }, grade);

  const evidenceList = (items: EvidenceItem[]) =>
    h(
      "ul",
      { class: "evidence" },
      ...items.map((item) =>
        h(
          "li",
          {},
          h(
            "div",
            { class: "ev-row" },
            gradeBadge(item.grade),
            h("span", { class: "ev-src" }, item.source),
            h(
              "span",
              { class: "ev-meta" },
              `retrieved ${formatWhen(item.retrieved)}`,
              ...(item.job_id ? [` · job ${item.job_id}`] : []),
            ),
          ),
          // The snapshot path is shown, never opened: the pane is read-only.
          item.snapshot
            ? h(
                "code",
                {
                  class: "ev-snap",
                  title:
                    "Recorded under .theta/evidence. The pane shows the path; it does not open files.",
                },
                item.snapshot,
              )
            : null,
        ),
      ),
    );

  const card = (entry: NotebookEntry) =>
    h(
      "article",
      { class: "card", "data-id": entry.id, "data-testid": "notebook-card" },
      h(
        "div",
        { class: "card-head" },
        h("span", { class: "id" }, entry.id),
        entry.grade ? gradeBadge(entry.grade) : null,
        entry.hypothesis ? h("span", { class: "judges" }, `judges ${entry.hypothesis}`) : null,
        h("span", { class: "when" }, formatWhen(entry.date)),
      ),
      h("p", { class: "card-text" }, entry.text),
      entry.evidence?.length ? evidenceList(entry.evidence) : null,
    );

  const emptyState = (present: boolean) =>
    h(
      "div",
      { class: "empty", "data-testid": "notebook-empty" },
      h("p", {}, present ? "The notebook has no entries yet." : "No notebook in this project yet."),
      h(
        "p",
        { class: "muted" },
        "As the pi agent records hypotheses, methods, observations, decisions, and confidence, they appear here live from .theta/notebook.jsonl.",
      ),
    );

  /** The card sections in the DOM, by type; the append path adds to these in place. */
  let sections: Partial<Record<EntryType, { head: HTMLElement; list: HTMLElement }>> = {};
  /** What the body last showed; the append path only extends a list. */
  let builtKind: "connecting" | "empty" | "list" | null = null;
  let renderedFilter: Filter = "all";
  let renderedPresent = false;
  let renderedIds: string[] = [];

  const syncStatus = () => {
    if (!state || !state.present) {
      status.replaceChildren();
      status.title = "";
      return;
    }
    const parts = [`${state.entries.length} ${state.entries.length === 1 ? "entry" : "entries"}`];
    if (state.skipped > 0)
      parts.push(`${state.skipped} ${state.skipped === 1 ? "line" : "lines"} not shown`);
    status.replaceChildren(...parts);
    status.title =
      state.skipped > 0
        ? "Lines that did not parse as notebook entries are never rendered, only counted."
        : "";
  };

  const syncChips = () => {
    const entries = state?.entries ?? [];
    chips.hidden = entries.length === 0;
    const counts = new Map<Filter, number>([["all", entries.length]]);
    for (const entry of entries) counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
    for (const [key, button] of chipButtons) {
      button.setAttribute("aria-pressed", String(filter === key));
      button.querySelector(".n")!.textContent = String(counts.get(key) ?? 0);
    }
  };

  const syncCounts = () => {
    const counts = new Map<EntryType, number>();
    for (const entry of state?.entries ?? [])
      counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
    for (const type of TYPES) {
      const slot = sections[type];
      if (slot) slot.head.textContent = `${PLURAL[type]} · ${counts.get(type) ?? 0}`;
    }
  };

  const rebuild = () => {
    sections = {};
    const children: Node[] = [];
    if (error) children.push(h("p", { class: "note", role: "alert" }, error));
    if (!state) {
      children.push(h("p", { class: "muted empty" }, "Connecting…"));
      builtKind = "connecting";
    } else if (state.entries.length === 0) {
      children.push(emptyState(state.present));
      builtKind = "empty";
    } else {
      for (const type of TYPES) {
        if (filter !== "all" && type !== filter) continue;
        const typed = state.entries.filter((entry) => entry.type === type);
        if (typed.length === 0) continue;
        const head = h("h2", {}, `${PLURAL[type]} · ${typed.length}`);
        const list = h("div", { class: "cards" }, ...typed.map(card));
        sections[type] = { head, list };
        children.push(h("section", {}, head, list));
      }
      builtKind = "list";
    }
    body.replaceChildren(...children);
    renderedFilter = filter;
    renderedPresent = state?.present ?? false;
    renderedIds = state?.entries.map((entry) => entry.id) ?? [];
  };

  const render = () => {
    if (disposed) return;
    syncStatus();
    syncChips();
    const entries = state?.entries ?? [];
    const ids = entries.map((entry) => entry.id);
    const fresh = entries.slice(renderedIds.length);
    const prefix = ids.length >= renderedIds.length && renderedIds.every((id, i) => ids[i] === id);
    const sameContext = filter === renderedFilter && (state?.present ?? false) === renderedPresent;
    // A list the journal merely grew extends in place: existing cards keep
    // their DOM, so a live append never scrolls or refocuses the pane.
    const appendable =
      builtKind === "list" &&
      prefix &&
      sameContext &&
      (fresh.length === 0 ||
        fresh.every((entry) => (filter === "all" ? sections[entry.type] : entry.type === filter)));
    if (appendable) {
      for (const entry of fresh) sections[entry.type]?.list.append(card(entry));
      renderedIds = ids;
    } else if (
      builtKind === "list" &&
      prefix &&
      sameContext &&
      filter !== "all" &&
      fresh.every((entry) => entry.type !== filter)
    ) {
      // Entries arrived for types the filter hides; nothing visible changed.
      renderedIds = ids;
    } else {
      rebuild();
    }
    syncCounts();
  };

  const binding = host.services.open({
    services: [Notebook],
    assertAccess: () => host.signal.throwIfAborted(),
    onError: (reason) => {
      error = reason instanceof Error ? reason.message : String(reason);
      render();
    },
  });
  const service = binding.use(Notebook);

  let unsubscribe = () => {};
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    host.signal.removeEventListener("abort", dispose);
    binding.dispose(BACKGROUND_CONTEXT).catch(() => {});
    root.replaceChildren();
  };
  host.signal.addEventListener("abort", dispose, { once: true });
  render();
  try {
    await binding.ready(BACKGROUND_CONTEXT);
    host.signal.throwIfAborted();
    unsubscribe = service.state.subscribe((next) => {
      state = next;
      render();
    });
    if (service.state.value) state = service.state.value;
    render();
  } catch (reason) {
    dispose();
    throw reason;
  }
  return dispose;
}
