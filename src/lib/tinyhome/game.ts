// Orchestrator: wires the DOM UI to the scene, store and tool controller.
// Keeps the Astro page's inline script to a single call.

import * as THREE from "three";
import {
  DOOR_SPAN,
  HouseStore,
  WINDOW_SPAN,
  LOT_PRESETS,
  MAX_COLS,
  MAX_LEVELS,
  MAX_ROWS,
  MIN_LOT,
  WALL_HEIGHT,
  computeMetrics,
  defaultState,
  deriveFloorForLevel,
  exportJSON,
  floorKey,
  levelBaseY,
  levelName,
  sanitize,
  type HomeCategory,
  type HouseState,
  type RoofStyle,
} from "./state";
import { createScene } from "./scene";
import { buildHouse, buildLevelOverlay, type BuiltScene } from "./builder";
import { ToolController, describeSelection, type FloorMode, type Selection, type Tool } from "./tools";
import { CATALOG } from "./catalog";
import { captureViews, downloadDataUrl, type CaptureShot } from "./capture";
import { CommandPalette, type Command } from "./palette";

type WallMode = "full" | "cutaway" | "hidden";

const FLOOR_COLORS = ["#c8a97e", "#9c6b43", "#6f4a2d", "#d9cbb2", "#8a8f98", "#3f4750"];
const WALL_COLORS = ["#e8e2d5", "#f2f2ef", "#d7c9a8", "#b9c4cf", "#a8b5a0", "#c98a7a"];
const ROOF_COLORS = ["#8a5a44", "#5a4636", "#3f4750", "#6b7f4a", "#7a2f2f", "#4a5a6b"];
const CUTAWAY_HEIGHT = 3.5;

