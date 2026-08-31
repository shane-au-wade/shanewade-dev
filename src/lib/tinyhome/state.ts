// Serializable house model + undo/redo store for the Tiny Home Builder.
// Everything here is plain JSON so state can be saved to localStorage, cloned
// for undo history, and shipped to a future grading endpoint unchanged.
//
// Grid: one cell = 1 ft, so lot dimensions and square footage are exact.
// Walls live on 1 ft grid edges; doors/windows span several edges.

export const CELL_FEET = 1;
export const WALL_HEIGHT = 8; // ft of wall per story
export const LEVEL_HEIGHT = WALL_HEIGHT; // exact 8 ft per story (2 stories = 16 ft)
export const FLOOR_THICKNESS = 0.4; // slab hangs below the level base
export const WALL_THICKNESS = 0.5;
export const MAX_LEVELS = 9; // number keys 1-9 map directly to stories
export const STATE_VERSION = 2;

export const DOOR_SPAN = 3; // ft of wall a door occupies
export const WINDOW_SPAN = 3;

export const TINY_HOME_MAX_SQFT = 400;
export const SMALL_HOME_MAX_SQFT = 1000;

export type RoofStyle = "none" | "flat" | "gable";
export type WallDir = "h" | "v"; // h: edge from node toward +x, v: toward +z
export type OpeningType = "door" | "window";

/** A 1 ft wall segment on a grid edge, on a given story (0 = ground). */
export interface WallSeg {
  x: number;
  z: number;
  dir: WallDir;
  level: number;
}

/** An opening anchored at its first wall edge, spanning `span` edges along the run. */
export interface Opening {
  x: number;
  z: number;
  dir: WallDir;
  level: number;
  type: OpeningType;
  span: number;
}

/** One square foot of finished floor. Omitting cells creates open-to-below voids. */
export interface FloorCell {
  cx: number;
  cz: number;
  level: number;
}

export interface FurnitureInst {
  uid: string;
  itemId: string;
  cx: number;
  cz: number;
  level: number;
  rot: number; // quarter turns, 0..3
}

export interface HouseState {
  v: number;
  cols: number; // lot width in ft
  rows: number; // lot depth in ft
  levels: number; // stories, 1..MAX_LEVELS
  walls: WallSeg[];
  openings: Opening[];
  floors: FloorCell[];
  furniture: FurnitureInst[];
  floorColor: string;
  wallColor: string;
  roofColor: string;
  roof: RoofStyle;
}

export interface LotPreset {
  id: string;
  label: string;
  cols: number;
  rows: number;
}

export const LOT_PRESETS: LotPreset[] = [
  { id: "micro", label: "Micro", cols: 8, rows: 12 },
  { id: "small", label: "Small", cols: 10, rows: 16 },
  { id: "medium", label: "Medium", cols: 12, rows: 20 },
  { id: "large", label: "Large", cols: 16, rows: 24 },
  { id: "xl", label: "XL", cols: 24, rows: 40 },
];

export const MIN_LOT = 6;
export const MAX_COLS = 48;
export const MAX_ROWS = 64;

