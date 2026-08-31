// Pointer handling, raycasting, ghost previews and selection for each tool.
// The controller reads the active tool / item / level through env callbacks so
// the page UI stays the single source of truth.
//
// Walls render as one merged mesh per level, so wall hits are resolved back to a
// 1 ft segment from the hit point rather than from per-segment objects.

import * as THREE from "three";
import {
  FLOOR_THICKNESS,
  WALL_HEIGHT,
  WALL_THICKNESS,
  floorKey,
  levelBaseY,
  makeUid,
  openingSpanFor,
  segAlong,
  wallKey,
  type FloorCell,
  type HouseState,
  type HouseStore,
  type Opening,
  type OpeningType,
  type WallSeg,
} from "./state";
import { CATALOG_BY_ID } from "./catalog";
import {
  nodeWorldX,
  nodeWorldZ,
  cellCenterX,
  cellCenterZ,
  footprintCenter,
  rotatedFootprint,
  worldToCell,
  worldToNode,
} from "./coords";
import { findPickable, nearestWallSeg, type BuiltScene } from "./builder";
import type { SceneCtx } from "./scene";

export type Tool = "select" | "wall" | "floor" | "erase" | "door" | "window" | "furniture";
export type FloorMode = "add" | "remove";

export type Selection =
  | { kind: "wall"; seg: WallSeg }
  | { kind: "opening"; key: string }
  | { kind: "furniture"; uid: string }
  | { kind: "roof" };

export interface ToolEnv {
  getTool: () => Tool;
  getItemId: () => string | null;
  getLevel: () => number;
  getFloorMode: () => FloorMode;
  getStore: () => HouseStore;
  getBuilt: () => BuiltScene | null;
  onSelect: (sel: Selection | null) => void;
}

const GHOST_OK = "#89181e";
const GHOST_BAD = "#6b6b6b";
const GHOST_ERASE = "#c22028";
const SELECT_COLOR = "#2f7dd1";
const CLICK_SLOP = 6;

interface Rect {
  cx0: number;
  cx1: number;
  cz0: number;
  cz1: number;
}

export class ToolController {
  private ghost = new THREE.Group();
  private selectionGroup = new THREE.Group();
  private selection: Selection | null = null;
  private dragging = false;
  private startNode: { x: number; z: number } | null = null;
  private startCell: { cx: number; cz: number } | null = null;
  private downXY = { x: 0, y: 0 };
  private ghostRot = 0;

  constructor(
    private ctx: SceneCtx,
    private env: ToolEnv,
  ) {
    this.ghost.name = "ghost";
    this.selectionGroup.name = "selection";
    ctx.scene.add(this.ghost);
    ctx.scene.add(this.selectionGroup);
    const el = ctx.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointerleave", this.clearGhost);
    this.applyControlScheme(this.env.getTool());
  }

  dispose(): void {
    const el = this.ctx.renderer.domElement;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointerleave", this.clearGhost);
    this.clearGhost();
  }

  onToolChanged(): void {
    this.dragging = false;
    this.startNode = null;
    this.startCell = null;
    this.clearGhost();
    this.applyControlScheme(this.env.getTool());
  }

  rotateGhost(): void {
    this.ghostRot = (this.ghostRot + 1) % 4;
    this.ctx.requestRender();
  }

  // ── Selection API (used by the UI) ─────────────────────────────────────────
  getSelection(): Selection | null {
    return this.selection;
  }

  clearSelection(): void {
    this.selection = null;
    this.env.onSelect(null);
    this.refreshSelection();
  }

  /** Re-derive the selection highlight from the freshly-built scene. */
  refreshSelection(): void {
    disposeChildren(this.selectionGroup);
    const sel = this.selection;
    const built = this.env.getBuilt();
    if (!sel || !built) {
      this.ctx.requestRender();
      return;
    }

    let box: THREE.Box3 | null = null;
    if (sel.kind === "wall") {
      const s = this.store().get();
      const key = wallKey(sel.seg);
      if (s.walls.some((w) => wallKey(w) === key)) box = this.segBox(sel.seg, s);
    } else {
      const obj =
        sel.kind === "opening"
          ? built.openingGroups.find((o) => o.userData.key === sel.key)
          : sel.kind === "furniture"
            ? built.furnitureGroups.find((f) => f.userData.uid === sel.uid)
            : built.roofGroup;
      if (obj) box = new THREE.Box3().setFromObject(obj);
    }

    if (!box) {
      // The selected element no longer exists (undo / delete / lot change).
      this.selection = null;
      this.env.onSelect(null);
      this.ctx.requestRender();
      return;
    }

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const pad = 0.15;
    const dims = new THREE.Vector3(size.x + pad, size.y + pad, size.z + pad);
    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(dims.x, dims.y, dims.z),
      new THREE.MeshBasicMaterial({
        color: SELECT_COLOR,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    fill.position.copy(center);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(dims.x, dims.y, dims.z)),
      new THREE.LineBasicMaterial({ color: SELECT_COLOR }),
    );
    edges.position.copy(center);
    this.selectionGroup.add(fill, edges);
    this.ctx.requestRender();
  }

