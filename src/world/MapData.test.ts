import { describe, it, expect, beforeEach } from 'vitest';
import { generateARAMMap, SPAWN_POSITION, TOWER_HP, NEXUS_HP } from './MapData';
import { World } from './World';
import { BlockType } from './Block';

describe('MapData', () => {
  let world: World;
  let structures: import('../entity/Structure').Structure[];

  beforeEach(() => {
    world = new World();
    const result = generateARAMMap(world);
    structures = result.structures;
  });

  it('ground is GRASS at lane center', () => {
    expect(world.getBlock(9, 3, 100)).toBe(BlockType.GRASS);
  });

  it('below grass is DIRT', () => {
    expect(world.getBlock(9, 2, 100)).toBe(BlockType.DIRT);
    expect(world.getBlock(9, 1, 100)).toBe(BlockType.DIRT);
  });

  it('bottom layer is BEDROCK', () => {
    expect(world.getBlock(9, 0, 100)).toBe(BlockType.BEDROCK);
  });

  it('outer walls are BEDROCK', () => {
    expect(world.getBlock(0, 4, 100)).toBe(BlockType.BEDROCK);
    expect(world.getBlock(18, 4, 100)).toBe(BlockType.BEDROCK);
  });

  it('inner walls are STONE', () => {
    expect(world.getBlock(1, 4, 100)).toBe(BlockType.STONE);
    expect(world.getBlock(17, 4, 100)).toBe(BlockType.STONE);
  });

  it('air above the lane', () => {
    expect(world.getBlock(9, 4, 100)).toBe(BlockType.AIR);
  });

  it('lane extends full length', () => {
    expect(world.getBlock(9, 3, 2)).not.toBe(BlockType.AIR);
    expect(world.getBlock(9, 3, 205)).not.toBe(BlockType.AIR);
  });

  it('spawn position is above ground in air', () => {
    expect(SPAWN_POSITION.y).toBeGreaterThan(3);
    expect(world.getBlock(
      Math.floor(SPAWN_POSITION.x),
      Math.floor(SPAWN_POSITION.y),
      Math.floor(SPAWN_POSITION.z),
    )).toBe(BlockType.AIR);
  });

  it('generates 6 structures', () => {
    expect(structures).toHaveLength(6);
  });

  it('structures are symmetrically placed', () => {
    const byId = new Map(structures.map(s => [s.id, s]));

    const blueNexus = byId.get('blue-nexus')!;
    const redNexus = byId.get('red-nexus')!;
    expect((blueNexus.z + redNexus.z + redNexus.depth) / 2).toBeCloseTo(104.5, 0);

    const blueT2 = byId.get('blue-t2')!;
    const redT2 = byId.get('red-t2')!;
    expect((blueT2.z + redT2.z + redT2.depth) / 2).toBeCloseTo(104.5, 0);
  });

  it('red tower blocks are TOWER_BLOCK', () => {
    const redT2 = structures.find(s => s.id === 'red-t2')!;
    expect(world.getBlock(redT2.x, redT2.y, redT2.z)).toBe(BlockType.TOWER_BLOCK);
  });

  it('red nexus blocks are NEXUS_BLOCK', () => {
    const redNexus = structures.find(s => s.id === 'red-nexus')!;
    expect(world.getBlock(redNexus.x, redNexus.y, redNexus.z)).toBe(BlockType.NEXUS_BLOCK);
  });

  it('protection chain is set correctly', () => {
    const byId = new Map(structures.map(s => [s.id, s]));
    const redT2 = byId.get('red-t2')!;
    const redT1 = byId.get('red-t1')!;
    const redNexus = byId.get('red-nexus')!;

    expect(redT2.protectedBy).toBeNull();
    expect(redT1.protectedBy).toBe(redT2);
    expect(redNexus.protectedBy).toBe(redT1);
  });

  it('tower and nexus HP constants are correct', () => {
    expect(TOWER_HP).toBe(1500);
    expect(NEXUS_HP).toBe(3000);
  });
});
