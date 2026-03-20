// src/player/PlayerState.ts
import { PLAYER_MAX_HP, RESPAWN_TIME, INVINCIBLE_TIME } from '../config/GameBalance';

export { PLAYER_MAX_HP, RESPAWN_TIME, INVINCIBLE_TIME };

export class PlayerState {
  hp: number = PLAYER_MAX_HP;
  readonly maxHp: number = PLAYER_MAX_HP;
  isAlive: boolean = true;
  respawnTimer: number = 0;
  invincibleTimer: number = 0;
  private onDeathCallback: (() => void) | null = null;

  onDeath(callback: () => void): void {
    this.onDeathCallback = callback;
  }

  takeDamage(amount: number): void {
    if (!this.isAlive || this.isInvincible() || amount <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.isAlive = false;
      this.respawnTimer = RESPAWN_TIME;
      this.onDeathCallback?.();
    }
  }

  update(dt: number): boolean {
    if (!this.isAlive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn();
        return true;
      }
      return false;
    }
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
      if (this.invincibleTimer <= 0) {
        this.invincibleTimer = 0;
      }
    }
    return false;
  }

  respawn(): void {
    this.hp = this.maxHp;
    this.isAlive = true;
    this.respawnTimer = 0;
    this.invincibleTimer = INVINCIBLE_TIME;
  }

  isInvincible(): boolean {
    return this.invincibleTimer > 0;
  }
}
