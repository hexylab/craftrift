// src/model/ModelDefinitions.ts

/** スキン展開図上でのパーツのUVソース位置 */
export interface SkinRegion {
  originX: number;
  originY: number;
  w: number;
  h: number;
  d: number;
}

/** 1パーツの定義 */
export interface PartDefinition {
  name: string;
  size: [number, number, number];    // [w, h, d] ピクセル単位
  pivot: [number, number, number];   // 回転軸の位置（ピクセル単位、Three.js座標系）
  offset: [number, number, number];  // ピボットからのメッシュ中心オフセット（ピクセル単位、Three.js座標系）
  skinRegion: SkinRegion;
  /** パーツの初期回転 [rx, ry, rz] ラジアン（例: 体のX軸90度回転） */
  initialRotation?: [number, number, number];
}

/** モデル全体の定義 */
export interface ModelDefinition {
  parts: PartDefinition[];
  textureWidth: number;
  textureHeight: number;
  pixelScale: number;
  /** モデルの前進方向オフセット角度 (ラジアン) */
  forwardAngle: number;
}

const PX = 1 / 16;

export const PLAYER_MODEL: ModelDefinition = {
  textureWidth: 64,
  textureHeight: 64,
  pixelScale: 1.8 / 32,
  forwardAngle: 0,
  parts: [
    // anchor='bottom' → offset=[0, h/2, 0], anchor='top'(default) → offset=[0, -h/2, 0]
    { name: 'head',     size: [8, 8, 8],   pivot: [0, 24, 0],   offset: [0, 4, 0],   skinRegion: { originX: 0,  originY: 0,  w: 8, h: 8, d: 8 } },
    { name: 'body',     size: [8, 12, 4],  pivot: [0, 12, 0],   offset: [0, 6, 0],   skinRegion: { originX: 16, originY: 16, w: 8, h: 12, d: 4 } },
    { name: 'rightArm', size: [4, 12, 4],  pivot: [-6, 24, 0],  offset: [0, -6, 0],  skinRegion: { originX: 40, originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftArm',  size: [4, 12, 4],  pivot: [6, 24, 0],   offset: [0, -6, 0],  skinRegion: { originX: 32, originY: 48, w: 4, h: 12, d: 4 } },
    { name: 'rightLeg', size: [4, 12, 4],  pivot: [-2, 12, 0],  offset: [0, -6, 0],  skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftLeg',  size: [4, 12, 4],  pivot: [2, 12, 0],   offset: [0, -6, 0],  skinRegion: { originX: 16, originY: 48, w: 4, h: 12, d: 4 } },
  ],
};

// Minecraft 1.8.9 ModelSheep1.java (羊毛レイヤー = 見た目の羊)
// + ModelQuadruped.java (par1=12, par2=0) + ModelSheep2 (UV座標参照)
// テクスチャ: 64x32 (UV座標はModelSheep2準拠)
//
// ModelSheep1 = 羊毛レイヤー（膨らんだ体）→ 見慣れた羊の見た目
// inflation: addBoxの最後のパラメータ。各面をinflation分だけ膨張させる
// 実効サイズ = (w + 2*inf, h + 2*inf, d + 2*inf)
//
// MC座標系: Y+ = 下, Z- = 前方, 地面 Y=24
// Three.js:  Y+ = 上, Z+ = 前方
// pivot変換: (mcX, 24 - mcY, -mcZ)
// offset変換: addBox(ox,oy,oz, w,h,d, inf)
//   inflatedBox: (ox-inf, oy-inf, oz-inf) to (ox+w+inf, oy+h+inf, oz+d+inf)
//   mcCenter = (ox-inf + (w+2*inf)/2, oy-inf + (h+2*inf)/2, oz-inf + (d+2*inf)/2)
//            = (ox + w/2, oy + h/2, oz + d/2)  ← inflation はメッシュ中心に影響しない
//   worldOffset = (mcCenter.x, -mcCenter.y, -mcCenter.z)
//   bodyのローカル逆変換(-PI/2 X): localY = -worldZ, localZ = worldY
//
// === Head (ModelSheep1) ===
// addBox(-3, -4, -4, 6, 6, 6, 0.6), rotationPoint(0, 6, -8)
// 実効サイズ: (7.2, 7.2, 7.2)
// pivot = (0, 18, 8)
// mcCenter = (0, -1, -1), worldOffset = (0, 1, 1)
//
// === Body (ModelSheep1) ===
// addBox(-4, -10, -7, 8, 16, 6, 1.75), rotationPoint(0, 5, 2), rotX=PI/2
// 実効サイズ: (11.5, 19.5, 9.5)
// pivot = (0, 19, -2)
// mcCenter = (0, -2, -4), worldOffset = (0, 2, 4)
// ローカル逆変換: (0, -4, 2)
//
// === Legs (ModelSheep1) ===
// addBox(-2, 0, -2, 4, 6, 4, 0.5), rotationPoint(±3, 12, ±7/±5)
// 実効サイズ: (5, 7, 5)
// mcCenter = (0, 3, 0), worldOffset = (0, -3, 0)
export const SHEEP_MODEL: ModelDefinition = {
  textureWidth: 64,
  textureHeight: 32,
  pixelScale: PX,
  forwardAngle: 0,
  parts: [
    // Head: ModelSheep1 addBox(-3,-4,-4, 6,6,6, 0.6) → 実効 7.2×7.2×7.2
    // rotationPoint(0,6,-8) → pivot(0, 18, 8)
    // mcCenter=(0,-1,-1) → offset(0, 1, 1)
    { name: 'head',          size: [7.2, 7.2, 7.2], pivot: [0, 18, 8],   offset: [0, 1, 1],    skinRegion: { originX: 0,  originY: 0,  w: 6, h: 6, d: 8 } },
    // Body: ModelSheep1 addBox(-4,-10,-7, 8,16,6, 1.75) → 実効 11.5×19.5×9.5
    // rotationPoint(0,5,2) → pivot(0, 19, -2), rotX → -PI/2
    // mcCenter=(0,-2,-4) → worldOffset(0,2,4) → local(0,-4,2)
    { name: 'body',          size: [11.5, 19.5, 9.5], pivot: [0, 19, -2],  offset: [0, -1, -2],  skinRegion: { originX: 28, originY: 8,  w: 8, h: 16, d: 6 }, initialRotation: [-Math.PI / 2, 0, 0] },
    // Legs: ModelSheep1 addBox(-2,0,-2, 4,6,4, 0.5) → 実効 5×7×5
    // mcCenter=(0,3,0) → offset(0,-3,0)
    { name: 'rightFrontLeg', size: [5, 7, 5],   pivot: [-3, 12, 5],  offset: [0, -3, 0],   skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftFrontLeg',  size: [5, 7, 5],   pivot: [3, 12, 5],   offset: [0, -3, 0],   skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'rightBackLeg',  size: [5, 7, 5],   pivot: [-3, 12, -7], offset: [0, -3, 0],   skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftBackLeg',   size: [5, 7, 5],   pivot: [3, 12, -7],  offset: [0, -3, 0],   skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
  ],
};
