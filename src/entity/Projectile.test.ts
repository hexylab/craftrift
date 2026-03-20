import { describe, it, expect } from 'vitest';
import { Projectile, PROJECTILE_SPEED, PROJECTILE_RADIUS, PROJECTILE_MAX_LIFETIME, PLAYER_HIT_RADIUS } from './Projectile';

describe('Projectile', () => {
  it('initial state: alive=true, at origin position', () => {
    const p = new Projectile(0, 5, 0, 25, 'red');
    expect(p.alive).toBe(true);
    expect(p.x).toBe(0);
    expect(p.y).toBe(5);
    expect(p.z).toBe(0);
  });

  it('moves toward target (homing)', () => {
    const p = new Projectile(0, 0, 0, 25, 'red');
    p.update(1.0, 80, 0, 0);
    expect(p.x).toBeCloseTo(PROJECTILE_SPEED, 1);
    expect(p.y).toBeCloseTo(0, 1);
    expect(p.z).toBeCloseTo(0, 1);
  });

  it('hits target when close enough', () => {
    const hitDist = PROJECTILE_RADIUS + PLAYER_HIT_RADIUS;
    const p = new Projectile(0, 0, 0, 25, 'red');
    const hit = p.update(0.001, hitDist * 0.5, 0, 0);
    expect(hit).toBe(true);
    expect(p.alive).toBe(false);
  });

  it('expires after max lifetime', () => {
    const p = new Projectile(0, 0, 0, 25, 'red');
    const hit = p.update(PROJECTILE_MAX_LIFETIME + 0.1, 1000, 0, 0);
    expect(hit).toBe(false);
    expect(p.alive).toBe(false);
  });

  it('keeps tracking when target moves', () => {
    const p = new Projectile(0, 0, 0, 25, 'red');
    p.update(0.5, 0, 0, 100);
    expect(p.z).toBeGreaterThan(0);
    p.update(0.5, 100, 0, 0);
    expect(p.x).toBeGreaterThan(0);
  });

  it('does not crash when at same position as target (zero distance)', () => {
    const p = new Projectile(5, 5, 5, 25, 'red');
    const hit = p.update(0.016, 5, 5, 5);
    expect(hit).toBe(true);
    expect(p.alive).toBe(false);
  });
});
