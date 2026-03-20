// src/engine/Game.ts
import * as THREE from 'three';
import { Renderer } from './Renderer';
import { InputManager } from './InputManager';
import { World } from '../world/World';
import { generateARAMMap, SPAWN_POSITION } from '../world/MapData';
import { Player, PLAYER_HEIGHT } from '../player/Player';
import { BlockInteraction } from '../player/BlockInteraction';
import { TextureAtlas } from '../utils/TextureLoader';
import { buildChunkGeometryData } from '../world/ChunkMesher';
import { CombatSystem } from '../entity/CombatSystem';
import { HUD } from '../ui/HUD';
import { Structure } from '../entity/Structure';
import { PlayerState } from '../player/PlayerState';
import { TowerAI } from '../entity/TowerAI';
import { ProjectileManager } from '../entity/ProjectileManager';
import { ScreenShake } from '../effects/ScreenShake';

const DEBUG_DAMAGE = 100;

export class Game {
  private renderer!: Renderer;
  private input!: InputManager;
  private world!: World;
  private player!: Player;
  private blockInteraction!: BlockInteraction;
  private atlas!: TextureAtlas;
  private material!: THREE.MeshLambertMaterial;
  private chunkMeshes = new Map<string, THREE.Mesh>();
  private lastTime = 0;
  private instructionsEl: HTMLElement | null = null;
  private combatSystem!: CombatSystem;
  private hud!: HUD;
  private structures!: Structure[];
  private gameOver = false;
  private gameStarted = false;
  private playerState!: PlayerState;
  private towerAIs!: TowerAI[];
  private projectileManager!: ProjectileManager;
  private screenShake!: ScreenShake;

