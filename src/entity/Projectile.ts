import { Team } from './Entity';

export const PROJECTILE_SPEED = 6.0;
export const PROJECTILE_RADIUS = 0.2;
export const PROJECTILE_MAX_LIFETIME = 5.0;
export const PLAYER_HIT_RADIUS = 0.3;

export class Projectile {
  x: number;
  y: number;
  z: number;
  readonly damage: number;
  readonly team: Team;
  private lifetime: number = 0;
  alive: boolean = true;

  constructor(x: number, y: number, z: number, damage: number, team: Team) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.damage = damage;
    this.team = team;
  }

  update(dt: number, targetX: number, targetY: number, targetZ: number): boolean {
    this.lifetime += dt;
    if (this.lifetime >= PROJECTILE_MAX_LIFETIME) {
      this.alive = false;
      return false;
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dz = targetZ - this.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const hitDist = PROJECTILE_RADIUS + PLAYER_HIT_RADIUS;

    // Pre-movement hit check (dist <= hitDist also prevents zero division since hitDist > 0)
    if (dist <= hitDist) {
      this.alive = false;
      return true;
    }

    // Homing movement (dist > hitDist > 0 guaranteed, normalization is safe)
    const nx = dx / dist;
    const ny = dy / dist;
    const nz = dz / dist;
    this.x += nx * PROJECTILE_SPEED * dt;
    this.y += ny * PROJECTILE_SPEED * dt;
    this.z += nz * PROJECTILE_SPEED * dt;

    // Post-movement hit check
    const dx2 = targetX - this.x;
    const dy2 = targetY - this.y;
    const dz2 = targetZ - this.z;
    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2);
    if (dist2 <= hitDist) {
      this.alive = false;
      return true;
    }

    return false;
  }
}
