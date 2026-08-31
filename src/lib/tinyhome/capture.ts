// Multi-angle screenshot capture. Renders the live scene from preset cameras
// into an offscreen renderer at a fixed resolution. The resulting images plus
// the house JSON are exactly the payload a future AI grading endpoint will
// consume — grading itself is out of scope for v1.

import * as THREE from "three";
import { CELL_FEET, LEVEL_HEIGHT, WALL_HEIGHT, type HouseState } from "./state";

export interface CaptureShot {
  label: string;
  dataUrl: string;
}

const WIDTH = 900;
const HEIGHT = 675;

export function captureViews(scene: THREE.Scene, s: HouseState): CaptureShot[] {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(WIDTH, HEIGHT);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const camera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 2000);

  const span = Math.max(s.cols, s.rows) * CELL_FEET;
  const height = s.levels * LEVEL_HEIGHT;
  const dist = span * 1.5 + height + 10;
  const center = new THREE.Vector3(0, height / 2, 0);

  // Roof meshes we hide for top-down and interior shots.
  const roofObjs: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.userData && o.userData.kind === "roof") roofObjs.push(o);
  });
  const setRoofVisible = (v: boolean) => roofObjs.forEach((o) => (o.visible = v));

  const shots: CaptureShot[] = [];

  const render = (label: string) => {
    camera.lookAt(center);
    renderer.render(scene, camera);
    shots.push({ label, dataUrl: renderer.domElement.toDataURL("image/png") });
  };

  // Four exterior corners.
  const corners: Array<[string, number, number]> = [
    ["Front Right", 1, 1],
    ["Front Left", -1, 1],
    ["Back Left", -1, -1],
    ["Back Right", 1, -1],
  ];
  setRoofVisible(true);
  for (const [label, sx, sz] of corners) {
    camera.position.set(sx * dist * 0.8, dist * 0.7, sz * dist * 0.8);
    render(label);
  }

  // Top-down plan (roof hidden to reveal layout).
  setRoofVisible(false);
  camera.position.set(0.001, dist * 1.4, 0.001);
  render("Top Down");

  // Interior eye-level shot (roof hidden).
  const eye = WALL_HEIGHT * 0.5;
  camera.position.set(-span * 0.35, eye, -span * 0.35);
  camera.lookAt(new THREE.Vector3(span * 0.3, eye * 0.8, span * 0.3));
  renderer.render(scene, camera);
  shots.push({ label: "Interior", dataUrl: renderer.domElement.toDataURL("image/png") });

  // Restore + clean up.
  setRoofVisible(true);
  renderer.dispose();
  renderer.domElement.width = 0;
  renderer.domElement.height = 0;

  return shots;
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
