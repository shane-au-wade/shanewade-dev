// Rebuilds the entire house Group from serializable state. Called on every
// commit.
//
// On a 1 ft grid a house is thousands of cells, so geometry is merged rather
// than emitted per cell: contiguous collinear wall segments coalesce into runs,
// floor cells coalesce into row strips, and each level ends up with a handful of
// draw calls. Doors and windows stay as individual groups (there are only ever a
// few) so they remain pickable, and wall picking resolves a segment from the hit
// point against the merged mesh.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  FLOOR_THICKNESS,
  WALL_HEIGHT,
  WALL_THICKNESS,
  interiorCells,
  levelBaseY,
  segAlong,
  wallKey,
  type HouseState,
  type Opening,
  type OpeningType,
  type WallDir,
  type WallSeg,
} from "./state";
import { CATALOG_BY_ID } from "./catalog";
import { cellCenterZ, footprintCenter, nodeWorldX, nodeWorldZ } from "./coords";

const DOOR_HEIGHT = 6.9;
const WINDOW_SILL = 3.0;
const WINDOW_TOP = 6.4;
const REVEAL = 0.15; // jamb width on each side of an opening

export interface BuiltScene {
  group: THREE.Group;
  wallMeshes: THREE.Object3D[]; // one merged mesh per level
  floorMeshes: THREE.Object3D[];
  openingGroups: THREE.Object3D[];
  furnitureGroups: THREE.Object3D[];
  roofGroup: THREE.Object3D | null;
  selectables: THREE.Object3D[];
}

export interface BuildOpts {
  wallRenderHeight?: number; // cutaway height, applied to the focus level
  focusLevel?: number; // when set, levels above are hidden
  showRoof?: boolean;
  ghost?: boolean;
}

// ── Material helpers ─────────────────────────────────────────────────────────
function lambert(color: THREE.ColorRepresentation, opacity?: number): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color });
  if (opacity !== undefined) {
    m.transparent = true;
    m.opacity = opacity;
  }
  return m;
}

function shade(hex: string, factor: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(factor);
  return `#${c.getHexString()}`;
}

