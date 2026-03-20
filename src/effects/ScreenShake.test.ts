import { describe, it, expect } from 'vitest';
import { ScreenShake, SCREEN_SHAKE_INTENSITY, SCREEN_SHAKE_DURATION } from './ScreenShake';

describe('ScreenShake', () => {
  it('initial state returns zero offsets', () => {
    const shake = new ScreenShake();
    const result = shake.update(0.016);
    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(0);
  });

  it('returns non-zero offsets after trigger', () => {
    let hasNonZero = false;
    for (let i = 0; i < 100; i++) {
      const s = new ScreenShake();
      s.trigger();
      const r = s.update(0.001);
      if (r.offsetX !== 0 || r.offsetY !== 0) {
        hasNonZero = true;
        break;
      }
    }
    expect(hasNonZero).toBe(true);
  });

  it('offsets decay to zero after duration elapses', () => {
    const shake = new ScreenShake();
    shake.trigger();
    const result = shake.update(SCREEN_SHAKE_DURATION + 0.1);
    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(0);
  });

  it('multiple triggers reset the timer', () => {
    const shake = new ScreenShake();
    shake.trigger();
    shake.update(SCREEN_SHAKE_DURATION - 0.01);
    shake.trigger();
    const result2 = shake.update(SCREEN_SHAKE_DURATION + 0.1);
    expect(result2.offsetX).toBe(0);
    expect(result2.offsetY).toBe(0);
  });

  it('uses custom intensity when provided', () => {
    let maxOffset = 0;
    for (let i = 0; i < 100; i++) {
      const s = new ScreenShake();
      s.trigger(0.5);
      const r = s.update(0.001);
      maxOffset = Math.max(maxOffset, Math.abs(r.offsetX), Math.abs(r.offsetY));
    }
    expect(maxOffset).toBeGreaterThan(0);
    expect(maxOffset).toBeLessThanOrEqual(0.5);
  });
});
