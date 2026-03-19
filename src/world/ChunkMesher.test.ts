import { describe, it, expect } from 'vitest';
import { buildChunkGeometryData } from './ChunkMesher';
import { BlockType } from './Block';

function createMockGetBlock(blocks: Map<string, BlockType>) {
  return (wx: number, wy: number, wz: number): BlockType => {
    return blocks.get(`${wx},${wy},${wz}`) ?? BlockType.AIR;
  };
}

describe('ChunkMesher', () => {
  it('generates no geometry for empty chunk', () => {
    const getBlock = createMockGetBlock(new Map());
    const data = buildChunkGeometryData(0, 0, 0, getBlock);
    expect(data.positions.length).toBe(0);
    expect(data.indices.length).toBe(0);
  });

  it('generates 6 faces (36 indices) for a single isolated block', () => {
    const blocks = new Map<string, BlockType>();
    blocks.set('5,5,5', BlockType.STONE);
    const getBlock = createMockGetBlock(blocks);
    const data = buildChunkGeometryData(0, 0, 0, getBlock);
    expect(data.indices.length).toBe(36);
    expect(data.positions.length).toBe(72);
  });

  it('culls faces between adjacent blocks', () => {
    const blocks = new Map<string, BlockType>();
    blocks.set('5,5,5', BlockType.STONE);
    blocks.set('6,5,5', BlockType.STONE);
    const getBlock = createMockGetBlock(blocks);
    const data = buildChunkGeometryData(0, 0, 0, getBlock);
    expect(data.indices.length).toBe(10 * 6);
  });

  it('generates UV coordinates', () => {
    const blocks = new Map<string, BlockType>();
    blocks.set('0,0,0', BlockType.GRASS);
    const getBlock = createMockGetBlock(blocks);
    const data = buildChunkGeometryData(0, 0, 0, getBlock);
    expect(data.uvs.length).toBeGreaterThan(0);
  });

  it('generates normals', () => {
    const blocks = new Map<string, BlockType>();
    blocks.set('0,0,0', BlockType.STONE);
    const getBlock = createMockGetBlock(blocks);
    const data = buildChunkGeometryData(0, 0, 0, getBlock);
    expect(data.normals.length).toBe(data.positions.length);
  });
});
