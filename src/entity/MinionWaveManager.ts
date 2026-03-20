import * as THREE from 'three';
import { Minion, MINION_MOVE_SPEED } from './Minion';
import { MinionAI } from './MinionAI';
import { Structure } from './Structure';
import { Team } from './Entity';
import { KnockbackState, createKnockbackState, updateKnockback, hasKnockback } from '../physics/Knockback';

export const WAVE_INTERVAL = 30.0;
export const WAVE_SIZE = 3;
export const BLUE_SPAWN_Z = 10;
export const RED_SPAWN_Z = 200;
export const SPAWN_X = 9.0;
const SPAWN_Y = 5;

export class MinionWaveManager {
  private minions: Minion[] = [];
  private ais: Map<string, MinionAI> = new Map();
  private knockbacks: Map<string, KnockbackState> = new Map();
  private meshes: Map<string, THREE.Group> = new Map();
  private waveTimer = WAVE_INTERVAL; // Triggers first wave immediately
  private waveCount = 0;

  constructor(
    private scene: THREE.Scene,
    private structures: Structure[],
    private buildMinionModel?: (team: Team) => THREE.Group,
  ) {}

  update(dt: number, structures: Structure[]): void {
    this.structures = structures;

    // Wave spawn
    this.waveTimer += dt;
    if (this.waveTimer >= WAVE_INTERVAL) {
      this.waveTimer -= WAVE_INTERVAL;
      this.spawnWave('blue');
      this.spawnWave('red');
      this.waveCount++;
    }

    // Update each minion AI
    for (const minion of this.minions) {
      if (!minion.isAlive) continue;

      const ai = this.ais.get(minion.id);
      if (!ai) continue;

      // Knockback update
      const kb = this.knockbacks.get(minion.id);
      if (kb && hasKnockback(kb)) {
        minion.x += kb.vx * dt;
        minion.z += kb.vz * dt;
        updateKnockback(kb, dt);
      }

      // AI update
      const result = ai.update(dt, this.minions, this.structures);

      // Apply movement
      minion.x += result.moveX;
      minion.z += result.moveZ;

      // Apply damage to target
      if (result.damage > 0 && result.targetId) {
        const target = this.minions.find(m => m.id === result.targetId) ??
          this.structures.find(s => s.id === result.targetId);
        if (target && target.isAlive) {
          target.takeDamage(result.damage);
        }
      }

      // Sync mesh position
      const mesh = this.meshes.get(minion.id);
      if (mesh) {
        mesh.position.set(minion.x, minion.y, minion.z);
      }
    }

    // Remove dead minions
    const dead = this.minions.filter(m => !m.isAlive);
    for (const m of dead) {
      const mesh = this.meshes.get(m.id);
      if (mesh) {
        this.scene.remove(mesh);
        this.meshes.delete(m.id);
      }
      this.ais.delete(m.id);
      this.knockbacks.delete(m.id);
    }
    this.minions = this.minions.filter(m => m.isAlive);
  }

  private spawnWave(team: Team): void {
    const z = team === 'blue' ? BLUE_SPAWN_Z : RED_SPAWN_Z;
    for (let i = 0; i < WAVE_SIZE; i++) {
      const id = `${team}-minion-w${this.waveCount}-${i}`;
      const offsetX = (i - 1) * 1.5;
      const minion = new Minion(id, team, SPAWN_X + offsetX, SPAWN_Y, z);
      this.minions.push(minion);
      this.ais.set(id, new MinionAI(minion));
      this.knockbacks.set(id, createKnockbackState());

      // Create mesh (use model builder if provided, else placeholder box)
      let mesh: THREE.Group;
      if (this.buildMinionModel) {
        mesh = this.buildMinionModel(team);
      } else {
        const color = team === 'blue' ? 0x4488ff : 0xff4444;
        const geometry = new THREE.BoxGeometry(0.6, 0.8, 0.6);
        const material = new THREE.MeshLambertMaterial({ color });
        mesh = new THREE.Group();
        mesh.add(new THREE.Mesh(geometry, material));
      }
      mesh.position.set(minion.x, minion.y, minion.z);
      this.scene.add(mesh);
      this.meshes.set(id, mesh);
    }
  }

  getAllMinions(): Minion[] { return this.minions; }
  getTeamMinions(team: Team): Minion[] { return this.minions.filter(m => m.team === team); }

  getKnockback(id: string): KnockbackState | undefined {
    return this.knockbacks.get(id);
  }
}
