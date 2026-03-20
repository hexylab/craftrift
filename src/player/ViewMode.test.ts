import { describe, it, expect } from 'vitest';
import { ViewMode } from './ViewMode';

describe('ViewMode', () => {
  it('starts in first-person mode', () => {
    const vm = new ViewMode();
    expect(vm.current).toBe('first-person');
  });

  it('cycles through modes on toggle', () => {
    const vm = new ViewMode();
    vm.toggle();
    expect(vm.current).toBe('third-person-back');
    vm.toggle();
    expect(vm.current).toBe('third-person-front');
    vm.toggle();
    expect(vm.current).toBe('first-person');
  });

  it('reports isFirstPerson correctly', () => {
    const vm = new ViewMode();
    expect(vm.isFirstPerson).toBe(true);
    vm.toggle();
    expect(vm.isFirstPerson).toBe(false);
  });

  it('computes camera offset for third-person-back', () => {
    const vm = new ViewMode();
    vm.toggle();
    const offset = vm.getCameraOffset(0, 0, -1);
    expect(offset.z).toBeGreaterThan(0);
  });

  it('computes camera offset for third-person-front', () => {
    const vm = new ViewMode();
    vm.toggle();
    vm.toggle();
    const offset = vm.getCameraOffset(0, 0, -1);
    expect(offset.z).toBeLessThan(0);
  });
});
