export const WALK_AMPLITUDE = 0.5;     // ラジアン
export const WALK_SPEED_FACTOR = 8.0;
const IDLE_AMPLITUDE = 0.02;
const IDLE_SPEED = 1.5;
const BLEND_SPEED = 8.0;

export interface LimbAngles {
  rightArm: number;
  leftArm: number;
  rightLeg: number;
  leftLeg: number;
  head: number;
}

export class WalkAnimator {
  private phase = 0;
  private walkBlend = 0;

  update(dt: number, isMoving: boolean, moveSpeed: number): LimbAngles {
    const targetBlend = isMoving ? 1 : 0;
    this.walkBlend += (targetBlend - this.walkBlend) * Math.min(1, BLEND_SPEED * dt);
    const animSpeed = isMoving ? moveSpeed * WALK_SPEED_FACTOR : IDLE_SPEED;
    this.phase += dt * animSpeed;
    const walkAngle = Math.sin(this.phase) * WALK_AMPLITUDE;
    const idleAngle = Math.sin(this.phase) * IDLE_AMPLITUDE;
    const limbAngle = walkAngle * this.walkBlend + idleAngle * (1 - this.walkBlend);
    return {
      rightArm: -limbAngle,
      leftArm: limbAngle,
      rightLeg: limbAngle,
      leftLeg: -limbAngle,
      head: idleAngle * (1 - this.walkBlend),
    };
  }
}

export class AttackAnimator {
  private timer = 0;
  private active = false;
  private static readonly DURATION = 0.3;

  play(): void {
    this.timer = AttackAnimator.DURATION;
    this.active = true;
  }

  update(dt: number): number {
    if (!this.active) return 0;
    this.timer -= dt;
    if (this.timer <= 0) { this.active = false; return 0; }
    const progress = 1 - this.timer / AttackAnimator.DURATION;
    return -Math.sin(progress * Math.PI) * 1.5;
  }

  get isPlaying(): boolean { return this.active; }
}
