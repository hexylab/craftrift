import { describe, it, expect } from 'vitest';
import { Chunk, CHUNK_SIZE } from './Chunk';
import { BlockType } from './Block';

describe('Chunk', () => {
  it('initializes all blocks as AIR', () => {
    const chunk = new Chunk(0, 0, 0);
    expect(chunk.getBlock(0, 0, 0)).toBe(BlockType.AIR);
    expect(chunk.getBlock(15, 15, 15)).toBe(BlockType.AIR);
  });

  it('sets and gets a block', () => {
    const chunk = new Chunk(0, 0, 0);
    chunk.setBlock(5, 3, 7, BlockType.STONE);
    expect(chunk.getBlock(5, 3, 7)).toBe(BlockType.STONE);
  });

  it('returns AIR for out-of-bounds coordinates', () => {
    const chunk = new Chunk(0, 0, 0);
    expect(chunk.getBlock(-1, 0, 0)).toBe(BlockType.AIR);
    expect(chunk.getBlock(16, 0, 0)).toBe(BlockType.AIR);
  });

  it('stores chunk world position', () => {
    const chunk = new Chunk(2, 0, 3);
    expect(chunk.worldX).toBe(32);
    expect(chunk.worldY).toBe(0);
    expect(chunk.worldZ).toBe(48);
  });

  it('CHUNK_SIZE is 16', () => {
    expect(CHUNK_SIZE).toBe(16);
  });

  it('marks dirty when a block changes', () => {
    const chunk = new Chunk(0, 0, 0);
    chunk.dirty = false;
    chunk.setBlock(0, 0, 0, BlockType.GRASS);
    expect(chunk.dirty).toBe(true);
  });
});
