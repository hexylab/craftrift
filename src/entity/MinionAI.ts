import { Minion, MINION_ATTACK_RANGE, MINION_MOVE_SPEED, MINION_DAMAGE } from './Minion';
import { Structure } from './Structure';
import { Entity } from './Entity';
import { findPath, buildObstacleMap } from '../physics/Pathfinding';

/** プレイヤー位置情報（MinionAIが攻撃判定に使う） */
export interface PlayerInfo {
  x: number;
  y: number;
  z: number;
  isAlive: boolean;
}

export const LANE_CENTER_X = 9.0;
export type MinionAIState = 'walking' | 'attacking';

export interface MinionAIResult {
  state: MinionAIState;
  moveX: number;
  moveZ: number;
  targetId: string | null;
  damage: number;
}

/** パス再計算の間隔（秒） */
const PATH_RECALC_INTERVAL = 2.0;
/** ウェイポイント到達判定距離 */
const WAYPOINT_REACH_DIST = 0.8;
/** 敵を追跡する距離（この範囲内なら敵に向かって直接移動） */
const CHASE_RANGE = 8.0;

export class MinionAI {
  private state: MinionAIState = 'walking';
  private waypoints: { x: number; z: number }[] = [];
  private waypointIndex = 0;
  private pathTimer = PATH_RECALC_INTERVAL; // 初回即座に計算

  constructor(private minion: Minion) {}

  update(
    dt: number,
    allMinions: Minion[],
    structures: Structure[],
    attackingMeId?: string,
    enemyPlayer?: PlayerInfo,
  ): MinionAIResult {
    if (!this.minion.isAlive) {
      return { state: 'walking', moveX: 0, moveZ: 0, targetId: null, damage: 0 };
    }

    const enemyMinions = allMinions.filter(m => m.team !== this.minion.team && m.isAlive);
    const enemyStructures = structures.filter(s => s.team !== this.minion.team && s.isAlive && !s.isProtected());

    // === ターゲット選択（攻撃判定） ===
    let attackTarget: Entity | null = null;

    // 1. 自分を攻撃中の敵ミニオン
    if (attackingMeId) {
      const attacker = enemyMinions.find(m => m.id === attackingMeId);
      if (attacker && this.distanceTo(attacker) <= MINION_ATTACK_RANGE) {
        attackTarget = attacker;
      }
    }

    // 2. 射程内の最も近い敵ミニオン
    if (!attackTarget) {
      let closest: Minion | null = null;
      let closestDist = Infinity;
      for (const enemy of enemyMinions) {
        const d = this.distanceTo(enemy);
        if (d <= MINION_ATTACK_RANGE && d < closestDist) {
          closest = enemy;
          closestDist = d;
        }
      }
      attackTarget = closest;
    }

    // 3. 射程内の敵構造物
    if (!attackTarget) {
      for (const s of enemyStructures) {
        const d = this.distanceToStructure(s);
        if (d <= MINION_ATTACK_RANGE) {
          attackTarget = s;
          break;
        }
      }
    }

    // 4. 射程内の敵プレイヤー
    if (!attackTarget && enemyPlayer && enemyPlayer.isAlive) {
      const dx = this.minion.x - enemyPlayer.x;
      const dy = this.minion.y - enemyPlayer.y;
      const dz = this.minion.z - enemyPlayer.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d <= MINION_ATTACK_RANGE) {
        attackTarget = {
          id: 'player', team: 'blue',
          x: enemyPlayer.x, y: enemyPlayer.y, z: enemyPlayer.z,
          hp: 1, maxHp: 1, isAlive: true, takeDamage: () => {},
        } as Entity;
      }
    }

    // 攻撃状態
    if (attackTarget) {
      this.state = 'attacking';
      let damage = 0;
      if (this.minion.tryAttack(dt)) {
        damage = MINION_DAMAGE;
      }
      return { state: 'attacking', moveX: 0, moveZ: 0, targetId: attackTarget.id, damage };
    }

    // === 移動（A*パスファインディング） ===
    this.state = 'walking';
    this.minion.resetAttackTimer();

    // 追跡ターゲットの検索（近くの敵ミニオン/プレイヤーに向かう）
    let chaseTarget: { x: number; z: number } | null = null;

    // 近くの敵ミニオンを追跡
    let closestEnemy: Minion | null = null;
    let closestEnemyDist = CHASE_RANGE;
    for (const enemy of enemyMinions) {
      const d = this.distanceTo(enemy);
      if (d < closestEnemyDist) {
        closestEnemy = enemy;
        closestEnemyDist = d;
      }
    }
    if (closestEnemy) {
      chaseTarget = { x: closestEnemy.x, z: closestEnemy.z };
    }

