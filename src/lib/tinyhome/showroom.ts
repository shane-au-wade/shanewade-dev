// Tiny Home Showroom: a warehouse that is generated from the catalog rather
// than authored. Adding an item to CATALOG grows the floor plan automatically —
// bays are sized to each item's footprint, packed into rows, and grouped into
// one zone per category, then the shell (floor, walls, trusses, roof) is sized
// to whatever the layout came out to. Nothing here is hand-placed.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CATALOG, ITEM_CATEGORIES, type CatalogItem, type ItemCategory } from "./catalog";
import { CommandPalette, type Command } from "./palette";

// ── Layout constants (feet) ──────────────────────────────────────────────────
const PEDESTAL_PAD = 1.2; // pedestal overhang beyond the item footprint per side
const PEDESTAL_H = 0.5;
const BAY_GAP = 2.5; // between pedestals in a row
const ROW_GAP = 5; // between rows within a zone
const ZONE_GAP = 11; // between category zones
const MAX_ROW_W = 58; // wrap a row past this width
const MARGIN = 12; // outer pedestals to the walls
const WALL_H = 26;

export interface ShowroomBay {
  item: CatalogItem;
  x: number;
  z: number;
  w: number; // pedestal width
  d: number; // pedestal depth
}

export interface ShowroomZone {
  category: ItemCategory;
  z0: number;
  z1: number;
  count: number;
}

export interface ShowroomPlan {
  bays: ShowroomBay[];
  zones: ShowroomZone[];
  width: number; // interior width
  depth: number; // interior depth
}

/**
 * Packs the catalog into a floor plan. Pure geometry — no three.js — so the
 * layout can be unit tested and reasoned about independently of rendering.
 */
export function planShowroom(items: CatalogItem[] = CATALOG): ShowroomPlan {
  // Known categories first, then any new ones so an unrecognised category still
  // gets a zone instead of vanishing.
  const order: ItemCategory[] = [...ITEM_CATEGORIES];
  for (const it of items) if (!order.includes(it.category)) order.push(it.category);

  const bays: ShowroomBay[] = [];
  const zones: ShowroomZone[] = [];
  let cursor = 0;
  let widest = 0;

  for (const category of order) {
    const group = items.filter((i) => i.category === category);
    if (group.length === 0) continue;
    const zoneStart = cursor;

    // Greedy row wrap on pedestal width.
    const rows: CatalogItem[][] = [];
    let row: CatalogItem[] = [];
    let rowW = 0;
    for (const it of group) {
      const w = it.fw + PEDESTAL_PAD * 2;
      if (row.length > 0 && rowW + BAY_GAP + w > MAX_ROW_W) {
        rows.push(row);
        row = [];
        rowW = 0;
      }
      rowW += (row.length > 0 ? BAY_GAP : 0) + w;
      row.push(it);
    }
    if (row.length > 0) rows.push(row);

    rows.forEach((rowItems, r) => {
      const widths = rowItems.map((i) => i.fw + PEDESTAL_PAD * 2);
      const totalW = widths.reduce((a, b) => a + b, 0) + BAY_GAP * (rowItems.length - 1);
      const rowDepth = Math.max(...rowItems.map((i) => i.fd + PEDESTAL_PAD * 2));
      widest = Math.max(widest, totalW);

      let x = -totalW / 2;
      rowItems.forEach((item, i) => {
        bays.push({
          item,
          x: x + widths[i] / 2,
          z: cursor + rowDepth / 2,
          w: widths[i],
          d: item.fd + PEDESTAL_PAD * 2,
        });
        x += widths[i] + BAY_GAP;
      });
      cursor += rowDepth + (r < rows.length - 1 ? ROW_GAP : 0);
    });

    zones.push({ category, z0: zoneStart, z1: cursor, count: group.length });
    cursor += ZONE_GAP;
  }

  const used = Math.max(0, cursor - ZONE_GAP);
  const shift = -used / 2; // center the plan on the origin
  for (const b of bays) b.z += shift;
  for (const z of zones) {
    z.z0 += shift;
    z.z1 += shift;
  }

  return { bays, zones, width: widest + MARGIN * 2, depth: used + MARGIN * 2 };
}

