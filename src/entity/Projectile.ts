import { Team } from './Entity';

export const PROJECTILE_SPEED = 8.0;
export const PROJECTILE_RADIUS = 0.2;
export const PROJECTILE_MAX_LIFETIME = 5.0;
export const PLAYER_HIT_RADIUS = 0.3;
export const PROJECTILE_TURN_RATE = 1.5; // radians/sec — 旋回速度制限

export class Projectile {
  x: number;
  y: number;
  z: number;
  readonly damage: number;
  readonly team: Team;
  private lifetime: number = 0;
  alive: boolean = true;
  // 現在の飛翔方向（正規化済み）
  private dirX: number;
  private dirY: number;
  private dirZ: number;

  constructor(x: number, y: number, z: number, damage: number, team: Team,
    targetX: number, targetY: number, targetZ: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.damage = damage;
    this.team = team;
    // 初期方向: 発射時のターゲットへ向かう
    const dx = targetX - x;
    const dy = targetY - y;
    const dz = targetZ - z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > 0) {
      this.dirX = dx / dist;
      this.dirY = dy / dist;
      this.dirZ = dz / dist;
    } else {
      this.dirX = 0;
      this.dirY = 0;
      this.dirZ = 1;
    }
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

    if (dist <= hitDist) {
      this.alive = false;
      return true;
    }

    // 目標方向を計算
    const desiredX = dx / dist;
    const desiredY = dy / dist;
    const desiredZ = dz / dist;

    // 現在方向と目標方向の角度差
    const dot = Math.max(-1, Math.min(1,
      this.dirX * desiredX + this.dirY * desiredY + this.dirZ * desiredZ));
    const angle = Math.acos(dot);

    // 旋回制限付きで方向を補間
    if (angle > 0.001) {
      const maxTurn = PROJECTILE_TURN_RATE * dt;
      const t = Math.min(1, maxTurn / angle);
      // 線形補間 + 再正規化
      let newX = this.dirX + (desiredX - this.dirX) * t;
      let newY = this.dirY + (desiredY - this.dirY) * t;
      let newZ = this.dirZ + (desiredZ - this.dirZ) * t;
      const len = Math.sqrt(newX * newX + newY * newY + newZ * newZ);
      if (len > 0) {
        this.dirX = newX / len;
        this.dirY = newY / len;
        this.dirZ = newZ / len;
      }
    }

    // 現在方向に沿って移動
    this.x += this.dirX * PROJECTILE_SPEED * dt;
    this.y += this.dirY * PROJECTILE_SPEED * dt;
    this.z += this.dirZ * PROJECTILE_SPEED * dt;

    // 移動後ヒット判定
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
