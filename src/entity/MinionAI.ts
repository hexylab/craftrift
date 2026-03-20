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
export const DETECTION_RANGE = 8.0;  // この範囲内の敵を追跡開始
export const LEASH_RANGE = 12.0;     // この範囲を超えると追跡中止

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
    // 敵がDETECTION_RANGE内にいれば追跡開始
    const chaseTarget = this.findTarget(allMinions, attackingMeId, enemyPlayer);
    if (chaseTarget) {
      this.currentTarget = chaseTarget;
      this.state = 'chasing';
      this.minion.resetAttackTimer();
      return this.updateChasing(dt, allMinions, structures, attackingMeId, enemyPlayer);
    }

    // 射程内の未保護敵構造物があれば攻撃（state は walking のまま）
    const enemyStructures = structures.filter(
      s => s.team !== this.minion.team && s.isAlive && !s.isProtected(),
    );
    for (const s of enemyStructures) {
      if (this.distanceToStructure(s) <= MINION_ATTACK_RANGE) {
        let damage = 0;
        if (this.minion.tryAttack(dt)) {
          damage = MINION_DAMAGE;
        }
        return {
          state: 'walking',
          moveX: 0,
          moveZ: 0,
          targetId: s.id,
          damage,
          shouldJump: false,
        };
      }
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
        return { state: 'walking', moveX: 0, moveZ: 0, targetId: null, damage: 0, shouldJump: false };
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
    // ターゲット再評価: より優先度の高いターゲットがいないか
    const betterTarget = this.findTarget(allMinions, attackingMeId, enemyPlayer);
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

    // A*パスファインディングでターゲットに向かう
    this.pathTimer += dt;
    if (this.pathTimer >= PATH_RECALC_INTERVAL || this.waypoints.length === 0) {
      this.recalculatePathToTarget(structures, this.currentTarget.x, this.currentTarget.z);
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
    return this.moveToward(this.currentTarget.x, this.currentTarget.z, dt, 'chasing', this.currentTarget.id);
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
   * ターゲット優先順位に基づいて追跡対象を検索する
   * 1. 自分を攻撃中の敵（attackingMeId）
   * 2. DETECTION_RANGE内の最も近い敵ミニオン
   * 3. DETECTION_RANGE内の敵プレイヤー
   */
  private findTarget(
    allMinions: Minion[],
    attackingMeId?: string,
    enemyPlayer?: PlayerInfo,
  ): Entity | null {
    const enemyMinions = allMinions.filter(m => m.team !== this.minion.team && m.isAlive);

    // 1. 自分を攻撃中の敵
    if (attackingMeId) {
      const attacker = enemyMinions.find(m => m.id === attackingMeId);
      if (attacker && this.distanceTo(attacker) <= DETECTION_RANGE) {
        return attacker;
      }
    }

    // 2. DETECTION_RANGE内の最も近い敵ミニオン
    let closest: Minion | null = null;
    let closestDist = DETECTION_RANGE;
    for (const enemy of enemyMinions) {
      const d = this.distanceTo(enemy);
      if (d < closestDist) {
        closest = enemy;
        closestDist = d;
      }
    }
    if (closest) return closest;

    // 3. DETECTION_RANGE内の敵プレイヤー
    if (enemyPlayer && enemyPlayer.isAlive) {
      const dx = this.minion.x - enemyPlayer.x;
      const dy = this.minion.y - enemyPlayer.y;
      const dz = this.minion.z - enemyPlayer.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d <= DETECTION_RANGE) {
        return {
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

    return null;
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
