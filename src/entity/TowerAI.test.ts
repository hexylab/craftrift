import { describe, it, expect } from 'vitest';
import { TowerAI, TOWER_ATTACK_RANGE, TOWER_ATTACK_INTERVAL, TOWER_DAMAGE } from './TowerAI';
import { Structure } from './Structure';
import { BlockType } from '../world/Block';
import { Minion } from './Minion';

function makeTower(team: 'blue' | 'red' = 'red', x = 8, y = 4, z = 136): Structure {
  return new Structure('test-tower', team, x, y, z, 'tower', 1500, 3, 6, 3, BlockType.RED_TOWER, null);
}

function makeMinion(id: string, team: 'blue' | 'red', x: number, y: number, z: number): Minion {
  return new Minion(id, team, x, y, z);
}

describe('TowerAI', () => {
  it('getCenterX/Y/Z returns structure center', () => {
    const tower = makeTower('red', 8, 4, 136);
    const ai = new TowerAI(tower);
    expect(ai.getCenterX()).toBe(8 + 3 / 2);
    expect(ai.getCenterY()).toBe(4 + 6 / 2);
    expect(ai.getCenterZ()).toBe(136 + 3 / 2);
  });

  it('isInRange returns true when target within range', () => {
    const ai = new TowerAI(makeTower());
    expect(ai.isInRange(9.5, 7, 137.5 + 5)).toBe(true);
  });

  it('isInRange returns false when target outside range', () => {
    const ai = new TowerAI(makeTower());
    expect(ai.isInRange(9.5, 7, 137.5 + TOWER_ATTACK_RANGE + 1)).toBe(false);
  });

  it('isInRange returns true at exact boundary', () => {
    const ai = new TowerAI(makeTower());
    expect(ai.isInRange(9.5, 7, 137.5 + TOWER_ATTACK_RANGE)).toBe(true);
  });

  it('fires after attack interval when in range', () => {
    const ai = new TowerAI(makeTower());
    const targetZ = 137.5 + 5;
    const result1 = ai.update(TOWER_ATTACK_INTERVAL - 0.01, { x: 9.5, y: 7, z: targetZ, isAlive: true }, []);
    expect(result1).toBeNull();
    const result2 = ai.update(0.02, { x: 9.5, y: 7, z: targetZ, isAlive: true }, []);
    expect(result2).not.toBeNull();
    expect(result2!.damage).toBe(TOWER_DAMAGE);
    expect(result2!.originX).toBe(9.5);
    expect(result2!.originY).toBe(7);
    expect(result2!.originZ).toBe(137.5);
    expect(result2!.team).toBe('red');
  });

  it('returns null when target out of range', () => {
    const ai = new TowerAI(makeTower());
    const farZ = 137.5 + TOWER_ATTACK_RANGE + 10;
    const result = ai.update(TOWER_ATTACK_INTERVAL + 1, { x: 9.5, y: 7, z: farZ, isAlive: true }, []);
    expect(result).toBeNull();
  });

  it('returns null when structure is destroyed', () => {
    const tower = makeTower();
    tower.hp = 0;
    tower.isAlive = false;
    const ai = new TowerAI(tower);
    const result = ai.update(TOWER_ATTACK_INTERVAL + 1, { x: 9.5, y: 7, z: 137.5, isAlive: true }, []);
    expect(result).toBeNull();
  });

  it('returns null when target is dead', () => {
    const ai = new TowerAI(makeTower());
    const result = ai.update(TOWER_ATTACK_INTERVAL + 1, { x: 9.5, y: 7, z: 137.5 + 5, isAlive: false }, []);
    expect(result).toBeNull();
  });

  it('resets timer when target leaves range', () => {
    const ai = new TowerAI(makeTower());
    const inRange = 137.5 + 5;
    const outOfRange = 137.5 + TOWER_ATTACK_RANGE + 10;
    ai.update(1.5, { x: 9.5, y: 7, z: inRange, isAlive: true }, []);
    ai.update(0.1, { x: 9.5, y: 7, z: outOfRange, isAlive: true }, []);
    const result = ai.update(1.5, { x: 9.5, y: 7, z: inRange, isAlive: true }, []);
    expect(result).toBeNull();
    const result2 = ai.update(0.6, { x: 9.5, y: 7, z: inRange, isAlive: true }, []);
    expect(result2).not.toBeNull();
  });
});

describe('TowerAI with minion targeting', () => {
  it('targets minion over player when both in range', () => {
    const ai = new TowerAI(makeTower());
    // Tower center: (9.5, 7, 137.5)
    const minionZ = 137.5 + 5;
    const minion = makeMinion('minion-1', 'blue', 9.5, 7, minionZ);
    const player = { x: 9.5, y: 7, z: 137.5 + 8, isAlive: true };
    const result = ai.update(TOWER_ATTACK_INTERVAL + 1, player, [minion]);
    expect(result).not.toBeNull();
    expect(result!.targetId).toBe('minion-1');
  });

  it('targets player when no minions in range', () => {
    const ai = new TowerAI(makeTower());
    const player = { x: 9.5, y: 7, z: 137.5 + 5, isAlive: true };
    const result = ai.update(TOWER_ATTACK_INTERVAL + 1, player, []);
    expect(result).not.toBeNull();
    expect(result!.targetId).toBeUndefined();
  });

  it('does not fire at dead minion when player also out of range', () => {
    const ai = new TowerAI(makeTower());
    const deadMinion = makeMinion('minion-dead', 'blue', 9.5, 7, 137.5 + 5);
    deadMinion.isAlive = false;
    const player = { x: 9.5, y: 7, z: 137.5 + TOWER_ATTACK_RANGE + 10, isAlive: true };
    const result = ai.update(TOWER_ATTACK_INTERVAL + 1, player, [deadMinion]);
    expect(result).toBeNull();
  });

  it('picks closest minion when multiple in range', () => {
    const ai = new TowerAI(makeTower());
    // Tower center: (9.5, 7, 137.5)
    const minionFar = makeMinion('minion-far', 'blue', 9.5, 7, 137.5 + 10);
    const minionClose = makeMinion('minion-close', 'blue', 9.5, 7, 137.5 + 3);
    const player = { x: 9.5, y: 7, z: 137.5 + TOWER_ATTACK_RANGE + 10, isAlive: false };
    const result = ai.update(TOWER_ATTACK_INTERVAL + 1, player, [minionFar, minionClose]);
    expect(result).not.toBeNull();
    expect(result!.targetId).toBe('minion-close');
  });
});