// ── Build ────────────────────────────────────────────────────────────────────
export interface BuiltBay extends ShowroomBay {
  node: THREE.Group; // the item itself, for turntable spin
  pedestal: THREE.Mesh; // pick target
  height: number; // item height, for camera framing
}

export interface BuiltShowroom {
  group: THREE.Group;
  bays: BuiltBay[];
  pickTargets: THREE.Object3D[];
  plan: ShowroomPlan;
}

function lambert(color: string, opts: THREE.MeshLambertMaterialParameters = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

export function buildShowroom(plan: ShowroomPlan = planShowroom()): BuiltShowroom {
  const group = new THREE.Group();
  group.add(buildShell(plan));

  const bays: BuiltBay[] = [];
  const pickTargets: THREE.Object3D[] = [];

  for (const bay of plan.bays) {
    const bayGroup = new THREE.Group();
    bayGroup.position.set(bay.x, 0, bay.z);

    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(bay.w, PEDESTAL_H, bay.d),
      lambert("#4d555c"),
    );
    pedestal.position.y = PEDESTAL_H / 2;
    pedestal.receiveShadow = true;
    pedestal.userData = { itemId: bay.item.id };
    bayGroup.add(pedestal);

    const top = new THREE.Mesh(
      new THREE.BoxGeometry(bay.w - 0.15, 0.06, bay.d - 0.15),
      lambert("#6f7880"),
    );
    top.position.y = PEDESTAL_H + 0.02;
    bayGroup.add(top);

    // Footprint decal so the declared fw × fd is visible at a glance.
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(bay.item.fw, 0.01, bay.item.fd)),
      new THREE.LineBasicMaterial({ color: "#cbd5dd", transparent: true, opacity: 0.75 }),
    );
    outline.position.y = PEDESTAL_H + 0.06;
    bayGroup.add(outline);

    const node = bay.item.build();
    node.position.y = PEDESTAL_H + 0.05;
    bayGroup.add(node);

    const bbox = new THREE.Box3().setFromObject(node);
    const height = Math.max(0.5, bbox.max.y - PEDESTAL_H);

    bayGroup.add(
      labelSprite(
        bay.item.label,
        `${bay.item.fw} × ${bay.item.fd} ft`,
        PEDESTAL_H + height + 1.4,
      ),
    );

    group.add(bayGroup);
    bays.push({ ...bay, node, pedestal, height });
    pickTargets.push(pedestal);
  }

  for (const zone of plan.zones) {
    group.add(zoneSign(zone, plan));
  }

  return { group, bays, pickTargets, plan };
}

