import { DamageSource } from '../systems/types';

export type Team = 'blue' | 'red';

export class Entity {
  readonly id: string;
  readonly team: Team;
  x: number;
  y: number;
  z: number;
  hp: number;
  readonly maxHp: number;
  isAlive = true;

  constructor(id: string, team: Team, x: number, y: number, z: number, maxHp: number) {
    this.id = id;
    this.team = team;
    this.x = x;
    this.y = y;
    this.z = z;
    this.hp = maxHp;
    this.maxHp = maxHp;
  }

  takeDamage(amount: number, _source?: DamageSource): void {
    if (!this.isAlive || amount <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.isAlive = false;
    }
  }
}
