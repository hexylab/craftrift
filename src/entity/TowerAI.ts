import { Structure } from './Structure';
import { Team } from './Entity';
import { Minion } from './Minion';
import { TOWER_ATTACK_RANGE, TOWER_ATTACK_INTERVAL, TOWER_DAMAGE } from '../config/GameBalance';

export { TOWER_ATTACK_RANGE, TOWER_ATTACK_INTERVAL, TOWER_DAMAGE };

export interface FireCommand {
  originX: number;
  originY: number;
  originZ: number;
  damage: number;
  team: Team;
  targetId?: string; // minion target ID when targeting a minion
}

export class TowerAI {
  private attackTimer: number = 0;

  constructor(readonly structure: Structure) {}

  update(
    dt: number,
    playerTarget: { x: number; y: number; z: number; isAlive: boolean },
    enemyMinions: Minion[],
  ): FireCommand | null {
    if (!this.structure.isAlive) return null;

    // 1. Find closest alive enemy minion in range
    let minionTarget: Minion | null = null;
    let minDist = Infinity;
    for (const m of enemyMinions) {
      if (!m.isAlive) continue;
      if (!this.isInRange(m.x, m.y, m.z)) continue;
      const dx = m.x - this.getCenterX();
      const dy = m.y - this.getCenterY();
      const dz = m.z - this.getCenterZ();
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < minDist) {
        minDist = d;
        minionTarget = m;
      }
    }

    // 2. If no minion, check player
    const hasTarget =
      minionTarget !== null ||
      (playerTarget.isAlive && this.isInRange(playerTarget.x, playerTarget.y, playerTarget.z));

    if (!hasTarget) {
      this.attackTimer = 0;
      return null;
    }

    this.attackTimer += dt;
    if (this.attackTimer >= TOWER_ATTACK_INTERVAL) {
      this.attackTimer -= TOWER_ATTACK_INTERVAL;
      return {
        originX: this.getCenterX(),
        originY: this.getCenterY(),
        originZ: this.getCenterZ(),
        damage: TOWER_DAMAGE,
        team: this.structure.team,
        targetId: minionTarget?.id,
      };
    }
    return null;
  }

  getCenterX(): number {
    return this.structure.x + this.structure.width / 2;
  }

  getCenterY(): number {
    return this.structure.y + this.structure.height / 2;
  }

  getCenterZ(): number {
    return this.structure.z + this.structure.depth / 2;
  }

  isInRange(targetX: number, targetY: number, targetZ: number): boolean {
    const dx = targetX - this.getCenterX();
    const dy = targetY - this.getCenterY();
    const dz = targetZ - this.getCenterZ();
    return Math.sqrt(dx * dx + dy * dy + dz * dz) <= TOWER_ATTACK_RANGE;
  }
}
