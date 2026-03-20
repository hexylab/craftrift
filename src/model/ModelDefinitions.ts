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
  pivot: [number, number, number];   // 回転軸の位置
  skinRegion: SkinRegion;
  /** 'top': ピボットから下に伸びる(腕/脚), 'bottom': ピボットから上に伸びる(頭/体) */
  anchor?: 'top' | 'bottom';
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
    { name: 'head',     size: [8, 8, 8],   pivot: [0, 24, 0],   skinRegion: { originX: 0,  originY: 0,  w: 8, h: 8, d: 8 }, anchor: 'bottom' },
    { name: 'body',     size: [8, 12, 4],  pivot: [0, 12, 0],   skinRegion: { originX: 16, originY: 16, w: 8, h: 12, d: 4 }, anchor: 'bottom' },
    { name: 'rightArm', size: [4, 12, 4],  pivot: [-6, 22, 0],  skinRegion: { originX: 40, originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftArm',  size: [4, 12, 4],  pivot: [6, 22, 0],   skinRegion: { originX: 32, originY: 48, w: 4, h: 12, d: 4 } },
    { name: 'rightLeg', size: [4, 12, 4],  pivot: [-2, 12, 0],  skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftLeg',  size: [4, 12, 4],  pivot: [2, 12, 0],   skinRegion: { originX: 16, originY: 48, w: 4, h: 12, d: 4 } },
  ],
};

// Minecraft 1.8.9 ModelSheep2.java に基づく正確な寸法
// テクスチャは 64x32 (textureHeight=32)
// Head:  texOffs(0, 0),  addBox(-3, -4, -6, 6, 6, 8)  → size=[6,6,8],  pivot=[0,18,-8]
// Body:  texOffs(28, 8), addBox(-4,-10, -7, 8,16, 6)  → size=[8,16,6], pivot=[0,13, 0] (体は胴軸に沿って立つ、レンダラー側でX軸90度回転)
// Legs:  texOffs(0, 16), addBox(-2,  0, -2, 4,12, 4)  → size=[4,12,4], pivot=front±3,back±3
export const SHEEP_MODEL: ModelDefinition = {
  textureWidth: 64,
  textureHeight: 32,
  pixelScale: PX,
  forwardAngle: 0,
  parts: [
    { name: 'head',          size: [6, 6, 8],   pivot: [0, 18, -8],  skinRegion: { originX: 0,  originY: 0,  w: 6, h: 6, d: 8 }, anchor: 'bottom' },
    { name: 'body',          size: [8, 16, 6],  pivot: [0, 13, 0],   skinRegion: { originX: 28, originY: 8,  w: 8, h: 16, d: 6 }, anchor: 'bottom' },
    { name: 'rightFrontLeg', size: [4, 12, 4],  pivot: [-3, 12, -5], skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftFrontLeg',  size: [4, 12, 4],  pivot: [3, 12, -5],  skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'rightBackLeg',  size: [4, 12, 4],  pivot: [-3, 12, 5],  skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftBackLeg',   size: [4, 12, 4],  pivot: [3, 12, 5],   skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
  ],
};
