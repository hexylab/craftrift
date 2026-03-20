import { describe, it, expect } from 'vitest';
import { CombatSystem, ATTACK_DAMAGE, ATTACK_COOLDOWN } from './CombatSystem';
import { Structure } from './Structure';
import { BlockType } from '../world/Block';

function createRedTower(z: number, protectedBy: Structure | null = null): Structure {
  return new Structure(
    'red-t',
    'red',
    8,
    4,
    z,
    'tower',
    1500,
    3,
    6,
    3,
    BlockType.RED_TOWER,
    protectedBy,
  );
}

function createBlueTower(z: number): Structure {
  return new Structure(
    'blue-t',
    'blue',
    8,
    4,
    z,
    'tower',
    1500,
    3,
    6,
    3,
    BlockType.RED_TOWER,
    null,
  );
}

describe('CombatSystem', () => {
  describe('tryAttack', () => {
    it('returns cooldown when attacked too soon', () => {
      const cs = new CombatSystem();
      const target = createRedTower(10);
      cs.tryAttack(target, 1.0);
      const result = cs.tryAttack(target, 1.2);
      expect(result.hit).toBe(false);
      if (!result.hit) expect(result.reason).toBe('cooldown');
    });

    it('succeeds after cooldown expires', () => {
      const cs = new CombatSystem();
      const target = createRedTower(10);
      cs.tryAttack(target, 1.0);
      const result = cs.tryAttack(target, 1.0 + ATTACK_COOLDOWN);
      expect(result.hit).toBe(true);
    });

    it('returns no_target when target is null', () => {
      const cs = new CombatSystem();
      const result = cs.tryAttack(null, 1.0);
      expect(result.hit).toBe(false);
      if (!result.hit) expect(result.reason).toBe('no_target');
    });

    it('returns protected when target is protected', () => {
      const cs = new CombatSystem();
      const t2 = createRedTower(168);
      const t1 = createRedTower(136);
      t1.protectedBy = t2;
      const result = cs.tryAttack(t1, 1.0);
      expect(result.hit).toBe(false);
      if (!result.hit) {
        expect(result.reason).toBe('protected');
        expect(result.target).toBe(t1);
      }
    });

    it('deals ATTACK_DAMAGE on hit', () => {
      const cs = new CombatSystem();
      const target = createRedTower(10);
      const result = cs.tryAttack(target, 1.0);
      expect(result.hit).toBe(true);
      if (result.hit) {
        expect(result.damage).toBe(ATTACK_DAMAGE);
        expect(target.hp).toBe(1500 - ATTACK_DAMAGE);
      }
    });

    it('returns destroyed=true when target dies', () => {
      const cs = new CombatSystem();
      const target = new Structure(
        't',
        'red',
        8,
        4,
        10,
        'tower',
        ATTACK_DAMAGE,
        3,
        6,
        3,
        BlockType.RED_TOWER,
        null,
      );
      const result = cs.tryAttack(target, 1.0);
      expect(result.hit).toBe(true);
      if (result.hit) {
        expect(result.destroyed).toBe(true);
        expect(target.isAlive).toBe(false);
      }
    });
  });

  describe('findTarget', () => {
    it('returns null when no structures in range', () => {
      const cs = new CombatSystem();
      const target = createRedTower(100);
      const result = cs.findTarget(9.5, 7, 5, 0, 0, 1, [target]);
      expect(result).toBeNull();
    });

    it('finds structure directly ahead within range', () => {
      const cs = new CombatSystem();
      // Tower AABB: x=8~11, y=4~10, z=10~13. Player at z=9 looking +z
      const target = createRedTower(10);
      const result = cs.findTarget(9.5, 7, 9, 0, 0, 1, [target]);
      expect(result).toBe(target);
    });

    it('returns closest structure when multiple in range', () => {
      const cs = new CombatSystem();
      const far = createRedTower(14);
      far.protectedBy = null;
      (far as unknown as { id: string }).id = 'far';
      const near = createRedTower(10);
      (near as unknown as { id: string }).id = 'near';
      const result = cs.findTarget(9.5, 7, 9, 0, 0, 1, [far, near]);
      expect(result?.id).toBe('near');
    });

    it('skips dead structures', () => {
      const cs = new CombatSystem();
      const target = createRedTower(10);
      target.takeDamage(1500);
      const result = cs.findTarget(9.5, 7, 9, 0, 0, 1, [target]);
      expect(result).toBeNull();
    });

    it('skips blue team structures', () => {
      const cs = new CombatSystem();
      const blueTarget = createBlueTower(10);
      const result = cs.findTarget(9.5, 7, 9, 0, 0, 1, [blueTarget]);
      expect(result).toBeNull();
    });

    it('returns null when looking away from structure', () => {
      const cs = new CombatSystem();
      const target = createRedTower(10);
      const result = cs.findTarget(9.5, 7, 9, 0, 0, -1, [target]);
      expect(result).toBeNull();
    });
  });
});
