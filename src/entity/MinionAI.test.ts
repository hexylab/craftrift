import { describe, it, expect } from 'vitest';
import { Minion, MINION_ATTACK_RANGE, MINION_MOVE_SPEED, MINION_ATTACK_INTERVAL, MINION_DAMAGE } from './Minion';
import { MinionAI, LANE_CENTER_X, DETECTION_RANGE, LEASH_RANGE } from './MinionAI';
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

describe('MinionAI State Machine', () => {
  // =========================================
  // Walking behavior
  // =========================================
  describe('Walking behavior', () => {
    it('blue minion walks toward red side (Z increase)', () => {
      const minion = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const ai = new MinionAI(minion);
      const result = ai.update(1.0, [], []);
      expect(result.state).toBe('walking');
      expect(result.moveZ).toBeGreaterThan(0);
    });

    it('red minion walks toward blue side (Z decrease)', () => {
      const minion = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 150);
      const ai = new MinionAI(minion);
      // 最初のフレームでパス計算、2フレーム目で移動開始
      ai.update(0.1, [], []);
      const result = ai.update(0.1, [], []);
      expect(result.state).toBe('walking');
      expect(result.moveZ).toBeLessThan(0);
    });

    it('walking speed does not exceed MINION_MOVE_SPEED * dt', () => {
      const minion = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const ai = new MinionAI(minion);
      const dt = 0.016;
      const result = ai.update(dt, [], []);
      const speed = Math.sqrt(result.moveX ** 2 + result.moveZ ** 2);
      expect(speed).toBeLessThanOrEqual(MINION_MOVE_SPEED * dt + 0.001);
    });
  });

  // =========================================
  // Walking → Chasing transition
  // =========================================
  describe('Walking → Chasing transition', () => {
    it('transitions to chasing when enemy minion enters DETECTION_RANGE', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      // 敵をDETECTION_RANGE内に配置
      const red = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 50 + DETECTION_RANGE - 1);
      const ai = new MinionAI(blue);
      const result = ai.update(0.1, [blue, red], []);
      expect(result.state).toBe('chasing');
      expect(result.targetId).toBe('red-1');
    });

    it('does not chase enemy outside DETECTION_RANGE', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      // 敵をDETECTION_RANGEの外に配置
      const red = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 50 + DETECTION_RANGE + 1);
      const ai = new MinionAI(blue);
      const result = ai.update(0.1, [blue, red], []);
      expect(result.state).toBe('walking');
    });
  });

  // =========================================
  // Chasing → Attacking transition
  // =========================================
  describe('Chasing → Attacking transition', () => {
    it('transitions to attacking when within ATTACK_RANGE', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      // 敵をDETECTION_RANGE内で配置してまず追跡状態にする
      const red = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 50 + DETECTION_RANGE - 1);
      const ai = new MinionAI(blue);
      // 初回: chasing状態へ
      ai.update(0.1, [blue, red], []);
      // 敵を攻撃範囲内に移動
      red.z = 50 + MINION_ATTACK_RANGE - 0.1;
      const result = ai.update(0.1, [blue, red], []);
      expect(result.state).toBe('attacking');
      expect(result.targetId).toBe('red-1');
    });
  });

  // =========================================
  // Attacking behavior
  // =========================================
  describe('Attacking behavior', () => {
    it('deals damage when attack timer elapses', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const red = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 50 + MINION_ATTACK_RANGE - 0.1);
      const ai = new MinionAI(blue);
      // 最初にchasing → attacking
      ai.update(0.1, [blue, red], []);
      // attackTimerを十分進めるためにATTACK_INTERVAL分のdtを渡す
      const result = ai.update(MINION_ATTACK_INTERVAL, [blue, red], []);
      expect(result.state).toBe('attacking');
      expect(result.damage).toBe(MINION_DAMAGE);
    });

    it('does not deal damage before timer elapses', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const red = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 50 + MINION_ATTACK_RANGE - 0.1);
      const ai = new MinionAI(blue);
      // 攻撃状態に遷移
      ai.update(0.1, [blue, red], []);
      // タイマー不足
      const result = ai.update(MINION_ATTACK_INTERVAL * 0.3, [blue, red], []);
      expect(result.state).toBe('attacking');
      expect(result.damage).toBe(0);
    });

    it('stops moving while attacking', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const red = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 50 + MINION_ATTACK_RANGE - 0.1);
      const ai = new MinionAI(blue);
      ai.update(0.1, [blue, red], []);
      const result = ai.update(MINION_ATTACK_INTERVAL, [blue, red], []);
      expect(result.moveX).toBe(0);
      expect(result.moveZ).toBe(0);
    });
  });

  // =========================================
  // Attacking/Chasing → Walking transition
  // =========================================
  describe('Attacking/Chasing → Walking transition', () => {
    it('returns to walking when target dies', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const red = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 50 + MINION_ATTACK_RANGE - 0.1);
      const ai = new MinionAI(blue);
      // chasing → attacking
      ai.update(0.1, [blue, red], []);
      ai.update(0.1, [blue, red], []);
      expect(ai.update(0.1, [blue, red], []).state).toBe('attacking');
      // ターゲット死亡
      red.takeDamage(10000);
      expect(red.isAlive).toBe(false);
      const result = ai.update(0.1, [blue, red], []);
      expect(result.state).toBe('walking');
    });

    it('returns to walking when target exceeds LEASH_RANGE', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const red = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 50 + DETECTION_RANGE - 1);
      const ai = new MinionAI(blue);
      // chasing状態にする
      const r1 = ai.update(0.1, [blue, red], []);
      expect(r1.state).toBe('chasing');
      // ターゲットをLEASH_RANGEの外へ移動
      red.z = 50 + LEASH_RANGE + 1;
      const result = ai.update(0.1, [blue, red], []);
      expect(result.state).toBe('walking');
    });
  });

  // =========================================
  // Structure targeting in walking mode
  // =========================================
  describe('Structure targeting in walking mode', () => {
    it('attacks enemy structure when in range during walking', () => {
      // タワー at (8, 4, 135) size 3x6x3 → center (9.5, 7, 136.5)
      const blue = makeMinion('blue-1', 'blue', 9.5, 7, 136.5);
      const redTower = makeTower('red-t1', 'red', 8, 4, 135);
      const ai = new MinionAI(blue);
      const result = ai.update(MINION_ATTACK_INTERVAL, [blue], [redTower]);
      // walking状態のまま構造物を攻撃する
      expect(result.state).toBe('walking');
      expect(result.targetId).toBe('red-t1');
      expect(result.damage).toBe(MINION_DAMAGE);
      expect(result.moveX).toBe(0);
      expect(result.moveZ).toBe(0);
    });

    it('does not attack protected structure', () => {
      const blue = makeMinion('blue-1', 'blue', 9.5, 0, 136);
      const protector = makeTower('red-t2', 'red', 8, 0, 160);
      const protectedTower = makeTower('red-t1', 'red', 8, 0, 134, protector);
      const ai = new MinionAI(blue);
      const result = ai.update(MINION_ATTACK_INTERVAL, [blue], [protectedTower]);
      expect(result.targetId).toBeNull();
    });

    it('does not attack ally structure', () => {
      const blue = makeMinion('blue-1', 'blue', 9.5, 0, 136);
      const blueTower = makeTower('blue-t1', 'blue', 8, 0, 134);
      const ai = new MinionAI(blue);
      const result = ai.update(MINION_ATTACK_INTERVAL, [blue], [blueTower]);
      expect(result.targetId).toBeNull();
    });
  });

  // =========================================
  // Target priority
  // =========================================
  describe('Target priority', () => {
    it('prioritizes enemy attacking self over nearest', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      // attackerは少し遠いがDETECTION_RANGE内
      const redAttacker = makeMinion('red-attacker', 'red', LANE_CENTER_X, 0, 50 + DETECTION_RANGE - 1);
      // nearはもっと近い
      const redNear = makeMinion('red-near', 'red', LANE_CENTER_X, 0, 50 + 2);
      const ai = new MinionAI(blue);
      const result = ai.update(0.1, [blue, redNear, redAttacker], [], 'red-attacker');
      expect(result.targetId).toBe('red-attacker');
    });

    it('prioritizes enemy minion over player', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const red = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 50 + DETECTION_RANGE - 1);
      const enemyPlayer = { x: LANE_CENTER_X, y: 0, z: 50 + 1, isAlive: true };
      const ai = new MinionAI(blue);
      const result = ai.update(0.1, [blue, red], [], undefined, enemyPlayer);
      // ミニオンがプレイヤーより優先される
      expect(result.targetId).toBe('red-1');
    });
  });

  // =========================================
  // Dead minion
  // =========================================
  describe('Dead minion', () => {
    it('returns idle when dead', () => {
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

  // =========================================
  // Pathfinding
  // =========================================
  describe('Pathfinding', () => {
    it('routes around obstacle to continue advancing', () => {
      // ミニオンの目の前にタワーがある場合、迂回して進む
      const blue = makeMinion('blue-1', 'blue', 9, 0, 68);
      const tower = makeTower('blue-t1', 'blue', 8, 4, 71); // 味方タワーがZ=71に
      const ai = new MinionAI(blue);
      // 数フレーム更新して進行方向を確認
      let totalMoveZ = 0;
      for (let i = 0; i < 20; i++) {
        const result = ai.update(0.5, [], [tower]);
        blue.x += result.moveX;
        blue.z += result.moveZ;
        totalMoveZ += result.moveZ;
      }
      // 全体としてZ方向に前進しているはず
      expect(totalMoveZ).toBeGreaterThan(0);
      // タワーを迂回して通過しているはず
      expect(blue.z).toBeGreaterThan(71);
    });
  });

  // =========================================
  // State output
  // =========================================
  describe('State output', () => {
    it('result.state matches current AI state', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const ai = new MinionAI(blue);
      // walking
      const r1 = ai.update(0.1, [], []);
      expect(r1.state).toBe('walking');
      // chasing
      const red = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 50 + DETECTION_RANGE - 1);
      const r2 = ai.update(0.1, [blue, red], []);
      expect(r2.state).toBe('chasing');
      // attacking
      red.z = 50 + MINION_ATTACK_RANGE - 0.1;
      const r3 = ai.update(0.1, [blue, red], []);
      expect(r3.state).toBe('attacking');
    });

    it('shouldJump is always false (handled externally)', () => {
      const blue = makeMinion('blue-1', 'blue', LANE_CENTER_X, 0, 50);
      const ai = new MinionAI(blue);
      const result = ai.update(0.1, [], []);
      expect(result.shouldJump).toBe(false);

      // chasing状態でも
      const red = makeMinion('red-1', 'red', LANE_CENTER_X, 0, 50 + DETECTION_RANGE - 1);
      const r2 = ai.update(0.1, [blue, red], []);
      expect(r2.shouldJump).toBe(false);
    });
  });
});
