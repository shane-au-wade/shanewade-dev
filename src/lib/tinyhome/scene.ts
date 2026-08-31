// Three.js scene: renderer, camera, OrbitControls, lighting, gradient sky,
// grass ground and a per-lot pad + grid. Rendering is on-demand: we only draw
// when something changes, so an idle editor uses no GPU.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CELL_FEET, LEVEL_HEIGHT, type HouseState } from "./state";
import { nodeWorldX, nodeWorldZ } from "./coords";

export interface SceneCtx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  ground: THREE.Mesh;
  lotGroup: THREE.Group;
  requestRender: () => void;
  setPlanView: (on: boolean) => void;
  isPlanView: () => boolean;
  frameLot: (s: HouseState) => void;
  updateLot: (s: HouseState) => void;
  raycastFromPointer: (ev: PointerEvent, targets: THREE.Object3D[]) => THREE.Intersection[];
  raycastGround: (ev: PointerEvent) => THREE.Vector3 | null;
  raycastPlaneY: (ev: PointerEvent, y: number) => THREE.Vector3 | null;
  dispose: () => void;
}

function makeSkyTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#a9c9e8");
  grad.addColorStop(0.55, "#cfe0ee");
  grad.addColorStop(1, "#eef3f6");
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createScene(mount: HTMLElement): SceneCtx {
  const scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog("#d6e2ec", 120, 320);

  const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 2000);
  camera.position.set(28, 26, 34);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  mount.appendChild(renderer.domElement);

  // ── Lights ──────────────────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0xffffff, 0x93a06f, 0.7));
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  const sun = new THREE.DirectionalLight(0xfff3e0, 1.15);
  sun.position.set(34, 54, 26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0004;
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -80;
  sc.right = 80;
  sc.top = 80;
  sc.bottom = -80;
  sc.updateProjectionMatrix();
  scene.add(sun);

  // ── Ground ────────────────────────────────────────────────────────────────────────
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshLambertMaterial({ color: "#86ad6a" }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  ground.userData = { kind: "ground" };
  scene.add(ground);

  // ── Lot pad + grid (rebuilt on lot change) ──────────────────────────────────────────
  const lotGroup = new THREE.Group();
  lotGroup.name = "lot";
  scene.add(lotGroup);

  function updateLot(s: HouseState): void {
    disposeChildren(lotGroup);
    const w = s.cols * CELL_FEET;
    const d = s.rows * CELL_FEET;

    // Buildable pad.
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ color: "#c9c2ad" }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = -0.46;
    pad.receiveShadow = true;
    lotGroup.add(pad);

    // Grid lines on every 1 ft cell edge, with a stronger line every 5 ft so a
    // dense grid stays readable and measurable.
    const minor: number[] = [];
    const major: number[] = [];
    const y = -0.44;
    const z0 = nodeWorldZ(0, s.rows);
    const z1 = nodeWorldZ(s.rows, s.rows);
    const x0 = nodeWorldX(0, s.cols);
    const x1 = nodeWorldX(s.cols, s.cols);
    for (let x = 0; x <= s.cols; x++) {
      const wx = nodeWorldX(x, s.cols);
      (x % 5 === 0 ? major : minor).push(wx, y, z0, wx, y, z1);
    }
    for (let z = 0; z <= s.rows; z++) {
      const wz = nodeWorldZ(z, s.rows);
      (z % 5 === 0 ? major : minor).push(x0, y, wz, x1, y, wz);
    }
    const addLines = (pts: number[], color: string, opacity: number) => {
      if (pts.length === 0) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      lotGroup.add(
        new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity })),
      );
    };
    addLines(minor, "#8a8470", 0.22);
    addLines(major, "#6f6a58", 0.6);

    // Perimeter outline.
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.02, d)),
      new THREE.LineBasicMaterial({ color: "#5f5a49" }),
    );
    edge.position.y = -0.43;
    lotGroup.add(edge);

    requestRender();
  }

  // ── Controls ────────────────────────────────────────────────────────────────────────
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minDistance = 6;
  controls.maxDistance = 220;
  controls.target.set(0, 4, 0);

  // ── Render-on-demand ────────────────────────────────────────────────────────────────
  let dirty = true;
  let running = true;
  let controlsMoving = false;
  const requestRender = () => {
    dirty = true;
  };
  controls.addEventListener("change", requestRender);
  controls.addEventListener("start", () => (controlsMoving = true));
  controls.addEventListener("end", () => {
    controlsMoving = false;
    requestRender();
  });

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    controls.update();
    if (dirty || controlsMoving) {
      renderer.render(scene, camera);
      dirty = false;
    }
  }
  loop();

  // ── Plan view ─────────────────────────────────────────────────────────────────────────
  let planView = false;
  let savedPos = camera.position.clone();
  let savedTarget = controls.target.clone();
  function setPlanView(on: boolean) {
    if (on === planView) return;
    planView = on;
    if (on) {
      savedPos = camera.position.clone();
      savedTarget = controls.target.clone();
      const dist = camera.position.distanceTo(controls.target);
      camera.position.set(controls.target.x, Math.max(48, dist), controls.target.z + 0.001);
      controls.enableRotate = false;
    } else {
      camera.position.copy(savedPos);
      controls.target.copy(savedTarget);
      controls.enableRotate = true;
    }
    controls.update();
    requestRender();
  }

  function frameLot(s: HouseState) {
    const span = Math.max(s.cols, s.rows) * CELL_FEET;
    const dist = span * 1.1 + 18;
    controls.target.set(0, (s.levels * LEVEL_HEIGHT) / 2, 0);
    camera.position.set(dist * 0.7, dist * 0.6, dist * 0.85);
    controls.update();
    requestRender();
  }

  // ── Raycasting ─────────────────────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane();

  function toNdc(ev: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  }
  function raycastFromPointer(ev: PointerEvent, targets: THREE.Object3D[]) {
    toNdc(ev);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(targets, true);
  }
  function raycastPlaneY(ev: PointerEvent, y: number): THREE.Vector3 | null {
    toNdc(ev);
    raycaster.setFromCamera(ndc, camera);
    plane.setComponents(0, 1, 0, -y);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
  }
  function raycastGround(ev: PointerEvent) {
    return raycastPlaneY(ev, 0);
  }

  // ── Resize ────────────────────────────────────────────────────────────────────────────────
  const onResize = () => {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    requestRender();
  };
  window.addEventListener("resize", onResize);

  function dispose() {
    running = false;
    window.removeEventListener("resize", onResize);
    controls.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  return {
    renderer,
    scene,
    camera,
    controls,
    ground,
    lotGroup,
    requestRender,
    setPlanView,
    isPlanView: () => planView,
    frameLot,
    updateLot,
    raycastFromPointer,
    raycastGround,
    raycastPlaneY,
    dispose,
  };
}

function disposeChildren(group: THREE.Group): void {
  for (let i = group.children.length - 1; i >= 0; i--) {
    const child = group.children[i];
    group.remove(child);
    child.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
    });
  }
}
