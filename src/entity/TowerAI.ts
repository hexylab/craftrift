import { Structure } from './Structure';
import { Team } from './Entity';

export const TOWER_ATTACK_RANGE = 15.0;
export const TOWER_ATTACK_INTERVAL = 2.0;
export const TOWER_DAMAGE = 25;

export interface FireCommand {
  originX: number;
  originY: number;
  originZ: number;
  damage: number;
  team: Team;
}

export class TowerAI {
  private attackTimer: number = 0;

  constructor(readonly structure: Structure) {}

  update(
    dt: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    targetAlive: boolean,
  ): FireCommand | null {
    if (!this.structure.isAlive) return null;
    if (!targetAlive) return null;

    if (!this.isInRange(targetX, targetY, targetZ)) {
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
