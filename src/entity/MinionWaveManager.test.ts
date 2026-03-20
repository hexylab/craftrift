import { describe, it, expect, vi } from 'vitest';
import { MinionWaveManager, WAVE_INTERVAL, WAVE_SIZE, WorldLike } from './MinionWaveManager';
import * as THREE from 'three';

/** y<=3 が地面（固体）、それ以外は空気 */
const mockWorld: WorldLike = {
  getBlock: (_x: number, y: number, _z: number) => {
    if (y <= 3) return 1; // ground
    return null;
  },
};

describe('MinionWaveManager', () => {
  function createManager() {
    const scene = new THREE.Scene();
    return new MinionWaveManager(scene, []);
  }

  it('spawns first wave immediately', () => {
    const manager = createManager();
    manager.update(0.1, [], mockWorld);
    expect(manager.getAllMinions().length).toBe(6); // 3 blue + 3 red
  });

  it('spawns next wave after interval', () => {
    const manager = createManager();
    manager.update(0.1, [], mockWorld);
    expect(manager.getAllMinions().length).toBe(6);
    manager.update(WAVE_INTERVAL, [], mockWorld);
    expect(manager.getAllMinions().length).toBe(12);
  });

  it('removes dead minions', () => {
    const manager = createManager();
    manager.update(0.1, [], mockWorld);
    const minions = manager.getAllMinions();
    minions[0].takeDamage(150); // instant kill
    manager.update(0.1, [], mockWorld);
    expect(manager.getAllMinions().length).toBe(5);
  });

  it('blue minions spawn at low-z, red at high-z', () => {
    const manager = createManager();
    manager.update(0.1, [], mockWorld);
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
    manager.update(0.1, [], mockWorld);
    expect(builder).toHaveBeenCalledTimes(6); // 3 blue + 3 red
  });

  it('applies gravity so minions land on ground', () => {
    const manager = createManager();
    manager.update(0.1, [], mockWorld);
    const minions = manager.getAllMinions();
    // Spawn Y=4 is directly above ground (y<=3), after gravity minions should land
    // Run several frames to let gravity settle
    for (let i = 0; i < 20; i++) {
      manager.update(0.05, [], mockWorld);
    }
    for (const m of minions) {
      if (!m.isAlive) continue;
      expect(m.onGround).toBe(true);
    }
  });

  it('minions have width and height for EntityBody', () => {
    const manager = createManager();
    manager.update(0.1, [], mockWorld);
    const minion = manager.getAllMinions()[0];
    expect(minion.width).toBe(0.8);
    expect(minion.height).toBe(1.0);
    expect(typeof minion.velocityY).toBe('number');
    expect(typeof minion.onGround).toBe('boolean');
  });
});
