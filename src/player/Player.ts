import { World } from '../world/World';
import { KnockbackState, createKnockbackState } from '../physics/Knockback';
import {
  EntityBody,
  applyGravity,
  moveWithCollision,
  tryJump,
  applyEntityKnockback,
} from '../physics/EntityPhysics';

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.6;
export const MOVE_SPEED = 4.3;

export { GRAVITY, JUMP_VELOCITY, TERMINAL_VELOCITY } from '../physics/EntityPhysics';

export class Player implements EntityBody {
  x: number;
  y: number;
  z: number;
  readonly width = PLAYER_WIDTH;
  readonly height = PLAYER_HEIGHT;
  velocityY = 0;
  onGround = false;
  knockback: KnockbackState = createKnockbackState();

  constructor(
    x: number,
    y: number,
    z: number,
    private world: World,
  ) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  move(dx: number, dz: number, dt: number): void {
    const dist = MOVE_SPEED * dt;
    // Z軸を先に処理することで壁スライドの挙動を維持する
    moveWithCollision(this, 0, dz * dist, this.world);
    moveWithCollision(this, dx * dist, 0, this.world);
  }

  updatePhysics(dt: number): void {
    applyEntityKnockback(this, this.knockback, dt, this.world);
    applyGravity(this, dt, this.world);
  }

  jump(): void {
    tryJump(this);
  }

  get eyeX(): number {
    return this.x;
  }
  get eyeY(): number {
    return this.y + PLAYER_EYE_HEIGHT;
  }
  get eyeZ(): number {
    return this.z;
  }
}
