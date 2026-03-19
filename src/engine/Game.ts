// src/engine/Game.ts
import * as THREE from 'three';
import { Renderer } from './Renderer';
import { InputManager } from './InputManager';
import { World } from '../world/World';
import { generateARAMMap, SPAWN_POSITION } from '../world/MapData';
import { Player } from '../player/Player';
import { BlockInteraction } from '../player/BlockInteraction';
import { TextureAtlas } from '../utils/TextureLoader';
import { buildChunkGeometryData } from '../world/ChunkMesher';

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
    generateARAMMap(this.world);

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

    this.update(dt);
    this.renderer.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    if (this.instructionsEl) {
      this.instructionsEl.style.display = this.input.isPointerLocked ? 'none' : 'block';
    }

    if (!this.input.isPointerLocked) return;

    const mouse = this.input.getMouseMovement();
    this.renderer.fpsCamera.rotate(mouse.x, mouse.y);

    if (this.input.isKeyDown('Space')) {
      this.player.jump();
    }
    this.player.updatePhysics(dt);

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

    const dir = this.renderer.fpsCamera.getDirection();
    const hit = this.blockInteraction.update(
      this.player.eyeX, this.player.eyeY, this.player.eyeZ,
      dir.x, dir.y, dir.z,
    );

    if (hit) {
      if (this.input.consumeLeftClick()) {
        if (this.blockInteraction.breakBlock(hit)) {
          this.rebuildDirtyChunks();
        }
      }
      if (this.input.consumeRightClick()) {
        if (this.blockInteraction.placeBlock(hit, this.player.x, this.player.y, this.player.z)) {
          this.rebuildDirtyChunks();
        }
      }
    } else {
      this.input.consumeLeftClick();
      this.input.consumeRightClick();
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
