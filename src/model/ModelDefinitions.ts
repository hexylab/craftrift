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
    { name: 'rightArm', size: [4, 12, 4],  pivot: [-6, 22, 0],  offset: [0, -6, 0],  skinRegion: { originX: 40, originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftArm',  size: [4, 12, 4],  pivot: [6, 22, 0],   offset: [0, -6, 0],  skinRegion: { originX: 32, originY: 48, w: 4, h: 12, d: 4 } },
    { name: 'rightLeg', size: [4, 12, 4],  pivot: [-2, 12, 0],  offset: [0, -6, 0],  skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftLeg',  size: [4, 12, 4],  pivot: [2, 12, 0],   offset: [0, -6, 0],  skinRegion: { originX: 16, originY: 48, w: 4, h: 12, d: 4 } },
  ],
};

// Minecraft 1.8.9 ModelSheep2.java + ModelQuadruped.java に基づく正確な寸法
// テクスチャは 64x32 (textureHeight=32)
// 座標変換: MC→Three.js
//   pivot: threeX = mcX, threeY = 24 - mcY, threeZ = -mcZ
//   offset (addBoxのメッシュ中心): threeX = cx, threeY = -cy, threeZ = -cz
//     (cx, cy, cz) = (ox + w/2, oy + h/2, oz + d/2)
//   rotation: threeRx = -mcRx
//
// Head:  rotationPoint(0,6,-8),  addBox(-3,-4,-6, 6,6,8)   → center(0,-1,-2) → offset(0,1,2)
// Body:  rotationPoint(0,5, 2),  addBox(-4,-10,-7, 8,16,6) → center(0,-2,-4) → offset(0,2,4), rotX=PI/2→-PI/2
// Leg1 (rightHind):  rotationPoint(-3,12, 7),  addBox(-2,0,-2, 4,12,4) → center(0,6,0) → offset(0,-6,0)
// Leg2 (leftHind):   rotationPoint( 3,12, 7)
// Leg3 (rightFront): rotationPoint(-3,12,-5)
// Leg4 (leftFront):  rotationPoint( 3,12,-5)
export const SHEEP_MODEL: ModelDefinition = {
  textureWidth: 64,
  textureHeight: 32,
  pixelScale: PX,
  forwardAngle: 0,
  parts: [
    // Head: rotationPoint(0,6,-8) → pivot(0, 24-6, 8) = (0,18,8)
    //   addBox(-3,-4,-6, 6,6,8) → MC center(0,-1,-2) → offset(0,1,2)
    { name: 'head',          size: [6, 6, 8],   pivot: [0, 18, 8],   offset: [0, 1, 2],   skinRegion: { originX: 0,  originY: 0,  w: 6, h: 6, d: 8 } },
    // Body: rotationPoint(0,5,2) → pivot(0, 24-5, -2) = (0,19,-2)
    //   addBox(-4,-10,-7, 8,16,6) → MC center(0,-2,-4) → offset(0,2,4)
    //   rotateAngleX=PI/2 → initialRotation=(-PI/2, 0, 0)
    { name: 'body',          size: [8, 16, 6],  pivot: [0, 19, -2],  offset: [0, 2, 4],   skinRegion: { originX: 28, originY: 8,  w: 8, h: 16, d: 6 }, initialRotation: [-Math.PI / 2, 0, 0] },
    // Leg3 (rightFront): rotationPoint(-3,12,-5) → pivot(-3, 12, 5)
    //   addBox(-2,0,-2, 4,12,4) → MC center(0,6,0) → offset(0,-6,0)
    { name: 'rightFrontLeg', size: [4, 12, 4],  pivot: [-3, 12, 5],  offset: [0, -6, 0],  skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    // Leg4 (leftFront): rotationPoint(3,12,-5) → pivot(3, 12, 5)
    { name: 'leftFrontLeg',  size: [4, 12, 4],  pivot: [3, 12, 5],   offset: [0, -6, 0],  skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    // Leg1 (rightHind): rotationPoint(-3,12,7) → pivot(-3, 12, -7)
    { name: 'rightBackLeg',  size: [4, 12, 4],  pivot: [-3, 12, -7], offset: [0, -6, 0],  skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    // Leg2 (leftHind): rotationPoint(3,12,7) → pivot(3, 12, -7)
    { name: 'leftBackLeg',   size: [4, 12, 4],  pivot: [3, 12, -7],  offset: [0, -6, 0],  skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
  ],
};
