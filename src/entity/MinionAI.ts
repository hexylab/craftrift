import { Minion, MINION_ATTACK_RANGE, MINION_MOVE_SPEED, MINION_DAMAGE } from './Minion';
import { Structure } from './Structure';
import { Entity } from './Entity';

/** プレイヤー位置情報（MinionAIが攻撃判定に使う） */
export interface PlayerInfo {
  x: number;
  y: number;
  z: number;
  isAlive: boolean;
}

export const LANE_CENTER_X = 9.0;
export type MinionAIState = 'walking' | 'attacking' | 'returning';

export interface MinionAIResult {
  state: MinionAIState;
  moveX: number;
  moveZ: number;
  targetId: string | null;
  damage: number;
}

export class MinionAI {
  private state: MinionAIState = 'walking';

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

    const direction = this.minion.team === 'blue' ? 1 : -1;
    const enemyMinions = allMinions.filter(m => m.team !== this.minion.team && m.isAlive);
    const enemyStructures = structures.filter(s => s.team !== this.minion.team && s.isAlive && !s.isProtected());

    // Target priority
    let target: Entity | null = null;

    // 1. Enemy minion attacking me
    if (attackingMeId) {
      const attacker = enemyMinions.find(m => m.id === attackingMeId);
      if (attacker && this.distanceTo(attacker) <= MINION_ATTACK_RANGE) {
        target = attacker;
      }
    }

    // 2. Closest enemy minion in range
    if (!target) {
      let closest: Minion | null = null;
      let closestDist = Infinity;
      for (const enemy of enemyMinions) {
        const d = this.distanceTo(enemy);
        if (d <= MINION_ATTACK_RANGE && d < closestDist) {
          closest = enemy;
          closestDist = d;
        }
      }
      target = closest;
    }

    // 3. Enemy structure (unprotected)
    if (!target) {
      for (const s of enemyStructures) {
        const cx = s.x + s.width / 2;
        const cy = s.y + s.height / 2;
        const cz = s.z + s.depth / 2;
        const dx = this.minion.x - cx;
        const dy = this.minion.y - cy;
        const dz = this.minion.z - cz;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d <= MINION_ATTACK_RANGE + s.width / 2) {
          target = s;
          break;
        }
      }
    }

    // 4. Enemy player in range (lowest priority)
    if (!target && enemyPlayer && enemyPlayer.isAlive) {
      const dx = this.minion.x - enemyPlayer.x;
      const dy = this.minion.y - enemyPlayer.y;
      const dz = this.minion.z - enemyPlayer.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d <= MINION_ATTACK_RANGE) {
        // プレイヤーをターゲットとして扱うが、IDは'player'固定
        target = { id: 'player', team: enemyPlayer.isAlive ? 'blue' : 'blue', x: enemyPlayer.x, y: enemyPlayer.y, z: enemyPlayer.z, hp: 1, maxHp: 1, isAlive: enemyPlayer.isAlive, takeDamage: () => {} } as Entity;
      }
    }

    // Attacking state
    if (target) {
      this.state = 'attacking';
      let damage = 0;
      if (this.minion.tryAttack(dt)) {
        damage = MINION_DAMAGE;
      }
      return { state: 'attacking', moveX: 0, moveZ: 0, targetId: target.id, damage };
    }

    // Walking state with lane return
    this.minion.resetAttackTimer();
    const targetX = LANE_CENTER_X;
    const dx = targetX - this.minion.x;
    let moveX = 0;
    let moveZ = direction * MINION_MOVE_SPEED * dt;

    if (Math.abs(dx) > 0.1) {
      this.state = 'returning';
      const totalDist = Math.sqrt(dx * dx + (MINION_MOVE_SPEED * dt) ** 2);
      moveX = (dx / totalDist) * MINION_MOVE_SPEED * dt;
      moveZ = (direction * MINION_MOVE_SPEED * dt / totalDist) * MINION_MOVE_SPEED * dt;
    } else {
      this.state = 'walking';
    }

    return { state: this.state, moveX, moveZ, targetId: null, damage: 0 };
  }

  private distanceTo(entity: Entity): number {
    const dx = this.minion.x - entity.x;
    const dy = this.minion.y - entity.y;
    const dz = this.minion.z - entity.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
