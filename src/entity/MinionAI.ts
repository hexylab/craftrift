import { Minion } from './Minion';
import { Structure } from './Structure';
import { Entity } from './Entity';
import { findPath, buildObstacleMap } from '../physics/Pathfinding';
import {
  MINION_ATTACK_RANGE,
  MINION_MOVE_SPEED,
  MINION_DAMAGE,
  LANE_CENTER_X,
  DETECTION_RANGE,
  LEASH_RANGE,
} from '../config/GameBalance';

/** プレイヤー位置情報（MinionAIが攻撃判定に使う） */
export interface PlayerInfo {
  x: number;
  y: number;
  z: number;
  isAlive: boolean;
}

export { LANE_CENTER_X, DETECTION_RANGE, LEASH_RANGE };

export type MinionAIState = 'walking' | 'chasing' | 'attacking';

export interface MinionAIResult {
  state: MinionAIState;
  moveX: number;
  moveZ: number;
  targetId: string | null;
  damage: number;
  shouldJump: boolean;
}

/** パス再計算の間隔（秒） */
const PATH_RECALC_INTERVAL = 2.0;
/** ウェイポイント到達判定距離 */
const WAYPOINT_REACH_DIST = 0.8;
/** パス失敗時のクイックリトライ間隔（秒） */
const PATH_FAIL_RETRY_INTERVAL = 0.5;
/** パス失敗時にフォールバック直線移動に切り替える回数 */
const PATH_FAIL_MAX = 3;

/** アイドル結果（死亡時用） */
const IDLE_RESULT: MinionAIResult = {
  state: 'walking',
  moveX: 0,
  moveZ: 0,
  targetId: null,
  damage: 0,
  shouldJump: false,
};

export class MinionAI {
  private state: MinionAIState = 'walking';
  private currentTarget: Entity | null = null;
  private waypoints: { x: number; z: number }[] = [];
  private waypointIndex = 0;
  private pathTimer = PATH_RECALC_INTERVAL; // 初回即座に計算
  private pathFailCount = 0;

  constructor(private minion: Minion) {}

  update(
    dt: number,
    allMinions: Minion[],
    structures: Structure[],
    attackingMeId?: string,
    enemyPlayer?: PlayerInfo,
  ): MinionAIResult {
    if (!this.minion.isAlive) {
      return { ...IDLE_RESULT };
    }

    // プレイヤーターゲットの座標を最新に同期（findTargetが作るスナップショットは位置が固定されるため）
    if (this.currentTarget?.id === 'player' && enemyPlayer) {
      this.currentTarget.x = enemyPlayer.x;
      this.currentTarget.y = enemyPlayer.y;
      this.currentTarget.z = enemyPlayer.z;
      this.currentTarget.isAlive = enemyPlayer.isAlive;
    }

    switch (this.state) {
      case 'walking':
        return this.updateWalking(dt, allMinions, structures, attackingMeId, enemyPlayer);
      case 'chasing':
        return this.updateChasing(dt, allMinions, structures, attackingMeId, enemyPlayer);
      case 'attacking':
        return this.updateAttacking(dt, allMinions, structures, attackingMeId, enemyPlayer);
    }
  }

  // =========================================
  // Walking: レーンを進行し、構造物を攻撃する
  // =========================================
  private updateWalking(
    dt: number,
    allMinions: Minion[],
    structures: Structure[],
    attackingMeId?: string,
    enemyPlayer?: PlayerInfo,
  ): MinionAIResult {
    // DETECTION_RANGE内の最も近い敵（ミニオン・構造物・プレイヤー）を追跡
    const chaseTarget = this.findTarget(allMinions, structures, attackingMeId, enemyPlayer);
    if (chaseTarget) {
      this.currentTarget = chaseTarget;
      this.state = 'chasing';
      this.minion.resetAttackTimer();
      return this.updateChasing(dt, allMinions, structures, attackingMeId, enemyPlayer);
    }

    // 攻撃対象がない → 攻撃タイマーリセット
    this.minion.resetAttackTimer();

    // A*パスファインディングでネクサスに向かう
    this.pathTimer += dt;
    if (this.pathTimer >= PATH_RECALC_INTERVAL || this.waypoints.length === 0) {
      this.recalculatePath(structures);
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
        return {
          state: 'walking',
          moveX: 0,
          moveZ: 0,
          targetId: null,
          damage: 0,
          shouldJump: false,
        };
      }

      return this.moveToward(wp.x, wp.z, dt, 'walking');
    }

