import { Entity, Team } from './Entity';

export const MINION_HP = 150;
export const MINION_DAMAGE = 10;
export const MINION_ATTACK_INTERVAL = 1.0;
export const MINION_ATTACK_RANGE = 2.0;
export const MINION_MOVE_SPEED = 3.5;

export class Minion extends Entity {
  attackTimer = 0;

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
