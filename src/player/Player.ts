import { World } from '../world/World';
import { KnockbackState, createKnockbackState } from '../physics/Knockback';
import {
  EntityBody,
  applyGravity,
  moveWithCollision,
  tryJump,
  applyEntityKnockback,
} from '../physics/EntityPhysics';
import {
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_EYE_HEIGHT,
  MOVE_SPEED,
  GRAVITY,
  JUMP_VELOCITY,
  TERMINAL_VELOCITY,
} from '../config/GameBalance';

export { PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_EYE_HEIGHT, MOVE_SPEED, GRAVITY, JUMP_VELOCITY, TERMINAL_VELOCITY };

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