    // 近くの敵プレイヤーを追跡（ミニオンより低優先）
    if (!chaseTarget && enemyPlayer && enemyPlayer.isAlive) {
      const dx = this.minion.x - enemyPlayer.x;
      const dz = this.minion.z - enemyPlayer.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < CHASE_RANGE) {
        chaseTarget = { x: enemyPlayer.x, z: enemyPlayer.z };
      }
    }

    // 追跡ターゲットがいる場合、そちらをA*ゴールにして経路再計算
    if (chaseTarget) {
      const blocked = buildObstacleMap(structures);
      const chasePath = findPath(this.minion.x, this.minion.z, chaseTarget.x, chaseTarget.z, blocked);
      if (chasePath.length > 0) {
        // パスの最初のウェイポイントに向かう
        return this.moveToward(chasePath[0].x, chasePath[0].z, dt);
      }
      return this.moveToward(chaseTarget.x, chaseTarget.z, dt);
    }

    // 通常移動: A*パスでネクサスに向かう
    this.pathTimer += dt;
    if (this.pathTimer >= PATH_RECALC_INTERVAL || this.waypoints.length === 0) {
      this.recalculatePath(structures);
      this.pathTimer = 0;
    }

    // 次のウェイポイントに向かう
    if (this.waypointIndex < this.waypoints.length) {
      const wp = this.waypoints[this.waypointIndex];
      const dx = wp.x - this.minion.x;
      const dz = wp.z - this.minion.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < WAYPOINT_REACH_DIST) {
        this.waypointIndex++;
        if (this.waypointIndex >= this.waypoints.length) {
          // パス終端に到達 → 再計算
          this.pathTimer = PATH_RECALC_INTERVAL;
        }
        return { state: 'walking', moveX: 0, moveZ: 0, targetId: null, damage: 0 };
      }

      return this.moveToward(wp.x, wp.z, dt);
    }

    // フォールバック: 直線移動
    const direction = this.minion.team === 'blue' ? 1 : -1;
    return {
      state: 'walking',
      moveX: 0,
      moveZ: direction * MINION_MOVE_SPEED * dt,
      targetId: null,
      damage: 0,
    };
  }

  private recalculatePath(structures: Structure[]): void {
    // 移動先: 最も味方側に近い未保護の敵構造物
    const target = this.findNearestEnemyStructure(structures);
    let goalX: number;
    let goalZ: number;
    if (target) {
      goalX = target.x + target.width / 2;
      goalZ = target.z + target.depth / 2;
    } else {
      // 全構造物が破壊された場合、敵ネクサス位置へ
      goalX = LANE_CENTER_X;
      goalZ = this.minion.team === 'blue' ? 200 : 10;
    }
    const blocked = buildObstacleMap(structures);
    this.waypoints = findPath(this.minion.x, this.minion.z, goalX, goalZ, blocked);
    this.waypointIndex = 0;
  }

  /**
   * 最も味方側に近い未保護の敵構造物を探す。
   * LoL ARAM: T1(outer) → T2(inner) → Nexus の順で攻撃する。
   */
  private findNearestEnemyStructure(structures: Structure[]): Structure | null {
    const enemies = structures.filter(
      s => s.team !== this.minion.team && s.isAlive && !s.isProtected(),
    );
    if (enemies.length === 0) return null;

    // 味方側に最も近い（Blueミニオン→Z小さい方、Redミニオン→Z大きい方）
    const direction = this.minion.team === 'blue' ? 1 : -1;
    enemies.sort((a, b) => {
      const aZ = a.z + a.depth / 2;
      const bZ = b.z + b.depth / 2;
      return direction > 0
        ? aZ - bZ  // Blue: Z小さい敵構造物が優先（味方側に近い）
        : bZ - aZ; // Red: Z大きい敵構造物が優先
    });
    return enemies[0];
  }

  private moveToward(targetX: number, targetZ: number, dt: number): MinionAIResult {
    const dx = targetX - this.minion.x;
    const dz = targetZ - this.minion.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.01) {
      return { state: 'walking', moveX: 0, moveZ: 0, targetId: null, damage: 0 };
    }
    const speed = MINION_MOVE_SPEED * dt;
    const moveX = (dx / dist) * speed;
    const moveZ = (dz / dist) * speed;
    return { state: 'walking', moveX, moveZ, targetId: null, damage: 0 };
  }

  private distanceTo(entity: Entity): number {
    const dx = this.minion.x - entity.x;
    const dy = this.minion.y - entity.y;
    const dz = this.minion.z - entity.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private distanceToStructure(s: Structure): number {
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;
    const cz = s.z + s.depth / 2;
    const dx = this.minion.x - cx;
    const dy = this.minion.y - cy;
    const dz = this.minion.z - cz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