export function initTinyHome(): void {
  const mount = document.getElementById("th-canvas");
  if (!mount) return;

  const ctx = createScene(mount);
  const store = new HouseStore();

  let currentTool: Tool = "select";
  let currentItemId: string | null = CATALOG[0]?.id ?? null;
  let wallMode: WallMode = "full";
  let floorMode: FloorMode = "add";
  let planView = false;
  let activeLevel = 0;
  let showAbove = true;
  let built: BuiltScene | null = null;
  let lastShots: CaptureShot[] = [];
  let lastLotKey = "";

  // Guide showing the floor above the one being edited; rebuilt with the scene.
  const overlayGroup = new THREE.Group();
  overlayGroup.name = "overlay";
  ctx.scene.add(overlayGroup);

  const controller = new ToolController(ctx, {
    getTool: () => currentTool,
    getItemId: () => currentItemId,
    getLevel: () => activeLevel,
    getFloorMode: () => floorMode,
    getStore: () => store,
    getBuilt: () => built,
    onSelect: (sel) => updateSelectionUi(sel),
  });

  // ── Rebuild scene from state ────────────────────────────────────────────────────
  function rebuild(): void {
    const s = store.get();
    activeLevel = Math.min(activeLevel, s.levels - 1);

    const lotKey = `${s.cols}x${s.rows}`;
    if (lotKey !== lastLotKey) {
      ctx.updateLot(s);
      lastLotKey = lotKey;
    }

    if (built) {
      ctx.scene.remove(built.group);
      disposeGroup(built.group);
    }
    const focusLevel = s.levels > 1 ? activeLevel : undefined;
    const wallRenderHeight = wallMode === "cutaway" ? CUTAWAY_HEIGHT : undefined;
    const showRoof = wallMode !== "hidden" && !planView;
    built = buildHouse(s, { wallRenderHeight, showRoof, focusLevel });
    if (wallMode === "hidden") {
      built.wallMeshes.forEach((w) => (w.visible = false));
      built.openingGroups.forEach((o) => (o.visible = false));
    }
    ctx.scene.add(built.group);

    clearGroup(overlayGroup);
    if (showAbove && activeLevel + 1 < s.levels) {
      const overlay = buildLevelOverlay(s, activeLevel + 1, levelBaseY(activeLevel));
      if (overlay) overlayGroup.add(overlay);
    }

    controller.refreshSelection();
    ctx.requestRender();
    updateHud(s);
    renderLevelTabs(s);
  }

  // ── HUD ──────────────────────────────────────────────────────────────────────────
  function updateHud(s: HouseState): void {
    const m = computeMetrics(s);
    const height = s.levels * WALL_HEIGHT;
    setText("th-sqft", `${m.floorSqft}`);
    setText(
      "th-dims",
      `${s.cols} × ${s.rows} ft · ${s.levels} ${s.levels > 1 ? "stories" : "story"} · ${height} ft tall`,
    );
    setText("th-enclosed", `${m.enclosedSqft} sq ft enclosed by walls`);
    setText("th-lotsqft", `${m.lotSqft} sq ft lot`);
    setText("th-walls-count", `${m.wallCount}`);
    setText("th-furni-count", `${m.furnitureCount}`);
    setText("th-open-count", `${m.doorCount + m.windowCount}`);

    // A full breakdown gets unreadable past a few stories, so fall back to the
    // one being edited.
    const perLevel =
      s.levels <= 4
        ? m.perLevelFloorSqft.map((v, i) => `${levelName(i)}: ${v}`).join(" · ")
        : `${levelName(activeLevel)}: ${m.perLevelFloorSqft[activeLevel] ?? 0} sq ft`;
    setText("th-per-level", s.levels > 1 ? perLevel : "");

    const badge = document.getElementById("th-badge");
    if (badge) {
      const [cls, text] = badgeFor(m.category, m.floorSqft);
      badge.className = `${cls} self-start`;
      badge.textContent = text;
    }
    setDisabled("th-undo", !store.canUndo());
    setDisabled("th-redo", !store.canRedo());
  }

  store.subscribe(() => rebuild());

  // ── Selection UI ────────────────────────────────────────────────────────────────
  function updateSelectionUi(sel: Selection | null): void {
    setText("th-selection", sel ? describeSelection(sel, store.get()) : "Nothing");
    setDisabled("th-delete", !sel);
  }

  // ── Tool selection ────────────────────────────────────────────────────────────────
  function setTool(tool: Tool): void {
    currentTool = tool;
    controller.onToolChanged();
    document.querySelectorAll<HTMLElement>("[data-th-tool]").forEach((el) => {
      const active = el.dataset.thTool === tool;
      el.classList.toggle("btn-primary", active);
      el.classList.toggle("btn-default", !active);
    });
    toggleHidden("th-furniture-panel", tool !== "furniture");
    toggleHidden("th-select-bar", tool !== "select");
    toggleHidden("th-floor-bar", tool !== "floor");
  }

  document.querySelectorAll<HTMLElement>("[data-th-tool]").forEach((el) => {
    el.addEventListener("click", () => setTool(el.dataset.thTool as Tool));
  });

  // ── Floor tool: add/cut mode + fill/clear for the active level ──────────────────
  function setFloorMode(mode: FloorMode): void {
    floorMode = mode;
    document.querySelectorAll<HTMLElement>("[data-th-floor-mode]").forEach((el) => {
      const active = el.dataset.thFloorMode === mode;
      el.classList.toggle("btn-primary", active);
      el.classList.toggle("btn-default", !active);
    });
    ctx.requestRender();
  }
  document.querySelectorAll<HTMLElement>("[data-th-floor-mode]").forEach((el) => {
    el.addEventListener("click", () => setFloorMode(el.dataset.thFloorMode as FloorMode));
  });

  function fillActiveFloor(): void {
    const level = activeLevel;
    store.commit((d) => {
      const cells = deriveFloorForLevel(d, level);
      const present = new Set(d.floors.map(floorKey));
      for (const c of cells) {
        const k = floorKey(c);
        if (!present.has(k)) {
          d.floors.push(c);
          present.add(k);
        }
      }
    });
  }
  function clearActiveFloor(): void {
    const level = activeLevel;
    store.commit((d) => (d.floors = d.floors.filter((f) => f.level !== level)));
  }
  onClick("th-fill-floor", fillActiveFloor);
  onClick("th-clear-floor", clearActiveFloor);

  // ── Levels: numbered tabs matching the 1-9 hotkeys ──────────────────────────────
  function setLevel(level: number): void {
    const s = store.get();
    if (level < 0 || level >= s.levels || level === activeLevel) return;
    activeLevel = level;
    controller.clearSelection();
    rebuild();
  }

  function renderLevelTabs(s: HouseState): void {
    const tabs = document.getElementById("th-level-tabs");
    if (tabs) {
      tabs.innerHTML = "";
      for (let lvl = 0; lvl < s.levels; lvl++) {
        const btn = document.createElement("button");
        const active = lvl === activeLevel;
        btn.className = `btn-sm flex-1 min-w-0 px-0 ${active ? "btn-primary" : "btn-default"}`;
        btn.textContent = `${lvl + 1}`;
        btn.title = `${levelName(lvl)} floor — press ${lvl + 1}`;
        btn.addEventListener("click", () => setLevel(lvl));
        tabs.appendChild(btn);
      }
    }
    setText("th-level-name", `${levelName(activeLevel)} floor of ${s.levels}`);
    setDisabled("th-add-story", s.levels >= MAX_LEVELS);
    setDisabled("th-remove-story", s.levels <= 1);

    const above = document.getElementById("th-show-above");
    if (above) {
      above.textContent = showAbove ? "Floor above: On" : "Floor above: Off";
      above.classList.toggle("btn-primary", showAbove);
      above.classList.toggle("btn-default", !showAbove);
      setDisabled("th-show-above", activeLevel + 1 >= s.levels);
    }
  }

  function addStory(): void {
    if (store.get().levels >= MAX_LEVELS) return;
    // A new story starts with a floor matching the footprint below, so it is
    // immediately usable; cut a void into it to make a loft.
    store.commit((d) => {
      const level = d.levels;
      d.levels = level + 1;
      for (const c of deriveFloorForLevel(d, level)) d.floors.push(c);
    });
    activeLevel = store.get().levels - 1;
    rebuild();
  }

  function removeStory(): void {
    const s = store.get();
    if (s.levels <= 1) return;
    const top = s.levels - 1;
    if (!confirm(`Remove the ${levelName(top)} floor and everything on it?`)) return;
    store.commit((d) => {
      d.levels = top;
      d.walls = d.walls.filter((w) => w.level < top);
      d.openings = d.openings.filter((o) => o.level < top);
      d.floors = d.floors.filter((f) => f.level < top);
      d.furniture = d.furniture.filter((f) => f.level < top);
    });
    activeLevel = Math.min(activeLevel, store.get().levels - 1);
    rebuild();
  }

  function setShowAbove(on: boolean): void {
    showAbove = on;
    rebuild();
  }

  onClick("th-add-story", addStory);
  onClick("th-remove-story", removeStory);
  onClick("th-show-above", () => setShowAbove(!showAbove));

  // ── Furniture catalog ──────────────────────────────────────────────────────────────
  const furniList = document.getElementById("th-furniture");
  if (furniList) {
    for (const item of CATALOG) {
      const btn = document.createElement("button");
      btn.className = "btn-default btn-sm flex flex-col items-center gap-1 py-2 shrink-0 w-16";
      btn.dataset.thItem = item.id;
      btn.innerHTML = `<i class="${item.icon} text-lg"></i><span class="text-xs">${item.label}</span>`;
      btn.addEventListener("click", () => {
        currentItemId = item.id;
        setTool("furniture");
        highlightItem();
      });
      furniList.appendChild(btn);
    }
  }
  function highlightItem(): void {
    document.querySelectorAll<HTMLElement>("[data-th-item]").forEach((el) => {
      const active = el.dataset.thItem === currentItemId;
      el.classList.toggle("btn-primary", active);
      el.classList.toggle("btn-default", !active);
    });
    const item = CATALOG.find((c) => c.id === currentItemId);
    setText("th-selected", item ? item.label : "None");
  }
  highlightItem();

  // ── Color palettes ───────────────────────────────────────────────────────────────
  buildPalette("th-floor-colors", FLOOR_COLORS, (c) => store.commit((d) => (d.floorColor = c)), () => store.get().floorColor);
  buildPalette("th-wall-colors", WALL_COLORS, (c) => store.commit((d) => (d.wallColor = c)), () => store.get().wallColor);
  buildPalette("th-roof-colors", ROOF_COLORS, (c) => store.commit((d) => (d.roofColor = c)), () => store.get().roofColor);

  // ── Roof style ─────────────────────────────────────────────────────────────────────
  const roofSelect = document.getElementById("th-roof") as HTMLSelectElement | null;
  if (roofSelect) {
    roofSelect.value = store.get().roof;
    roofSelect.addEventListener("change", () => store.commit((d) => (d.roof = roofSelect.value as RoofStyle)));
  }

  // ── Lot presets / new ────────────────────────────────────────────────────────────────
  const lotSelect = document.getElementById("th-lot") as HTMLSelectElement | null;
  const lotW = document.getElementById("th-lot-w") as HTMLInputElement | null;
  const lotD = document.getElementById("th-lot-d") as HTMLInputElement | null;

  function applyLot(cols: number, rows: number): void {
    store.commit((d) => {
      d.cols = cols;
      d.rows = rows;
      d.walls = d.walls.filter((w) => inLot(w.x, w.z, cols, rows));
      d.openings = d.openings.filter((o) => inLot(o.x, o.z, cols, rows));
      d.floors = d.floors.filter((f) => f.cx < cols && f.cz < rows);
      d.furniture = d.furniture.filter((f) => f.cx < cols && f.cz < rows);
    });
    ctx.frameLot(store.get());
    syncControls();
  }

  if (lotSelect) {
    const custom = document.createElement("option");
    custom.value = "";
    custom.textContent = "Custom";
    lotSelect.appendChild(custom);
    for (const p of LOT_PRESETS) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.label} — ${p.cols}×${p.rows} ft`;
      lotSelect.appendChild(opt);
    }
    lotSelect.addEventListener("change", () => {
      const preset = LOT_PRESETS.find((p) => p.id === lotSelect.value);
      if (preset) applyLot(preset.cols, preset.rows);
    });
  }

  onClick("th-lot-apply", () => {
    const s = store.get();
    const cols = clamp(Number(lotW?.value), MIN_LOT, MAX_COLS, s.cols);
    const rows = clamp(Number(lotD?.value), MIN_LOT, MAX_ROWS, s.rows);
    if (cols === s.cols && rows === s.rows) return;
    applyLot(cols, rows);
  });
  for (const input of [lotW, lotD]) {
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("th-lot-apply")?.dispatchEvent(new Event("click"));
    });
  }

  function newBuild(): void {
    if (!confirm("Clear the current build and start over?")) return;
    const cur = store.get();
    activeLevel = 0;
    store.replace(defaultState(cur.cols, cur.rows, cur.levels));
    ctx.frameLot(store.get());
  }
  onClick("th-new", newBuild);

  // ── Undo / redo / delete ────────────────────────────────────────────────────────────
  function undo(): void {
    store.undo();
    syncControls();
  }
  function redo(): void {
    store.redo();
    syncControls();
  }
  onClick("th-undo", undo);
  onClick("th-redo", redo);
  onClick("th-delete", () => controller.deleteSelected());

  // ── Wall visibility + plan view ────────────────────────────────────────────────────────
  function setWallMode(mode: WallMode): void {
    wallMode = mode;
    setText("th-walls-label", wallModeLabel(wallMode));
    rebuild();
  }
  function setPlanView(on: boolean): void {
    planView = on;
    ctx.setPlanView(planView);
    const btn = document.getElementById("th-plan");
    btn?.classList.toggle("btn-primary", planView);
    btn?.classList.toggle("btn-default", !planView);
    rebuild();
  }
  onClick("th-walls", () =>
    setWallMode(wallMode === "full" ? "cutaway" : wallMode === "cutaway" ? "hidden" : "full"),
  );
  onClick("th-plan", () => setPlanView(!planView));

  // ── Capture ────────────────────────────────────────────────────────────────────────────
  function runCapture(): void {
    const hide = [
      ctx.lotGroup,
      overlayGroup,
      ctx.scene.getObjectByName("ghost"),
      ctx.scene.getObjectByName("selection"),
    ];
    const prev = hide.map((o) => (o ? o.visible : true));
    hide.forEach((o) => o && (o.visible = false));
    lastShots = captureViews(ctx.scene, store.get());
    hide.forEach((o, i) => o && (o.visible = prev[i]));
    ctx.requestRender();
    renderGallery(lastShots);
    openModal("th-capture-modal");
  }
  onClick("th-capture", runCapture);
  onClick("th-download-all", () => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    lastShots.forEach((shot, i) => downloadDataUrl(shot.dataUrl, `tiny-home-${ts}-${i + 1}-${slug(shot.label)}.png`));
    downloadText(exportJSON(store.get()), `tiny-home-${ts}.json`);
  });

  function renderGallery(shots: CaptureShot[]): void {
    const gallery = document.getElementById("th-gallery");
    if (!gallery) return;
    gallery.innerHTML = "";
    for (const shot of shots) {
      const fig = document.createElement("figure");
      fig.className = "card overflow-hidden";
      fig.innerHTML = `
        <img src="${shot.dataUrl}" alt="${shot.label}" class="w-full block" />
        <figcaption class="card-body py-2 flex items-center justify-between">
          <span class="text-small font-medium">${shot.label}</span>
        </figcaption>`;
      const dlBtn = document.createElement("button");
      dlBtn.className = "btn-ghost btn-sm";
      dlBtn.innerHTML = '<i class="ri-download-line"></i>';
      dlBtn.addEventListener("click", () => downloadDataUrl(shot.dataUrl, `tiny-home-${slug(shot.label)}.png`));
      fig.querySelector("figcaption")?.appendChild(dlBtn);
      gallery.appendChild(fig);
    }
  }

  // ── Save / load ─────────────────────────────────────────────────────────────────────────
  function saveBuild(): void {
    const input = document.getElementById("th-save-name") as HTMLInputElement | null;
    const name = (input?.value || "").trim() || `Build ${new Date().toLocaleString()}`;
    store.saveAs(name);
    if (input) input.value = "";
    renderSaves();
    flash("Saved");
  }
  function openSaves(): void {
    renderSaves();
    openModal("th-saves-modal");
  }
  onClick("th-save", saveBuild);
  onClick("th-open-saves", openSaves);

  function renderSaves(): void {
    const list = document.getElementById("th-saves-list");
    if (!list) return;
    const saves = HouseStore.listSaves();
    if (saves.length === 0) {
      list.innerHTML = '<p class="text-muted text-small">No saved builds yet.</p>';
      return;
    }
    list.innerHTML = "";
    for (const save of saves) {
      const row = document.createElement("div");
      row.className = "flex items-center justify-between gap-2 py-2 border-b border-gray-200 dark:border-dark-border";
      const when = new Date(save.savedAt).toLocaleString();
      const m = computeMetrics(sanitize(save.state));
      row.innerHTML = `<div>
          <div class="font-medium">${escapeHtml(save.name)}</div>
          <div class="text-xs text-muted">${when} · ${m.floorSqft} sq ft</div>
        </div>`;
      const actions = document.createElement("div");
      actions.className = "flex gap-2 shrink-0";
      const loadBtn = document.createElement("button");
      loadBtn.className = "btn-primary btn-sm";
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", () => {
        activeLevel = 0;
        store.replace(sanitize(save.state));
        syncControls();
        ctx.frameLot(store.get());
        closeModal("th-saves-modal");
      });
      const delBtn = document.createElement("button");
      delBtn.className = "btn-ghost btn-sm";
      delBtn.innerHTML = '<i class="ri-delete-bin-line"></i>';
      delBtn.addEventListener("click", () => {
        HouseStore.deleteSave(save.name);
        renderSaves();
      });
      actions.append(loadBtn, delBtn);
      row.appendChild(actions);
      list.appendChild(row);
    }
  }

  function syncControls(): void {
    const s = store.get();
    if (roofSelect) roofSelect.value = s.roof;
    if (lotSelect) {
      const preset = LOT_PRESETS.find((p) => p.cols === s.cols && p.rows === s.rows);
      lotSelect.value = preset ? preset.id : "";
    }
    if (lotW) lotW.value = `${s.cols}`;
    if (lotD) lotD.value = `${s.rows}`;
  }

  // ── Command palette ────────────────────────────────────────────────────────────────────
  // Rebuilt on every open so entries track live state (story count, roof, lot).
  function paletteCommands(): Command[] {
    const s = store.get();
    const cmds: Command[] = [];

    for (const item of CATALOG) {
      cmds.push({
        id: `item:${item.id}`,
        title: item.label,
        group: "Furniture",
        icon: item.icon,
        keywords: `${item.keywords} place furniture item`,
        hint: `${item.fw} × ${item.fd} ft`,
        run: () => {
          currentItemId = item.id;
          setTool("furniture");
          highlightItem();
        },
      });
    }

    const tools: { tool: Tool; label: string; icon: string; key: string; keywords: string }[] = [
      { tool: "select", label: "Select", icon: "ri-cursor-line", key: "V", keywords: "pick inspect move" },
      { tool: "wall", label: "Wall", icon: "ri-layout-column-line", key: "W", keywords: "draw partition build" },
      { tool: "floor", label: "Floor", icon: "ri-grid-line", key: "G", keywords: "slab deck void loft paint" },
      { tool: "door", label: "Door", icon: "ri-door-open-line", key: "D", keywords: "opening entry doorway" },
      { tool: "window", label: "Window", icon: "ri-window-2-line", key: "N", keywords: "opening glazing glass" },
      { tool: "furniture", label: "Furnish", icon: "ri-sofa-line", key: "F", keywords: "place item object" },
      { tool: "erase", label: "Erase", icon: "ri-eraser-line", key: "E", keywords: "delete remove demolish" },
    ];
    for (const t of tools) {
      cmds.push({
        id: `tool:${t.tool}`,
        title: `${t.label} tool`,
        group: "Tools",
        icon: t.icon,
        keywords: t.keywords,
        hint: t.key,
        run: () => setTool(t.tool),
      });
    }

    for (let lvl = 0; lvl < s.levels; lvl++) {
      cmds.push({
        id: `level:${lvl}`,
        title: `Go to ${levelName(lvl)} floor`,
        group: "Levels",
        icon: "ri-stack-line",
        keywords: `story storey level switch ${lvl + 1}`,
        hint: `${lvl + 1}`,
        run: () => setLevel(lvl),
      });
    }
    if (s.levels < MAX_LEVELS) {
      cmds.push({
        id: "level:add",
        title: "Add a story",
        group: "Levels",
        icon: "ri-add-box-line",
        keywords: "new storey level upstairs floor above",
        run: addStory,
      });
    }
    if (s.levels > 1) {
      cmds.push({
        id: "level:remove",
        title: `Remove the ${levelName(s.levels - 1)} floor`,
        group: "Levels",
        icon: "ri-indeterminate-circle-line",
        keywords: "delete storey level top",
        run: removeStory,
      });
      cmds.push({
        id: "level:above",
        title: `Floor above: ${showAbove ? "On" : "Off"}`,
        group: "Levels",
        icon: "ri-eye-line",
        keywords: "overlay outline guide ghost stairs toggle",
        run: () => setShowAbove(!showAbove),
      });
    }

    cmds.push(
      {
        id: "floor:fill",
        title: `Fill ${levelName(activeLevel)} floor`,
        group: "Floor",
        icon: "ri-checkbox-multiple-blank-line",
        keywords: "slab deck whole level all",
        run: fillActiveFloor,
      },
      {
        id: "floor:clear",
        title: `Clear ${levelName(activeLevel)} floor`,
        group: "Floor",
        icon: "ri-eraser-line",
        keywords: "remove slab deck empty",
        run: clearActiveFloor,
      },
      {
        id: "floor:add",
        title: "Floor mode: Add",
        group: "Floor",
        icon: "ri-add-line",
        keywords: "paint draw slab",
        run: () => {
          setTool("floor");
          setFloorMode("add");
        },
      },
      {
        id: "floor:cut",
        title: "Floor mode: Cut void",
        group: "Floor",
        icon: "ri-scissors-cut-line",
        keywords: "remove hole loft opening double height stairwell",
        run: () => {
          setTool("floor");
          setFloorMode("remove");
        },
      },
    );

    const wallModes: WallMode[] = ["full", "cutaway", "hidden"];
    for (const mode of wallModes) {
      cmds.push({
        id: `view:walls-${mode}`,
        title: wallModeLabel(mode),
        group: "View",
        icon: "ri-wall-line",
        keywords: "visibility cutaway hide see through interior",
        run: () => setWallMode(mode),
      });
    }
    cmds.push(
      {
        id: "view:plan",
        title: planView ? "Leave plan view" : "Plan view (top down)",
        group: "View",
        icon: "ri-artboard-line",
        keywords: "orthographic overhead blueprint birds eye",
        run: () => setPlanView(!planView),
      },
      {
        id: "view:frame",
        title: "Recenter camera on lot",
        group: "View",
        icon: "ri-focus-3-line",
        keywords: "fit zoom reset frame view",
        run: () => ctx.frameLot(store.get()),
      },
    );

    const roofs: { style: RoofStyle; label: string }[] = [
      { style: "gable", label: "Gable" },
      { style: "flat", label: "Flat" },
      { style: "none", label: "None" },
    ];
    for (const r of roofs) {
      cmds.push({
        id: `roof:${r.style}`,
        title: `Roof: ${r.label}`,
        group: "Roof",
        icon: "ri-home-4-line",
        keywords: "pitch cover top",
        run: () => {
          store.commit((d) => (d.roof = r.style));
          syncControls();
        },
      });
    }

    for (const p of LOT_PRESETS) {
      cmds.push({
        id: `lot:${p.id}`,
        title: `Lot: ${p.label}`,
        group: "Lot",
        icon: "ri-crop-line",
        keywords: `size ${p.cols} ${p.rows} feet footprint`,
        hint: `${p.cols} × ${p.rows} ft`,
        run: () => applyLot(p.cols, p.rows),
      });
    }

    cmds.push(
      { id: "act:undo", title: "Undo", group: "Build", icon: "ri-arrow-go-back-line", hint: "⌘Z", keywords: "revert back", run: undo },
      { id: "act:redo", title: "Redo", group: "Build", icon: "ri-arrow-go-forward-line", hint: "⇧⌘Z", keywords: "again forward", run: redo },
      {
        id: "act:delete",
        title: "Delete selection",
        group: "Build",
        icon: "ri-delete-bin-line",
        hint: "Del",
        keywords: "remove erase selected",
        run: () => controller.deleteSelected(),
      },
      { id: "act:capture", title: "Capture views", group: "Build", icon: "ri-camera-line", keywords: "screenshot render photo export image", run: runCapture },
      { id: "act:save", title: "Save build", group: "Build", icon: "ri-save-line", keywords: "store persist", run: saveBuild },
      { id: "act:saves", title: "Open saved builds", group: "Build", icon: "ri-folder-open-line", keywords: "load restore library", run: openSaves },
      { id: "act:new", title: "New build (clear all)", group: "Build", icon: "ri-file-add-line", keywords: "reset start over empty", run: newBuild },
      {
        id: "act:showroom",
        title: "Open the showroom",
        group: "Build",
        icon: "ri-building-line",
        keywords: "catalog assets inventory warehouse browse gallery items",
        run: () => (window.location.href = "/tiny-home-showroom"),
      },
    );

    return cmds;
  }

  const palette = new CommandPalette(paletteCommands);
  onClick("th-palette-open", () => palette.open());

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (palette.isOpen()) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      store.undo();
      syncControls();
    } else if (meta && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
      e.preventDefault();
      store.redo();
      syncControls();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      controller.deleteSelected();
    } else if (e.key.toLowerCase() === "r") {
      controller.rotateGhost();
    } else if (e.key === "Escape") {
      controller.clearSelection();
      setTool("select");
    } else if (/^[1-9]$/.test(e.key)) {
      setLevel(Number(e.key) - 1);
    } else {
      const map: Record<string, Tool> = {
        v: "select",
        w: "wall",
        g: "floor",
        e: "erase",
        d: "door",
        n: "window",
        f: "furniture",
      };
      const t = map[e.key.toLowerCase()];
      if (t) setTool(t);
    }
  });

  // ── Boot ─────────────────────────────────────────────────────────────────────────────────
  setText("th-walls-label", wallModeLabel(wallMode));
  syncControls();
  setFloorMode(floorMode);
  setTool("select");
  rebuild();
  ctx.frameLot(store.get());

  if (store.get().walls.length === 0) seedStarterRoom(store);
}

// ── Small DOM/util helpers ────────────────────────────────────────────────────────────────────
function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function setDisabled(id: string, disabled: boolean): void {
  const el = document.getElementById(id) as HTMLButtonElement | null;
  if (el) el.disabled = disabled;
}
function toggleHidden(id: string, hidden: boolean): void {
  document.getElementById(id)?.classList.toggle("hidden", hidden);
}
function onClick(id: string, fn: () => void): void {
  document.getElementById(id)?.addEventListener("click", fn);
}
function buildPalette(containerId: string, colors: string[], onPick: (c: string) => void, getCurrent: () => string): void {
  const container = document.getElementById(containerId);
  if (!container) return;
  for (const color of colors) {
    const sw = document.createElement("button");
    sw.className = "w-7 h-7 rounded-md border-2 border-white dark:border-dark-border shadow-sm";
    sw.style.backgroundColor = color;
    sw.title = color;
    sw.addEventListener("click", () => {
      onPick(color);
      markActive();
    });
    container.appendChild(sw);
  }
  function markActive(): void {
    const cur = getCurrent();
    container!.querySelectorAll<HTMLElement>("button").forEach((b) => {
      const on = b.style.backgroundColor === hexToRgb(cur);
      b.classList.toggle("ring-2", on);
      b.classList.toggle("ring-brand-primary", on);
    });
  }
  markActive();
}
function hexToRgb(hex: string): string {
  const m = hex.replace("#", "");
  return `rgb(${parseInt(m.slice(0, 2), 16)}, ${parseInt(m.slice(2, 4), 16)}, ${parseInt(m.slice(4, 6), 16)})`;
}
function wallModeLabel(m: WallMode): string {
  return m === "full" ? "Walls: Full" : m === "cutaway" ? "Walls: Low" : "Walls: Hidden";
}
function clamp(v: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}
function badgeFor(category: HomeCategory, sqft: number): [string, string] {
  switch (category) {
    case "none":
      return ["badge-secondary", "No floor laid yet"];
    case "tiny":
      return ["badge-success", `Tiny home ✓ (${sqft} sq ft)`];
    case "small":
      return ["badge-info", `Small home (${sqft} sq ft)`];
    case "full":
      return ["badge-warning", `Full-size home (${sqft} sq ft)`];
  }
}
function inLot(x: number, z: number, cols: number, rows: number): boolean {
  return x >= 0 && x <= cols && z >= 0 && z <= rows;
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function openModal(id: string): void {
  (document.getElementById(id) as HTMLDialogElement | null)?.showModal();
}
function closeModal(id: string): void {
  (document.getElementById(id) as HTMLDialogElement | null)?.close();
}
function flash(msg: string): void {
  const el = document.getElementById("th-flash");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("opacity-0");
  el.classList.add("opacity-100");
  window.setTimeout(() => {
    el.classList.add("opacity-0");
    el.classList.remove("opacity-100");
  }, 1200);
}
function disposeGroup(group: THREE.Object3D): void {
  group.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
  });
}
function clearGroup(group: THREE.Object3D): void {
  for (let i = group.children.length - 1; i >= 0; i--) {
    const child = group.children[i];
    group.remove(child);
    disposeGroup(child);
  }
}

/** A single enclosed room inset 1 ft from the lot edge, with a door and a window. */
function seedStarterRoom(store: HouseStore): void {
  const s = store.get();
  const w = Math.max(6, s.cols - 2);
  const d = Math.max(8, s.rows - 2);
  const x0 = Math.floor((s.cols - w) / 2);
  const z0 = Math.floor((s.rows - d) / 2);
  store.commit((draft) => {
    for (let i = 0; i < w; i++) {
      draft.walls.push({ x: x0 + i, z: z0, dir: "h", level: 0 });
      draft.walls.push({ x: x0 + i, z: z0 + d, dir: "h", level: 0 });
    }
    for (let j = 0; j < d; j++) {
      draft.walls.push({ x: x0, z: z0 + j, dir: "v", level: 0 });
      draft.walls.push({ x: x0 + w, z: z0 + j, dir: "v", level: 0 });
    }
    draft.openings.push({
      x: x0 + Math.floor(w / 2) - 1,
      z: z0 + d,
      dir: "h",
      level: 0,
      type: "door",
      span: DOOR_SPAN,
    });
    draft.openings.push({ x: x0, z: z0 + 2, dir: "v", level: 0, type: "window", span: WINDOW_SPAN });
    draft.openings.push({
      x: x0 + w,
      z: z0 + d - 5,
      dir: "v",
      level: 0,
      type: "window",
      span: WINDOW_SPAN,
    });
    for (let cz = z0; cz < z0 + d; cz++) {
      for (let cx = x0; cx < x0 + w; cx++) draft.floors.push({ cx, cz, level: 0 });
    }
  });
}
