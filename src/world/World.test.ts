import { describe, it, expect } from 'vitest';
import { World } from './World';
import { BlockType } from './Block';

describe('World', () => {
  it('getBlock returns AIR for empty world', () => {
    const world = new World();
    expect(world.getBlock(0, 0, 0)).toBe(BlockType.AIR);
  });

  it('setBlock and getBlock with world coordinates', () => {
    const world = new World();
    world.setBlock(5, 3, 7, BlockType.STONE);
    expect(world.getBlock(5, 3, 7)).toBe(BlockType.STONE);
  });

  it('handles negative coordinates', () => {
    const world = new World();
    world.setBlock(-1, 0, -1, BlockType.DIRT);
    expect(world.getBlock(-1, 0, -1)).toBe(BlockType.DIRT);
  });

  it('handles cross-chunk coordinates', () => {
    const world = new World();
    world.setBlock(17, 0, 0, BlockType.GRASS);
    expect(world.getBlock(17, 0, 0)).toBe(BlockType.GRASS);
    expect(world.getBlock(1, 0, 0)).toBe(BlockType.AIR);
  });

  it('getChunk returns the correct chunk', () => {
    const world = new World();
    world.setBlock(5, 3, 7, BlockType.STONE);
    const chunk = world.getChunk(0, 0, 0);
    expect(chunk).toBeDefined();
    expect(chunk!.getBlock(5, 3, 7)).toBe(BlockType.STONE);
  });

  it('isSolidBlock checks solidity at world coordinates', () => {
    const world = new World();
    world.setBlock(5, 3, 7, BlockType.STONE);
    expect(world.isSolidBlock(5, 3, 7)).toBe(true);
    expect(world.isSolidBlock(0, 0, 0)).toBe(false);
  });
});
