// Procedural furniture catalog. Every item is built from three.js primitives
// with flat colors so v1 ships with zero downloaded assets. Each builder
// returns a Group centered on the floor at the origin, modelled directly in
// feet. glTF models can later replace `build` behind the same interface without
// touching tools/builder.

import * as THREE from "three";
import { LEVEL_HEIGHT } from "./state";

// Zones the showroom lays out, in the order it walks them.
export const ITEM_CATEGORIES = [
  "Kitchen",
  "Bathroom",
  "Bedroom",
  "Living",
  "Utility",
  "Structure",
  "Decor",
  "Lighting",
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export interface CatalogItem {
  id: string;
  label: string;
  category: ItemCategory;
  icon: string; // remix icon class
  keywords: string; // extra synonyms for the command palette search
  fw: number; // footprint width in ft
  fd: number; // footprint depth in ft
  build: () => THREE.Group;
}

function mat(color: number | string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

function glowMat(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: "#fff4cc" });
}

function box(
  w: number,
  h: number,
  d: number,
  color: number | string,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(
  r: number,
  h: number,
  color: number | string,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function tapered(
  rTop: number,
  rBottom: number,
  h: number,
  color: number | string,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 20), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const WOOD = "#9c6b43";
const WOOD_DARK = "#6f4a2d";
const FABRIC = "#5b6b7a";
const FABRIC_WARM = "#b5651d";
const WHITE = "#f2f2ef";
const METAL = "#b8bcc2";
const GREEN = "#4b7a3f";
const PORCELAIN = "#f7f8f6";
const BASIN_SHADOW = "#dbe0e0"; // reads as the hollow of a bowl
const MIRROR = "#c6d8e0";
const APPLIANCE = "#3a3e44";
const FABRIC_SOFT = "#8b7d6e";

// A rectangular basin: solid body with a recessed lip and a drain, so a flat-
// shaded box still reads as something you can wash your hands in.
function basin(w: number, d: number, h: number, rimY: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, h, d, PORCELAIN, 0, rimY - h / 2, 0));
  g.add(box(w - 0.22, 0.06, d - 0.22, BASIN_SHADOW, 0, rimY - 0.02, 0));
  g.add(cyl(0.055, 0.05, METAL, 0, rimY - 0.05, 0));
  return g;
}

// Faucet standing on a deck at `deckY`. A gooseneck arc suits kitchen sinks;
// the straight spout suits basins.
function faucet(x: number, z: number, deckY: number, gooseneck = false): THREE.Group {
  const g = new THREE.Group();
  const riseH = gooseneck ? 0.85 : 0.5;
  g.add(cyl(0.05, riseH, METAL, x, deckY + riseH / 2, z));
  const topY = deckY + riseH;
  if (gooseneck) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.045, 8, 14, Math.PI),
      mat(METAL),
    );
    // Half-torus standing upright, curving forward over the basin.
    arc.rotation.y = Math.PI / 2;
    arc.position.set(x, topY, z + 0.26);
    g.add(arc);
    g.add(cyl(0.04, 0.16, METAL, x, topY - 0.08, z + 0.52));
  } else {
    const spout = box(0.075, 0.075, 0.42, METAL, x, topY, z + 0.19);
    g.add(spout);
    g.add(cyl(0.05, 0.06, METAL, x, topY - 0.02, z + 0.38));
  }
  for (const hx of [-0.24, 0.24]) {
    g.add(cyl(0.045, 0.16, METAL, x + hx, deckY + 0.08, z));
    g.add(box(0.2, 0.045, 0.06, METAL, x + hx, deckY + 0.17, z));
  }
  return g;
}

