import { World } from './World';
import { BlockType } from './Block';
import { Structure } from '../entity/Structure';

const MAP_WIDTH = 19;
const MAP_LENGTH = 210;

const LANE_X_START = 2;
const LANE_X_END = 16;
const LANE_Z_START = 2;
const BEDROCK_Y = 0;
const DIRT_Y_START = 1;
const DIRT_Y_END = 2;
const GRASS_Y = 3;

const WALL_TOP_Y = 8;

export const TOWER_HP = 1500;
export const NEXUS_HP = 3000;

export const SPAWN_POSITION = {
  x: 9.0,
  y: GRASS_Y + 2,
  z: LANE_Z_START + 2,
};

export interface MapResult {
  structures: Structure[];
}

export function generateARAMMap(world: World): MapResult {
  for (let z = 0; z < MAP_LENGTH; z++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const isLaneX = x >= LANE_X_START && x <= LANE_X_END;
      const isInnerWallX = x === 1 || x === MAP_WIDTH - 2;
      const isOuterWallX = x === 0 || x === MAP_WIDTH - 1;
      const isEndWallZ = z === 0 || z === 1 || z === MAP_LENGTH - 2 || z === MAP_LENGTH - 1;
      const isOuterEndZ = z === 0 || z === MAP_LENGTH - 1;

      world.setBlock(x, BEDROCK_Y, z, BlockType.BEDROCK);

      if ((isLaneX && !isEndWallZ) || isInnerWallX || isOuterWallX) {
        world.setBlock(x, DIRT_Y_START, z, BlockType.DIRT);
        world.setBlock(x, DIRT_Y_END, z, BlockType.DIRT);
        world.setBlock(x, GRASS_Y, z, BlockType.GRASS);
      }

      if (isEndWallZ) {
        for (let y = BEDROCK_Y; y <= WALL_TOP_Y; y++) {
          if (isOuterEndZ) {
            world.setBlock(x, y, z, BlockType.BEDROCK);
          } else {
            world.setBlock(x, y, z, BlockType.STONE);
          }
        }
      }

      if (isOuterWallX) {
        for (let y = BEDROCK_Y; y <= WALL_TOP_Y; y++) {
          world.setBlock(x, y, z, BlockType.BEDROCK);
        }
      } else if (isInnerWallX) {
        for (let y = GRASS_Y + 1; y <= WALL_TOP_Y; y++) {
          world.setBlock(x, y, z, BlockType.STONE);
        }
      }
    }
  }

  const structures = createStructures(world);
  return { structures };
}

function createStructures(world: World): Structure[] {
  const STRUCTURE_Y = GRASS_Y + 1;

  // Blue side: T1(outer, z=71) → T2(inner, z=38) → Nexus(z=6)
  // Red approaching from high-z attacks: T1 first, then T2, then Nexus
  const blueT1 = new Structure(
    'blue-t1',
    'blue',
    8,
    STRUCTURE_Y,
    71,
    'tower',
    TOWER_HP,
    3,
    6,
    3,
    BlockType.BLUE_TOWER,
    null,
  );
  const blueT2 = new Structure(
    'blue-t2',
    'blue',
    8,
    STRUCTURE_Y,
    38,
    'tower',
    TOWER_HP,
    3,
    6,
    3,
    BlockType.BLUE_TOWER,
    blueT1,
  );
  const blueNexus = new Structure(
    'blue-nexus',
    'blue',
    7,
    STRUCTURE_Y,
    6,
    'nexus',
    NEXUS_HP,
    5,
    4,
    5,
    BlockType.BLUE_NEXUS,
    blueT2,
  );

  // Red side: T1(outer, z=136) → T2(inner, z=168) → Nexus(z=198)
  // Blue player approaching from low-z attacks: T1 first, then T2, then Nexus
  const redT1 = new Structure(
    'red-t1',
    'red',
    8,
    STRUCTURE_Y,
    136,
    'tower',
    TOWER_HP,
    3,
    6,
    3,
    BlockType.RED_TOWER,
    null,
  );
  const redT2 = new Structure(
    'red-t2',
    'red',
    8,
    STRUCTURE_Y,
    168,
    'tower',
    TOWER_HP,
    3,
    6,
    3,
    BlockType.RED_TOWER,
    redT1,
  );
  const redNexus = new Structure(
    'red-nexus',
    'red',
    7,
    STRUCTURE_Y,
    198,
    'nexus',
    NEXUS_HP,
    5,
    4,
    5,
    BlockType.RED_NEXUS,
    redT2,
  );

  const all = [blueNexus, blueT1, blueT2, redT2, redT1, redNexus];
  for (const s of all) {
    s.placeBlocks(world);
  }
  return all;
}
