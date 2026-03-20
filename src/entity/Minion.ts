import { Entity, Team } from './Entity';
import {
  MINION_HP,
  MINION_DAMAGE,
  MINION_ATTACK_INTERVAL,
  MINION_ATTACK_RANGE,
  MINION_MOVE_SPEED,
} from '../config/GameBalance';

export { MINION_HP, MINION_DAMAGE, MINION_ATTACK_INTERVAL, MINION_ATTACK_RANGE, MINION_MOVE_SPEED };

export class Minion extends Entity {
  attackTimer = 0;

  // EntityBody fields for EntityPhysics integration
  readonly width = 0.8; // slightly larger than player (0.6)
  readonly height = 1.0; // sheep height
  velocityY = 0;
  onGround = false;

  constructor(id: string, team: Team, x: number, y: number, z: number) {
    super(id, team, x, y, z, MINION_HP);
  }

  tryAttack(dt: number): boolean {
    this.attackTimer += dt;
    if (this.attackTimer >= MINION_ATTACK_INTERVAL) {
      this.attackTimer -= MINION_ATTACK_INTERVAL;
      return true;
    }
    return false;
  }

  resetAttackTimer(): void {
    this.attackTimer = 0;
  }
}