  deleteSelected(): void {
    const sel = this.selection;
    if (!sel) return;
    const store = this.store();
    if (sel.kind === "wall") {
      const key = wallKey(sel.seg);
      store.commit((d) => {
        d.walls = d.walls.filter((w) => wallKey(w) !== key);
        pruneOpenings(d);
      });
    } else if (sel.kind === "opening") {
      store.commit((d) => {
        d.openings = d.openings.filter((o) => wallKey(o) !== sel.key);
      });
    } else if (sel.kind === "furniture") {
      store.commit((d) => {
        d.furniture = d.furniture.filter((f) => f.uid !== sel.uid);
      });
    } else {
      store.commit((d) => (d.roof = "none"));
    }
    this.selection = null;
    this.env.onSelect(null);
  }

  // ── Control scheme per tool ────────────────────────────────────────────────
  private applyControlScheme(tool: Tool): void {
    const c = this.ctx.controls;
    if (tool === "select") {
      c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
      c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    } else {
      c.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
      c.touches = { ONE: null as unknown as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_PAN };
    }
  }

  private planeY(): number {
    return levelBaseY(this.env.getLevel());
  }

  // ── Pointer handlers ───────────────────────────────────────────────────────
  private onDown = (ev: PointerEvent) => {
    if (ev.button !== 0) return;
    this.downXY = { x: ev.clientX, y: ev.clientY };
    const tool = this.env.getTool();
    const p = this.ctx.raycastPlaneY(ev, this.planeY());
    if (!p) return;
    if (tool === "wall") {
      this.startNode = worldToNode(p.x, p.z, this.store().get());
      this.dragging = true;
    } else if (tool === "floor") {
      this.startCell = worldToCell(p.x, p.z, this.store().get());
      this.dragging = true;
    }
  };

  private onMove = (ev: PointerEvent) => {
    switch (this.env.getTool()) {
      case "wall":
        this.previewWall(ev);
        break;
      case "floor":
        this.previewFloor(ev);
        break;
      case "furniture":
        this.previewFurniture(ev);
        break;
      case "door":
        this.previewOpening(ev, "door");
        break;
      case "window":
        this.previewOpening(ev, "window");
        break;
      case "erase":
        this.previewErase(ev);
        break;
      case "select":
        this.previewSelect(ev);
        break;
    }
  };

  private onUp = (ev: PointerEvent) => {
    if (ev.button !== 0) return;
    const tool = this.env.getTool();
    const moved = Math.abs(ev.clientX - this.downXY.x) + Math.abs(ev.clientY - this.downXY.y);

    if (tool === "wall" && this.dragging && this.startNode) {
      this.commitWall(ev);
      this.dragging = false;
      this.startNode = null;
      return;
    }
    if (tool === "floor" && this.dragging && this.startCell) {
      this.commitFloor(ev);
      this.dragging = false;
      this.startCell = null;
      return;
    }
    if (moved > CLICK_SLOP) return; // drag = orbit/pan, not a click

    if (tool === "furniture") this.placeFurniture(ev);
    else if (tool === "door") this.toggleOpening(ev, "door");
    else if (tool === "window") this.toggleOpening(ev, "window");
    else if (tool === "erase") this.eraseAt(ev);
    else if (tool === "select") this.selectAt(ev);
  };

  private clearGhost = () => {
    disposeChildren(this.ghost);
    this.ctx.requestRender();
  };

  /** Hidden upper floors shouldn't intercept clicks. */
  private visible(objs: THREE.Object3D[]): THREE.Object3D[] {
    return objs.filter((o) => o.visible);
  }

