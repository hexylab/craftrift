import * as THREE from 'three';
import { Minion } from './Minion';
import { MinionAI, PlayerInfo } from './MinionAI';
import { Structure } from './Structure';
import { Team } from './Entity';
import { KnockbackState, createKnockbackState } from '../physics/Knockback';
import { applyGravity, moveWithCollision, tryJump, applyEntityKnockback } from '../physics/EntityPhysics';
import { WalkAnimator, AttackAnimator } from '../model/Animator';
import { MINION_MOVE_SPEED } from './Minion';

/** EntityPhysicsが要求するWorldの最小インターフェース */
export type WorldLike = { getBlock: (x: number, y: number, z: number) => unknown };

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
  private walkAnimators: Map<string, WalkAnimator> = new Map();
  private attackAnimators: Map<string, AttackAnimator> = new Map();
  private forwardAngles: Map<string, number> = new Map();
  private waveTimer = WAVE_INTERVAL; // Triggers first wave immediately
  private waveCount = 0;
  private pendingPlayerDamage = 0;

  constructor(
    private scene: THREE.Scene,
    private structures: Structure[],
    private buildMinionModel?: (team: Team) => { mesh: THREE.Group; forwardAngle: number },
  ) {}

  update(dt: number, structures: Structure[], world: WorldLike, playerInfo?: PlayerInfo): void {
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

      // AI update — Redミニオンにはプレイヤー（Blue）を敵として渡す
      const enemyPlayer = (minion.team !== 'blue' && playerInfo) ? playerInfo : undefined;
      const result = ai.update(dt, this.minions, this.structures, undefined, enemyPlayer);

      // 移動前の位置を記録（auto-jump判定用）
      const prevX = minion.x;
      const prevZ = minion.z;

      // ノックバックをEntityPhysics経由で適用（壁衝突考慮）
      const kb = this.knockbacks.get(minion.id);
      if (kb) {
        applyEntityKnockback(minion, kb, dt, world);
      }

      // AI移動をEntityPhysics経由で適用（壁衝突考慮）
      if (result.moveX !== 0 || result.moveZ !== 0) {
        moveWithCollision(minion, result.moveX, result.moveZ, world);
      }

      // Auto-jump: 移動しようとしたのにブロックされた場合、ジャンプで乗り越え試行
      if (result.moveX !== 0 || result.moveZ !== 0) {
        const moved = Math.abs(minion.x - prevX) + Math.abs(minion.z - prevZ);
        const intended = Math.abs(result.moveX) + Math.abs(result.moveZ);
        if (moved < intended * 0.3 && minion.onGround) {
          tryJump(minion);
        }
      }

      // 重力適用
      applyGravity(minion, dt, world);

      // ミニオンの向きを進行方向に合わせる
      if (result.moveX !== 0 || result.moveZ !== 0) {
        const mesh = this.meshes.get(minion.id);
        if (mesh) {
          const forwardAngle = this.forwardAngles.get(minion.id) ?? 0;
          mesh.rotation.y = Math.atan2(result.moveX, result.moveZ) + forwardAngle;
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

        const walkAnim = this.walkAnimators.get(minion.id);
        const attackAnim = this.attackAnimators.get(minion.id);
        if (walkAnim && attackAnim) {
          const isMoving = result.moveX !== 0 || result.moveZ !== 0;
          const angles = walkAnim.update(dt, isMoving, MINION_MOVE_SPEED);

          // WalkAnimatorのリムをヒツジモデルのパーツに対応付ける:
          // rightArm → rightFrontLeg
          // leftArm  → leftFrontLeg
          // rightLeg → rightBackLeg
          // leftLeg  → leftBackLeg
          // head     → head
          for (const child of mesh.children) {
            const g = child as THREE.Group;
            switch (g.name) {
              case 'head':          g.rotation.x = angles.head;     break;
              case 'rightFrontLeg': g.rotation.x = angles.rightArm; break;
              case 'leftFrontLeg':  g.rotation.x = angles.leftArm;  break;
              case 'rightBackLeg':  g.rotation.x = angles.rightLeg; break;
              case 'leftBackLeg':   g.rotation.x = angles.leftLeg;  break;
            }
          }

          // 攻撃アニメーション: 頭にノッドを加算
          if (result.state === 'attacking') {
            if (!attackAnim.isPlaying) attackAnim.play();
            const attackAngle = attackAnim.update(dt);
            const headGroup = mesh.children.find(c => (c as THREE.Group).name === 'head') as THREE.Group;
            if (headGroup) headGroup.rotation.x += attackAngle * 0.3;
          }
        }
      }
    }

    // ミニオン同士の押し出し（separation）— 重なりを防ぐ
    const MINION_RADIUS = 0.4;
    const SEPARATION_FORCE = 2.0;
    for (let i = 0; i < this.minions.length; i++) {
      const a = this.minions[i];
      if (!a.isAlive) continue;
      for (let j = i + 1; j < this.minions.length; j++) {
        const b = this.minions[j];
        if (!b.isAlive) continue;
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const minDist = MINION_RADIUS * 2;
        if (dist < minDist && dist > 0.001) {
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const nz = dz / dist;
          const push = overlap * SEPARATION_FORCE * dt;
          a.x += nx * push;
          a.z += nz * push;
          b.x -= nx * push;
          b.z -= nz * push;
        }
      }
    }

    // メッシュ位置の最終同期（押し出し後）
    for (const minion of this.minions) {
      if (!minion.isAlive) continue;
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
      this.walkAnimators.delete(m.id);
      this.attackAnimators.delete(m.id);
      this.forwardAngles.delete(m.id);
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
        const result = this.buildMinionModel(team);
        mesh = result.mesh;
        this.forwardAngles.set(id, result.forwardAngle);
      } else {
        const color = team === 'blue' ? 0x4488ff : 0xff4444;
        const geometry = new THREE.BoxGeometry(0.6, 0.8, 0.6);
        const material = new THREE.MeshLambertMaterial({ color });
        mesh = new THREE.Group();
        mesh.add(new THREE.Mesh(geometry, material));
        this.forwardAngles.set(id, 0);
      }
      mesh.position.set(minion.x, minion.y, minion.z);
      // チーム方向に向ける: Blue→+Z方向(0), Red→-Z方向(π)
      mesh.rotation.y = team === 'red' ? Math.PI : 0;
      this.scene.add(mesh);
      this.meshes.set(id, mesh);
      this.walkAnimators.set(id, new WalkAnimator());
      this.attackAnimators.set(id, new AttackAnimator());
    }
  }

  getAllMinions(): Minion[] { return this.minions; }
  getTeamMinions(team: Team): Minion[] { return this.minions.filter(m => m.team === team); }

  getKnockback(id: string): KnockbackState | undefined {
    return this.knockbacks.get(id);
  }

  /** ミニオンからプレイヤーへの蓄積ダメージを取得してリセット */
  consumePlayerDamage(): number {
    const d = this.pendingPlayerDamage;
    this.pendingPlayerDamage = 0;
    return d;
  }
}
