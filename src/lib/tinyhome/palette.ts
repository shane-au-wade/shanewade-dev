// Command palette (Cmd/Ctrl+P or Cmd/Ctrl+K): fuzzy search over every item,
// tool, level and action so nothing needs hunting for in the side panel.
//
// The command list is supplied by a provider and re-read on every open, because
// entries depend on live state (how many stories exist, whether undo is
// available, which floor is active). MiniSearch handles ranking; this module
// owns the DOM, keyboard navigation and grouping.

import MiniSearch from "minisearch";

export interface Command {
  id: string;
  title: string;
  group: string;
  icon?: string;
  keywords?: string;
  hint?: string; // right-aligned detail: a shortcut, a size, a state
  run: () => void;
}

const ROW_BASE =
  "w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer border-none bg-transparent border-l-2 transition-colors";
const ROW_IDLE = "border-transparent hover:bg-gray-100 dark:hover:bg-dark-bg-hover";
const ROW_ACTIVE = "border-brand-primary bg-gray-100 dark:bg-dark-bg-hover";

export class CommandPalette {
  private root: HTMLElement | null;
  private input: HTMLInputElement | null;
  private list: HTMLElement | null;
  private commands: Command[] = [];
  private rows: Command[] = [];
  private rowEls: HTMLElement[] = [];
  private active = 0;
  private mini: MiniSearch | null = null;
  private opened = false;

  constructor(private provider: () => Command[]) {
    this.root = document.getElementById("th-palette");
    this.input = document.getElementById("th-palette-input") as HTMLInputElement | null;
    this.list = document.getElementById("th-palette-list");
    if (!this.root || !this.input || !this.list) return;

    document.getElementById("th-palette-backdrop")?.addEventListener("click", () => this.close());
    this.input.addEventListener("input", () => this.search());
    this.input.addEventListener("keydown", this.onInputKey);
    document.addEventListener("keydown", this.onGlobalKey);
  }

  isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    if (!this.root || !this.input || this.opened) return;
    this.opened = true;
    this.reindex();
    this.root.classList.remove("hidden");
    this.input.value = "";
    this.search();
    this.input.focus();
  }

  close(): void {
    if (!this.root || !this.opened) return;
    this.opened = false;
    this.root.classList.add("hidden");
  }

  toggle(): void {
    if (this.opened) this.close();
    else this.open();
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  private reindex(): void {
    this.commands = this.provider();
    this.mini = new MiniSearch({
      idField: "id",
      fields: ["title", "group", "keywords"],
      searchOptions: {
        prefix: true,
        fuzzy: 0.25,
        // Title matches should outrank a shared group name like "Furniture".
        boost: { title: 5, keywords: 2, group: 1 },
        combineWith: "AND",
      },
    });
    this.mini.addAll(
      this.commands.map((c) => ({
        id: c.id,
        title: c.title,
        group: c.group,
        keywords: c.keywords ?? "",
      })),
    );
  }

  private search(): void {
    const query = (this.input?.value ?? "").trim();
    if (!query || !this.mini) {
      this.rows = this.commands;
    } else {
      const byId = new Map(this.commands.map((c) => [c.id, c]));
      this.rows = this.mini
        .search(query)
        .map((r) => byId.get(String(r.id)))
        .filter((c): c is Command => !!c);
    }
    this.active = 0;
    this.render(query);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────
  private render(query: string): void {
    const list = this.list;
    if (!list) return;
    list.innerHTML = "";
    this.rowEls = [];

    if (this.rows.length === 0) {
      const empty = document.createElement("p");
      empty.className = "px-3 py-6 text-center text-muted";
      empty.textContent = `No matches for "${query}"`;
      list.appendChild(empty);
      return;
    }

    let lastGroup = "";
    this.rows.forEach((cmd, i) => {
      // Group headers only make sense for the unfiltered list; a ranked result
      // set is ordered by relevance, so each row shows its own group instead.
      if (!query && cmd.group !== lastGroup) {
        lastGroup = cmd.group;
        const header = document.createElement("p");
        header.className =
          "px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400";
        header.textContent = cmd.group;
        list.appendChild(header);
      }

      const row = document.createElement("button");
      row.type = "button";
      row.className = `${ROW_BASE} ${ROW_IDLE}`;
      row.innerHTML = `
        <i class="${cmd.icon ?? "ri-corner-down-left-line"} text-base w-5 shrink-0 text-center opacity-70"></i>
        <span class="flex-1 truncate text-sm">${escapeHtml(cmd.title)}</span>
        <span class="text-xs text-muted shrink-0">${escapeHtml(cmd.hint ?? (query ? cmd.group : ""))}</span>`;
      row.addEventListener("click", () => this.run(i));
      row.addEventListener("mousemove", () => {
        if (this.active !== i) {
          this.active = i;
          this.paintActive(false);
        }
      });
      list.appendChild(row);
      this.rowEls.push(row);
    });
    this.paintActive(true);
  }

  private paintActive(scroll: boolean): void {
    this.rowEls.forEach((el, i) => {
      el.className = `${ROW_BASE} ${i === this.active ? ROW_ACTIVE : ROW_IDLE}`;
    });
    if (scroll) this.rowEls[this.active]?.scrollIntoView({ block: "nearest" });
  }

  private move(delta: number): void {
    if (this.rows.length === 0) return;
    const n = this.rows.length;
    this.active = (this.active + delta + n) % n;
    this.paintActive(true);
  }

  private run(index: number): void {
    const cmd = this.rows[index];
    if (!cmd) return;
    this.close();
    cmd.run();
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────
  private onInputKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      this.run(this.active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  };

  private onGlobalKey = (e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (!ctrl || (key !== "p" && key !== "k")) return;
    // A native dialog sits in the top layer and would cover the palette.
    if (!this.opened && document.querySelector("dialog[open]")) return;
    e.preventDefault(); // Cmd+P would otherwise open the print dialog
    this.toggle();
  };
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
