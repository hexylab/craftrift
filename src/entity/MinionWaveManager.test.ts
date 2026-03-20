import { describe, it, expect, vi } from 'vitest';
import { MinionWaveManager, WAVE_INTERVAL, WAVE_SIZE } from './MinionWaveManager';
import * as THREE from 'three';

describe('MinionWaveManager', () => {
  function createManager() {
    const scene = new THREE.Scene();
    return new MinionWaveManager(scene, []);
  }

  it('spawns first wave immediately', () => {
    const manager = createManager();
    manager.update(0.1, []);
    expect(manager.getAllMinions().length).toBe(6); // 3 blue + 3 red
  });

  it('spawns next wave after interval', () => {
    const manager = createManager();
    manager.update(0.1, []);
    expect(manager.getAllMinions().length).toBe(6);
    manager.update(WAVE_INTERVAL, []);
    expect(manager.getAllMinions().length).toBe(12);
  });

  it('removes dead minions', () => {
    const manager = createManager();
    manager.update(0.1, []);
    const minions = manager.getAllMinions();
    minions[0].takeDamage(150); // instant kill
    manager.update(0.1, []);
    expect(manager.getAllMinions().length).toBe(5);
  });

  it('blue minions spawn at low-z, red at high-z', () => {
    const manager = createManager();
    manager.update(0.1, []);
    const blues = manager.getTeamMinions('blue');
    const reds = manager.getTeamMinions('red');
    expect(blues.length).toBe(WAVE_SIZE);
    expect(reds.length).toBe(WAVE_SIZE);
    expect(blues[0].z).toBeLessThan(50);
    expect(reds[0].z).toBeGreaterThan(150);
  });

  it('uses custom model builder when provided', () => {
    const scene = new THREE.Scene();
    const builder = vi.fn(() => new THREE.Group());
    const manager = new MinionWaveManager(scene, [], builder);
    manager.update(0.1, []);
    expect(builder).toHaveBeenCalledTimes(6); // 3 blue + 3 red
  });
});