export const CATALOG: CatalogItem[] = [
  {
    id: "bed",
    label: "Bed",
    category: "Bedroom",
    icon: "ri-hotel-bed-line",
    keywords: "sleep bedroom mattress double queen",
    fw: 5,
    fd: 6,
    build() {
      const g = new THREE.Group();
      g.add(box(4.4, 0.6, 5.8, WOOD_DARK, 0, 0.5, 0)); // frame
      g.add(box(4.2, 0.4, 5.6, WHITE, 0, 0.95, 0.1)); // mattress
      g.add(box(3.8, 0.4, 1.2, "#cdd6e0", 0, 1.2, -2)); // pillows
      g.add(box(4.0, 0.15, 3.6, FABRIC, 0, 1.2, 0.8)); // blanket
      return g;
    },
  },
  {
    id: "sofa",
    label: "Sofa",
    category: "Living",
    icon: "ri-sofa-line",
    keywords: "couch settee lounge living seating",
    fw: 5,
    fd: 2,
    build() {
      const g = new THREE.Group();
      g.add(box(4.6, 0.7, 2.0, FABRIC, 0, 0.6, 0)); // base
      g.add(box(4.6, 1.2, 0.5, FABRIC, 0, 1.2, -0.75)); // back
      g.add(box(0.5, 1.0, 2.0, FABRIC, -2.05, 1.0, 0)); // arm
      g.add(box(0.5, 1.0, 2.0, FABRIC, 2.05, 1.0, 0)); // arm
      return g;
    },
  },
  {
    id: "table",
    label: "Table",
    category: "Living",
    icon: "ri-table-line",
    keywords: "dining desk worktop",
    fw: 3,
    fd: 3,
    build() {
      const g = new THREE.Group();
      g.add(box(2.4, 0.18, 2.4, WOOD, 0, 2.3, 0)); // top
      const legs: Array<[number, number]> = [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ];
      for (const [lx, lz] of legs) g.add(box(0.18, 2.2, 0.18, WOOD_DARK, lx, 1.1, lz));
      return g;
    },
  },
  {
    id: "chair",
    label: "Chair",
    category: "Living",
    icon: "ri-armchair-line",
    keywords: "seat stool dining armchair",
    fw: 2,
    fd: 2,
    build() {
      const g = new THREE.Group();
      g.add(box(1.3, 0.15, 1.3, WOOD, 0, 1.5, 0)); // seat
      g.add(box(1.3, 1.4, 0.15, WOOD, 0, 2.2, -0.55)); // back
      const legs: Array<[number, number]> = [
        [-0.5, -0.5],
        [0.5, -0.5],
        [-0.5, 0.5],
        [0.5, 0.5],
      ];
      for (const [lx, lz] of legs) g.add(box(0.14, 1.5, 0.14, WOOD_DARK, lx, 0.75, lz));
      return g;
    },
  },
  {
    id: "coffee-table",
    label: "Coffee table",
    category: "Living",
    icon: "ri-table-alt-line",
    keywords: "low table living ottoman cocktail lounge",
    fw: 3,
    fd: 2,
    build() {
      const g = new THREE.Group();
      g.add(box(2.7, 0.12, 1.6, WOOD, 0, 1.35, 0));
      g.add(box(2.4, 0.08, 1.4, WOOD_DARK, 0, 0.7, 0)); // lower shelf
      for (const [lx, lz] of [
        [-1.15, -0.65],
        [1.15, -0.65],
        [-1.15, 0.65],
        [1.15, 0.65],
      ] as Array<[number, number]>) {
        g.add(box(0.12, 1.3, 0.12, WOOD_DARK, lx, 0.65, lz));
      }
      return g;
    },
  },
  {
    id: "armchair",
    label: "Armchair",
    category: "Living",
    icon: "ri-armchair-line",
    keywords: "lounge chair accent seating living reading",
    fw: 3,
    fd: 3,
    build() {
      const g = new THREE.Group();
      g.add(box(2.4, 0.7, 2.3, FABRIC_SOFT, 0, 0.7, 0.1)); // seat
      g.add(box(2.4, 1.5, 0.5, FABRIC_SOFT, 0, 1.7, -0.95)); // back
      g.add(box(0.4, 1.1, 2.1, FABRIC_SOFT, -1.15, 1.25, 0.05));
      g.add(box(0.4, 1.1, 2.1, FABRIC_SOFT, 1.15, 1.25, 0.05));
      g.add(box(1.6, 0.25, 0.7, "#cfc6b8", 0, 1.15, 0.15)); // cushion
      return g;
    },
  },
  {
    id: "kitchen",
    label: "Kitchen",
    category: "Kitchen",
    icon: "ri-fridge-line",
    keywords: "counter sink cabinet cook galley worktop",
    fw: 3,
    fd: 3,
    build() {
      const g = new THREE.Group();
      g.add(box(2.8, 3.0, 2.2, WHITE, 0, 1.5, 0)); // cabinet
      g.add(box(2.9, 0.2, 2.3, WOOD_DARK, 0, 3.05, 0)); // countertop
      g.add(box(1.0, 0.1, 1.0, METAL, 0.5, 3.16, 0)); // sink basin
      g.add(cyl(0.06, 0.6, METAL, 0.5, 3.4, -0.3)); // faucet
      return g;
    },
  },
  {
    id: "sink-kitchen",
    label: "Kitchen sink",
    category: "Kitchen",
    icon: "ri-drop-line",
    keywords: "basin double bowl washing up dishes galley plumbing counter",
    fw: 3,
    fd: 2,
    build() {
      const g = new THREE.Group();
      const cabH = 2.9;
      const deck = 3.0; // 36 in counter height
      g.add(box(2.7, cabH, 1.9, WHITE, 0, cabH / 2 + 0.1, 0)); // base cabinet
      g.add(box(2.5, 0.1, 1.8, "#d8d8d4", 0, 0.05, 0)); // toe kick
      g.add(box(2.9, 0.18, 2.0, WOOD_DARK, 0, deck - 0.09, 0)); // countertop
      // Twin bowls dropped in, rims sitting just proud of the deck so the
      // hollow stays visible above the countertop slab.
      for (const bx of [-0.58, 0.58]) {
        const bowl = basin(1.02, 1.3, 0.62, deck + 0.06);
        bowl.position.x = bx;
        g.add(bowl);
      }
      g.add(faucet(0, -0.72, deck, true));
      return g;
    },
  },
  {
    id: "counter",
    label: "Counter",
    category: "Kitchen",
    icon: "ri-rectangle-line",
    keywords: "worktop butcher block cabinet base run prep surface no sink",
    fw: 3,
    fd: 2,
    build() {
      const g = new THREE.Group();
      const cabH = 2.9;
      g.add(box(2.7, cabH, 1.8, WHITE, 0, cabH / 2 + 0.1, 0)); // base cabinet
      g.add(box(2.5, 0.1, 1.7, "#d8d8d4", 0, 0.05, 0)); // toe kick
      g.add(box(2.9, 0.22, 1.95, WOOD, 0, 2.89, 0)); // butcher block top
      for (const dx of [-0.66, 0.66]) {
        g.add(box(1.2, cabH - 0.5, 0.06, "#e6e6e2", dx, cabH / 2 + 0.15, 0.92)); // door
        g.add(box(0.5, 0.07, 0.07, METAL, dx, cabH - 0.35, 0.96)); // pull
      }
      return g;
    },
  },
  {
    id: "fridge",
    label: "Fridge",
    category: "Kitchen",
    icon: "ri-archive-2-line",
    keywords: "refrigerator freezer appliance cold",
    fw: 2,
    fd: 2,
    build() {
      const g = new THREE.Group();
      g.add(box(2.0, 5.2, 2.0, METAL, 0, 2.6, 0));
      g.add(box(0.12, 0.8, 0.12, "#888", 0.8, 3.4, 0.94)); // handle
      g.add(box(0.12, 0.8, 0.12, "#888", 0.8, 2.2, 0.94));
      return g;
    },
  },
  {
    id: "range",
    label: "Range",
    category: "Kitchen",
    icon: "ri-fire-line",
    keywords: "stove oven cooktop cooker hob burners gas electric cook",
    fw: 2,
    fd: 2,
    build() {
      const g = new THREE.Group();
      g.add(box(1.9, 2.9, 1.85, APPLIANCE, 0, 1.45, 0)); // body
      g.add(box(1.95, 0.14, 1.9, "#2a2d32", 0, 2.97, 0)); // cooktop
      const burners: Array<[number, number]> = [
        [-0.48, -0.42],
        [0.48, -0.42],
        [-0.48, 0.42],
        [0.48, 0.42],
      ];
      for (const [bx, bz] of burners) {
        g.add(cyl(0.22, 0.04, "#6a6e74", bx, 3.06, bz));
        g.add(cyl(0.08, 0.05, "#c45c2a", bx, 3.08, bz));
      }
      g.add(box(1.9, 0.55, 0.16, APPLIANCE, 0, 3.3, -0.84)); // backsplash / controls
      for (const kx of [-0.55, -0.18, 0.18, 0.55]) g.add(cyl(0.06, 0.08, METAL, kx, 3.42, -0.76));
      g.add(box(1.5, 1.5, 0.06, "#1c1e22", 0, 1.35, 0.94)); // oven door
      g.add(box(0.5, 0.08, 0.08, METAL, 0, 2.0, 0.98)); // handle
      return g;
    },
  },
  {
    id: "island",
    label: "Island",
    category: "Kitchen",
    icon: "ri-layout-masonry-line",
    keywords: "prep table peninsula butcher block seating breakfast bar worktop",
    fw: 3,
    fd: 3,
    build() {
      const g = new THREE.Group();
      g.add(box(2.5, 2.9, 2.2, WHITE, 0, 1.45, -0.15)); // cabinet mass
      g.add(box(2.9, 0.2, 2.85, WOOD, 0, 2.95, 0)); // overhang toward seating
      for (const dx of [-0.6, 0.6]) {
        g.add(box(1.1, 2.2, 0.06, "#e6e6e2", dx, 1.35, 0.97));
        g.add(box(0.4, 0.07, 0.07, METAL, dx, 2.2, 1.02));
      }
      // Two stools tucked under the overhang.
      for (const sx of [-0.7, 0.7]) {
        g.add(cyl(0.28, 0.08, WOOD_DARK, sx, 2.05, 1.15));
        g.add(cyl(0.06, 2.0, METAL, sx, 1.0, 1.15));
        g.add(cyl(0.22, 0.06, WOOD_DARK, sx, 0.04, 1.15));
      }
      return g;
    },
  },
  {
    id: "toilet",
    label: "Toilet",
    category: "Bathroom",
    icon: "ri-drop-line",
    keywords: "wc bathroom loo lavatory washroom",
    fw: 2,
    fd: 2,
    build() {
      const g = new THREE.Group();
      g.add(box(1.4, 1.2, 0.6, WHITE, 0, 0.6, -0.9)); // tank
      g.add(cyl(0.7, 1.2, WHITE, 0, 0.6, 0)); // bowl
      g.add(cyl(0.75, 0.12, "#dcdcda", 0, 1.2, 0)); // seat
      return g;
    },
  },
  {
    id: "shower",
    label: "Shower",
    category: "Bathroom",
    icon: "ri-showers-line",
    keywords: "bath bathroom wash washroom wet room ensuite",
    fw: 3,
    fd: 3,
    build() {
      const g = new THREE.Group();
      g.add(box(2.6, 0.2, 2.6, "#d7dde2", 0, 0.1, 0)); // pan
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 6.0, 0.08),
        new THREE.MeshLambertMaterial({ color: "#bcd7e6", transparent: true, opacity: 0.35 }),
      );
      glass.position.set(0, 3, 1.3);
      g.add(glass);
      const glass2 = glass.clone();
      glass2.rotation.y = Math.PI / 2;
      glass2.position.set(1.3, 3, 0);
      g.add(glass2);
      g.add(cyl(0.1, 0.1, METAL, 0.9, 5.5, -0.9)); // head
      return g;
    },
  },
  {
    id: "sink-pedestal",
    label: "Pedestal sink",
    category: "Bathroom",
    icon: "ri-drop-line",
    keywords: "basin lavatory washbasin bathroom hand wash pedestal freestanding",
    fw: 2,
    fd: 2,
    build() {
      const g = new THREE.Group();
      const rim = 2.75; // 33 in rim height
      g.add(tapered(0.34, 0.5, rim - 0.5, PORCELAIN, 0, (rim - 0.5) / 2, 0)); // column
      g.add(box(1.1, 0.1, 0.9, PORCELAIN, 0, 0.05, 0)); // foot
      g.add(basin(1.7, 1.4, 0.5, rim));
      g.add(faucet(0, -0.5, rim));
      return g;
    },
  },
  {
    id: "sink-vanity",
    label: "Vanity sink",
    category: "Bathroom",
    icon: "ri-drop-line",
    keywords: "basin lavatory washbasin bathroom vanity cabinet mirror storage under",
    fw: 3,
    fd: 2,
    build() {
      const g = new THREE.Group();
      const cabH = 2.5;
      const rim = 2.7;
      g.add(box(2.7, cabH, 1.7, WOOD, 0, cabH / 2 + 0.2, 0)); // cabinet
      g.add(box(2.5, 0.2, 1.6, WOOD_DARK, 0, 0.1, 0)); // toe kick
      g.add(box(2.85, 0.16, 1.85, WHITE, 0, rim - 0.08, 0)); // counter
      g.add(basin(1.5, 1.25, 0.42, rim + 0.18)); // vessel basin sitting on the counter
      g.add(faucet(0, -0.6, rim));
      for (const dx of [-0.66, 0.66]) {
        g.add(box(1.22, cabH - 0.3, 0.06, WOOD_DARK, dx, cabH / 2 + 0.2, 0.87)); // door
        g.add(cyl(0.04, 0.34, METAL, dx + (dx < 0 ? 0.5 : -0.5), cabH / 2 + 0.2, 0.93)); // pull
      }
      // Wall mirror above, which is what makes the bay read as a bathroom.
      g.add(box(1.9, 2.2, 0.08, WOOD_DARK, 0, 4.5, -0.86));
      g.add(box(1.7, 2.0, 0.04, MIRROR, 0, 4.5, -0.8));
      return g;
    },
  },
  {
    id: "sink-corner",
    label: "Corner sink",
    category: "Bathroom",
    icon: "ri-drop-line",
    keywords: "basin lavatory washbasin bathroom corner triangle compact small space saving tiny",
    fw: 2,
    fd: 2,
    build() {
      const g = new THREE.Group();
      const rim = 2.75;
      // Right triangle with its square corner at -x/-z, so the basin tucks into
      // a corner and presents its diagonal to the room.
      const triangle = (r: number, depth: number) => {
        const s = new THREE.Shape();
        s.moveTo(-r, -r);
        s.lineTo(r, -r);
        s.lineTo(-r, r);
        s.closePath();
        return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
      };
      const body = new THREE.Mesh(triangle(0.9, 0.55), mat(PORCELAIN));
      body.rotation.x = Math.PI / 2; // lay the shape flat, extruding down from the rim
      body.position.y = rim;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      // Hollow uses the same triangle, inset toward the corner so it cannot
      // poke through the diagonal face.
      const hollow = new THREE.Mesh(triangle(0.66, 0.06), mat(BASIN_SHADOW));
      hollow.rotation.x = Math.PI / 2;
      hollow.position.set(-0.16, rim + 0.005, -0.16);
      g.add(hollow);
      g.add(cyl(0.055, 0.05, METAL, -0.25, rim - 0.05, -0.25)); // drain
      g.add(tapered(0.16, 0.22, rim - 0.55, PORCELAIN, -0.45, (rim - 0.55) / 2, -0.45)); // shroud
      g.add(faucet(-0.5, -0.5, rim));
      return g;
    },
  },
  {
    id: "bathtub",
    label: "Bathtub",
    category: "Bathroom",
    icon: "ri-drop-fill",
    keywords: "tub bath soaking alcove bathroom wash",
    fw: 5,
    fd: 3,
    build() {
      const g = new THREE.Group();
      g.add(box(4.7, 1.45, 2.6, PORCELAIN, 0, 0.73, 0)); // tub body
      g.add(box(4.3, 0.08, 2.2, "#c5d4dc", 0, 1.38, 0)); // water
      g.add(box(4.85, 0.12, 2.75, PORCELAIN, 0, 1.5, 0)); // rim
      g.add(cyl(0.06, 0.08, METAL, 0, 1.36, 0)); // drain
      g.add(faucet(-1.9, -1.05, 1.5, true));
      return g;
    },
  },
  {
    id: "linen",
    label: "Linen cabinet",
    category: "Bathroom",
    icon: "ri-archive-line",
    keywords: "towel cupboard bathroom closet shelves laundry hamper",
    fw: 2,
    fd: 2,
    build() {
      const g = new THREE.Group();
      g.add(box(1.7, 5.4, 1.4, WHITE, 0, 2.7, 0));
      g.add(box(1.55, 5.1, 0.06, "#e4e4e0", 0, 2.7, 0.72)); // door
      g.add(cyl(0.04, 0.4, METAL, 0.55, 2.7, 0.78));
      for (let i = 0; i < 3; i++) g.add(box(1.5, 0.06, 1.2, "#d8d4cc", 0, 1.2 + i * 1.4, 0));
      return g;
    },
  },
  {
    id: "storage",
    label: "Storage",
    category: "Bedroom",
    icon: "ri-inbox-archive-line",
    keywords: "shelf shelving closet cupboard wardrobe bookcase",
    fw: 3,
    fd: 2,
    build() {
      const g = new THREE.Group();
      g.add(box(2.6, 4.0, 1.4, WOOD, 0, 2.0, 0));
      for (let i = 0; i < 3; i++) g.add(box(2.4, 0.08, 1.3, WOOD_DARK, 0, 1.0 + i * 1.2, 0.05));
      return g;
    },
  },
  {
    id: "nightstand",
    label: "Nightstand",
    category: "Bedroom",
    icon: "ri-archive-drawer-line",
    keywords: "bedside table drawer lamp stand bedroom",
    fw: 2,
    fd: 2,
    build() {
      const g = new THREE.Group();
      g.add(box(1.6, 0.12, 1.5, WOOD, 0, 2.05, 0)); // top
      g.add(box(1.5, 1.7, 1.4, WOOD_DARK, 0, 1.15, 0));
      g.add(box(1.35, 0.55, 0.06, WOOD, 0, 1.45, 0.73)); // drawer
      g.add(box(0.35, 0.06, 0.06, METAL, 0, 1.45, 0.78));
      for (const [lx, lz] of [
        [-0.6, -0.55],
        [0.6, -0.55],
        [-0.6, 0.55],
        [0.6, 0.55],
      ] as Array<[number, number]>) {
        g.add(box(0.12, 0.3, 0.12, WOOD_DARK, lx, 0.15, lz));
      }
      return g;
    },
  },
  {
    id: "dresser",
    label: "Dresser",
    category: "Bedroom",
    icon: "ri-archive-drawer-line",
    keywords: "chest drawers clothes bureau bedroom storage",
    fw: 3,
    fd: 2,
    build() {
      const g = new THREE.Group();
      g.add(box(2.8, 3.2, 1.5, WOOD, 0, 1.7, 0));
      g.add(box(2.9, 0.12, 1.6, WOOD_DARK, 0, 3.32, 0));
      for (let i = 0; i < 3; i++) {
        const y = 0.7 + i * 0.95;
        g.add(box(2.55, 0.8, 0.06, WOOD_DARK, 0, y, 0.78));
        g.add(box(0.45, 0.07, 0.07, METAL, 0, y, 0.84));
      }
      return g;
    },
  },
  {
    id: "rug",
    label: "Rug",
    category: "Decor",
    icon: "ri-layout-grid-line",
    keywords: "carpet mat floor covering",
    fw: 6,
    fd: 6,
    build() {
      const g = new THREE.Group();
      g.add(box(5.4, 0.06, 5.4, FABRIC_WARM, 0, 0.06, 0));
      g.add(box(4.6, 0.08, 4.6, "#d98c4a", 0, 0.08, 0));
      return g;
    },
  },
  {
    id: "plant",
    label: "Plant",
    category: "Decor",
    icon: "ri-plant-line",
    keywords: "tree greenery pot foliage houseplant",
    fw: 2,
    fd: 2,
    build() {
      const g = new THREE.Group();
      g.add(cyl(0.5, 0.9, "#a3623b", 0, 0.45, 0)); // pot
      g.add(cyl(0.12, 1.4, WOOD_DARK, 0, 1.6, 0)); // stem
      const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(0.98, 1), mat(GREEN));
      foliage.position.set(0, 2.8, 0);
      foliage.castShadow = true;
      g.add(foliage);
      return g;
    },
  },
  {
    id: "stairs",
    label: "Stairs",
    category: "Structure",
    icon: "ri-stairs-line",
    keywords: "staircase stairway steps flight loft access upstairs",
    fw: 3,
    fd: 10,
    build() {
      const g = new THREE.Group();
      // 12 risers of 8" over a 10 ft run: steep, but typical for a tiny home.
      const steps = 12;
      const totalRun = 10;
      const rise = LEVEL_HEIGHT / steps;
      const run = totalRun / steps;
      const width = 3;
      const z0 = -totalRun / 2;
      for (let i = 0; i < steps; i++) {
        const h = rise * (i + 1);
        const step = box(width, h, run, i % 2 === 0 ? WOOD : WOOD_DARK, 0, h / 2, z0 + run * (i + 0.5));
        g.add(step);
      }
      // Side stringers, angled along the flight. Shortened from the true
      // diagonal so the rotated box stays inside the 3 × 10 ft footprint and
      // above the floor.
      const diagonal = Math.hypot(totalRun, LEVEL_HEIGHT) - 0.85;
      for (const sx of [-width / 2 + 0.1, width / 2 - 0.1]) {
        const stringer = box(0.2, 0.6, diagonal, WOOD_DARK, sx, LEVEL_HEIGHT / 2, 0);
        stringer.rotation.x = -Math.atan2(LEVEL_HEIGHT, totalRun);
        g.add(stringer);
      }
      // Simple handrail on the open side.
      const railX = width / 2 - 0.1;
      const rail = box(0.12, 0.12, diagonal, WOOD_DARK, railX, LEVEL_HEIGHT / 2 + 3, 0);
      rail.rotation.x = -Math.atan2(LEVEL_HEIGHT, totalRun);
      g.add(rail);
      for (let i = 1; i < steps; i += 3) {
        const y = rise * (i + 1);
        g.add(box(0.1, 3, 0.1, WOOD_DARK, railX, y + 1.5, z0 + run * (i + 0.5)));
      }
      return g;
    },
  },
  {
    id: "stairs-metal",
    label: "Steel stairs",
    category: "Structure",
    icon: "ri-stairs-line",
    keywords: "staircase metal steel iron industrial open riser undercroft gray grey loft",
    fw: 3,
    fd: 10,
    build() {
      const g = new THREE.Group();
      const steps = 12;
      const totalRun = 10;
      const rise = LEVEL_HEIGHT / steps;
      const run = totalRun / steps;
      const width = 2.55; // treads sit between the stringers
      const z0 = -totalRun / 2;
      const steel = "#8b9298";
      const steelDark = "#5d646b";
      // Open treads: thin plates only, so the volume under the flight stays clear.
      for (let i = 0; i < steps; i++) {
        const y = rise * (i + 1);
        const z = z0 + run * (i + 0.5);
        g.add(box(width, 0.08, run - 0.04, steel, 0, y - 0.04, z));
        g.add(box(width, 0.04, 0.06, steelDark, 0, y, z + run / 2 - 0.08)); // nosing
      }
      const diagonal = Math.hypot(totalRun, LEVEL_HEIGHT) - 0.85;
      const pitch = -Math.atan2(LEVEL_HEIGHT, totalRun);
      for (const sx of [-1.38, 1.38]) {
        const stringer = box(0.12, 0.32, diagonal, steelDark, sx, LEVEL_HEIGHT / 2, 0);
        stringer.rotation.x = pitch;
        g.add(stringer);
      }
      const railX = 1.38;
      const rail = box(0.08, 0.08, diagonal, steel, railX, LEVEL_HEIGHT / 2 + 3, 0);
      rail.rotation.x = pitch;
      g.add(rail);
      // Balusters rise from the treads, not the floor, so they don't fill the undercroft.
      for (let i = 0; i < steps; i += 2) {
        const y = rise * (i + 1);
        const z = z0 + run * (i + 0.5);
        g.add(box(0.06, 3, 0.06, steel, railX, y + 1.5, z));
      }
      return g;
    },
  },
  {
    id: "ladder",
    label: "Loft ladder",
    category: "Structure",
    icon: "ri-stairs-line",
    keywords: "ship ladder loft access compact stairs vertical climb",
    fw: 2,
    fd: 3,
    build() {
      const g = new THREE.Group();
      const lean = 0.2; // tilt toward +z so it reads as a climb, not a wall
      for (const x of [-0.7, 0.7]) {
        const rail = box(0.1, 7.5, 0.1, WOOD_DARK, x, 3.8, 0);
        rail.rotation.x = lean;
        g.add(rail);
      }
      for (let i = 0; i < 8; i++) {
        const t = (i + 1) / 9;
        const y = 0.4 + t * 6.8;
        const z = Math.sin(lean) * (y - 3.8);
        g.add(box(1.5, 0.08, 0.22, WOOD, 0, y, z));
      }
      return g;
    },
  },
  {
    id: "rail-wood",
    label: "Wood rail",
    category: "Structure",
    icon: "ri-subtract-line",
    keywords: "railing banister guard loft balcony half wall barrier fence wooden",
    fw: 4,
    fd: 1,
    build() {
      const g = new THREE.Group();
      const h = 3.5;
      for (const x of [-1.75, 0, 1.75]) {
        g.add(box(0.18, h, 0.18, WOOD_DARK, x, h / 2, 0));
      }
      g.add(box(3.85, 0.14, 0.22, WOOD, 0, h - 0.07, 0)); // cap
      g.add(box(3.7, 0.1, 0.14, WOOD_DARK, 0, 0.28, 0)); // shoe rail
      for (let i = 0; i < 9; i++) {
        const x = -1.55 + i * 0.39;
        g.add(box(0.08, h - 0.55, 0.06, WOOD, x, (h - 0.55) / 2 + 0.32, 0));
      }
      return g;
    },
  },
  {
    id: "rail-steel",
    label: "Steel rail",
    category: "Structure",
    icon: "ri-subtract-line",
    keywords: "railing banister guard loft balcony half wall barrier fence metal gray grey industrial",
    fw: 4,
    fd: 1,
    build() {
      const g = new THREE.Group();
      const h = 3.5;
      const steel = "#8b9298";
      const steelDark = "#5d646b";
      for (const x of [-1.8, 0, 1.8]) {
        g.add(box(0.08, h, 0.08, steelDark, x, h / 2, 0));
      }
      g.add(box(3.85, 0.08, 0.1, steel, 0, h - 0.04, 0)); // top
      g.add(box(3.7, 0.06, 0.06, steelDark, 0, 0.2, 0)); // kick
      for (const y of [1.15, 2.05, 2.9]) {
        g.add(box(3.55, 0.05, 0.05, steel, 0, y, 0));
      }
      return g;
    },
  },
  {
    id: "washer",
    label: "Washer",
    category: "Utility",
    icon: "ri-drop-line",
    keywords: "washing machine laundry washer dryer combo appliance",
    fw: 2,
    fd: 2,
    build() {
      const g = new THREE.Group();
      g.add(box(1.9, 3.1, 1.9, WHITE, 0, 1.55, 0));
      g.add(box(1.9, 0.35, 1.9, "#d8d8d4", 0, 3.28, 0)); // control deck
      const door = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 24), mat(MIRROR));
      door.rotation.x = Math.PI / 2;
      door.position.set(0, 1.55, 0.96);
      g.add(door);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.08, 24), mat(METAL));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 1.55, 0.93);
      g.add(ring);
      g.add(box(0.7, 0.08, 0.08, METAL, 0.55, 2.35, 0.98)); // handle
      for (const kx of [-0.45, 0, 0.45]) g.add(cyl(0.07, 0.06, APPLIANCE, kx, 3.38, 0.7));
      return g;
    },
  },
  {
    id: "water-heater",
    label: "Water heater",
    category: "Utility",
    icon: "ri-fire-line",
    keywords: "hot water tank boiler heater plumbing utility mechanical",
    fw: 2,
    fd: 2,
    build() {
      const g = new THREE.Group();
      g.add(cyl(0.85, 4.4, METAL, 0, 2.3, 0));
      g.add(cyl(0.88, 0.16, "#6a7076", 0, 4.55, 0)); // lid
      g.add(cyl(0.88, 0.2, "#6a7076", 0, 0.12, 0)); // base ring
      g.add(cyl(0.08, 0.7, METAL, 0.35, 4.95, 0)); // flue
      g.add(box(0.28, 0.7, 0.12, APPLIANCE, 0.75, 1.6, 0)); // access panel
      return g;
    },
  },
  {
    id: "lamp",
    label: "Floor lamp",
    category: "Lighting",
    icon: "ri-lightbulb-line",
    keywords: "light lighting floor lamp standing torchiere",
    fw: 2,
    fd: 2,
    build() {
      const g = new THREE.Group();
      g.add(cyl(0.5, 0.15, WOOD_DARK, 0, 0.08, 0)); // base
      g.add(cyl(0.08, 4.2, METAL, 0, 2.1, 0)); // pole
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.98, 1.0, 16), mat("#f5e6c0"));
      shade.position.set(0, 4.4, 0);
      g.add(shade);
      return g;
    },
  },
  {
    id: "lamp-table",
    label: "Table lamp",
    category: "Lighting",
    icon: "ri-lightbulb-line",
    keywords: "light lighting bedside nightstand desk accent",
    fw: 1,
    fd: 1,
    build() {
      const g = new THREE.Group();
      g.add(cyl(0.22, 0.08, WOOD_DARK, 0, 0.04, 0));
      g.add(cyl(0.05, 1.1, METAL, 0, 0.62, 0));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.55, 16), mat("#f5e6c0"));
      shade.position.set(0, 1.4, 0);
      g.add(shade);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), glowMat());
      glow.position.set(0, 1.25, 0);
      g.add(glow);
      return g;
    },
  },
  {
    id: "lamp-pendant",
    label: "Pendant",
    category: "Lighting",
    icon: "ri-lightbulb-line",
    keywords: "light lighting hanging overhead chandelier dining island ceiling",
    fw: 2,
    fd: 2,
    build() {
      const g = new THREE.Group();
      const mountY = LEVEL_HEIGHT - 0.08;
      g.add(cyl(0.18, 0.08, METAL, 0, mountY, 0)); // canopy
      g.add(cyl(0.03, 1.6, METAL, 0, mountY - 0.84, 0)); // cord
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.55, 0.7, 16), mat("#f5e6c0"));
      shade.position.set(0, mountY - 1.85, 0);
      g.add(shade);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), glowMat());
      glow.position.set(0, mountY - 1.7, 0);
      g.add(glow);
      return g;
    },
  },
  {
    id: "lamp-ceiling",
    label: "Ceiling light",
    category: "Lighting",
    icon: "ri-lightbulb-flash-line",
    keywords: "light lighting flush mount overhead dome disk ceiling fixture",
    fw: 2,
    fd: 2,
    build() {
      const g = new THREE.Group();
      const y = LEVEL_HEIGHT - 0.2;
      g.add(cyl(0.55, 0.1, METAL, 0, y + 0.08, 0)); // mount
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glowMat());
      dome.rotation.x = Math.PI;
      dome.position.set(0, y, 0);
      g.add(dome);
      g.add(cyl(0.72, 0.06, "#d8c9a4", 0, y - 0.02, 0)); // rim
      return g;
    },
  },
  {
    id: "lamp-sconce",
    label: "Sconce",
    category: "Lighting",
    icon: "ri-lightbulb-line",
    keywords: "light lighting wall sconce hallway bath vanity upstairs",
    fw: 1,
    fd: 1,
    build() {
      const g = new THREE.Group();
      // Sits on the back of a 1 ft cell so it reads as wall-mounted.
      g.add(box(0.28, 0.4, 0.08, METAL, 0, 5.4, -0.42));
      g.add(box(0.08, 0.08, 0.22, METAL, 0, 5.4, -0.28));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.45, 14), mat("#f5e6c0"));
      shade.position.set(0, 5.4, -0.12);
      g.add(shade);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), glowMat());
      glow.position.set(0, 5.4, -0.12);
      g.add(glow);
      return g;
    },
  },
  {
    id: "bookshelf",
    label: "Bookshelf",
    category: "Decor",
    icon: "ri-book-2-line",
    keywords: "books shelves library case display living office",
    fw: 3,
    fd: 1,
    build() {
      const g = new THREE.Group();
      g.add(box(2.8, 5.6, 0.85, WOOD, 0, 2.8, 0));
      g.add(box(2.6, 5.4, 0.08, WOOD_DARK, 0, 2.8, -0.4)); // back
      for (let i = 0; i < 4; i++) g.add(box(2.55, 0.08, 0.75, WOOD_DARK, 0, 0.7 + i * 1.35, 0.02));
      const colors = ["#6b4a32", "#3d5a73", "#7a3e3e", "#4a5a3a"];
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 5; j++) {
          const w = 0.28 + ((i + j) % 3) * 0.06;
          g.add(box(w, 0.85, 0.45, colors[(i + j) % colors.length], -1.0 + j * 0.5, 1.2 + i * 1.35, 0.05));
        }
      }
      return g;
    },
  },
  {
    id: "artwork",
    label: "Artwork",
    category: "Decor",
    icon: "ri-image-line",
    keywords: "picture frame painting print wall art canvas",
    fw: 2,
    fd: 1,
    build() {
      const g = new THREE.Group();
      g.add(box(1.7, 2.1, 0.1, WOOD_DARK, 0, 4.1, -0.35)); // frame
      g.add(box(1.4, 1.8, 0.04, "#d4c4a8", 0, 4.1, -0.28));
      g.add(box(0.7, 0.5, 0.03, GREEN, -0.2, 4.2, -0.26));
      g.add(box(0.5, 0.35, 0.03, FABRIC, 0.25, 3.85, -0.26));
      return g;
    },
  },
];

export const CATALOG_BY_ID = new Map(CATALOG.map((c) => [c.id, c]));

export function footprintFeet(item: CatalogItem): { w: number; d: number } {
  return { w: item.fw, d: item.fd };
}
