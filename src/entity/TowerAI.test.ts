import { describe, it, expect } from 'vitest';
import { TowerAI, TOWER_ATTACK_RANGE, TOWER_ATTACK_INTERVAL, TOWER_DAMAGE } from './TowerAI';
import { Structure } from './Structure';
import { BlockType } from '../world/Block';

function makeTower(team: 'blue' | 'red' = 'red', x = 8, y = 4, z = 136): Structure {
  return new Structure('test-tower', team, x, y, z, 'tower', 1500, 3, 6, 3, BlockType.RED_TOWER, null);
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
    const result1 = ai.update(TOWER_ATTACK_INTERVAL - 0.01, 9.5, 7, targetZ, true);
    expect(result1).toBeNull();
    const result2 = ai.update(0.02, 9.5, 7, targetZ, true);
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
    const result = ai.update(TOWER_ATTACK_INTERVAL + 1, 9.5, 7, farZ, true);
    expect(result).toBeNull();
  });

  it('returns null when structure is destroyed', () => {
    const tower = makeTower();
    tower.hp = 0;
    tower.isAlive = false;
    const ai = new TowerAI(tower);
    const result = ai.update(TOWER_ATTACK_INTERVAL + 1, 9.5, 7, 137.5, true);
    expect(result).toBeNull();
  });

  it('returns null when target is dead', () => {
    const ai = new TowerAI(makeTower());
    const result = ai.update(TOWER_ATTACK_INTERVAL + 1, 9.5, 7, 137.5 + 5, false);
    expect(result).toBeNull();
  });

  it('resets timer when target leaves range', () => {
    const ai = new TowerAI(makeTower());
    const inRange = 137.5 + 5;
    const outOfRange = 137.5 + TOWER_ATTACK_RANGE + 10;
    ai.update(1.5, 9.5, 7, inRange, true);
    ai.update(0.1, 9.5, 7, outOfRange, true);
    const result = ai.update(1.5, 9.5, 7, inRange, true);
    expect(result).toBeNull();
    const result2 = ai.update(0.6, 9.5, 7, inRange, true);
    expect(result2).not.toBeNull();
  });
});
