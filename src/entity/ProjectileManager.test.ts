import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectileManager } from './ProjectileManager';
import { FireCommand } from './TowerAI';
import { PROJECTILE_MAX_LIFETIME } from './Projectile';

vi.mock('three', () => {
  class MockVector3 {
    constructor(public x = 0, public y = 0, public z = 0) {}
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; }
  }
  class MockMesh {
    position = new MockVector3();
    geometry = { dispose: vi.fn() };
  }
  class MockSphereGeometry {}
  class MockMeshStandardMaterial {}
  class MockScene {
    children: any[] = [];
    add(obj: any) { this.children.push(obj); }
    remove(obj: any) {
      const i = this.children.indexOf(obj);
      if (i >= 0) this.children.splice(i, 1);
    }
  }
  return {
    Scene: MockScene,
    Mesh: MockMesh,
    SphereGeometry: MockSphereGeometry,
    MeshStandardMaterial: MockMeshStandardMaterial,
    Vector3: MockVector3,
  };
});

import * as THREE from 'three';

describe('ProjectileManager', () => {
  let scene: THREE.Scene;
  let manager: ProjectileManager;

  beforeEach(() => {
    scene = new THREE.Scene();
    manager = new ProjectileManager(scene);
  });

  it('spawn adds a projectile and mesh to scene', () => {
    const command: FireCommand = { originX: 0, originY: 5, originZ: 0, damage: 25, team: 'red' };
    manager.spawn(command, 100, 0, 0);
    expect(scene.children.length).toBe(1);
  });

  it('update moves projectiles', () => {
    const command: FireCommand = { originX: 0, originY: 0, originZ: 0, damage: 25, team: 'red' };
    manager.spawn(command, 100, 0, 0);
    const hits = manager.update(0.5, 100, 0, 0);
    expect(hits.length).toBe(0);
    const mesh = scene.children[0] as THREE.Mesh;
    expect(mesh.position.x).toBeGreaterThan(0);
  });

  it('update returns HitResult when projectile hits', () => {
    const command: FireCommand = { originX: 0, originY: 0, originZ: 0, damage: 25, team: 'red' };
    manager.spawn(command, 100, 0, 0);
    const hits = manager.update(0.001, 0.1, 0, 0);
    expect(hits.length).toBe(1);
    expect(hits[0].damage).toBe(25);
    expect(hits[0].team).toBe('red');
    expect(scene.children.length).toBe(0);
  });

  it('removes expired projectiles', () => {
    const command: FireCommand = { originX: 0, originY: 0, originZ: 0, damage: 25, team: 'red' };
    manager.spawn(command, 100, 0, 0);
    manager.update(PROJECTILE_MAX_LIFETIME + 1, 1000, 0, 0);
    expect(scene.children.length).toBe(0);
  });

  it('dispose removes all projectiles', () => {
    manager.spawn({ originX: 0, originY: 0, originZ: 0, damage: 25, team: 'red' }, 100, 0, 0);
    manager.spawn({ originX: 5, originY: 0, originZ: 0, damage: 25, team: 'red' }, 100, 0, 0);
    expect(scene.children.length).toBe(2);
    manager.dispose();
    expect(scene.children.length).toBe(0);
  });
});
