import {
  KNOCKBACK_HORIZONTAL,
  KNOCKBACK_VERTICAL,
  KNOCKBACK_FRICTION,
} from '../config/GameBalance';

export { KNOCKBACK_HORIZONTAL, KNOCKBACK_VERTICAL, KNOCKBACK_FRICTION };

export interface KnockbackState {
  vx: number;
  vz: number;
}

export function applyKnockback(
  state: KnockbackState,
  sourceX: number,
  sourceY: number,
  sourceZ: number,
  targetX: number,
  targetY: number,
  targetZ: number,
): void {
  let dx = targetX - sourceX;
  let dz = targetZ - sourceZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist > 0.001) {
    dx /= dist;
    dz /= dist;
  } else {
    dx = 0;
    dz = 1;
  }

  state.vx = dx * KNOCKBACK_HORIZONTAL;
  state.vz = dz * KNOCKBACK_HORIZONTAL;
}

export function updateKnockback(state: KnockbackState, dt: number): void {
  const decay = Math.exp(-KNOCKBACK_FRICTION * dt);
  state.vx *= decay;
  state.vz *= decay;
}

export function createKnockbackState(): KnockbackState {
  return { vx: 0, vz: 0 };
}

export function hasKnockback(state: KnockbackState): boolean {
  return Math.abs(state.vx) > 0.01 || Math.abs(state.vz) > 0.01;
}
