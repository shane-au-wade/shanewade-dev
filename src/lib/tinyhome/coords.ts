// Grid <-> world coordinate helpers. World units are feet; the lot is centered
// on the origin so the camera orbits a stable point regardless of lot size.

import { CELL_FEET, type HouseState } from "./state";

export function nodeWorldX(x: number, cols: number): number {
  return (x - cols / 2) * CELL_FEET;
}

export function nodeWorldZ(z: number, rows: number): number {
  return (z - rows / 2) * CELL_FEET;
}

export function cellCenterX(cx: number, cols: number): number {
  return (cx + 0.5 - cols / 2) * CELL_FEET;
}

export function cellCenterZ(cz: number, rows: number): number {
  return (cz + 0.5 - rows / 2) * CELL_FEET;
}

/** A footprint's extent in ft along x and z once quarter-turn rotation is applied. */
export function rotatedFootprint(fw: number, fd: number, rot: number): { w: number; d: number } {
  return rot % 2 === 1 ? { w: fd, d: fw } : { w: fw, d: fd };
}

/**
 * World centre for a footprint anchored at a cell, offset so its edges land on
 * grid lines. An odd extent straddles a cell centre; an even one sits on a node.
 * Without this, even-sized items (a 10 ft stair run) are stuck half a foot off
 * the grid and can never line up with a wall or a stairwell void.
 */
export function footprintCenter(
  cx: number,
  cz: number,
  fw: number,
  fd: number,
  rot: number,
  s: HouseState,
): { x: number; z: number } {
  const { w, d } = rotatedFootprint(fw, fd, rot);
  return {
    x: nodeWorldX(cx, s.cols) + (w % 2 === 1 ? 0.5 : 0),
    z: nodeWorldZ(cz, s.rows) + (d % 2 === 1 ? 0.5 : 0),
  };
}

/** Nearest grid node (corner) to a world point, clamped to the lot. */
export function worldToNode(
  wx: number,
  wz: number,
  s: HouseState,
): { x: number; z: number } {
  const x = Math.round(wx / CELL_FEET + s.cols / 2);
  const z = Math.round(wz / CELL_FEET + s.rows / 2);
  return {
    x: Math.max(0, Math.min(s.cols, x)),
    z: Math.max(0, Math.min(s.rows, z)),
  };
}

/** Nearest cell (interior tile) to a world point, clamped to the lot. */
export function worldToCell(
  wx: number,
  wz: number,
  s: HouseState,
): { cx: number; cz: number } {
  const cx = Math.floor(wx / CELL_FEET + s.cols / 2);
  const cz = Math.floor(wz / CELL_FEET + s.rows / 2);
  return {
    cx: Math.max(0, Math.min(s.cols - 1, cx)),
    cz: Math.max(0, Math.min(s.rows - 1, cz)),
  };
}
