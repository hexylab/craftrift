import { describe, it, expect } from 'vitest';
import { ViewMode } from './ViewMode';

describe('ViewMode', () => {
  it('starts in first-person mode', () => {
    const vm = new ViewMode();
    expect(vm.current).toBe('first-person');
  });

  it('cycles between first-person and third-person-back', () => {
    const vm = new ViewMode();
    vm.toggle();
    expect(vm.current).toBe('third-person-back');
    vm.toggle();
    expect(vm.current).toBe('first-person');
  });

  it('reports isFirstPerson correctly', () => {
    const vm = new ViewMode();
    expect(vm.isFirstPerson).toBe(true);
    vm.toggle();
    expect(vm.isFirstPerson).toBe(false);
  });

  it('computes camera offset for third-person-back (behind player)', () => {
    const vm = new ViewMode();
    vm.toggle();
    // forward=(0,0,-1) → offset.z should be positive (behind = opposite of forward)
    const offset = vm.getCameraOffset(0, 0, -1);
    expect(offset.z).toBeGreaterThan(0);
    expect(offset.y).toBe(1.0);
  });
});
