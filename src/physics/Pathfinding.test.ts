import { describe, it, expect } from 'vitest';
import { findPath, buildObstacleMap, LANE_X_MIN, LANE_X_MAX } from './Pathfinding';
import { Structure } from '../entity/Structure';
import { BlockType } from '../world/Block';

function createStructure(x: number, z: number, w: number, d: number): Structure {
  return new Structure('test', 'red', x, 4, z, 'tower', 1500, w, 6, d, BlockType.RED_TOWER, null);
}

describe('buildObstacleMap', () => {
  it('marks structure cells as blocked', () => {
    const s = createStructure(8, 70, 3, 3); // X=8-11, Z=70-73
    const blocked = buildObstacleMap([s]);
    expect(blocked.has('9,71')).toBe(true);
    expect(blocked.has('5,71')).toBe(false);
  });

  it('ignores dead structures', () => {
    const s = createStructure(8, 70, 3, 3);
    s.takeDamage(1500); // kill it
    const blocked = buildObstacleMap([s]);
    expect(blocked.has('9,71')).toBe(false);
  });
});

describe('findPath', () => {
  it('returns direct path when no obstacles', () => {
    const blocked = new Set<string>();
    const path = findPath(9, 20, 9, 30, blocked);
    expect(path.length).toBeGreaterThan(0);
    const last = path[path.length - 1];
    expect(Math.abs(last.z - 30.5)).toBeLessThan(1);
  });

  it('routes around obstacle', () => {
    // タワー at X=8-10, Z=70-72 → blocked includes margin
    const s = createStructure(8, 70, 3, 3);
    const blocked = buildObstacleMap([s]);
    const path = findPath(9, 65, 9, 80, blocked);
    expect(path.length).toBeGreaterThan(0);
    // パスの全ポイントがブロックセルに入っていないこと
    for (const p of path) {
      const key = `${Math.round(p.x)},${Math.round(p.z)}`;
      expect(blocked.has(key)).toBe(false);
    }
    // ゴールに到達
    const last = path[path.length - 1];
    expect(Math.abs(last.z - 80.5)).toBeLessThan(1);
  });

  it('stays within lane bounds', () => {
    const blocked = new Set<string>();
    const path = findPath(9, 20, 9, 50, blocked);
    for (const p of path) {
      expect(p.x).toBeGreaterThanOrEqual(LANE_X_MIN);
      expect(p.x).toBeLessThanOrEqual(LANE_X_MAX + 1);
    }
  });

  it('returns empty for same start and goal', () => {
    const path = findPath(9, 20, 9, 20, new Set());
    expect(path.length).toBe(0);
  });
});