    // フォールバック: 直線移動
    const direction = this.minion.team === 'blue' ? 1 : -1;
    return {
      state: 'walking',
      moveX: 0,
      moveZ: direction * MINION_MOVE_SPEED * dt,
      targetId: null,
      damage: 0,
      shouldJump: false,
    };
  }

  // =========================================
  // Chasing: 敵ユニットを追いかける
  // =========================================
  private updateChasing(
    dt: number,
    allMinions: Minion[],
    structures: Structure[],
    attackingMeId?: string,
    enemyPlayer?: PlayerInfo,
  ): MinionAIResult {
    // ターゲット再評価: より優先度の高い/近いターゲットがいないか
    const betterTarget = this.findTarget(allMinions, structures, attackingMeId, enemyPlayer);
    if (betterTarget) {
      this.currentTarget = betterTarget;
    }

    // ターゲットが死んだ or 見失った → walking に戻る
    if (!this.currentTarget || !this.currentTarget.isAlive) {
      return this.transitionToWalking(dt, allMinions, structures, attackingMeId, enemyPlayer);
    }

    const dist = this.distanceTo(this.currentTarget);

    // LEASH_RANGEを超えた → walking に戻る
    if (dist > LEASH_RANGE) {
      return this.transitionToWalking(dt, allMinions, structures, attackingMeId, enemyPlayer);
    }

    // 攻撃範囲内 → attacking
    if (dist <= MINION_ATTACK_RANGE) {
      this.state = 'attacking';
      return this.updateAttacking(dt, allMinions, structures, attackingMeId, enemyPlayer);
    }

    // A*パスファインディングでターゲットに向かう（構造物は中心座標を使用）
    const tp = this.targetPosition(this.currentTarget);
    this.pathTimer += dt;
    if (this.pathTimer >= PATH_RECALC_INTERVAL || this.waypoints.length === 0) {
      this.recalculatePathToTarget(structures, tp.x, tp.z);
    }

    // ウェイポイント追跡
    if (this.waypointIndex < this.waypoints.length) {
      const wp = this.waypoints[this.waypointIndex];
      const dx = wp.x - this.minion.x;
      const dz = wp.z - this.minion.z;
      const wpDist = Math.sqrt(dx * dx + dz * dz);

      if (wpDist < WAYPOINT_REACH_DIST) {
        this.waypointIndex++;
        if (this.waypointIndex >= this.waypoints.length) {
          this.pathTimer = PATH_RECALC_INTERVAL;
        }
      }

      if (this.waypointIndex < this.waypoints.length) {
        const nextWp = this.waypoints[this.waypointIndex];
        return this.moveToward(nextWp.x, nextWp.z, dt, 'chasing', this.currentTarget.id);
      }
    }

    // フォールバック: ターゲットに直接向かう
    return this.moveToward(tp.x, tp.z, dt, 'chasing', this.currentTarget.id);
  }

  // =========================================
  // Attacking: 立ち止まって攻撃する
  // =========================================
  private updateAttacking(
    dt: number,
    allMinions: Minion[],
    structures: Structure[],
    attackingMeId?: string,
    enemyPlayer?: PlayerInfo,
  ): MinionAIResult {
    // ターゲット消失 → walking に戻る
    if (!this.currentTarget || !this.currentTarget.isAlive) {
      return this.transitionToWalking(dt, allMinions, structures, attackingMeId, enemyPlayer);
    }

    const dist = this.distanceTo(this.currentTarget);

    // LEASH_RANGE超過 → walking に戻る
    if (dist > LEASH_RANGE) {
      return this.transitionToWalking(dt, allMinions, structures, attackingMeId, enemyPlayer);
    }

    // 攻撃範囲外だがLEASH_RANGE内 → chasing に戻る
    if (dist > MINION_ATTACK_RANGE) {
      this.state = 'chasing';
      this.waypoints = [];
      this.waypointIndex = 0;
      this.pathTimer = PATH_RECALC_INTERVAL;
      return this.updateChasing(dt, allMinions, structures, attackingMeId, enemyPlayer);
    }

    // 攻撃
    let damage = 0;
    if (this.minion.tryAttack(dt)) {
      damage = MINION_DAMAGE;
    }

    return {
      state: 'attacking',
      moveX: 0,
      moveZ: 0,
      targetId: this.currentTarget.id,
      damage,
      shouldJump: false,
    };
  }

  // =========================================
  // ヘルパーメソッド
  // =========================================

  /** walking状態に遷移してupdateWalkingを呼ぶ */
  private transitionToWalking(
    dt: number,
    allMinions: Minion[],
    structures: Structure[],
    attackingMeId?: string,
    enemyPlayer?: PlayerInfo,
  ): MinionAIResult {
    this.state = 'walking';
    this.currentTarget = null;
    this.waypoints = [];
    this.waypointIndex = 0;
    this.pathTimer = PATH_RECALC_INTERVAL;
    this.pathFailCount = 0;
    this.minion.resetAttackTimer();
    return this.updateWalking(dt, allMinions, structures, attackingMeId, enemyPlayer);
  }

  /**
   * LoL準拠のターゲット優先順位に基づいて追跡対象を検索する
   * 1. 自分を攻撃中の敵（attackingMeId）— 最優先
   * 2. DETECTION_RANGE内の最も近い敵オブジェクト（ミニオン・構造物・プレイヤー問わず）
   */
  private findTarget(
    allMinions: Minion[],
    structures: Structure[],
    attackingMeId?: string,
    enemyPlayer?: PlayerInfo,
  ): Entity | null {
    const enemyMinions = allMinions.filter((m) => m.team !== this.minion.team && m.isAlive);

    // 1. 自分を攻撃中の敵（最優先）
    if (attackingMeId) {
      const attacker = enemyMinions.find((m) => m.id === attackingMeId);
      if (attacker && this.distanceTo(attacker) <= DETECTION_RANGE) {
        return attacker;
      }
    }

    // 2. DETECTION_RANGE内の最も近い敵（ミニオン・構造物・プレイヤー統一）
    let closest: Entity | null = null;
    let closestDist = DETECTION_RANGE;

    for (const enemy of enemyMinions) {
      const d = this.distanceTo(enemy);
      if (d < closestDist) {
        closest = enemy;
        closestDist = d;
      }
    }

    const enemyStructures = structures.filter(
      (s) => s.team !== this.minion.team && s.isAlive && !s.isProtected(),
    );
    for (const s of enemyStructures) {
      const d = this.distanceTo(s);
      if (d < closestDist) {
        closest = s;
        closestDist = d;
      }
    }

    if (enemyPlayer && enemyPlayer.isAlive) {
      const dx = this.minion.x - enemyPlayer.x;
      const dy = this.minion.y - enemyPlayer.y;
      const dz = this.minion.z - enemyPlayer.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < closestDist) {
        closest = {
          id: 'player',
          team: this.minion.team === 'blue' ? 'red' : 'blue',
          x: enemyPlayer.x,
          y: enemyPlayer.y,
          z: enemyPlayer.z,
          hp: 1,
          maxHp: 1,
          isAlive: true,
          takeDamage: () => {},
        } as Entity;
      }
    }

    return closest;
  }

  /** ターゲット地点に向かって移動する結果を返す */
  private moveToward(
    targetX: number,
    targetZ: number,
    dt: number,
    state: MinionAIState,
    targetId: string | null = null,
  ): MinionAIResult {
    const dx = targetX - this.minion.x;
    const dz = targetZ - this.minion.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.01) {
      return { state, moveX: 0, moveZ: 0, targetId, damage: 0, shouldJump: false };
    }
    const speed = MINION_MOVE_SPEED * dt;
    const moveX = (dx / dist) * speed;
    const moveZ = (dz / dist) * speed;
    return { state, moveX, moveZ, targetId, damage: 0, shouldJump: false };
  }

  /** A*パスを再計算する（通常のレーン進行用） */
  private recalculatePath(structures: Structure[]): void {
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
    this.recalculatePathToTarget(structures, goalX, goalZ);
  }

  /** A*パスを再計算する（指定座標へ） */
  private recalculatePathToTarget(structures: Structure[], goalX: number, goalZ: number): void {
    const blocked = buildObstacleMap(structures);
    const path = findPath(this.minion.x, this.minion.z, goalX, goalZ, blocked);
    if (path.length > 0) {
      this.waypoints = path;
      this.waypointIndex = 0;
      this.pathTimer = 0;
      this.pathFailCount = 0;
    } else {
      // パス失敗
      this.pathFailCount++;
      this.pathTimer = PATH_RECALC_INTERVAL - PATH_FAIL_RETRY_INTERVAL; // すぐにリトライ
      if (this.pathFailCount >= PATH_FAIL_MAX) {
        // フォールバック: 直線移動
        this.waypoints = [];
        this.waypointIndex = 0;
      }
    }
  }

  /**
   * 最も味方側に近い未保護の敵構造物を探す。
   * LoL ARAM: T1(outer) → T2(inner) → Nexus の順で攻撃する。
   */
  private findNearestEnemyStructure(structures: Structure[]): Structure | null {
    const enemies = structures.filter(
      (s) => s.team !== this.minion.team && s.isAlive && !s.isProtected(),
    );
    if (enemies.length === 0) return null;

    // 味方側に最も近い（Blueミニオン→Z小さい方、Redミニオン→Z大きい方）
    const direction = this.minion.team === 'blue' ? 1 : -1;
    enemies.sort((a, b) => {
      const aZ = a.z + a.depth / 2;
      const bZ = b.z + b.depth / 2;
      return direction > 0
        ? aZ - bZ // Blue: Z小さい敵構造物が優先（味方側に近い）
        : bZ - aZ; // Red: Z大きい敵構造物が優先
    });
    return enemies[0];
  }

  /**
   * ターゲットへの移動先座標を返す。
   * 構造物: XZ footprint上の最近接点（最寄りの壁面に向かう）
   * ミニオン/プレイヤー: そのまま座標を返す
   */
  private targetPosition(entity: Entity): { x: number; y: number; z: number } {
    if (entity instanceof Structure) {
      return {
        x: Math.max(entity.x, Math.min(this.minion.x, entity.x + entity.width)),
        y: this.minion.y,
        z: Math.max(entity.z, Math.min(this.minion.z, entity.z + entity.depth)),
      };
    }
    return { x: entity.x, y: entity.y, z: entity.z };
  }

  private distanceTo(entity: Entity): number {
    if (entity instanceof Structure) {
      // 構造物: XZ平面上のAABB最近接点への距離（高さ差を無視）
      // ミニオンはタワーの「壁面」に到達すれば攻撃可能
      const closestX = Math.max(entity.x, Math.min(this.minion.x, entity.x + entity.width));
      const closestZ = Math.max(entity.z, Math.min(this.minion.z, entity.z + entity.depth));
      const dx = this.minion.x - closestX;
      const dz = this.minion.z - closestZ;
      return Math.sqrt(dx * dx + dz * dz);
    }
    const dx = this.minion.x - entity.x;
    const dy = this.minion.y - entity.y;
    const dz = this.minion.z - entity.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