function buildShell(plan: ShowroomPlan): THREE.Group {
  const g = new THREE.Group();
  const W = plan.width;
  const D = plan.depth;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), lambert("#92979b"));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  // Painted band per zone, so zones read as areas of the floor.
  plan.zones.forEach((zone, i) => {
    const depth = zone.z1 - zone.z0;
    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(W - MARGIN, depth + 3),
      lambert(i % 2 === 0 ? "#878d92" : "#8d9398"),
    );
    band.rotation.x = -Math.PI / 2;
    band.position.set(0, 0.01, (zone.z0 + zone.z1) / 2);
    g.add(band);

    for (const edge of [zone.z0 - 1.5, zone.z1 + 1.5]) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(W - MARGIN, 0.35), lambert("#e8c552"));
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.02, edge);
      g.add(stripe);
    }
  });

  // Walls: light panel above a dark wainscot, which hides the floor seam.
  const wall = lambert("#b3b9bd");
  const wainscot = lambert("#5a6268");
  const T = 0.5;
  const sides: Array<[number, number, number, number]> = [
    [W, T, 0, -D / 2], // back
    [W, T, 0, D / 2], // front
    [T, D, -W / 2, 0], // left
    [T, D, W / 2, 0], // right
  ];
  for (const [w, d, x, z] of sides) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), wall);
    panel.position.set(x, WALL_H / 2, z);
    panel.receiveShadow = true;
    g.add(panel);
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 4, d + 0.05), wainscot);
    base.position.set(x, 2, z);
    g.add(base);
  }

  // Steel columns down both long walls.
  const columnMat = lambert("#767d83");
  for (let z = -D / 2 + 8; z <= D / 2 - 8; z += 16) {
    for (const x of [-W / 2 + 1, W / 2 - 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.8, WALL_H, 0.8), columnMat);
      col.position.set(x, WALL_H / 2, z);
      g.add(col);
    }
  }

  // Roof deck + trusses + a skylight strip down the middle.
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(W, D), lambert("#3f464b"));
  roof.rotation.x = Math.PI / 2;
  roof.position.y = WALL_H;
  g.add(roof);

  const trussMat = lambert("#8a9298");
  for (let z = -D / 2 + 10; z <= D / 2 - 10; z += 20) {
    const chord = new THREE.Mesh(new THREE.BoxGeometry(W - 2, 0.7, 0.5), trussMat);
    chord.position.set(0, WALL_H - 1.6, z);
    g.add(chord);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(W - 2, 0.4, 0.4), trussMat);
    lower.position.set(0, WALL_H - 4, z);
    g.add(lower);
    for (let x = -W / 2 + 4; x <= W / 2 - 4; x += 8) {
      const web = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, 0.3), trussMat);
      web.position.set(x, WALL_H - 2.8, z);
      g.add(web);
    }
  }

  const skylight = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.22, D - 8),
    new THREE.MeshBasicMaterial({ color: "#eaf4fb", transparent: true, opacity: 0.75 }),
  );
  skylight.rotation.x = Math.PI / 2;
  skylight.position.y = WALL_H - 0.12;
  g.add(skylight);

  // High-bay fixtures. MeshBasic so they read as emitters without extra lights.
  const lampMat = new THREE.MeshBasicMaterial({ color: "#fff6dd" });
  for (let z = -D / 2 + 12; z <= D / 2 - 12; z += 18) {
    for (const x of [-W / 4, W / 4]) {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 2.4), lambert("#4a5157"));
      housing.position.set(x, WALL_H - 5, z);
      g.add(housing);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), lampMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(x, WALL_H - 5.2, z);
      g.add(lens);
    }
  }

  // Roll-up door on the front wall for a sense of scale and entry.
  const doorW = Math.min(16, W * 0.25);
  const doorH = 14;
  const jamb = lambert("#4f565c");
  g.add(meshAt(new THREE.BoxGeometry(doorW + 1.4, doorH + 0.7, 0.3), jamb, 0, (doorH + 0.7) / 2, D / 2 - 0.3));
  const slat = lambert("#98a0a6");
  for (let y = 0.5; y < doorH; y += 1.15) {
    g.add(meshAt(new THREE.BoxGeometry(doorW, 1.0, 0.18), slat, 0, y, D / 2 - 0.45));
  }

  return g;
}

function meshAt(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}

// ── Sprites ──────────────────────────────────────────────────────────────────
function labelSprite(title: string, sub: string, y: number): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(18,20,24,0.86)";
  if (typeof g.roundRect === "function") {
    g.beginPath();
    g.roundRect(0, 0, 512, 160, 28);
    g.fill();
  } else {
    g.fillRect(0, 0, 512, 160);
  }
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#ffffff";
  g.font = "700 58px ui-sans-serif, system-ui, sans-serif";
  g.fillText(title, 256, 60);
  g.fillStyle = "#9fb0bd";
  g.font = "500 40px ui-sans-serif, system-ui, sans-serif";
  g.fillText(sub, 256, 118);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(5.2, 1.63, 1);
  sprite.position.set(0, y, 0);
  return sprite;
}