function makeBox(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  cast = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A box positioned in run-local terms: `along` is the world coordinate on the
 * run's axis, `cross` the coordinate perpendicular to it.
 */
function alongGeo(
  dir: WallDir,
  along: number,
  cross: number,
  width: number,
  height: number,
  yc: number,
  thick: number,
): THREE.BufferGeometry | null {
  if (width <= 0.001 || height <= 0.001) return null;
  const geo =
    dir === "h" ? new THREE.BoxGeometry(width, height, thick) : new THREE.BoxGeometry(thick, height, width);
  if (dir === "h") geo.translate(along, yc, cross);
  else geo.translate(cross, yc, along);
  return geo;
}

function mergeBucket(
  geos: THREE.BufferGeometry[],
  material: THREE.Material,
  cast = true,
): THREE.Mesh | null {
  if (geos.length === 0) return null;
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged) return null;
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildHouse(s: HouseState, opts: BuildOpts = {}): BuiltScene {
  const group = new THREE.Group();
  const wallMeshes: THREE.Object3D[] = [];
  const floorMeshes: THREE.Object3D[] = [];
  const openingGroups: THREE.Object3D[] = [];
  const furnitureGroups: THREE.Object3D[] = [];
  const selectables: THREE.Object3D[] = [];
  const ghost = !!opts.ghost;
  const focus = opts.focusLevel;

  const mats = {
    wall: lambert(s.wallColor, ghost ? 0.4 : undefined),
    trim: lambert(shade(s.wallColor, 0.82), ghost ? 0.4 : undefined),
    base: lambert(shade(s.wallColor, 0.7), ghost ? 0.4 : undefined),
    door: lambert("#7a4a2b", ghost ? 0.4 : undefined),
    doorPanel: lambert("#8a5735", ghost ? 0.4 : undefined),
    handle: lambert("#c9b47a"),
    glass: new THREE.MeshLambertMaterial({
      color: "#bfe0ef",
      transparent: true,
      opacity: ghost ? 0.2 : 0.45,
    }),
    floor: lambert(s.floorColor, ghost ? 0.5 : undefined),
    floorEdge: lambert(shade(s.floorColor, 0.7), ghost ? 0.5 : undefined),
    roof: lambert(s.roofColor, ghost ? 0.5 : undefined),
    roofRidge: lambert(shade(s.roofColor, 0.75), ghost ? 0.5 : undefined),
  };

  const topBuilt = topBuiltLevel(s);

  for (let level = 0; level < s.levels; level++) {
    const baseY = levelBaseY(level);
    const hidden = focus !== undefined && level > focus;
    const cutaway = opts.wallRenderHeight;
    const isCut = cutaway !== undefined && (focus === undefined || focus === level);
    const wallH = isCut ? cutaway! : WALL_HEIGHT;

    // ── Floor: row strips merged into one mesh ──────────────────────────────
    const floor = buildFloor(s, level, baseY, mats, ghost);
    if (floor) {
      floor.userData = { kind: "floor", level };
      floor.visible = !hidden;
      floorMeshes.push(floor);
      group.add(floor);
    }

    // ── Walls: coalesced runs merged per material ──────────────────────────
    const wallMesh = buildWalls(s, level, baseY, wallH, isCut, mats);
    if (wallMesh) {
      wallMesh.userData = { kind: "wallMesh", level };
      wallMesh.visible = !hidden;
      if (ghost) applyGhost(wallMesh);
      wallMeshes.push(wallMesh);
      selectables.push(wallMesh);
      group.add(wallMesh);
    }

    // ── Openings: individual pickable groups (skipped on a cut level) ──────
    if (!isCut) {
      for (const o of s.openings) {
        if (o.level !== level) continue;
        const g = buildOpening(o, s, mats);
        g.position.y = baseY;
        g.userData = { kind: "opening", key: wallKey(o) };
        g.visible = !hidden;
        if (ghost) applyGhost(g);
        openingGroups.push(g);
        selectables.push(g);
        group.add(g);
      }
    }

    // ── Furniture ──────────────────────────────────────────────────────────
    for (const f of s.furniture) {
      if (f.level !== level) continue;
      const item = CATALOG_BY_ID.get(f.itemId);
      if (!item) continue;
      const inst = item.build();
      const c = footprintCenter(f.cx, f.cz, item.fw, item.fd, f.rot, s);
      inst.position.set(c.x, baseY, c.z);
      inst.rotation.y = (f.rot * Math.PI) / 2;
      inst.userData = { kind: "furniture", uid: f.uid };
      inst.visible = !hidden;
      if (ghost) applyGhost(inst);
      furnitureGroups.push(inst);
      selectables.push(inst);
      group.add(inst);
    }
  }

  // ── Roof on top of the highest built story ────────────────────────────────
  let roofGroup: THREE.Object3D | null = null;
  const roofVisible =
    s.roof !== "none" &&
    opts.showRoof !== false &&
    topBuilt >= 0 &&
    (focus === undefined || focus === topBuilt);
  if (roofVisible) {
    roofGroup = buildRoof(s, topBuilt, mats, ghost);
    if (roofGroup) {
      roofGroup.userData = { kind: "roof" };
      selectables.push(roofGroup);
      group.add(roofGroup);
    }
  }

  return { group, wallMeshes, floorMeshes, openingGroups, furnitureGroups, roofGroup, selectables };
}

function applyGhost(obj: THREE.Object3D): void {
  obj.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      const mat = (m.material as THREE.MeshLambertMaterial).clone();
      mat.transparent = true;
      mat.opacity = 0.5;
      m.material = mat;
      m.castShadow = false;
    }
  });
}

// ── Floors ───────────────────────────────────────────────────────────────────
interface Strip {
  cx0: number;
  cx1: number;
  cz: number;
}

