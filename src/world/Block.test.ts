import { describe, it, expect } from 'vitest';
import { BlockType, isSolid, isDestructible, getBlockUVs, TEXTURE_NAMES } from './Block';

describe('Block', () => {
  it('AIR is not solid', () => {
    expect(isSolid(BlockType.AIR)).toBe(false);
  });

  it('GRASS, DIRT, STONE, BEDROCK are solid', () => {
    expect(isSolid(BlockType.GRASS)).toBe(true);
    expect(isSolid(BlockType.DIRT)).toBe(true);
    expect(isSolid(BlockType.STONE)).toBe(true);
    expect(isSolid(BlockType.BEDROCK)).toBe(true);
  });

  it('BEDROCK is not destructible', () => {
    expect(isDestructible(BlockType.BEDROCK)).toBe(false);
  });

  it('GRASS, DIRT, STONE are destructible', () => {
    expect(isDestructible(BlockType.GRASS)).toBe(true);
    expect(isDestructible(BlockType.DIRT)).toBe(true);
    expect(isDestructible(BlockType.STONE)).toBe(true);
  });

  it('GRASS has different textures for top/side/bottom', () => {
    const uvs = getBlockUVs(BlockType.GRASS);
    expect(uvs.top).not.toBe(uvs.side);
    expect(uvs.top).not.toBe(uvs.bottom);
  });

  it('STONE has same texture for all faces', () => {
    const uvs = getBlockUVs(BlockType.STONE);
    expect(uvs.top).toBe(uvs.side);
    expect(uvs.top).toBe(uvs.bottom);
  });

  it('TEXTURE_NAMES lists all unique texture names', () => {
    expect(TEXTURE_NAMES).toContain('grass_top');
    expect(TEXTURE_NAMES).toContain('grass_side');
    expect(TEXTURE_NAMES).toContain('dirt');
    expect(TEXTURE_NAMES).toContain('stone');
    expect(TEXTURE_NAMES).toContain('bedrock');
  });

  it('structure blocks are solid', () => {
    expect(isSolid(BlockType.BLUE_TOWER)).toBe(true);
    expect(isSolid(BlockType.RED_TOWER)).toBe(true);
    expect(isSolid(BlockType.BLUE_NEXUS)).toBe(true);
    expect(isSolid(BlockType.RED_NEXUS)).toBe(true);
  });

  it('structure blocks are not destructible', () => {
    expect(isDestructible(BlockType.BLUE_TOWER)).toBe(false);
    expect(isDestructible(BlockType.RED_TOWER)).toBe(false);
    expect(isDestructible(BlockType.BLUE_NEXUS)).toBe(false);
    expect(isDestructible(BlockType.RED_NEXUS)).toBe(false);
  });

  it('structure blocks have same texture for all faces', () => {
    for (const bt of [
      BlockType.BLUE_TOWER,
      BlockType.RED_TOWER,
      BlockType.BLUE_NEXUS,
      BlockType.RED_NEXUS,
    ]) {
      const uvs = getBlockUVs(bt);
      expect(uvs.top).toBe(uvs.side);
      expect(uvs.top).toBe(uvs.bottom);
    }
  });

  it('blue and red tower textures are different', () => {
    const blue = getBlockUVs(BlockType.BLUE_TOWER);
    const red = getBlockUVs(BlockType.RED_TOWER);
    expect(blue.top).not.toBe(red.top);
  });
});
