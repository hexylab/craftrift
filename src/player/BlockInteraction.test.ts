import { describe, it, expect } from 'vitest';
import { castRay } from './BlockInteraction';
import { World } from '../world/World';
import { BlockType, isDestructible, isSolid } from '../world/Block';

describe('BlockInteraction - DDA Raycast', () => {
  it('hits a block directly in front', () => {
    const world = new World();
    world.setBlock(5, 5, 3, BlockType.STONE);
    const result = castRay(world, 5.5, 5.5, 5.5, 0, 0, -1, 5);
    expect(result).not.toBeNull();
    expect(result!.blockX).toBe(5);
    expect(result!.blockY).toBe(5);
    expect(result!.blockZ).toBe(3);
  });

  it('returns null when no block in range', () => {
    const world = new World();
    const result = castRay(world, 5.5, 5.5, 5.5, 0, 0, -1, 5);
    expect(result).toBeNull();
  });

  it('returns the adjacent face normal', () => {
    const world = new World();
    world.setBlock(5, 5, 3, BlockType.STONE);
    const result = castRay(world, 5.5, 5.5, 5.5, 0, 0, -1, 5);
    expect(result).not.toBeNull();
    expect(result!.normalX).toBe(0);
    expect(result!.normalY).toBe(0);
    expect(result!.normalZ).toBe(1);
  });

  it('respects max distance', () => {
    const world = new World();
    world.setBlock(5, 5, -10, BlockType.STONE);
    const result = castRay(world, 5.5, 5.5, 5.5, 0, 0, -1, 5);
    expect(result).toBeNull();
  });
});

describe('BlockInteraction - breakBlock / placeBlock', () => {
  it('breakBlock destroys a destructible block', () => {
    const world = new World();
    world.setBlock(5, 5, 3, BlockType.STONE);
    const hit = castRay(world, 5.5, 5.5, 5.5, 0, 0, -1, 5)!;
    expect(isDestructible(world.getBlock(hit.blockX, hit.blockY, hit.blockZ))).toBe(true);
    world.setBlock(hit.blockX, hit.blockY, hit.blockZ, BlockType.AIR);
    expect(world.getBlock(5, 5, 3)).toBe(BlockType.AIR);
  });

  it('breakBlock refuses to destroy BEDROCK', () => {
    const world = new World();
    world.setBlock(5, 5, 3, BlockType.BEDROCK);
    const hit = castRay(world, 5.5, 5.5, 5.5, 0, 0, -1, 5)!;
    expect(isDestructible(world.getBlock(hit.blockX, hit.blockY, hit.blockZ))).toBe(false);
  });

  it('placeBlock sets a block on the adjacent face', () => {
    const world = new World();
    world.setBlock(5, 5, 3, BlockType.STONE);
    const hit = castRay(world, 5.5, 5.5, 5.5, 0, 0, -1, 5)!;
    const px = hit.blockX + hit.normalX;
    const py = hit.blockY + hit.normalY;
    const pz = hit.blockZ + hit.normalZ;
    expect(isSolid(world.getBlock(px, py, pz))).toBe(false);
    world.setBlock(px, py, pz, BlockType.STONE);
    expect(world.getBlock(px, py, pz)).toBe(BlockType.STONE);
  });
});