  // ── Wall tool ──────────────────────────────────────────────────────────────
  private orthoRun(a: { x: number; z: number }, b: { x: number; z: number }): WallSeg[] {
    const level = this.env.getLevel();
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const segs: WallSeg[] = [];
    if (Math.abs(dx) >= Math.abs(dz)) {
      const z = a.z;
      for (let x = Math.min(a.x, b.x); x < Math.max(a.x, b.x); x++) segs.push({ x, z, dir: "h", level });
    } else {
      const x = a.x;
      for (let z = Math.min(a.z, b.z); z < Math.max(a.z, b.z); z++) segs.push({ x, z, dir: "v", level });
    }
    return segs;
  }

  private previewWall(ev: PointerEvent) {
    const s = this.store().get();
    const p = this.ctx.raycastPlaneY(ev, this.planeY());
    disposeChildren(this.ghost);
    if (!p) {
      this.ctx.requestRender();
      return;
    }
    const cur = worldToNode(p.x, p.z, s);
    if (this.dragging && this.startNode) {
      // One box for the whole run rather than one per foot.
      const segs = this.orthoRun(this.startNode, cur);
      if (segs.length) {
        const first = segs[0];
        const horizontal = first.dir === "h";
        const len = segs.length;
        const nx = nodeWorldX(first.x, s.cols);
        const nz = nodeWorldZ(first.z, s.rows);
        const geo = horizontal
          ? new THREE.BoxGeometry(len, WALL_HEIGHT, WALL_THICKNESS)
          : new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, len);
        const mesh = new THREE.Mesh(geo, ghostMat(GHOST_OK));
        mesh.position.set(
          horizontal ? nx + len / 2 : nx,
          this.planeY() + WALL_HEIGHT / 2,
          horizontal ? nz : nz + len / 2,
        );
        this.ghost.add(mesh);
        this.ghost.add(this.dimLabel(len, mesh.position));
      }
    } else {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), ghostMat(GHOST_OK));
      dot.position.set(nodeWorldX(cur.x, s.cols), this.planeY() + 0.5, nodeWorldZ(cur.z, s.rows));
      this.ghost.add(dot);
    }
    this.ctx.requestRender();
  }

  private commitWall(ev: PointerEvent) {
    const store = this.store();
    const s = store.get();
    const p = this.ctx.raycastPlaneY(ev, this.planeY());
    if (!p || !this.startNode) return;
    const segs = this.orthoRun(this.startNode, worldToNode(p.x, p.z, s));
    if (segs.length === 0) return;
    store.commit((draft) => {
      const existing = new Set(draft.walls.map(wallKey));
      for (const seg of segs) {
        const k = wallKey(seg);
        if (!existing.has(k)) {
          draft.walls.push(seg);
          existing.add(k);
        }
      }
    });
    disposeChildren(this.ghost);
  }

  // ── Floor tool: drag a rectangle to add or remove finished floor ───────────
  private floorRect(ev: PointerEvent): Rect | null {
    const s = this.store().get();
    const p = this.ctx.raycastPlaneY(ev, this.planeY());
    if (!p || !this.startCell) return null;
    const cur = worldToCell(p.x, p.z, s);
    return {
      cx0: Math.min(this.startCell.cx, cur.cx),
      cx1: Math.max(this.startCell.cx, cur.cx),
      cz0: Math.min(this.startCell.cz, cur.cz),
      cz1: Math.max(this.startCell.cz, cur.cz),
    };
  }

  private previewFloor(ev: PointerEvent) {
    disposeChildren(this.ghost);
    const s = this.store().get();
    const p = this.ctx.raycastPlaneY(ev, this.planeY());
    if (!p) {
      this.ctx.requestRender();
      return;
    }
    const remove = this.env.getFloorMode() === "remove";
    const color = remove ? GHOST_ERASE : GHOST_OK;
    const rect = this.dragging ? this.floorRect(ev) : null;
    const cur = worldToCell(p.x, p.z, s);
    const r = rect ?? { cx0: cur.cx, cx1: cur.cx, cz0: cur.cz, cz1: cur.cz };
    const w = r.cx1 - r.cx0 + 1;
    const d = r.cz1 - r.cz0 + 1;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), ghostMat(color, 0.4));
    mesh.position.set(
      (r.cx0 + r.cx1 + 1) / 2 - s.cols / 2,
      this.planeY() + 0.12,
      (r.cz0 + r.cz1 + 1) / 2 - s.rows / 2,
    );
    this.ghost.add(mesh);
    if (w > 1 || d > 1) {
      this.ghost.add(this.textSprite(`${w} × ${d} ft · ${w * d} sq ft`, mesh.position, 1.4));
    }
    this.ctx.requestRender();
  }

  private commitFloor(ev: PointerEvent) {
    const rect = this.floorRect(ev);
    if (!rect) return;
    const level = this.env.getLevel();
    const remove = this.env.getFloorMode() === "remove";
    this.store().commit((d) => {
      const inRect = (f: FloorCell) =>
        f.level === level && f.cx >= rect.cx0 && f.cx <= rect.cx1 && f.cz >= rect.cz0 && f.cz <= rect.cz1;
      if (remove) {
        d.floors = d.floors.filter((f) => !inRect(f));
        return;
      }
      const present = new Set(d.floors.map(floorKey));
      for (let cz = rect.cz0; cz <= rect.cz1; cz++) {
        for (let cx = rect.cx0; cx <= rect.cx1; cx++) {
          const cell = { cx, cz, level };
          const k = floorKey(cell);
          if (!present.has(k)) {
            d.floors.push(cell);
            present.add(k);
          }
        }
      }
    });
    disposeChildren(this.ghost);
  }

  // ── Furniture tool ─────────────────────────────────────────────────────────
  private previewFurniture(ev: PointerEvent) {
    disposeChildren(this.ghost);
    const itemId = this.env.getItemId();
    const item = itemId ? CATALOG_BY_ID.get(itemId) : null;
    const p = this.ctx.raycastPlaneY(ev, this.planeY());
    if (!item || !p) {
      this.ctx.requestRender();
      return;
    }
    const s = this.store().get();
    const { cx, cz } = worldToCell(p.x, p.z, s);
    const c = footprintCenter(cx, cz, item.fw, item.fd, this.ghostRot, s);
    const inst = item.build();
    inst.position.set(c.x, this.planeY(), c.z);
    inst.rotation.y = (this.ghostRot * Math.PI) / 2;
    makeGhost(inst, GHOST_OK);
    this.ghost.add(inst);

    // Footprint outline on the floor, so the exact snapped extent is visible.
    const { w, d } = rotatedFootprint(item.fw, item.fd, this.ghostRot);
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2)),
      new THREE.LineBasicMaterial({ color: GHOST_OK, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    outline.position.set(c.x, this.planeY() + 0.08, c.z);
    this.ghost.add(outline);
    this.ghost.add(this.textSprite(`${w} × ${d} ft`, new THREE.Vector3(c.x, this.planeY(), c.z), 0.6));
    this.ctx.requestRender();
  }

  private placeFurniture(ev: PointerEvent) {
    const itemId = this.env.getItemId();
    if (!itemId) return;
    const store = this.store();
    const s = store.get();
    const p = this.ctx.raycastPlaneY(ev, this.planeY());
    if (!p) return;
    const { cx, cz } = worldToCell(p.x, p.z, s);
    const rot = this.ghostRot;
    const level = this.env.getLevel();
    store.commit((draft) => {
      draft.furniture.push({ uid: makeUid(), itemId, cx, cz, level, rot });
    });
  }

  // ── Door / Window tools ────────────────────────────────────────────────────
  /** The wall segment under the cursor, whether the hit was bare wall or an existing opening. */
  private hoveredWall(ev: PointerEvent): WallSeg | null {
    const built = this.env.getBuilt();
    if (!built) return null;
    const s = this.store().get();
    const targets = this.visible([...built.wallMeshes, ...built.openingGroups]);
    const hits = this.ctx.raycastFromPointer(ev, targets);
    if (hits.length === 0) return null;
    const pick = findPickable(hits[0].object);
    if (!pick) return null;
    if (pick.userData.kind === "opening") {
      const op = s.openings.find((o) => wallKey(o) === pick.userData.key);
      return op ? segAlong(op, 0) : null;
    }
    if (pick.userData.kind === "wallMesh") {
      return nearestWallSeg(s, pick.userData.level as number, hits[0].point);
    }
    return null;
  }

  private previewOpening(ev: PointerEvent, type: OpeningType) {
    disposeChildren(this.ghost);
    const seg = this.hoveredWall(ev);
    if (seg) {
      const s = this.store().get();
      const existing = openingCovering(s, seg);
      if (existing) {
        this.ghost.add(this.spanHighlight(existing, existing.span, s, GHOST_ERASE));
      } else {
        const start = this.findOpeningStart(seg, type, s);
        const span = openingSpanFor(type);
        if (start) this.ghost.add(this.spanHighlight(start, span, s, GHOST_OK));
        else this.ghost.add(this.spanHighlight(seg, 1, s, GHOST_BAD));
      }
    }
    this.ctx.requestRender();
  }

  /**
   * Where a `span`-foot opening should start so it covers `seg`. Prefers a
   * placement centred on the clicked segment, then shifts along the run until it
   * finds one backed by wall the whole way and clear of other openings.
   */
  private findOpeningStart(seg: WallSeg, type: OpeningType, s: HouseState): WallSeg | null {
    const span = openingSpanFor(type);
    const walls = new Set(s.walls.filter((w) => w.level === seg.level).map(wallKey));
    const along = seg.dir === "h" ? seg.x : seg.z;
    const centered = along - Math.floor((span - 1) / 2);

    const offsets: number[] = [];
    for (let o = 0; o < span; o++) {
      const cand = along - o;
      offsets.push(cand);
    }
    offsets.sort((a, b) => Math.abs(a - centered) - Math.abs(b - centered));

    for (const startAlong of offsets) {
      const start: WallSeg =
        seg.dir === "h"
          ? { x: startAlong, z: seg.z, dir: "h", level: seg.level }
          : { x: seg.x, z: startAlong, dir: "v", level: seg.level };
      let ok = true;
      for (let k = 0; k < span; k++) {
        const sub = segAlong(start, k);
        if (!walls.has(wallKey(sub)) || openingCovering(s, sub)) {
          ok = false;
          break;
        }
      }
      if (ok) return start;
    }
    return null;
  }

  private toggleOpening(ev: PointerEvent, type: OpeningType) {
    const seg = this.hoveredWall(ev);
    if (!seg) return;
    const s = this.store().get();
    const existing = openingCovering(s, seg);

    if (existing) {
      const key = wallKey(existing);
      this.store().commit((d) => {
        const idx = d.openings.findIndex((o) => wallKey(o) === key);
        if (idx < 0) return;
        // Same tool as the existing opening removes it; the other tool swaps type.
        if (d.openings[idx].type === type) d.openings.splice(idx, 1);
        else d.openings[idx] = { ...d.openings[idx], type, span: openingSpanFor(type) };
      });
      return;
    }

    const start = this.findOpeningStart(seg, type, s);
    if (!start) return;
    const span = openingSpanFor(type);
    this.store().commit((d) => {
      d.openings.push({ x: start.x, z: start.z, dir: start.dir, level: start.level, type, span });
    });
  }

  // ── Erase tool ─────────────────────────────────────────────────────────────
  private eraseTargets(): THREE.Object3D[] {
    const built = this.env.getBuilt();
    if (!built) return [];
    return this.visible([
      ...built.wallMeshes,
      ...built.openingGroups,
      ...built.furnitureGroups,
      ...built.floorMeshes,
      ...(built.roofGroup ? [built.roofGroup] : []),
    ]);
  }

  private previewErase(ev: PointerEvent) {
    disposeChildren(this.ghost);
    const hits = this.ctx.raycastFromPointer(ev, this.eraseTargets());
    const hit = hits.length ? hits[0] : null;
    const pick = hit ? findPickable(hit.object) : null;
    if (pick && hit) {
      const s = this.store().get();
      if (pick.userData.kind === "wallMesh") {
        const seg = nearestWallSeg(s, pick.userData.level as number, hit.point);
        if (seg) this.ghost.add(this.spanHighlight(seg, 1, s, GHOST_ERASE));
      } else if (pick.userData.kind === "floor") {
        const level = pick.userData.level as number;
        const { cx, cz } = worldToCell(hit.point.x, hit.point.z, s);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), ghostMat(GHOST_ERASE, 0.5));
        mesh.position.set(cellCenterX(cx, s.cols), levelBaseY(level) - FLOOR_THICKNESS / 2, cellCenterZ(cz, s.rows));
        this.ghost.add(mesh);
      } else {
        this.ghost.add(this.boxHighlight(pick, GHOST_ERASE));
      }
    }
    this.ctx.requestRender();
  }

  private eraseAt(ev: PointerEvent) {
    const hits = this.ctx.raycastFromPointer(ev, this.eraseTargets());
    const hit = hits.length ? hits[0] : null;
    const pick = hit ? findPickable(hit.object) : null;
    if (!pick || !hit) return;
    const store = this.store();
    const s = store.get();
    const kind = pick.userData.kind;

    if (kind === "wallMesh") {
      const seg = nearestWallSeg(s, pick.userData.level as number, hit.point);
      if (!seg) return;
      const key = wallKey(seg);
      store.commit((d) => {
        d.walls = d.walls.filter((w) => wallKey(w) !== key);
        pruneOpenings(d);
      });
    } else if (kind === "opening") {
      const key = pick.userData.key as string;
      store.commit((d) => (d.openings = d.openings.filter((o) => wallKey(o) !== key)));
    } else if (kind === "furniture") {
      const uid = pick.userData.uid as string;
      store.commit((d) => (d.furniture = d.furniture.filter((f) => f.uid !== uid)));
    } else if (kind === "floor") {
      const level = pick.userData.level as number;
      const { cx, cz } = worldToCell(hit.point.x, hit.point.z, s);
      store.commit(
        (d) => (d.floors = d.floors.filter((f) => !(f.level === level && f.cx === cx && f.cz === cz))),
      );
    } else if (kind === "roof") {
      store.commit((d) => (d.roof = "none"));
    }
  }

  // ── Select tool ────────────────────────────────────────────────────────────
  private selectTargets(): THREE.Object3D[] {
    const built = this.env.getBuilt();
    return built ? this.visible(built.selectables) : [];
  }

  private previewSelect(ev: PointerEvent) {
    disposeChildren(this.ghost);
    const hits = this.ctx.raycastFromPointer(ev, this.selectTargets());
    const hit = hits.length ? hits[0] : null;
    const pick = hit ? findPickable(hit.object) : null;
    if (pick && hit) {
      if (pick.userData.kind === "wallMesh") {
        const s = this.store().get();
        const seg = nearestWallSeg(s, pick.userData.level as number, hit.point);
        if (seg) this.ghost.add(this.spanHighlight(seg, 1, s, SELECT_COLOR));
      } else {
        this.ghost.add(this.boxHighlight(pick, SELECT_COLOR, 0.12));
      }
    }
    this.ctx.requestRender();
  }

  private selectAt(ev: PointerEvent) {
    const hits = this.ctx.raycastFromPointer(ev, this.selectTargets());
    const hit = hits.length ? hits[0] : null;
    const pick = hit ? findPickable(hit.object) : null;
    if (!pick || !hit) {
      this.clearSelection();
      return;
    }
    const kind = pick.userData.kind;
    if (kind === "wallMesh") {
      const seg = nearestWallSeg(this.store().get(), pick.userData.level as number, hit.point);
      if (!seg) {
        this.clearSelection();
        return;
      }
      this.selection = { kind: "wall", seg };
    } else if (kind === "opening") {
      this.selection = { kind: "opening", key: pick.userData.key as string };
    } else if (kind === "furniture") {
      this.selection = { kind: "furniture", uid: pick.userData.uid as string };
    } else if (kind === "roof") {
      this.selection = { kind: "roof" };
    } else {
      this.clearSelection();
      return;
    }
    this.env.onSelect(this.selection);
    this.refreshSelection();
  }

  // ── Highlight helpers ──────────────────────────────────────────────────────
  private segBox(seg: WallSeg, s: HouseState): THREE.Box3 {
    const horizontal = seg.dir === "h";
    const nx = nodeWorldX(seg.x, s.cols);
    const nz = nodeWorldZ(seg.z, s.rows);
    const midX = horizontal ? nx + 0.5 : nx;
    const midZ = horizontal ? nz : nz + 0.5;
    const y = levelBaseY(seg.level);
    const halfAlong = 0.5;
    const halfCross = WALL_THICKNESS / 2;
    return new THREE.Box3(
      new THREE.Vector3(
        midX - (horizontal ? halfAlong : halfCross),
        y,
        midZ - (horizontal ? halfCross : halfAlong),
      ),
      new THREE.Vector3(
        midX + (horizontal ? halfAlong : halfCross),
        y + WALL_HEIGHT,
        midZ + (horizontal ? halfCross : halfAlong),
      ),
    );
  }

  /** Translucent box over `span` feet of wall starting at `start`. */
  private spanHighlight(
    start: { x: number; z: number; dir: "h" | "v"; level: number },
    span: number,
    s: HouseState,
    color: string,
  ): THREE.Mesh {
    const horizontal = start.dir === "h";
    const nx = nodeWorldX(start.x, s.cols);
    const nz = nodeWorldZ(start.z, s.rows);
    const pad = 0.2;
    const geo = horizontal
      ? new THREE.BoxGeometry(span, WALL_HEIGHT + pad, WALL_THICKNESS + pad)
      : new THREE.BoxGeometry(WALL_THICKNESS + pad, WALL_HEIGHT + pad, span);
    const mesh = new THREE.Mesh(geo, ghostMat(color));
    mesh.position.set(
      horizontal ? nx + span / 2 : nx,
      levelBaseY(start.level) + WALL_HEIGHT / 2,
      horizontal ? nz : nz + span / 2,
    );
    return mesh;
  }

  private boxHighlight(obj: THREE.Object3D, color: string, opacity = 0.35): THREE.Mesh {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.x + 0.25, size.y + 0.25, size.z + 0.25),
      ghostMat(color, opacity),
    );
    mesh.position.copy(center);
    return mesh;
  }

  private dimLabel(len: number, at: THREE.Vector3): THREE.Sprite {
    return this.textSprite(`${len} ft`, at, 1.2);
  }

  /** Canvas-backed sprite so drag operations can show live dimensions. */
  private textSprite(text: string, at: THREE.Vector3, yOffset: number): THREE.Sprite {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(20,20,24,0.82)";
    if (typeof g.roundRect === "function") {
      g.beginPath();
      g.roundRect(0, 0, 256, 64, 14);
      g.fill();
    } else {
      g.fillRect(0, 0, 256, 64);
    }
    g.fillStyle = "#fff";
    g.font = "600 30px ui-sans-serif, system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 128, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
    );
    sprite.scale.set(6, 1.5, 1);
    sprite.position.set(at.x, at.y + WALL_HEIGHT / 2 + yOffset, at.z);
    return sprite;
  }

  private store(): HouseStore {
    return this.env.getStore();
  }
}

