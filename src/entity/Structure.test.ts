import { describe, it, expect, beforeEach } from 'vitest';
import { Structure } from './Structure';
import { World } from '../world/World';
import { BlockType } from '../world/Block';

function createTower(
  id: string,
  team: 'blue' | 'red',
  z: number,
  protectedBy: Structure | null = null,
): Structure {
  return new Structure(id, team, 8, 4, z, 'tower', 1500, 3, 6, 3, BlockType.RED_TOWER, protectedBy);
}

function createNexus(
  id: string,
  team: 'blue' | 'red',
  z: number,
  protectedBy: Structure | null = null,
): Structure {
  return new Structure(id, team, 7, 4, z, 'nexus', 3000, 5, 4, 5, BlockType.RED_NEXUS, protectedBy);
}

describe('Structure', () => {
  it('constructor sets all properties', () => {
    const s = createTower('red-t2', 'red', 168);
    expect(s.id).toBe('red-t2');
    expect(s.team).toBe('red');
    expect(s.structureType).toBe('tower');
    expect(s.hp).toBe(1500);
    expect(s.maxHp).toBe(1500);
    expect(s.width).toBe(3);
    expect(s.height).toBe(6);
    expect(s.depth).toBe(3);
    expect(s.blockType).toBe(BlockType.RED_TOWER);
    expect(s.protectedBy).toBeNull();
  });

  it('isProtected returns false when protectedBy is null', () => {
    const s = createTower('red-t2', 'red', 168);
    expect(s.isProtected()).toBe(false);
  });

  it('isProtected returns true when protectedBy is alive', () => {
    const t2 = createTower('red-t2', 'red', 168);
    const t1 = createTower('red-t1', 'red', 136, t2);
    expect(t1.isProtected()).toBe(true);
  });

  it('isProtected returns false when protectedBy is destroyed', () => {
    const t2 = createTower('red-t2', 'red', 168);
    const t1 = createTower('red-t1', 'red', 136, t2);
    t2.takeDamage(1500);
    expect(t1.isProtected()).toBe(false);
  });

  it('takeDamage is ignored when protected', () => {
    const t2 = createTower('red-t2', 'red', 168);
    const t1 = createTower('red-t1', 'red', 136, t2);
    t1.takeDamage(500);
    expect(t1.hp).toBe(1500);
  });

  it('takeDamage works when not protected', () => {
    const s = createTower('red-t2', 'red', 168);
    s.takeDamage(500);
    expect(s.hp).toBe(1000);
  });

  it('protection chain: T2 -> T1 -> Nexus', () => {
    const t2 = createTower('red-t2', 'red', 168);
    const t1 = createTower('red-t1', 'red', 136, t2);
    const nexus = createNexus('red-nexus', 'red', 198, t1);

    expect(nexus.isProtected()).toBe(true);
    expect(t1.isProtected()).toBe(true);

    t2.takeDamage(1500);
    expect(t1.isProtected()).toBe(false);
    expect(nexus.isProtected()).toBe(true);

    t1.takeDamage(1500);
    expect(nexus.isProtected()).toBe(false);
  });

  describe('placeBlocks / removeBlocks', () => {
    let world: World;

    beforeEach(() => {
      world = new World();
    });

    it('placeBlocks fills the area with blockType', () => {
      const s = createTower('test', 'red', 10);
      s.placeBlocks(world);
      expect(world.getBlock(8, 4, 10)).toBe(BlockType.RED_TOWER);
      expect(world.getBlock(10, 9, 12)).toBe(BlockType.RED_TOWER);
      expect(world.getBlock(7, 4, 10)).toBe(BlockType.AIR);
      expect(world.getBlock(11, 4, 10)).toBe(BlockType.AIR);
    });

    it('removeBlocks clears the area to AIR', () => {
      const s = createTower('test', 'red', 10);
      s.placeBlocks(world);
      s.removeBlocks(world);
      expect(world.getBlock(8, 4, 10)).toBe(BlockType.AIR);
      expect(world.getBlock(10, 9, 12)).toBe(BlockType.AIR);
    });
  });
});
