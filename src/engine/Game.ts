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
import { ProjectileTarget } from '../entity/Projectile';
import { ScreenShake } from '../effects/ScreenShake';
import { MinionWaveManager } from '../entity/MinionWaveManager';
import { ViewMode } from '../player/ViewMode';
import { applyKnockback, KNOCKBACK_VERTICAL } from '../physics/Knockback';
import { Entity } from '../entity/Entity';
import { Minion } from '../entity/Minion';
import { ATTACK_RANGE, ATTACK_DAMAGE, ATTACK_COOLDOWN } from '../entity/CombatSystem';
import { buildModel } from '../model/MobModel';
import { SHEEP_MODEL, PLAYER_MODEL } from '../model/ModelDefinitions';
import { WalkAnimator, AttackAnimator } from '../model/Animator';
import { createDamageFlash, triggerFlash, updateFlash, applyFlashToMesh, DamageFlashState } from '../model/DamageFlash';

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
  private playerTarget!: ProjectileTarget;
  private minionWaveManager!: MinionWaveManager;
  private viewMode!: ViewMode;
  private playerModel!: THREE.Group;
  private armModel!: THREE.Group;
  private playerWalkAnimator!: WalkAnimator;
  private playerAttackAnimator!: AttackAnimator;
  private playerFlash: DamageFlashState = createDamageFlash();

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
    // プレイヤーをProjectileTargetとして表すアダプターオブジェクト
    this.playerTarget = { x: 0, y: 0, z: 0, isAlive: true };

    const textureLoader = new THREE.TextureLoader();
    const sheepBlueTexture = await textureLoader.loadAsync('/textures/mobs/minion_blue.png');
    sheepBlueTexture.magFilter = THREE.NearestFilter;
    sheepBlueTexture.minFilter = THREE.NearestFilter;
    const sheepRedTexture = await textureLoader.loadAsync('/textures/mobs/minion_red.png');
    sheepRedTexture.magFilter = THREE.NearestFilter;
    sheepRedTexture.minFilter = THREE.NearestFilter;

    this.minionWaveManager = new MinionWaveManager(
      this.renderer.scene,
      this.structures,
      (team) => ({
        mesh: buildModel(SHEEP_MODEL, team === 'blue' ? sheepBlueTexture : sheepRedTexture),
        forwardAngle: SHEEP_MODEL.forwardAngle,
      }),
    );
    this.viewMode = new ViewMode();

    // プレイヤーモデル
    const playerTexture = await textureLoader.loadAsync('/textures/mobs/player_default.png');
    playerTexture.magFilter = THREE.NearestFilter;
    playerTexture.minFilter = THREE.NearestFilter;

    // 三人称用フルボディモデル
    this.playerModel = buildModel(PLAYER_MODEL, playerTexture);
    this.playerModel.visible = false; // 一人称では非表示
    this.renderer.scene.add(this.playerModel);

    // 一人称用アームモデル（右腕のみ表示）
    this.armModel = buildModel(PLAYER_MODEL, playerTexture);
    for (const child of this.armModel.children) {
      if ((child as THREE.Group).name !== 'rightArm') {
        (child as THREE.Object3D).visible = false;
      }
    }
    this.armModel.position.set(0.4, -0.3, -0.5);
    this.renderer.fpsCamera.camera.add(this.armModel);

    this.playerWalkAnimator = new WalkAnimator();
    this.playerAttackAnimator = new AttackAnimator();

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

    // プレイヤーターゲットを毎フレーム更新
    this.playerTarget.x = this.player.x;
    this.playerTarget.y = this.player.y + PLAYER_HEIGHT / 2;
    this.playerTarget.z = this.player.z;
    this.playerTarget.isAlive = this.playerState.isAlive;

    // プレイヤーモデル位置同期（三人称用）
    this.playerModel.position.set(this.player.x, this.player.y, this.player.z);
    const camForwardSync = this.renderer.fpsCamera.getForward();
    this.playerModel.rotation.y = Math.atan2(camForwardSync.x, camForwardSync.z);

    // ミニオンウェーブ更新（プレイヤー情報を渡してRedミニオンがプレイヤーを攻撃可能に）
    this.minionWaveManager.update(dt, this.structures, this.world, {
      x: this.player.x, y: this.player.y, z: this.player.z,
      isAlive: this.playerState.isAlive,
    });

    // ミニオンからプレイヤーへのダメージ処理
    const minionDamage = this.minionWaveManager.consumePlayerDamage();
    if (minionDamage > 0 && !this.playerState.isInvincible()) {
      this.playerState.takeDamage(minionDamage);
      triggerFlash(this.playerFlash);
      this.screenShake.trigger();
      this.hud.triggerDamageFlash();
    }

    // タワーAI更新 — REDチーム（blueミニオン + プレイヤーを攻撃）
    for (const ai of this.towerAIs) {
      if (ai.structure.team === 'blue') continue;
      const enemyMinions = this.minionWaveManager.getTeamMinions('blue');
      const cmd = ai.update(dt, this.playerTarget, enemyMinions);
      if (cmd) {
        let target: ProjectileTarget;
        if (cmd.targetId) {
          const minion = enemyMinions.find(m => m.id === cmd.targetId);
          target = minion ?? this.playerTarget;
        } else {
          target = this.playerTarget;
        }
        this.projectileManager.spawn(cmd, target);
      }
    }

    // タワーAI更新 — BLUEチーム（redミニオンを攻撃、プレイヤーは味方なので攻撃しない）
    for (const ai of this.towerAIs) {
      if (ai.structure.team === 'red') continue;
      const enemyMinions = this.minionWaveManager.getTeamMinions('red');
      const dummyPlayer: ProjectileTarget = { x: 0, y: -999, z: 0, isAlive: false };
      const cmd = ai.update(dt, dummyPlayer, enemyMinions);
      if (cmd && cmd.targetId) {
        const minion = enemyMinions.find(m => m.id === cmd.targetId);
        if (minion) this.projectileManager.spawn(cmd, minion);
      }
    }

    // プロジェクタイル更新
    const projectileHits = this.projectileManager.update(dt);
    for (const hit of projectileHits) {
      if (hit.target === this.playerTarget) {
        // プレイヤーへのヒット
        if (!this.playerState.isInvincible()) {
          this.playerState.takeDamage(hit.damage);
          triggerFlash(this.playerFlash);
          this.screenShake.trigger();
          this.hud.triggerDamageFlash();
          const tower = this.towerAIs.find(ai => ai.structure.team === hit.team);
          if (tower) {
            applyKnockback(
              this.player.knockback,
              tower.getCenterX(), tower.getCenterY(), tower.getCenterZ(),
              this.player.x, this.player.y, this.player.z,
            );
            this.player.velocityY += KNOCKBACK_VERTICAL;
          }
        }
      } else {
        // ミニオンへのヒット
        const minion = hit.target as Entity;
        if (minion.isAlive) {
          minion.takeDamage(hit.damage);
          const kb = this.minionWaveManager.getKnockback(minion.id);
          if (kb) {
            const tower = this.towerAIs.find(ai => ai.structure.team === hit.team);
            if (tower) {
              applyKnockback(
                kb,
                tower.getCenterX(), tower.getCenterY(), tower.getCenterZ(),
                minion.x, minion.y, minion.z,
              );
            }
          }
        }
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
    updateFlash(this.playerFlash, dt);
    if (this.playerModel) applyFlashToMesh(this.playerModel, this.playerFlash);
    if (this.armModel) applyFlashToMesh(this.armModel, this.playerFlash);

    // === 入力処理（Pointer Lock + 生存中のみ） ===

    if (!this.input.isPointerLocked || !this.playerState.isAlive) {
      // シェイクとカメラ同期（viewMode対応）
      const shake = this.screenShake.update(dt);
      this.updateCameraPosition(shake.offsetX, shake.offsetY);
      return;
    }

    // マウス操作
    const mouse = this.input.getMouseMovement();
    this.renderer.fpsCamera.rotate(mouse.x, mouse.y);

    // ジャンプ
    if (this.input.isKeyDown('Space')) {
      this.player.jump();
    }

    // F5: 視点モード切替
    if (this.input.consumeKeyPress('F5')) {
      this.viewMode.toggle();
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

    // 歩行アニメーション
    const isMoving = (moveX !== 0 || moveZ !== 0);
    const walkAngles = this.playerWalkAnimator.update(dt, isMoving, 4.3);

    const applyAngles = (model: THREE.Group, angles: typeof walkAngles) => {
      for (const child of model.children) {
        const g = child as THREE.Group;
        if (g.name === 'rightArm') g.rotation.x = angles.rightArm;
        else if (g.name === 'leftArm') g.rotation.x = angles.leftArm;
        else if (g.name === 'rightLeg') g.rotation.x = angles.rightLeg;
        else if (g.name === 'leftLeg') g.rotation.x = angles.leftLeg;
        else if (g.name === 'head') g.rotation.x = angles.head;
      }
    };
    applyAngles(this.playerModel, walkAngles);

    // 視点モードに応じたモデル表示切替
    if (this.viewMode.isFirstPerson) {
      this.playerModel.visible = false;
      this.armModel.visible = true;
    } else {
      this.playerModel.visible = true;
      this.armModel.visible = false;
    }

    // カメラ位置更新（視点モードに応じて）
    this.updateCameraPosition();

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

    // ミニオンのレイキャスト判定（球体近似）
    const targetMinion = this.findMinionTarget(
      this.player.eyeX, this.player.eyeY, this.player.eyeZ,
      dir.x, dir.y, dir.z,
    );

    const leftClick = this.input.consumeLeftClick();
    if (leftClick) {
      // 構造物ターゲットを先に試す
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
      } else if (result.reason === 'no_target' || result.reason === 'cooldown') {
        // ミニオンへの攻撃（構造物がなければ）
        if (targetMinion && result.reason !== 'cooldown') {
          targetMinion.takeDamage(ATTACK_DAMAGE);
          this.minionWaveManager.triggerMinionFlash(targetMinion.id);
        } else if (blockHit && result.reason !== 'cooldown') {
          if (this.blockInteraction.breakBlock(blockHit)) {
            this.rebuildDirtyChunks();
          }
        }
      }
    }

    // 攻撃アニメーション
    if (leftClick) {
      this.playerAttackAnimator.play();
    }
    const attackAngle = this.playerAttackAnimator.update(dt);
    // 攻撃アニメーションを右腕に適用（一人称アーム）
    for (const child of this.armModel.children) {
      if ((child as THREE.Group).name === 'rightArm') {
        (child as THREE.Group).rotation.x = walkAngles.rightArm + attackAngle;
      }
    }
    // 攻撃アニメーションを三人称モデルの右腕にも適用
    for (const child of this.playerModel.children) {
      if ((child as THREE.Group).name === 'rightArm') {
        (child as THREE.Group).rotation.x = walkAngles.rightArm + attackAngle;
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

    // 画面シェイク適用（フレーム最後、viewMode対応）
    const shake = this.screenShake.update(dt);
    if (shake.offsetX !== 0 || shake.offsetY !== 0) {
      this.updateCameraPosition(shake.offsetX, shake.offsetY);
    }
  }

  /** 現在のviewModeに応じたカメラ位置を設定する */
  private updateCameraPosition(shakeX = 0, shakeY = 0): void {
    if (this.viewMode.isFirstPerson) {
      this.renderer.fpsCamera.setPosition(
        this.player.eyeX + shakeX,
        this.player.eyeY + shakeY,
        this.player.eyeZ,
      );
    } else {
      const camForward = this.renderer.fpsCamera.getForward();
      const offset = this.viewMode.getCameraOffset(camForward.x, camForward.y, camForward.z);
      this.renderer.fpsCamera.setPosition(
        this.player.eyeX + offset.x + shakeX,
        this.player.eyeY + offset.y + shakeY,
        this.player.eyeZ + offset.z,
      );
    }
  }

  /** レイとミニオン（球体近似 半径0.5）の交差判定 */
  private findMinionTarget(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
  ): Minion | null {
    let closest: Minion | null = null;
    let closestT = Infinity;
    const allMinions = this.minionWaveManager.getAllMinions();

    for (const m of allMinions) {
      if (!m.isAlive) continue;
      // 敵ミニオン（Red）のみターゲット可能
      if (m.team === 'blue') continue;

      const radius = 0.5;
      const centerY = m.y + 0.5; // ミニオン中心
      const ex = m.x - ox, ey = centerY - oy, ez = m.z - oz;
      const b = ex * dx + ey * dy + ez * dz;
      const c = ex * ex + ey * ey + ez * ez - radius * radius;
      const disc = b * b - c;
      if (disc < 0) continue;
      const t = b - Math.sqrt(disc);
      if (t > 0 && t <= ATTACK_RANGE && t < closestT) {
        closest = m;
        closestT = t;
      }
    }
    return closest;
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