/** Contiguous horizontal runs over a `cx,cz` cell set, so a filled area is a few boxes. */
function stripsFromCells(present: Set<string>, cols: number, rows: number): Strip[] {
  if (present.size === 0) return [];
  const strips: Strip[] = [];
  for (let cz = 0; cz < rows; cz++) {
    let run = -1;
    for (let cx = 0; cx <= cols; cx++) {
      const has = cx < cols && present.has(`${cx},${cz}`);
      if (has && run < 0) run = cx;
      else if (!has && run >= 0) {
        strips.push({ cx0: run, cx1: cx - 1, cz });
        run = -1;
      }
    }
  }
  return strips;
}

function levelFloorCells(s: HouseState, level: number): Set<string> {
  const present = new Set<string>();
  for (const f of s.floors) {
    if (f.level === level) present.add(`${f.cx},${f.cz}`);
  }
  return present;
}

function floorStrips(s: HouseState, level: number): Strip[] {
  return stripsFromCells(levelFloorCells(s, level), s.cols, s.rows);
}

function buildFloor(
  s: HouseState,
  level: number,
  baseY: number,
  mats: { floor: THREE.Material; floorEdge: THREE.Material },
  ghost: boolean,
): THREE.Group | null {
  const strips = floorStrips(s, level);
  if (strips.length === 0) return null;

  const slabs: THREE.BufferGeometry[] = [];
  const under: THREE.BufferGeometry[] = [];
  for (const st of strips) {
    const width = st.cx1 - st.cx0 + 1;
    const x = (st.cx0 + st.cx1 + 1) / 2 - s.cols / 2;
    const z = cellCenterZ(st.cz, s.rows);
    const slab = new THREE.BoxGeometry(width, FLOOR_THICKNESS, 1);
    slab.translate(x, baseY - FLOOR_THICKNESS / 2, z);
    slabs.push(slab);
    // Only the ground floor gets a course below it; on upper floors that would
    // hang into the room below as a soffit.
    if (level === 0) {
      const band = new THREE.BoxGeometry(width + 0.5, 0.7, 1.5);
      band.translate(x, baseY - FLOOR_THICKNESS - 0.35, z);
      under.push(band);
    }
  }

  const g = new THREE.Group();
  const slabMesh = mergeBucket(slabs, mats.floor, false);
  if (slabMesh) g.add(slabMesh);
  const bandMesh = mergeBucket(under, mats.floorEdge, false);
  if (bandMesh) g.add(bandMesh);
  if (ghost) applyGhost(g);
  return g.children.length ? g : null;
}

// ── Walls ────────────────────────────────────────────────────────────────────
interface WallMats {
  wall: THREE.Material;
  trim: THREE.Material;
  base: THREE.Material;
  door: THREE.Material;
  doorPanel: THREE.Material;
  handle: THREE.Material;
  glass: THREE.Material;
}

type Profile = "full" | "door" | "window";

/** Along/cross indices for a segment, so 'h' and 'v' runs share one code path. */
function alongIndex(w: WallSeg): number {
  return w.dir === "h" ? w.x : w.z;
}
function crossIndex(w: WallSeg): number {
  return w.dir === "h" ? w.z : w.x;
}

/**
 * Merged wall geometry for one story. Segments are grouped into collinear runs
 * and split only where there is a gap or a change of profile (plain wall vs the
 * remnants left above a door or around a window).
 */
