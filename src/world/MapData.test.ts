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
    expect(
      world.getBlock(
        Math.floor(SPAWN_POSITION.x),
        Math.floor(SPAWN_POSITION.y),
        Math.floor(SPAWN_POSITION.z),
      ),
    ).toBe(BlockType.AIR);
  });

  it('generates 6 structures', () => {
    expect(structures).toHaveLength(6);
  });

  it('structures are symmetrically placed', () => {
    const byId = new Map(structures.map((s) => [s.id, s]));

    const blueNexus = byId.get('blue-nexus')!;
    const redNexus = byId.get('red-nexus')!;
    expect((blueNexus.z + redNexus.z + redNexus.depth) / 2).toBeCloseTo(104.5, 0);

    const blueT2 = byId.get('blue-t2')!;
    const redT2 = byId.get('red-t2')!;
    expect((blueT2.z + redT2.z + redT2.depth) / 2).toBeCloseTo(104.5, 0);
  });

  it('red tower blocks are RED_TOWER', () => {
    const redT1 = structures.find((s) => s.id === 'red-t1')!;
    expect(world.getBlock(redT1.x, redT1.y, redT1.z)).toBe(BlockType.RED_TOWER);
  });

  it('blue tower blocks are BLUE_TOWER', () => {
    const blueT1 = structures.find((s) => s.id === 'blue-t1')!;
    expect(world.getBlock(blueT1.x, blueT1.y, blueT1.z)).toBe(BlockType.BLUE_TOWER);
  });

  it('red nexus blocks are RED_NEXUS', () => {
    const redNexus = structures.find((s) => s.id === 'red-nexus')!;
    expect(world.getBlock(redNexus.x, redNexus.y, redNexus.z)).toBe(BlockType.RED_NEXUS);
  });

  it('blue nexus blocks are BLUE_NEXUS', () => {
    const blueNexus = structures.find((s) => s.id === 'blue-nexus')!;
    expect(world.getBlock(blueNexus.x, blueNexus.y, blueNexus.z)).toBe(BlockType.BLUE_NEXUS);
  });

  it('protection chain: T1(outer) -> T2(inner) -> Nexus', () => {
    const byId = new Map(structures.map((s) => [s.id, s]));
    const redT1 = byId.get('red-t1')!;
    const redT2 = byId.get('red-t2')!;
    const redNexus = byId.get('red-nexus')!;

    // T1 is outer (closest to enemy), attackable first
    expect(redT1.protectedBy).toBeNull();
    // T2 is inner, protected by T1
    expect(redT2.protectedBy).toBe(redT1);
    // Nexus protected by T2
    expect(redNexus.protectedBy).toBe(redT2);
  });

  it('tower and nexus HP constants are correct', () => {
    expect(TOWER_HP).toBe(1500);
    expect(NEXUS_HP).toBe(3000);
  });
});
