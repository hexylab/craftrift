import { describe, it, expect } from 'vitest';
import { createDamageFlash, triggerFlash, updateFlash, FLASH_DURATION } from './DamageFlash';

describe('DamageFlash', () => {
  it('starts inactive', () => {
    const flash = createDamageFlash();
    expect(flash.active).toBe(false);
    expect(flash.timer).toBe(0);
  });

  it('becomes active after trigger', () => {
    const flash = createDamageFlash();
    triggerFlash(flash);
    expect(flash.active).toBe(true);
    expect(flash.timer).toBe(FLASH_DURATION);
  });

  it('stays active during duration', () => {
    const flash = createDamageFlash();
    triggerFlash(flash);
    updateFlash(flash, FLASH_DURATION * 0.5);
    expect(flash.active).toBe(true);
  });

  it('deactivates after duration', () => {
    const flash = createDamageFlash();
    triggerFlash(flash);
    updateFlash(flash, FLASH_DURATION + 0.01);
    expect(flash.active).toBe(false);
    expect(flash.timer).toBe(0);
  });

  it('can be re-triggered while active', () => {
    const flash = createDamageFlash();
    triggerFlash(flash);
    updateFlash(flash, FLASH_DURATION * 0.5);
    triggerFlash(flash); // re-trigger
    expect(flash.timer).toBe(FLASH_DURATION); // timer reset
  });
});
