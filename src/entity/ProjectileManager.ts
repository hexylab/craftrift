import * as THREE from 'three';
import { Projectile, PROJECTILE_RADIUS } from './Projectile';
import { FireCommand } from './TowerAI';
import { Team } from './Entity';

export interface HitResult {
  damage: number;
  team: Team;
}

export class ProjectileManager {
  private projectiles: Projectile[] = [];
  private meshes: Map<Projectile, THREE.Mesh> = new Map();

  constructor(private scene: THREE.Scene) {}

  spawn(command: FireCommand): void {
    const projectile = new Projectile(
      command.originX, command.originY, command.originZ,
      command.damage, command.team,
    );
    this.projectiles.push(projectile);

    const color = command.team === 'red' ? 0xff4444 : 0x4444ff;
    const geometry = new THREE.SphereGeometry(PROJECTILE_RADIUS, 8, 8);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(command.originX, command.originY, command.originZ);
    this.scene.add(mesh);
    this.meshes.set(projectile, mesh);
  }

  update(dt: number, targetX: number, targetY: number, targetZ: number): HitResult[] {
    const hits: HitResult[] = [];

    for (const p of this.projectiles) {
      const hit = p.update(dt, targetX, targetY, targetZ);
      if (hit) {
        hits.push({ damage: p.damage, team: p.team });
      }
    }

    const dead = this.projectiles.filter(p => !p.alive);
    for (const p of dead) {
      const mesh = this.meshes.get(p);
      if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.meshes.delete(p);
      }
    }
    this.projectiles = this.projectiles.filter(p => p.alive);

    for (const p of this.projectiles) {
      const mesh = this.meshes.get(p);
      if (mesh) {
        mesh.position.set(p.x, p.y, p.z);
      }
    }

    return hits;
  }

  dispose(): void {
    for (const [, mesh] of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.projectiles = [];
    this.meshes.clear();
  }
}