function zoneSign(zone: ShowroomZone, plan: ShowroomPlan): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(232,197,82,0.95)";
  g.fillRect(0, 0, 640, 160);
  g.fillStyle = "#1b1d21";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "800 74px ui-sans-serif, system-ui, sans-serif";
  g.fillText(zone.category.toUpperCase(), 320, 62);
  g.font = "600 38px ui-sans-serif, system-ui, sans-serif";
  g.fillText(`${zone.count} item${zone.count === 1 ? "" : "s"}`, 320, 122);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(13, 3.25, 1);
  sprite.position.set(-plan.width / 2 + 9, 15, (zone.z0 + zone.z1) / 2);
  return sprite;
}

// ── Page controller ──────────────────────────────────────────────────────────
export function initShowroom(): void {
  const mount = document.getElementById("sr-canvas");
  if (!mount) return;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#20262b");

  const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.1, 2000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  mount.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x60666b, 0.9));
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  const built = buildShowroom();
  scene.add(built.group);
  const { width: W, depth: D } = built.plan;

  const sun = new THREE.DirectionalLight(0xfff4e2, 0.75);
  sun.position.set(W * 0.35, WALL_H * 2, -D * 0.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -W;
  sc.right = W;
  sc.top = D;
  sc.bottom = -D;
  sc.near = 1;
  sc.far = WALL_H * 6;
  sc.updateProjectionMatrix();
  scene.add(sun);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.minDistance = 4;
  controls.maxDistance = Math.max(W, D) * 1.6;

  // ── Render on demand, with a tween for camera moves ────────────────────────
  let dirty = true;
  let moving = false;
  let spinning = false;
  let focusId: string | null = null;
  const requestRender = () => {
    dirty = true;
  };
  controls.addEventListener("change", requestRender);
  controls.addEventListener("start", () => (moving = true));
  controls.addEventListener("end", () => {
    moving = false;
    requestRender();
  });

  let tween: { pos: THREE.Vector3; target: THREE.Vector3; t: number } | null = null;
  function flyTo(pos: THREE.Vector3, target: THREE.Vector3): void {
    tween = { pos, target, t: 0 };
    requestRender();
  }

  let last = performance.now();
  function loop(): void {
    requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000); // clamp so tab-switches don't jump
    last = now;

    if (tween) {
      tween.t = Math.min(1, tween.t + dt * 2.2);
      const k = 1 - Math.pow(1 - tween.t, 3); // ease-out cubic
      camera.position.lerp(tween.pos, k * 0.35);
      controls.target.lerp(tween.target, k * 0.35);
      if (tween.t >= 1 && camera.position.distanceTo(tween.pos) < 0.4) tween = null;
      dirty = true;
    }

    if (spinning && focusId) {
      const bay = built.bays.find((b) => b.item.id === focusId);
      if (bay) {
        bay.node.rotation.y += dt * 0.6;
        dirty = true;
      }
    }

    controls.update();
    if (dirty || moving) {
      renderer.render(scene, camera);
      dirty = false;
    }
  }
  loop();

  // ── Framing ────────────────────────────────────────────────────────────────
  function overview(): void {
    focusId = null;
    setSpin(false);
    updateDetails(null);
    const dist = Math.max(W, D) * 0.72;
    flyTo(new THREE.Vector3(dist * 0.55, dist * 0.72, dist * 0.95), new THREE.Vector3(0, 6, 0));
    highlightList();
  }

  function focusItem(id: string): void {
    const bay = built.bays.find((b) => b.item.id === id);
    if (!bay) return;
    focusId = id;
    const span = Math.max(bay.w, bay.d, bay.height);
    const dist = span * 1.9 + 5;
    flyTo(
      new THREE.Vector3(bay.x + dist * 0.62, PEDESTAL_H + bay.height * 0.75 + dist * 0.45, bay.z + dist * 0.78),
      new THREE.Vector3(bay.x, PEDESTAL_H + bay.height * 0.45, bay.z),
    );
    updateDetails(bay);
    highlightList();
  }

  // ── Sidebar + details ──────────────────────────────────────────────────────
  function updateDetails(bay: BuiltBay | null): void {
    const panel = document.getElementById("sr-details");
    if (!panel) return;
    panel.classList.toggle("hidden", !bay);
    if (!bay) return;
    setText("sr-name", bay.item.label);
    setText("sr-cat", bay.item.category);
    setText("sr-dims", `${bay.item.fw} × ${bay.item.fd} ft footprint · ${bay.height.toFixed(1)} ft tall`);
    setText("sr-id", bay.item.id);
  }

  function highlightList(): void {
    document.querySelectorAll<HTMLElement>("[data-sr-item]").forEach((el) => {
      const active = el.dataset.srItem === focusId;
      el.classList.toggle("bg-brand-primary", active);
      el.classList.toggle("text-white", active);
    });
  }

  const list = document.getElementById("sr-list");
  if (list) {
    for (const zone of built.plan.zones) {
      const header = document.createElement("p");
      header.className =
        "px-1 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400";
      header.textContent = `${zone.category} · ${zone.count}`;
      list.appendChild(header);

      for (const bay of built.bays.filter((b) => b.item.category === zone.category)) {
        const btn = document.createElement("button");
        btn.dataset.srItem = bay.item.id;
        btn.className =
          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm cursor-pointer border-none bg-transparent hover:bg-gray-100 dark:hover:bg-dark-bg-hover transition-colors";
        btn.innerHTML = `<i class="${bay.item.icon} w-4 text-center opacity-70"></i>
          <span class="flex-1 truncate">${bay.item.label}</span>
          <span class="text-xs opacity-60">${bay.item.fw}×${bay.item.fd}</span>`;
        btn.addEventListener("click", () => focusItem(bay.item.id));
        list.appendChild(btn);
      }
    }
  }

  setText("sr-count", `${built.bays.length}`);
  setText("sr-size", `${Math.round(W)} × ${Math.round(D)} ft`);
  setText("sr-zones", `${built.plan.zones.length}`);

  // ── Picking ────────────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = { x: 0, y: 0 };
  renderer.domElement.addEventListener("pointerdown", (e) => {
    downAt = { x: e.clientX, y: e.clientY };
  });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return; // a drag, not a click
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(built.pickTargets, false)[0];
    const id = hit?.object.userData?.itemId;
    if (typeof id === "string") focusItem(id);
  });

  // ── Controls ───────────────────────────────────────────────────────────────
  function setSpin(on: boolean): void {
    spinning = on;
    const btn = document.getElementById("sr-spin");
    if (btn) {
      btn.textContent = on ? "Spin: On" : "Spin: Off";
      btn.classList.toggle("btn-primary", on);
      btn.classList.toggle("btn-default", !on);
    }
    requestRender();
  }
  document.getElementById("sr-overview")?.addEventListener("click", overview);
  document.getElementById("sr-spin")?.addEventListener("click", () => setSpin(!spinning));

  // Reuse the builder's command palette for search-to-jump.
  const palette = new CommandPalette(() =>
    built.bays.map<Command>((bay) => ({
      id: `showroom:${bay.item.id}`,
      title: bay.item.label,
      group: bay.item.category,
      icon: bay.item.icon,
      keywords: bay.item.keywords,
      hint: `${bay.item.fw} × ${bay.item.fd} ft`,
      run: () => focusItem(bay.item.id),
    })),
  );

  document.addEventListener("keydown", (e) => {
    if (palette.isOpen()) return;
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "Escape") overview();
    else if (e.key.toLowerCase() === "s") setSpin(!spinning);
  });

  const onResize = () => {
    camera.aspect = mount.clientWidth / mount.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    requestRender();
  };
  window.addEventListener("resize", onResize);

  // Boot straight into the overview so the generated plan is the first thing seen.
  camera.position.set(W * 0.5, W * 0.6, D * 0.75);
  controls.target.set(0, 6, 0);
  overview();
  setSpin(false);
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
