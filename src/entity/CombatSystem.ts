import { Structure } from './Structure';

export const ATTACK_DAMAGE = 50;
export const ATTACK_RANGE = 5.0;
export const ATTACK_COOLDOWN = 0.5;

export type AttackFailReason = 'cooldown' | 'no_target' | 'protected';

export interface AttackResult {
  hit: true;
  target: Structure;
  damage: number;
  destroyed: boolean;
}

export interface AttackFailed {
  hit: false;
  reason: AttackFailReason;
  target: Structure | null;
}

export class CombatSystem {
  private lastAttackTime = 0;

  tryAttack(
    target: Structure | null,
    time: number,
  ): AttackResult | AttackFailed {
    if (time - this.lastAttackTime < ATTACK_COOLDOWN) {
      return { hit: false, reason: 'cooldown', target: null };
    }
    if (!target) {
      return { hit: false, reason: 'no_target', target: null };
    }
    if (target.isProtected()) {
      return { hit: false, reason: 'protected', target };
    }

    this.lastAttackTime = time;
    const prevAlive = target.isAlive;
    target.takeDamage(ATTACK_DAMAGE);

    return {
      hit: true,
      target,
      damage: ATTACK_DAMAGE,
      destroyed: prevAlive && !target.isAlive,
    };
  }

  findTarget(
    eyeX: number, eyeY: number, eyeZ: number,
    dirX: number, dirY: number, dirZ: number,
    structures: Structure[],
  ): Structure | null {
    let closest: Structure | null = null;
    let closestT = Infinity;

    for (const s of structures) {
      if (!s.isAlive || s.team === 'blue') continue;

      const t = this.rayIntersectsAABB(
        eyeX, eyeY, eyeZ,
        dirX, dirY, dirZ,
        s.x, s.y, s.z,
        s.x + s.width, s.y + s.height, s.z + s.depth,
      );

      if (t !== null && t > 0 && t <= ATTACK_RANGE && t < closestT) {
        closest = s;
        closestT = t;
      }
    }

    return closest;
  }

  private rayIntersectsAABB(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
  ): number | null {
    let tmin = -Infinity;
    let tmax = Infinity;

    if (dx !== 0) {
      const t1 = (minX - ox) / dx;
      const t2 = (maxX - ox) / dx;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    } else {
      if (ox < minX || ox > maxX) return null;
    }

    if (dy !== 0) {
      const t1 = (minY - oy) / dy;
      const t2 = (maxY - oy) / dy;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    } else {
      if (oy < minY || oy > maxY) return null;
    }

    if (dz !== 0) {
      const t1 = (minZ - oz) / dz;
      const t2 = (maxZ - oz) / dz;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    } else {
      if (oz < minZ || oz > maxZ) return null;
    }

    if (tmax < tmin) return null;
    return tmin >= 0 ? tmin : tmax >= 0 ? tmax : null;
  }
}
