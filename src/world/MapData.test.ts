import { describe, it, expect, beforeEach } from 'vitest';
import { generateARAMMap, SPAWN_POSITION } from './MapData';
import { World } from './World';
import { BlockType } from './Block';

describe('MapData', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    generateARAMMap(world);
  });

  it('ground is GRASS at lane center', () => {
    expect(world.getBlock(7, 3, 10)).toBe(BlockType.GRASS);
  });

  it('below grass is DIRT', () => {
    expect(world.getBlock(7, 2, 10)).toBe(BlockType.DIRT);
    expect(world.getBlock(7, 1, 10)).toBe(BlockType.DIRT);
  });

  it('bottom layer is BEDROCK', () => {
    expect(world.getBlock(7, 0, 10)).toBe(BlockType.BEDROCK);
  });

  it('walls exist at lane edges', () => {
    expect(world.getBlock(1, 4, 10)).toBe(BlockType.STONE);
    expect(world.getBlock(0, 4, 10)).toBe(BlockType.BEDROCK);
  });

  it('air above the lane', () => {
    expect(world.getBlock(7, 4, 10)).toBe(BlockType.AIR);
  });

  it('lane extends in Z direction for 80+ blocks', () => {
    expect(world.getBlock(7, 3, 0)).not.toBe(BlockType.AIR);
    expect(world.getBlock(7, 3, 79)).not.toBe(BlockType.AIR);
  });

  it('wall reaches WALL_TOP_Y and air above', () => {
    expect(world.getBlock(0, 8, 10)).toBe(BlockType.BEDROCK);
    expect(world.getBlock(0, 9, 10)).toBe(BlockType.AIR);
  });

  it('spawn position is above ground', () => {
    expect(SPAWN_POSITION.y).toBeGreaterThan(3);
    expect(world.getBlock(
      Math.floor(SPAWN_POSITION.x),
      Math.floor(SPAWN_POSITION.y),
      Math.floor(SPAWN_POSITION.z),
    )).toBe(BlockType.AIR);
  });
});
