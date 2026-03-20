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
}

const PX = 1 / 16;

export const PLAYER_MODEL: ModelDefinition = {
  textureWidth: 64,
  textureHeight: 64,
  pixelScale: 1.8 / 32,
  parts: [
    { name: 'head',     size: [8, 8, 8],   pivot: [0, 24, 0],   skinRegion: { originX: 0,  originY: 0,  w: 8, h: 8, d: 8 }, anchor: 'bottom' },
    { name: 'body',     size: [8, 12, 4],  pivot: [0, 12, 0],   skinRegion: { originX: 16, originY: 16, w: 8, h: 12, d: 4 }, anchor: 'bottom' },
    { name: 'rightArm', size: [4, 12, 4],  pivot: [-6, 22, 0],  skinRegion: { originX: 40, originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftArm',  size: [4, 12, 4],  pivot: [6, 22, 0],   skinRegion: { originX: 32, originY: 48, w: 4, h: 12, d: 4 } },
    { name: 'rightLeg', size: [4, 12, 4],  pivot: [-2, 12, 0],  skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftLeg',  size: [4, 12, 4],  pivot: [2, 12, 0],   skinRegion: { originX: 16, originY: 48, w: 4, h: 12, d: 4 } },
  ],
};

export const SHEEP_MODEL: ModelDefinition = {
  textureWidth: 64,
  textureHeight: 64,
  pixelScale: PX,
  parts: [
    { name: 'head',          size: [8, 8, 6],   pivot: [0, 18, -8],  skinRegion: { originX: 0,  originY: 0,  w: 8, h: 8, d: 6 }, anchor: 'bottom' },
    { name: 'body',          size: [6, 10, 16],  pivot: [0, 12, 0],   skinRegion: { originX: 16, originY: 16, w: 6, h: 10, d: 16 }, anchor: 'bottom' },
    { name: 'rightFrontLeg', size: [4, 12, 4],  pivot: [-2, 12, -5],  skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftFrontLeg',  size: [4, 12, 4],  pivot: [2, 12, -5],   skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'rightBackLeg',  size: [4, 12, 4],  pivot: [-2, 12, 5],   skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftBackLeg',   size: [4, 12, 4],  pivot: [2, 12, 5],    skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
  ],
};