  async init(): Promise<void> {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2');
    if (!gl) {
      const errorDiv = document.getElementById('error');
      if (errorDiv) errorDiv.style.display = 'flex';
      throw new Error('WebGL2 not supported');
    }

    this.renderer = new Renderer();
    this.input = new InputManager(this.renderer.canvas);
    this.atlas = await TextureAtlas.load();
    this.material = new THREE.MeshLambertMaterial({
      map: this.atlas.texture,
    });

    this.world = new World();
    const { structures } = generateARAMMap(this.world);
    this.structures = structures;
    this.combatSystem = new CombatSystem();
    this.hud = new HUD();
    this.playerState = new PlayerState();
    this.playerState.onDeath(() => {
      // 将来のインベントリドロップ拡張ポイント
    });

    this.towerAIs = this.structures.map(s => new TowerAI(s));
    this.projectileManager = new ProjectileManager(this.renderer.scene);
    this.screenShake = new ScreenShake();

    this.player = new Player(
      SPAWN_POSITION.x, SPAWN_POSITION.y, SPAWN_POSITION.z,
      this.world,
    );

    this.blockInteraction = new BlockInteraction(this.world, this.renderer.scene);

    this.rebuildAllChunks();

    this.instructionsEl = document.getElementById('instructions');

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(time: number): void {
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;
    this.update(dt, time);
    this.renderer.render();
    this.scheduleNextFrame();
  }

  private scheduleNextFrame(): void {
    if (document.hidden) {
      // タブ非アクティブ時はsetTimeoutでループ継続（~60fps相当）
      setTimeout(() => this.loop(performance.now()), 16);
    } else {
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  private update(dt: number, time: number): void {
    // 初回クリック前はインストラクション表示、ゲーム未開始
    if (!this.gameStarted) {
      if (this.instructionsEl) {
        this.instructionsEl.style.display = this.input.isPointerLocked ? 'none' : 'block';
      }
      if (this.input.isPointerLocked) {
        this.gameStarted = true;
      } else {
        return;
      }
    }

    if (this.gameOver) return;

    // === シミュレーション（常に実行、Pointer Lock不要） ===

    // PlayerState更新（リスポーン判定）
    const respawned = this.playerState.update(dt);
    if (respawned) {
      this.player.x = SPAWN_POSITION.x;
      this.player.y = SPAWN_POSITION.y;
      this.player.z = SPAWN_POSITION.z;
      this.player.velocityY = 0;
      this.player.onGround = false;
      this.renderer.fpsCamera.setPosition(
        this.player.eyeX, this.player.eyeY, this.player.eyeZ,
      );
      this.hud.hideDeathScreen();
    }

    // 重力は常に適用
    this.player.updatePhysics(dt);

    // タワーAI更新（敵チームのみ）
    for (const ai of this.towerAIs) {
      if (ai.structure.team === 'blue') continue;
      const cmd = ai.update(dt, this.player.x, this.player.y, this.player.z, this.playerState.isAlive);
      if (cmd) {
        this.projectileManager.spawn(cmd, this.player.x, this.player.y + PLAYER_HEIGHT / 2, this.player.z);
      }
    }

    // プロジェクタイル更新
    const projectileHits = this.projectileManager.update(
      dt, this.player.x, this.player.y + PLAYER_HEIGHT / 2, this.player.z,
    );
    for (const hit of projectileHits) {
      if (!this.playerState.isInvincible()) {
        this.playerState.takeDamage(hit.damage);
        this.screenShake.trigger();
        this.hud.triggerDamageFlash();
      }
    }

    // 死亡中のHUD表示
    if (!this.playerState.isAlive) {
      this.hud.showDeathScreen(this.playerState.respawnTimer);
      this.input.consumeLeftClick();
      this.input.consumeRightClick();
    }

    // プレイヤーHP HUD更新
    this.hud.updatePlayerHp(
      this.playerState.hp,
      this.playerState.maxHp,
      this.playerState.isInvincible(),
    );

    // タワー警告HUD
    const inTowerRange = this.towerAIs.some(
      ai => ai.structure.team !== 'blue' && ai.structure.isAlive && ai.isInRange(this.player.x, this.player.y, this.player.z),
    );
    if (inTowerRange) {
      this.hud.showTowerWarning();
    } else {
      this.hud.hideTowerWarning();
    }

    // ダメージフラッシュ更新
    this.hud.updateDamageFlash(dt);

    // === 入力処理（Pointer Lock + 生存中のみ） ===

    if (!this.input.isPointerLocked || !this.playerState.isAlive) {
      // シェイクとカメラ同期は実行
      this.renderer.fpsCamera.setPosition(
        this.player.eyeX, this.player.eyeY, this.player.eyeZ,
      );
      const shake = this.screenShake.update(dt);
      if (shake.offsetX !== 0 || shake.offsetY !== 0) {
        this.renderer.fpsCamera.setPosition(
          this.player.eyeX + shake.offsetX,
          this.player.eyeY + shake.offsetY,
          this.player.eyeZ,
        );
      }
      return;
    }

    // マウス操作
    const mouse = this.input.getMouseMovement();
    this.renderer.fpsCamera.rotate(mouse.x, mouse.y);

    // ジャンプ
    if (this.input.isKeyDown('Space')) {
      this.player.jump();
    }

    // WASD移動
    const forward = this.renderer.fpsCamera.getForward();
    const right = this.renderer.fpsCamera.getRight();
    let moveX = 0, moveZ = 0;
    if (this.input.isKeyDown('KeyW')) { moveX += forward.x; moveZ += forward.z; }
    if (this.input.isKeyDown('KeyS')) { moveX -= forward.x; moveZ -= forward.z; }
    if (this.input.isKeyDown('KeyA')) { moveX -= right.x; moveZ -= right.z; }
    if (this.input.isKeyDown('KeyD')) { moveX += right.x; moveZ += right.z; }

    if (moveX !== 0 || moveZ !== 0) {
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      this.player.move(moveX / len, moveZ / len, dt);
    }

    this.renderer.fpsCamera.setPosition(
      this.player.eyeX, this.player.eyeY, this.player.eyeZ,
    );

    // レイキャスト・戦闘
    const dir = this.renderer.fpsCamera.getDirection();

    const targetStructure = this.combatSystem.findTarget(
      this.player.eyeX, this.player.eyeY, this.player.eyeZ,
      dir.x, dir.y, dir.z,
      this.structures,
    );

    const blockHit = this.blockInteraction.update(
      this.player.eyeX, this.player.eyeY, this.player.eyeZ,
      dir.x, dir.y, dir.z,
    );

    const leftClick = this.input.consumeLeftClick();
    if (leftClick) {
      const result = this.combatSystem.tryAttack(targetStructure, time / 1000);

      if (result.hit) {
        this.hud.showDamage(result);
        if (result.destroyed) {
          result.target.removeBlocks(this.world);
          this.rebuildDirtyChunks();
          this.checkVictory();
        }
      } else if (result.reason === 'protected') {
        this.hud.showProtected();
      } else if (result.reason === 'no_target' && blockHit) {
        if (this.blockInteraction.breakBlock(blockHit)) {
          this.rebuildDirtyChunks();
        }
      }
    }

    if (this.input.consumeRightClick()) {
      if (blockHit) {
        if (this.blockInteraction.placeBlock(blockHit, this.player.x, this.player.y, this.player.z)) {
          this.rebuildDirtyChunks();
        }
      }
    }

    if (targetStructure) {
      this.hud.showTarget(targetStructure);
    } else {
      this.hud.hideTarget();
    }

    // デバッグ: Kキーで自傷ダメージ
    if (this.input.consumeKeyPress('KeyK')) {
      if (!this.playerState.isInvincible()) {
        this.playerState.takeDamage(DEBUG_DAMAGE);
        this.screenShake.trigger();
        this.hud.triggerDamageFlash();
      }
    }

    // 画面シェイク適用（フレーム最後）
    const shake = this.screenShake.update(dt);
    if (shake.offsetX !== 0 || shake.offsetY !== 0) {
      this.renderer.fpsCamera.setPosition(
        this.player.eyeX + shake.offsetX,
        this.player.eyeY + shake.offsetY,
        this.player.eyeZ,
      );
    }
  }

  private checkVictory(): void {
    const redNexus = this.structures.find(s => s.id === 'red-nexus');
    if (redNexus && !redNexus.isAlive) {
      this.gameOver = true;
      this.hud.hideTarget();
      this.hud.showVictory();
      document.exitPointerLock();
    }
  }

  private rebuildAllChunks(): void {
    for (const chunk of this.world.getAllChunks()) {
      this.rebuildChunkMesh(chunk.cx, chunk.cy, chunk.cz);
      chunk.dirty = false;
    }
  }

  private rebuildDirtyChunks(): void {
    for (const chunk of this.world.getAllChunks()) {
      if (chunk.dirty) {
        this.rebuildChunkMesh(chunk.cx, chunk.cy, chunk.cz);
        chunk.dirty = false;
      }
    }
  }

  private rebuildChunkMesh(cx: number, cy: number, cz: number): void {
    const key = `${cx},${cy},${cz}`;

    const old = this.chunkMeshes.get(key);
    if (old) {
      this.renderer.scene.remove(old);
      old.geometry.dispose();
    }

    const data = buildChunkGeometryData(
      cx, cy, cz,
      (wx, wy, wz) => this.world.getBlock(wx, wy, wz),
    );

    if (data.positions.length === 0) {
      this.chunkMeshes.delete(key);
      return;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
    geometry.setIndex(data.indices);

    const mesh = new THREE.Mesh(geometry, this.material);
    this.renderer.scene.add(mesh);
    this.chunkMeshes.set(key, mesh);
  }
}
