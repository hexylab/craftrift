import { describe, it, expect } from 'vitest';
import { Minion, MINION_ATTACK_RANGE, MINION_MOVE_SPEED, MINION_ATTACK_INTERVAL, MINION_DAMAGE } from './Minion';
import { MinionAI, LANE_CENTER_X } from './MinionAI';
import { Structure } from './Structure';
import { BlockType } from '../world/Block';

function makeMinion(id: string, team: 'blue' | 'red', x = LANE_CENTER_X, y = 0, z = 50): Minion {
  return new Minion(id, team, x, y, z);
}

function makeTower(
  id: string,
  team: 'blue' | 'red',
  x = 8,
  y = 4,
  z = 136,
  protectedBy: Structure | null = null,
): Structure {
  return new Structure(id, team, x, y, z, 'tower', 1500, 3, 6, 3, BlockType.RED_TOWER, protectedBy);
}

describe('MinionAI', () => {
  describe('Walking behavior', () => {
    it('blue minion walks toward red side (Z increase)', () => {
      const minion = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const ai = new MinionAI(minion);
      const result = ai.update(1.0, [], []);
      expect(result.state).toBe('walking');
      expect(result.moveZ).toBeGreaterThan(0);
      expect(result.moveX).toBeCloseTo(0, 5);
    });

    it('red minion walks toward blue side (Z decrease)', () => {
      const minion = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 150);
      const ai = new MinionAI(minion);
      const result = ai.update(1.0, [], []);
      expect(result.state).toBe('walking');
      expect(result.moveZ).toBeLessThan(0);
      expect(result.moveX).toBeCloseTo(0, 5);
    });

    it('walking moveZ magnitude equals MINION_MOVE_SPEED * dt', () => {
      const minion = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const ai = new MinionAI(minion);
      const dt = 0.016;
      const result = ai.update(dt, [], []);
      expect(Math.abs(result.moveZ)).toBeCloseTo(MINION_MOVE_SPEED * dt, 5);
    });
  });

  describe('Attacking behavior', () => {
    it('attacks enemy minion in range', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const red = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 50 + MINION_ATTACK_RANGE - 0.1);
      const ai = new MinionAI(blue);
      // Accumulate enough time to trigger attack
      const result = ai.update(MINION_ATTACK_INTERVAL, [blue, red], []);
      expect(result.state).toBe('attacking');
      expect(result.targetId).toBe('red-1');
      expect(result.damage).toBe(MINION_DAMAGE);
    });

    it('does not attack ally minion', () => {
      const blue1 = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const blue2 = makeMinion('blue-2', 'blue', LANE_CENTER_X, 0, 51);
      const ai = new MinionAI(blue1);
      const result = ai.update(MINION_ATTACK_INTERVAL, [blue1, blue2], []);
      expect(result.state).toBe('walking');
      expect(result.targetId).toBeNull();
    });

    it('does not attack enemy minion out of range', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const red = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 50 + MINION_ATTACK_RANGE + 1);
      const ai = new MinionAI(blue);
      const result = ai.update(MINION_ATTACK_INTERVAL, [blue, red], []);
      expect(result.state).toBe('walking');
      expect(result.targetId).toBeNull();
    });

    it('does not deal damage if attack timer has not elapsed', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const red = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 50 + MINION_ATTACK_RANGE - 0.1);
      const ai = new MinionAI(blue);
      // dt less than attack interval — should not fire
      const result = ai.update(MINION_ATTACK_INTERVAL * 0.5, [blue, red], []);
      expect(result.state).toBe('attacking');
      expect(result.targetId).toBe('red-1');
      expect(result.damage).toBe(0);
    });
  });

  describe('Target priority', () => {
    it('prioritizes enemy minion attacking self over nearest enemy', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      // red-attacker is farther but within range and is attacking blue
      const redAttacker = makeMinion('red-attacker', 'red', LANE_CENTER_X, 0, 50 + MINION_ATTACK_RANGE - 0.5);
      // red-near is closer
      const redNear = makeMinion('red-near', 'red', LANE_CENTER_X, 0, 50 + 0.5);
      const ai = new MinionAI(blue);
      const result = ai.update(MINION_ATTACK_INTERVAL, [blue, redNear, redAttacker], [], 'red-attacker');
      expect(result.targetId).toBe('red-attacker');
    });

    it('falls back to closest enemy minion when attacker not in range', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      // attacker is out of range
      const redAttacker = makeMinion('red-attacker', 'red', LANE_CENTER_X, 0, 50 + MINION_ATTACK_RANGE + 2);
      const redNear = makeMinion('red-near', 'red', LANE_CENTER_X, 0, 50 + 0.5);
      const ai = new MinionAI(blue);
      const result = ai.update(MINION_ATTACK_INTERVAL, [blue, redNear, redAttacker], [], 'red-attacker');
      expect(result.targetId).toBe('red-near');
    });
  });

  describe('Structure targeting', () => {
    it('attacks enemy structure when no enemy minions present', () => {
      // Blue minion at Z=133, red tower at z=136 (x=8, width=3 -> center=9.5)
      // tower center Z = 136 + 3/2 = 137.5, distance ~ 137.5 - 133 = 4.5 > ATTACK_RANGE=2.0
      // Place minion close enough: at (9.5, 0, 136) — inside the tower footprint
      const blue = makeMinion('blue-1', 'blue', 9.5, 0, 136);
      const redTower = makeTower('red-t1', 'red', 8, 0, 134);
      const ai = new MinionAI(blue);
      const result = ai.update(MINION_ATTACK_INTERVAL, [blue], [redTower]);
      expect(result.state).toBe('attacking');
      expect(result.targetId).toBe('red-t1');
    });

    it('does not attack protected structure', () => {
      const blue = makeMinion('blue-1', 'blue', 9.5, 0, 136);
      const protector = makeTower('red-t2', 'red', 8, 0, 160);
      const protectedTower = makeTower('red-t1', 'red', 8, 0, 134, protector);
      const ai = new MinionAI(blue);
      const result = ai.update(MINION_ATTACK_INTERVAL, [blue], [protectedTower]);
      expect(result.targetId).toBeNull();
      expect(result.state).not.toBe('attacking');
    });

    it('does not attack ally structure', () => {
      const blue = makeMinion('blue-1', 'blue', 9.5, 0, 136);
      const blueTower = makeTower('blue-t1', 'blue', 8, 0, 134);
      const ai = new MinionAI(blue);
      const result = ai.update(MINION_ATTACK_INTERVAL, [blue], [blueTower]);
      expect(result.targetId).toBeNull();
    });
  });

  describe('Lane return', () => {
    it('returns to lane center when displaced (X != LANE_CENTER_X)', () => {
      const displaced = makeMinion('blue-1', 'blue', LANE_CENTER_X + 5, 0, 50);
      const ai = new MinionAI(displaced);
      const result = ai.update(1.0, [], []);
      expect(result.state).toBe('returning');
      expect(result.moveX).toBeLessThan(0); // moving back toward center (x decreases)
    });

    it('returning minion also advances in Z direction', () => {
      const displaced = makeMinion('blue-1', 'blue', LANE_CENTER_X + 5, 0, 50);
      const ai = new MinionAI(displaced);
      const result = ai.update(1.0, [], []);
      expect(result.moveZ).toBeGreaterThan(0); // still advancing
    });

    it('displaced red minion moves toward lane center and advances in -Z', () => {
      const displaced = makeMinion('red-1', 'red', LANE_CENTER_X - 5, 0, 150);
      const ai = new MinionAI(displaced);
      const result = ai.update(1.0, [], []);
      expect(result.state).toBe('returning');
      expect(result.moveX).toBeGreaterThan(0); // moving back toward center (x increases)
      expect(result.moveZ).toBeLessThan(0); // still advancing toward blue base
    });
  });

  describe('Dead minion', () => {
    it('returns idle result when minion is dead', () => {
      const blue = makeMinion('blue-1', 'blue');
      blue.takeDamage(10000);
      expect(blue.isAlive).toBe(false);
      const ai = new MinionAI(blue);
      const result = ai.update(1.0, [], []);
      expect(result.moveX).toBe(0);
      expect(result.moveZ).toBe(0);
      expect(result.targetId).toBeNull();
      expect(result.damage).toBe(0);
    });
  });
});
