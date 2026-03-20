import * as THREE from 'three';
import { Minion, MINION_MOVE_SPEED } from './Minion';
import { MinionAI, PlayerInfo } from './MinionAI';
import { Structure } from './Structure';
import { Team } from './Entity';
import { KnockbackState, createKnockbackState, updateKnockback, hasKnockback } from '../physics/Knockback';

export const WAVE_INTERVAL = 30.0;
export const WAVE_SIZE = 3;
export const BLUE_SPAWN_Z = 12; // Blue Nexus(Z=6, depth=5)の外側
export const RED_SPAWN_Z = 197; // Red Nexus(Z=198, depth=5)の外側
export const SPAWN_X = 9.0;
const SPAWN_Y = 4; // GRASS_Y(3) + 1 = 地面の上

export class MinionWaveManager {
  private minions: Minion[] = [];
  private ais: Map<string, MinionAI> = new Map();
  private knockbacks: Map<string, KnockbackState> = new Map();
  private meshes: Map<string, THREE.Group> = new Map();
  private waveTimer = WAVE_INTERVAL; // Triggers first wave immediately
  private waveCount = 0;
  private pendingPlayerDamage = 0;

  constructor(
    private scene: THREE.Scene,
    private structures: Structure[],
    private buildMinionModel?: (team: Team) => THREE.Group,
  ) {}

  update(dt: number, structures: Structure[], playerInfo?: PlayerInfo): void {
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

      // AI update — Redミニオンにはプレイヤー（Blue）を敵として渡す
      const enemyPlayer = (minion.team !== 'blue' && playerInfo) ? playerInfo : undefined;
      const result = ai.update(dt, this.minions, this.structures, undefined, enemyPlayer);

      // Apply movement with obstacle avoidance
      const newX = minion.x + result.moveX;
      const newZ = minion.z + result.moveZ;
      if (!this.collidesWithStructure(newX, minion.y, newZ)) {
        minion.x = newX;
        minion.z = newZ;
      } else {
        // 障害物回避: Z方向に進めない場合、X方向にずれて迂回
        // まずZ方向のみ試す
        if (!this.collidesWithStructure(minion.x, minion.y, newZ)) {
          minion.z = newZ;
        } else {
          // Z方向もブロック → X方向にステップして迂回
          const avoidDir = minion.x < SPAWN_X ? -1 : 1; // レーン中央より左なら左へ、右なら右へ
          const stepX = avoidDir * MINION_MOVE_SPEED * dt;
          if (!this.collidesWithStructure(minion.x + stepX, minion.y, minion.z)) {
            minion.x += stepX;
          } else if (!this.collidesWithStructure(minion.x - stepX, minion.y, minion.z)) {
            // 反対方向を試す
            minion.x -= stepX;
          }
        }
      }

      // Apply damage to target
      if (result.damage > 0 && result.targetId) {
        if (result.targetId === 'player') {
          // プレイヤーへのダメージはGame.tsで処理するためフラグを立てる
          this.pendingPlayerDamage += result.damage;
        } else {
          const target = this.minions.find(m => m.id === result.targetId) ??
            this.structures.find(s => s.id === result.targetId);
          if (target && target.isAlive) {
            target.takeDamage(result.damage);
          }
        }
      }

      // Sync mesh position and animation
      const mesh = this.meshes.get(minion.id);
      if (mesh) {
        mesh.position.set(minion.x, minion.y, minion.z);
        // 攻撃モーション: 頭を前に突き出す
        for (const child of mesh.children) {
          const g = child as THREE.Group;
          if (g.name === 'head') {
            const targetAngle = result.state === 'attacking' ?
              Math.sin(Date.now() * 0.01) * 0.3 : 0; // 攻撃時に頭を振る
            g.rotation.x = targetAngle;
          }
          // 歩行アニメーション（脚を振る）
          if (result.state === 'walking' || result.state === 'returning') {
            const walkPhase = Date.now() * 0.008 + minion.x * 10; // ミニオンごとに位相をずらす
            const angle = Math.sin(walkPhase) * 0.4;
            if (g.name === 'rightFrontLeg' || g.name === 'leftBackLeg') g.rotation.x = angle;
            else if (g.name === 'leftFrontLeg' || g.name === 'rightBackLeg') g.rotation.x = -angle;
          } else {
            // 静止時は脚をリセット
            if (g.name.includes('Leg')) g.rotation.x = 0;
          }
        }
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
      // チーム方向に向ける: Blue→+Z方向(0), Red→-Z方向(π)
      mesh.rotation.y = team === 'red' ? Math.PI : 0;
      this.scene.add(mesh);
      this.meshes.set(id, mesh);
    }
  }

  getAllMinions(): Minion[] { return this.minions; }
  getTeamMinions(team: Team): Minion[] { return this.minions.filter(m => m.team === team); }

  getKnockback(id: string): KnockbackState | undefined {
    return this.knockbacks.get(id);
  }

  /** ミニオンが構造物と衝突するかチェック（AABB判定、半径0.4） */
  private collidesWithStructure(x: number, y: number, z: number): boolean {
    const r = 0.4;
    for (const s of this.structures) {
      if (!s.isAlive) continue;
      if (x + r > s.x && x - r < s.x + s.width &&
          y + 1.0 > s.y && y < s.y + s.height &&
          z + r > s.z && z - r < s.z + s.depth) {
        return true;
      }
    }
    return false;
  }

  /** ミニオンからプレイヤーへの蓄積ダメージを取得してリセット */
  consumePlayerDamage(): number {
    const d = this.pendingPlayerDamage;
    this.pendingPlayerDamage = 0;
    return d;
  }
}