function buildWalls(
  s: HouseState,
  level: number,
  baseY: number,
  wallH: number,
  isCut: boolean,
  mats: WallMats,
): THREE.Group | null {
  const walls = s.walls.filter((w) => w.level === level);
  if (walls.length === 0) return null;

  // Which segments are covered by an opening, and by what kind.
  const profileByKey = new Map<string, Profile>();
  if (!isCut) {
    const present = new Set(walls.map(wallKey));
    for (const o of s.openings) {
      if (o.level !== level) continue;
      for (let k = 0; k < o.span; k++) {
        const seg = segAlong(o, k);
        const key = wallKey(seg);
        if (present.has(key)) profileByKey.set(key, o.type);
      }
    }
  }

  // Group into collinear lines, then into contiguous same-profile runs.
  const lines = new Map<string, WallSeg[]>();
  for (const w of walls) {
    const key = `${w.dir}:${crossIndex(w)}`;
    const arr = lines.get(key);
    if (arr) arr.push(w);
    else lines.set(key, [w]);
  }

  const body: THREE.BufferGeometry[] = [];
  const base: THREE.BufferGeometry[] = [];
  const trim: THREE.BufferGeometry[] = [];
  const full = wallH >= WALL_HEIGHT - 0.01;

  for (const arr of lines.values()) {
    arr.sort((a, b) => alongIndex(a) - alongIndex(b));
    const dir = arr[0].dir;
    const cross = dir === "h" ? nodeWorldZ(arr[0].z, s.rows) : nodeWorldX(arr[0].x, s.cols);

    let i = 0;
    while (i < arr.length) {
      const profile = profileByKey.get(wallKey(arr[i])) ?? "full";
      const start = alongIndex(arr[i]);
      let end = start; // inclusive
      let j = i + 1;
      while (
        j < arr.length &&
        alongIndex(arr[j]) === end + 1 &&
        (profileByKey.get(wallKey(arr[j])) ?? "full") === profile
      ) {
        end = alongIndex(arr[j]);
        j++;
      }
      const width = end - start + 1;
      const a0 = dir === "h" ? nodeWorldX(start, s.cols) : nodeWorldZ(start, s.rows);
      const along = a0 + width / 2;

      const push = (
        bucket: THREE.BufferGeometry[],
        w: number,
        h: number,
        yc: number,
        thick: number,
        alongC = along,
      ) => {
        const geo = alongGeo(dir, alongC, cross, w, h, yc, thick);
        if (geo) bucket.push(geo);
      };

      if (profile === "full") {
        push(body, width, wallH, wallH / 2, WALL_THICKNESS);
        push(base, width, 0.6, 0.3, WALL_THICKNESS + 0.08);
        if (full) push(trim, width, 0.4, wallH - 0.2, WALL_THICKNESS + 0.06);
      } else if (profile === "door") {
        const headerH = wallH - DOOR_HEIGHT;
        push(body, width, headerH, DOOR_HEIGHT + headerH / 2, WALL_THICKNESS);
        if (full) push(trim, width, 0.4, wallH - 0.2, WALL_THICKNESS + 0.06);
      } else {
        push(body, width, WINDOW_SILL, WINDOW_SILL / 2, WALL_THICKNESS);
        push(base, width, 0.6, 0.3, WALL_THICKNESS + 0.08);
        const headerH = wallH - WINDOW_TOP;
        push(body, width, headerH, WINDOW_TOP + headerH / 2, WALL_THICKNESS);
        if (full) push(trim, width, 0.4, wallH - 0.2, WALL_THICKNESS + 0.06);
      }
      i = j;
    }
  }

  const g = new THREE.Group();
  for (const [bucket, material] of [
    [body, mats.wall],
    [base, mats.base],
    [trim, mats.trim],
  ] as const) {
    const mesh = mergeBucket(bucket as THREE.BufferGeometry[], material as THREE.Material);
    if (mesh) g.add(mesh);
  }
  g.position.y = baseY;
  return g.children.length ? g : null;
}

