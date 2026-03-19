import { World } from './World';
import { BlockType } from './Block';

const MAP_WIDTH = 15;
const MAP_HEIGHT = 10;
const MAP_LENGTH = 84;

const LANE_X_START = 2;
const LANE_X_END = 12;
const LANE_Z_START = 2;
const LANE_Z_END = 81;

const BEDROCK_Y = 0;
const DIRT_Y_START = 1;
const DIRT_Y_END = 2;
const GRASS_Y = 3;

const WALL_TOP_Y = 8;

export const SPAWN_POSITION = {
  x: 7.5,
  y: GRASS_Y + 2,
  z: LANE_Z_START + 2,
};

export function generateARAMMap(world: World): void {
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
}
