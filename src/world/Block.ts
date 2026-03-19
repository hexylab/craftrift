export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  BEDROCK = 4,
  TOWER_BLOCK = 5,
  NEXUS_BLOCK = 6,
}

export function isSolid(type: BlockType): boolean {
  return type !== BlockType.AIR;
}

export function isDestructible(type: BlockType): boolean {
  return type !== BlockType.AIR
    && type !== BlockType.BEDROCK
    && type !== BlockType.TOWER_BLOCK
    && type !== BlockType.NEXUS_BLOCK;
}

interface BlockUVs {
  top: number;
  side: number;
  bottom: number;
}

// テクスチャアトラス内のインデックス
const TEXTURE_INDEX: Record<string, number> = {
  grass_top: 0,
  grass_side: 1,
  dirt: 2,
  stone: 3,
  bedrock: 4,
};

export const TEXTURE_NAMES: string[] = Object.keys(TEXTURE_INDEX);

const BLOCK_UVS: Record<BlockType, BlockUVs> = {
  [BlockType.AIR]: { top: 0, side: 0, bottom: 0 },
  [BlockType.GRASS]: {
    top: TEXTURE_INDEX.grass_top,
    side: TEXTURE_INDEX.grass_side,
    bottom: TEXTURE_INDEX.dirt,
  },
  [BlockType.DIRT]: {
    top: TEXTURE_INDEX.dirt,
    side: TEXTURE_INDEX.dirt,
    bottom: TEXTURE_INDEX.dirt,
  },
  [BlockType.STONE]: {
    top: TEXTURE_INDEX.stone,
    side: TEXTURE_INDEX.stone,
    bottom: TEXTURE_INDEX.stone,
  },
  [BlockType.BEDROCK]: {
    top: TEXTURE_INDEX.bedrock,
    side: TEXTURE_INDEX.bedrock,
    bottom: TEXTURE_INDEX.bedrock,
  },
  [BlockType.TOWER_BLOCK]: {
    top: TEXTURE_INDEX.stone,
    side: TEXTURE_INDEX.stone,
    bottom: TEXTURE_INDEX.stone,
  },
  [BlockType.NEXUS_BLOCK]: {
    top: TEXTURE_INDEX.bedrock,
    side: TEXTURE_INDEX.bedrock,
    bottom: TEXTURE_INDEX.bedrock,
  },
};

export function getBlockUVs(type: BlockType): BlockUVs {
  return BLOCK_UVS[type];
}

export const ATLAS_SIZE = TEXTURE_NAMES.length;