// ── Openings ─────────────────────────────────────────────────────────────────
/** Frame, leaf/glass and hardware for one opening, in world XZ at level y=0. */
function buildOpening(o: Opening, s: HouseState, mats: WallMats): THREE.Group {
  const g = new THREE.Group();
  const T = WALL_THICKNESS;
  const dir = o.dir;
  const span = o.span;
  const a0 = dir === "h" ? nodeWorldX(o.x, s.cols) : nodeWorldZ(o.z, s.rows);
  const along = a0 + span / 2;
  const cross = dir === "h" ? nodeWorldZ(o.z, s.rows) : nodeWorldX(o.x, s.cols);

  const add = (
    material: THREE.Material,
    width: number,
    h: number,
    yc: number,
    thick: number,
    offset = 0,
  ) => {
    const geo = alongGeo(dir, along + offset, cross, width, h, yc, thick);
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  };

  const clear = span - REVEAL * 2; // width between the jambs

  if (o.type === "door") {
    // Jambs + lintel.
    add(mats.trim, REVEAL, DOOR_HEIGHT, DOOR_HEIGHT / 2, T + 0.12, -(span - REVEAL) / 2);
    add(mats.trim, REVEAL, DOOR_HEIGHT, DOOR_HEIGHT / 2, T + 0.12, (span - REVEAL) / 2);
    add(mats.trim, span, 0.24, DOOR_HEIGHT - 0.12, T + 0.12);
    // Leaf with two recessed panels.
    add(mats.door, clear, DOOR_HEIGHT - 0.2, (DOOR_HEIGHT - 0.2) / 2, T + 0.16);
    add(mats.doorPanel, clear - 0.6, DOOR_HEIGHT * 0.3, DOOR_HEIGHT * 0.3, T + 0.22);
    add(mats.doorPanel, clear - 0.6, DOOR_HEIGHT * 0.2, DOOR_HEIGHT * 0.72, T + 0.22);
    // Handle.
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), mats.handle);
    const hAlong = along + clear / 2 - 0.35;
    const hCross = cross + (T + 0.3) / 2;
    if (dir === "h") handle.position.set(hAlong, DOOR_HEIGHT * 0.45, hCross);
    else handle.position.set(hCross, DOOR_HEIGHT * 0.45, hAlong);
    g.add(handle);
  } else {
    const glassH = WINDOW_TOP - WINDOW_SILL;
    const midGlass = WINDOW_SILL + glassH / 2;
    add(mats.glass, clear, glassH, midGlass, T * 0.4);
    // Sill, jambs, head.
    add(mats.trim, span + 0.2, 0.2, WINDOW_SILL, T + 0.2);
    add(mats.trim, REVEAL, glassH, midGlass, T + 0.14, -(span - REVEAL) / 2);
    add(mats.trim, REVEAL, glassH, midGlass, T + 0.14, (span - REVEAL) / 2);
    add(mats.trim, span, 0.2, WINDOW_TOP - 0.1, T + 0.14);
    // Mullion cross.
    add(mats.trim, 0.12, glassH, midGlass, T + 0.16);
    add(mats.trim, clear, 0.12, midGlass, T + 0.16);
  }
  return g;
}

// ── Roof ─────────────────────────────────────────────────────────────────────
interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function topBuiltLevel(s: HouseState): number {
  let top = -1;
  for (const w of s.walls) if (w.level > top) top = w.level;
  return top;
}

function wallBoundsForLevel(s: HouseState, level: number): Bounds | null {
  const walls = s.walls.filter((w) => w.level === level);
  if (walls.length === 0) return null;
  let minNx = Infinity,
    maxNx = -Infinity,
    minNz = Infinity,
    maxNz = -Infinity;
  for (const w of walls) {
    const x2 = w.dir === "h" ? w.x + 1 : w.x;
    const z2 = w.dir === "v" ? w.z + 1 : w.z;
    minNx = Math.min(minNx, w.x, x2);
    maxNx = Math.max(maxNx, w.x, x2);
    minNz = Math.min(minNz, w.z, z2);
    maxNz = Math.max(maxNz, w.z, z2);
  }
  return {
    minX: nodeWorldX(minNx, s.cols),
    maxX: nodeWorldX(maxNx, s.cols),
    minZ: nodeWorldZ(minNz, s.rows),
    maxZ: nodeWorldZ(maxNz, s.rows),
  };
}

