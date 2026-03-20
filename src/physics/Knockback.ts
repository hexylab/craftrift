export const KNOCKBACK_HORIZONTAL = 3.0;
export const KNOCKBACK_VERTICAL = 2.0;
export const KNOCKBACK_FRICTION = 10.0;

export interface KnockbackState {
  vx: number;
  vy: number;
  vz: number;
}

export function applyKnockback(
  state: KnockbackState,
  sourceX: number, sourceY: number, sourceZ: number,
  targetX: number, targetY: number, targetZ: number,
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
  state.vy = KNOCKBACK_VERTICAL;
  state.vz = dz * KNOCKBACK_HORIZONTAL;
}

export function updateKnockback(state: KnockbackState, dt: number): void {
  const decay = Math.exp(-KNOCKBACK_FRICTION * dt);
  state.vx *= decay;
  state.vz *= decay;
  state.vy = 0; // Y is handled by Player physics
}

export function createKnockbackState(): KnockbackState {
  return { vx: 0, vy: 0, vz: 0 };
}

export function hasKnockback(state: KnockbackState): boolean {
  return Math.abs(state.vx) > 0.01 || Math.abs(state.vz) > 0.01;
}