/** "Ground", "2nd", "3rd", ... — story 0 is at grade. */
export function levelName(level: number): string {
  if (level === 0) return "Ground";
  const n = level + 1;
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix}`;
}

export function lotSqft(cols: number, rows: number): number {
  return cols * rows;
}

export function wallKey(w: { x: number; z: number; dir: WallDir; level: number }): string {
  return `${w.x},${w.z},${w.dir},${w.level ?? 0}`;
}

export function floorKey(c: { cx: number; cz: number; level: number }): string {
  return `${c.cx},${c.cz},${c.level}`;
}

export function levelBaseY(level: number): number {
  return level * LEVEL_HEIGHT;
}

export function openingSpanFor(type: OpeningType): number {
  return type === "door" ? DOOR_SPAN : WINDOW_SPAN;
}

/** The nth wall edge along an opening's run. */
export function segAlong(base: { x: number; z: number; dir: WallDir; level: number }, k: number): WallSeg {
  return {
    x: base.dir === "h" ? base.x + k : base.x,
    z: base.dir === "v" ? base.z + k : base.z,
    dir: base.dir,
    level: base.level,
  };
}

export function defaultState(cols = 12, rows = 20, levels = 1): HouseState {
  return {
    v: STATE_VERSION,
    cols,
    rows,
    levels: Math.max(1, Math.min(MAX_LEVELS, levels)),
    walls: [],
    openings: [],
    floors: [],
    furniture: [],
    floorColor: "#c8a97e",
    wallColor: "#e8e2d5",
    roofColor: "#8a5a44",
    roof: "gable",
  };
}

const STORAGE_KEY = "tinyhome:autosave";
const NAMED_KEY = "tinyhome:saves";

export interface NamedSave {
  name: string;
  savedAt: number;
  state: HouseState;
}

type Listener = (state: HouseState) => void;

/**
 * Central store. Every mutation goes through `commit`, which snapshots the
 * previous state onto the undo stack, applies the change, autosaves, and
 * notifies listeners so the scene rebuilds and the HUD updates.
 */
export class HouseStore {
  private state: HouseState;
  private undoStack: HouseState[] = [];
  private redoStack: HouseState[] = [];
  private listeners = new Set<Listener>();
  private readonly maxHistory = 100;

  constructor(initial?: HouseState) {
    this.state = initial ?? HouseStore.loadAutosave() ?? defaultState();
  }

  get(): HouseState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private clone(s: HouseState): HouseState {
    return structuredClone(s);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }

  commit(mutator: (draft: HouseState) => void): void {
    const draft = this.clone(this.state);
    mutator(draft);
    this.undoStack.push(this.state);
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.redoStack = [];
    this.state = draft;
    this.autosave();
    this.emit();
  }

  replace(next: HouseState, recordHistory = true): void {
    if (recordHistory) {
      this.undoStack.push(this.state);
      this.redoStack = [];
    }
    this.state = this.clone(next);
    this.autosave();
    this.emit();
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.state);
    this.state = prev;
    this.autosave();
    this.emit();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.state);
    this.state = next;
    this.autosave();
    this.emit();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // ── Persistence ─────────────────────────────────────────────────────────
  private autosave(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* storage full or unavailable — non-fatal */
    }
  }

  static loadAutosave(): HouseState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return sanitize(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  static listSaves(): NamedSave[] {
    try {
      const raw = localStorage.getItem(NAMED_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw) as NamedSave[];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  saveAs(name: string): void {
    const saves = HouseStore.listSaves().filter((s) => s.name !== name);
    saves.push({ name, savedAt: Date.now(), state: this.clone(this.state) });
    saves.sort((a, b) => b.savedAt - a.savedAt);
    localStorage.setItem(NAMED_KEY, JSON.stringify(saves));
  }

  static deleteSave(name: string): void {
    const saves = HouseStore.listSaves().filter((s) => s.name !== name);
    localStorage.setItem(NAMED_KEY, JSON.stringify(saves));
  }
}

// ── Sanitize + migration ─────────────────────────────────────────────────────

/**
 * v1 used a 3 ft grid with one opening per wall segment. Rescale to the 1 ft
 * grid: each old segment becomes three, and each opening becomes a 3 ft span.
 */
function migrateV1(o: Record<string, unknown>): Record<string, unknown> {
  const S = 3;
  const oldWalls = (Array.isArray(o.walls) ? o.walls : []) as WallSeg[];
  const walls: WallSeg[] = [];
  for (const w of oldWalls) {
    const level = w.level ?? 0;
    for (let k = 0; k < S; k++) {
      walls.push({
        x: w.x * S + (w.dir === "h" ? k : 0),
        z: w.z * S + (w.dir === "v" ? k : 0),
        dir: w.dir,
        level,
      });
    }
  }
  const oldOpenings = (Array.isArray(o.openings) ? o.openings : []) as Opening[];
  const openings: Opening[] = oldOpenings.map((op) => ({
    x: op.x * S,
    z: op.z * S,
    dir: op.dir,
    level: op.level ?? 0,
    type: op.type,
    span: S,
  }));
  const oldFurn = (Array.isArray(o.furniture) ? o.furniture : []) as FurnitureInst[];
  const furniture: FurnitureInst[] = oldFurn.map((f) => ({
    ...f,
    cx: f.cx * S + 1,
    cz: f.cz * S + 1,
    level: f.level ?? 0,
  }));
  return {
    ...o,
    cols: ((o.cols as number) ?? 4) * S,
    rows: ((o.rows as number) ?? 5) * S,
    walls,
    openings,
    furniture,
    floors: [],
  };
}

export function sanitize(input: unknown): HouseState {
  const d = defaultState();
  if (!input || typeof input !== "object") return d;
  let o = input as Record<string, unknown>;
  if (((o.v as number) ?? 1) < 2) o = migrateV1(o);
  const p = o as unknown as Partial<HouseState>;

  const state: HouseState = {
    v: STATE_VERSION,
    cols: clampInt(p.cols, MIN_LOT, MAX_COLS, d.cols),
    rows: clampInt(p.rows, MIN_LOT, MAX_ROWS, d.rows),
    levels: clampInt(p.levels, 1, MAX_LEVELS, d.levels),
    walls: Array.isArray(p.walls) ? p.walls.filter(isWall).map(withLevel) : [],
    openings: Array.isArray(p.openings) ? p.openings.filter(isOpening).map(normalizeOpening) : [],
    floors: Array.isArray(p.floors) ? p.floors.filter(isFloorCell).map(withLevel) : [],
    furniture: Array.isArray(p.furniture) ? p.furniture.filter(isFurniture).map(withLevel) : [],
    floorColor: typeof p.floorColor === "string" ? p.floorColor : d.floorColor,
    wallColor: typeof p.wallColor === "string" ? p.wallColor : d.wallColor,
    roofColor: typeof p.roofColor === "string" ? p.roofColor : d.roofColor,
    roof: p.roof === "flat" || p.roof === "none" || p.roof === "gable" ? p.roof : d.roof,
  };

  // Builds from before explicit floors get a floor derived from their walls.
  if (state.floors.length === 0 && state.walls.length > 0) {
    state.floors = deriveFloors(state);
  }
  return state;
}

function withLevel<T extends { level?: number }>(item: T): T {
  return { ...item, level: typeof item.level === "number" ? item.level : 0 };
}

function normalizeOpening(o: Opening): Opening {
  const span = typeof o.span === "number" && o.span >= 1 ? Math.round(o.span) : openingSpanFor(o.type);
  return { ...o, level: o.level ?? 0, span };
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function isWall(w: unknown): w is WallSeg {
  const x = w as WallSeg;
  return !!x && typeof x.x === "number" && typeof x.z === "number" && (x.dir === "h" || x.dir === "v");
}

function isOpening(o: unknown): o is Opening {
  const x = o as Opening;
  return isWall(x) && (x.type === "door" || x.type === "window");
}

function isFloorCell(c: unknown): c is FloorCell {
  const x = c as FloorCell;
  return !!x && typeof x.cx === "number" && typeof x.cz === "number";
}

function isFurniture(f: unknown): f is FurnitureInst {
  const x = f as FurnitureInst;
  return (
    !!x &&
    typeof x.itemId === "string" &&
    typeof x.cx === "number" &&
    typeof x.cz === "number" &&
    typeof x.rot === "number"
  );
}

// ── Geometry queries ─────────────────────────────────────────────────────────

/**
 * Cells enclosed by walls on a story, via flood fill from the lot border: any
 * cell that reaches the edge without crossing a wall is outside.
 */
export function interiorCells(s: HouseState, level: number): Array<{ cx: number; cz: number }> {
  const { cols, rows } = s;
  const wallSet = new Set(s.walls.filter((w) => w.level === level).map(wallKey));
  const has = (x: number, z: number, dir: WallDir) => wallSet.has(`${x},${z},${dir},${level}`);

  const outside = new Uint8Array(cols * rows);
  const idx = (cx: number, cz: number) => cz * cols + cx;
  const queue: Array<[number, number]> = [];
  const seed = (cx: number, cz: number) => {
    if (!outside[idx(cx, cz)]) {
      outside[idx(cx, cz)] = 1;
      queue.push([cx, cz]);
    }
  };

  // The area beyond the lot is the flood source, so a border cell only counts as
  // outside when the lot-boundary edge beside it carries no wall. Without this a
  // house built right up to the lot line would read as enclosing nothing.
  for (let cx = 0; cx < cols; cx++) {
    if (!has(cx, 0, "h")) seed(cx, 0);
    if (!has(cx, rows, "h")) seed(cx, rows - 1);
  }
  for (let cz = 0; cz < rows; cz++) {
    if (!has(0, cz, "v")) seed(0, cz);
    if (!has(cols, cz, "v")) seed(cols - 1, cz);
  }

  while (queue.length) {
    const [cx, cz] = queue.pop()!;
    if (cz > 0 && !has(cx, cz, "h") && !outside[idx(cx, cz - 1)]) seed(cx, cz - 1);
    if (cz < rows - 1 && !has(cx, cz + 1, "h") && !outside[idx(cx, cz + 1)]) seed(cx, cz + 1);
    if (cx > 0 && !has(cx, cz, "v") && !outside[idx(cx - 1, cz)]) seed(cx - 1, cz);
    if (cx < cols - 1 && !has(cx + 1, cz, "v") && !outside[idx(cx + 1, cz)]) seed(cx + 1, cz);
  }

  const cells: Array<{ cx: number; cz: number }> = [];
  for (let cz = 0; cz < rows; cz++) {
    for (let cx = 0; cx < cols; cx++) {
      if (!outside[idx(cx, cz)]) cells.push({ cx, cz });
    }
  }
  return cells;
}

/** Floor cells covering the enclosed area of each story (upper stories fall back to the one below). */
export function deriveFloors(s: HouseState): FloorCell[] {
  const out: FloorCell[] = [];
  for (let level = 0; level < s.levels; level++) {
    let cells = interiorCells(s, level);
    if (cells.length === 0 && level > 0) cells = interiorCells(s, level - 1);
    for (const c of cells) out.push({ cx: c.cx, cz: c.cz, level });
  }
  return out;
}

/** Floor cells for one story, from that story's walls or the one below. */
export function deriveFloorForLevel(s: HouseState, level: number): FloorCell[] {
  let cells = interiorCells(s, level);
  if (cells.length === 0 && level > 0) cells = interiorCells(s, level - 1);
  return cells.map((c) => ({ cx: c.cx, cz: c.cz, level }));
}

// ── Derived metrics ────────────────────────────────────────────────────────

export type HomeCategory = "none" | "tiny" | "small" | "full";

export interface HouseMetrics {
  floorSqft: number; // finished floor area (voids excluded)
  enclosedSqft: number; // area enclosed by walls
  perLevelFloorSqft: number[];
  lotSqft: number;
  wallCount: number;
  doorCount: number;
  windowCount: number;
  furnitureCount: number;
  category: HomeCategory;
}

export function computeMetrics(s: HouseState): HouseMetrics {
  const perLevelFloorSqft: number[] = [];
  let enclosedSqft = 0;
  for (let level = 0; level < s.levels; level++) {
    perLevelFloorSqft.push(s.floors.filter((f) => f.level === level).length);
    enclosedSqft += interiorCells(s, level).length;
  }
  const floorSqft = perLevelFloorSqft.reduce((a, b) => a + b, 0);
  return {
    floorSqft,
    enclosedSqft,
    perLevelFloorSqft,
    lotSqft: lotSqft(s.cols, s.rows),
    wallCount: s.walls.length,
    doorCount: s.openings.filter((o) => o.type === "door").length,
    windowCount: s.openings.filter((o) => o.type === "window").length,
    furnitureCount: s.furniture.length,
    category: categorize(floorSqft),
  };
}

function categorize(sqft: number): HomeCategory {
  if (sqft <= 0) return "none";
  if (sqft <= TINY_HOME_MAX_SQFT) return "tiny";
  if (sqft <= SMALL_HOME_MAX_SQFT) return "small";
  return "full";
}

export function exportJSON(s: HouseState): string {
  return JSON.stringify(s, null, 2);
}

let uidCounter = 0;
export function makeUid(): string {
  uidCounter += 1;
  return `f${Date.now().toString(36)}${uidCounter.toString(36)}`;
}