function buildRoof(
  s: HouseState,
  topLevel: number,
  mats: { wall: THREE.Material; roof: THREE.Material; roofRidge: THREE.Material },
  ghost: boolean,
): THREE.Group | null {
  const b = wallBoundsForLevel(s, topLevel);
  if (!b) return null;
  const ov = 1.0;
  const baseY = levelBaseY(topLevel) + WALL_HEIGHT;
  const w = b.maxX - b.minX + ov * 2;
  const d = b.maxZ - b.minZ + ov * 2;
  if (w <= 0 || d <= 0) return null;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const g = new THREE.Group();

  if (s.roof === "flat") {
    g.add(makeBox(w, 0.3, d, mats.roof, cx, baseY + 0.15, cz));
    const p = 0.4;
    g.add(makeBox(w, p, 0.2, mats.roofRidge, cx, baseY + 0.3 + p / 2, cz - d / 2));
    g.add(makeBox(w, p, 0.2, mats.roofRidge, cx, baseY + 0.3 + p / 2, cz + d / 2));
    g.add(makeBox(0.2, p, d, mats.roofRidge, cx - w / 2, baseY + 0.3 + p / 2, cz));
    g.add(makeBox(0.2, p, d, mats.roofRidge, cx + w / 2, baseY + 0.3 + p / 2, cz));
    if (ghost) applyGhost(g);
    return g;
  }

  // Gable: ridge runs along the longer axis, pitch scaled to the span.
  const ridgeAlongX = w >= d;
  const halfSpan = (ridgeAlongX ? d : w) / 2;
  const rh = Math.max(2.5, Math.min(6, halfSpan * 0.55));
  const slope = Math.sqrt(halfSpan * halfSpan + rh * rh);
  const angle = Math.atan2(rh, halfSpan);

  for (const sign of [-1, 1]) {
    let plane: THREE.Mesh;
    if (ridgeAlongX) {
      plane = makeBox(w, 0.3, slope, mats.roof, cx, baseY + rh / 2, cz + (sign * halfSpan) / 2);
      plane.rotation.x = sign * angle;
    } else {
      plane = makeBox(slope, 0.3, d, mats.roof, cx + (sign * halfSpan) / 2, baseY + rh / 2, cz);
      plane.rotation.z = -sign * angle;
    }
    g.add(plane);
  }

  // Triangular gable end walls (siding) rather than boxes.
  const span = ridgeAlongX ? d : w;
  for (const sign of [-1, 1]) {
    const tri = buildGableEnd(span, rh, WALL_THICKNESS, mats.wall);
    if (ridgeAlongX) {
      tri.rotation.y = Math.PI / 2;
      tri.position.set(cx + (sign * (w - ov * 2)) / 2, baseY, cz);
    } else {
      tri.position.set(cx, baseY, cz + (sign * (d - ov * 2)) / 2);
    }
    g.add(tri);
  }

  if (ridgeAlongX) g.add(makeBox(w, 0.35, 0.35, mats.roofRidge, cx, baseY + rh, cz));
  else g.add(makeBox(0.35, 0.35, d, mats.roofRidge, cx, baseY + rh, cz));

  if (ghost) applyGhost(g);
  return g;
}