// ── Module helpers ───────────────────────────────────────────────────────────

/** The opening that covers `seg`, if any. */
export function openingCovering(s: HouseState, seg: WallSeg): Opening | null {
  for (const o of s.openings) {
    if (o.level !== seg.level || o.dir !== seg.dir) continue;
    if (o.dir === "h") {
      if (o.z !== seg.z) continue;
      if (seg.x >= o.x && seg.x < o.x + o.span) return o;
    } else {
      if (o.x !== seg.x) continue;
      if (seg.z >= o.z && seg.z < o.z + o.span) return o;
    }
  }
  return null;
}

/** Drop openings that are no longer backed by wall along their whole span. */
export function pruneOpenings(d: HouseState): void {
  const walls = new Set(d.walls.map(wallKey));
  d.openings = d.openings.filter((o) => {
    for (let k = 0; k < o.span; k++) {
      if (!walls.has(wallKey(segAlong(o, k)))) return false;
    }
    return true;
  });
}

export function describeSelection(sel: Selection, s: HouseState): string {
  switch (sel.kind) {
    case "wall":
      return `Wall segment · ${sel.seg.dir === "h" ? "east–west" : "north–south"}`;
    case "opening": {
      const op = s.openings.find((o) => wallKey(o) === sel.key);
      return op ? `${op.type === "door" ? "Door" : "Window"} · ${op.span} ft` : "Opening";
    }
    case "furniture": {
      const f = s.furniture.find((x) => x.uid === sel.uid);
      const item = f ? CATALOG_BY_ID.get(f.itemId) : null;
      return item ? item.label : "Furniture";
    }
    case "roof":
      return "Roof";
  }
}

function ghostMat(color: string, opacity = 0.45): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
}

function makeGhost(obj: THREE.Object3D, color: string): void {
  obj.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.material = ghostMat(color);
      m.castShadow = false;
    }
  });
}

function disposeChildren(group: THREE.Group): void {
  for (let i = group.children.length - 1; i >= 0; i--) {
    const child = group.children[i];
    group.remove(child);
    child.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!mat) return;
      for (const x of Array.isArray(mat) ? mat : [mat]) {
        // Dimension labels own a canvas texture that the material won't release.
        (x as THREE.SpriteMaterial).map?.dispose();
        x.dispose();
      }
    });
  }
}
