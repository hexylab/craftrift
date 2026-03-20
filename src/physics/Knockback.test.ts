import { describe, it, expect } from 'vitest';
import { KnockbackState, applyKnockback, updateKnockback,
  KNOCKBACK_HORIZONTAL, KNOCKBACK_VERTICAL } from './Knockback';

describe('applyKnockback', () => {
  it('applies velocity away from source', () => {
    const state: KnockbackState = { vx: 0, vy: 0, vz: 0 };
    applyKnockback(state, 0, 0, 0, 10, 0, 0);
    expect(state.vx).toBeCloseTo(KNOCKBACK_HORIZONTAL);
    expect(state.vy).toBeCloseTo(KNOCKBACK_VERTICAL);
    expect(state.vz).toBeCloseTo(0);
  });

  it('applies diagonal knockback', () => {
    const state: KnockbackState = { vx: 0, vy: 0, vz: 0 };
    applyKnockback(state, 0, 0, 0, 1, 0, 1);
    expect(Math.abs(state.vx - state.vz)).toBeLessThan(0.001);
    const horizontal = Math.sqrt(state.vx ** 2 + state.vz ** 2);
    expect(horizontal).toBeCloseTo(KNOCKBACK_HORIZONTAL);
  });

  it('handles zero distance', () => {
    const state: KnockbackState = { vx: 0, vy: 0, vz: 0 };
    applyKnockback(state, 5, 0, 5, 5, 0, 5);
    expect(state.vy).toBeCloseTo(KNOCKBACK_VERTICAL);
  });
});

describe('updateKnockback', () => {
  it('decays velocity over time', () => {
    const state: KnockbackState = { vx: 3.0, vy: 2.0, vz: 0 };
    updateKnockback(state, 0.1);
    expect(state.vx).toBeLessThan(3.0);
    expect(state.vx).toBeGreaterThan(0);
  });

  it('reaches near-zero after sufficient time', () => {
    const state: KnockbackState = { vx: 3.0, vy: 0, vz: 3.0 };
    for (let i = 0; i < 30; i++) updateKnockback(state, 0.05);
    expect(Math.abs(state.vx)).toBeLessThan(0.01);
    expect(Math.abs(state.vz)).toBeLessThan(0.01);
  });
});