function buildGableEnd(spanWidth: number, rh: number, thickness: number, mat: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-spanWidth / 2, 0);
  shape.lineTo(spanWidth / 2, 0);
  shape.lineTo(0, rh);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geo.translate(0, 0, -thickness / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ── Floor-above overlay ──────────────────────────────────────────────────────
const OVERLAY_COLOR = "#1f9bb3";

/**
 * A guide showing the floor of `level` while you work on the story below it:
 * the boundary of its finished floor (which traces both the outer edge and the
 * edge of every void) drawn at its real height, plus the same outline and a
 * filled void footprint projected down onto `projectY`. That projection is what
 * lets you line a staircase up with the stairwell it has to pass through.
 */
export function buildLevelOverlay(s: HouseState, level: number, projectY: number): THREE.Group | null {
  if (level < 0 || level >= s.levels) return null;
  const present = levelFloorCells(s, level);
  if (present.size === 0) return null;

  const segs: Array<[number, number, number, number]> = [];
  for (const key of present) {
    const [cx, cz] = key.split(",").map(Number);
    const x0 = nodeWorldX(cx, s.cols);
    const x1 = nodeWorldX(cx + 1, s.cols);
    const z0 = nodeWorldZ(cz, s.rows);
    const z1 = nodeWorldZ(cz + 1, s.rows);
    if (!present.has(`${cx},${cz - 1}`)) segs.push([x0, z0, x1, z0]);
    if (!present.has(`${cx},${cz + 1}`)) segs.push([x0, z1, x1, z1]);
    if (!present.has(`${cx - 1},${cz}`)) segs.push([x0, z0, x0, z1]);
    if (!present.has(`${cx + 1},${cz}`)) segs.push([x1, z0, x1, z1]);
  }
  if (segs.length === 0) return null;

  const outlineAt = (y: number, opacity: number) => {
    const pos: number[] = [];
    for (const [x1, z1, x2, z2] of segs) pos.push(x1, y, z1, x2, y, z2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: OVERLAY_COLOR, transparent: true, opacity, depthWrite: false }),
    );
  };

  const g = new THREE.Group();
  const guideY = projectY + 0.06;
  g.add(outlineAt(levelBaseY(level) + 0.02, 0.85));
  g.add(outlineAt(guideY, 0.35));

  // Enclosed but unfloored cells above: the opening a staircase rises through.
  const voids = new Set<string>();
  for (const c of interiorCells(s, level)) {
    const key = `${c.cx},${c.cz}`;
    if (!present.has(key)) voids.add(key);
  }
  const geos: THREE.BufferGeometry[] = [];
  for (const st of stripsFromCells(voids, s.cols, s.rows)) {
    const width = st.cx1 - st.cx0 + 1;
    const plane = new THREE.PlaneGeometry(width, 1);
    plane.rotateX(-Math.PI / 2);
    plane.translate((st.cx0 + st.cx1 + 1) / 2 - s.cols / 2, guideY, cellCenterZ(st.cz, s.rows));
    geos.push(plane);
  }
  if (geos.length) {
    const merged = mergeGeometries(geos, false);
    for (const geo of geos) geo.dispose();
    if (merged) {
      g.add(
        new THREE.Mesh(
          merged,
          new THREE.MeshBasicMaterial({
            color: OVERLAY_COLOR,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        ),
      );
    }
  }
  return g;
}

// ── Picking helpers ──────────────────────────────────────────────────────────

/** Walk up from a raycast hit to the tagged pickable ancestor. */
export function findPickable(obj: THREE.Object3D | null): THREE.Object3D | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.userData && cur.userData.kind) return cur;
    cur = cur.parent;
  }
  return null;
}

/**
 * Walls on a level are one merged mesh, so a hit resolves to the nearest 1 ft
 * segment centre in plan. Segments are 1 ft long, so the nearest centre is
 * always the segment that was actually hit.
 */
export function nearestWallSeg(s: HouseState, level: number, point: THREE.Vector3): WallSeg | null {
  let best: WallSeg | null = null;
  let bestDist = Infinity;
  for (const w of s.walls) {
    if (w.level !== level) continue;
    const nx = nodeWorldX(w.x, s.cols);
    const nz = nodeWorldZ(w.z, s.rows);
    const mx = w.dir === "h" ? nx + 0.5 : nx;
    const mz = w.dir === "v" ? nz + 0.5 : nz;
    const dx = point.x - mx;
    const dz = point.z - mz;
    const dist = dx * dx + dz * dz;
    if (dist < bestDist) {
      bestDist = dist;
      best = w;
    }
  }
  return best;
}

export function openingSegProfile(type: OpeningType): { sill: number; top: number } {
  return type === "door" ? { sill: 0, top: DOOR_HEIGHT } : { sill: WINDOW_SILL, top: WINDOW_TOP };
}
