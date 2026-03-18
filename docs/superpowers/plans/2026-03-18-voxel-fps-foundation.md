# CraftRift ボクセルFPS基盤 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Minecraft風ボクセルワールドをブラウザ上に描画し、一人称視点でWASD移動、ブロック破壊・設置ができる基盤を構築する。

**Architecture:** Three.js + TypeScript + Viteで構成。16×16×16チャンクベースのボクセルエンジンに、Culled Meshingによるメッシュ生成、DDAレイキャストによるブロック検出、AABB衝突判定を組み合わせる。固定マップはARAMレーン形状。

**Tech Stack:** TypeScript, Three.js, Vite, npm

**Spec:** `docs/superpowers/specs/2026-03-18-voxel-fps-foundation-design.md`

---

## ファイル構成

| ファイル | 責務 |
|----------|------|
| `index.html` | エントリーHTML、canvasコンテナ |
| `package.json` | 依存関係（three, typescript, vite） |
| `tsconfig.json` | TypeScript設定 |
| `vite.config.ts` | Vite設定 |
| `src/main.ts` | エントリーポイント、Gameインスタンス起動 |
| `src/engine/Game.ts` | ゲームループ（init, update, render）、各モジュール統合 |
| `src/engine/InputManager.ts` | キーボード・マウス入力のキャプチャと状態管理 |
| `src/engine/Renderer.ts` | Three.js WebGLRenderer/Scene/Cameraの初期化と管理 |
| `src/world/Block.ts` | BlockType enum、ブロック属性（isSolid, isDestructible, テクスチャマッピング） |
| `src/world/Chunk.ts` | 16×16×16ボクセルデータ格納 |
| `src/world/ChunkMesher.ts` | Culled Meshingによるチャンクメッシュ生成 |
| `src/world/World.ts` | チャンクの集合管理、getBlock(worldX,Y,Z) API |
| `src/world/MapData.ts` | ARAMレーン固定マップの生成ロジック |
| `src/player/Player.ts` | プレイヤー位置・向き、WASD移動、AABB衝突判定 |
| `src/player/Camera.ts` | 一人称カメラ制御、Pointer Lock、yaw/pitch |
| `src/player/BlockInteraction.ts` | DDAレイキャスト、ブロック破壊・設置、ハイライト表示 |
| `src/utils/TextureLoader.ts` | 個別PNG→Canvas APIでアトラス合成、UV座標管理 |
| `public/textures/*.png` | プレースホルダーテクスチャ（16×16px） |
| `src/world/Block.test.ts` | Blockモジュールのテスト |
| `src/world/Chunk.test.ts` | Chunkデータ操作のテスト |
| `src/world/World.test.ts` | Worldグローバル座標APIのテスト |
| `src/world/MapData.test.ts` | マップ生成のテスト |
| `src/player/Player.test.ts` | 移動・衝突判定のテスト |
| `src/player/BlockInteraction.test.ts` | DDAレイキャスト・ブロック操作のテスト |
| `src/world/ChunkMesher.test.ts` | チャンクメッシュ生成のテスト |

---

## Task 1: プロジェクトセットアップ

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`

- [ ] **Step 1: npm init と依存関係インストール**

```bash
cd /home/hexyl/workspace/craftrift
npm init -y
npm install three
npm install -D typescript vite @types/three vitest
```

- [ ] **Step 2: tsconfig.json を作成**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: vite.config.ts を作成**

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
  },
  test: {
    globals: true,
  },
});
```

- [ ] **Step 4: index.html を作成**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CraftRift</title>
  <style>
    * { margin: 0; padding: 0; }
    body { overflow: hidden; background: #000; }
    canvas { display: block; }
    #error {
      display: none;
      position: fixed;
      inset: 0;
      background: #1a1a2e;
      color: #e94560;
      font-family: monospace;
      font-size: 1.5rem;
      justify-content: center;
      align-items: center;
    }
  </style>
</head>
<body>
  <div id="error">WebGL is not supported in this browser.</div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: src/main.ts を最小実装で作成**

```typescript
import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer();
if (!renderer.capabilities.isWebGL2) {
  const errorDiv = document.getElementById('error');
  if (errorDiv) {
    errorDiv.style.display = 'flex';
  }
  throw new Error('WebGL2 not supported');
}

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 6, 0);

renderer.render(scene, camera);
console.log('CraftRift initialized');
```

- [ ] **Step 6: 動作確認**

Run: `npx vite --open`
Expected: ブラウザに空色の背景が表示される。コンソールに "CraftRift initialized"。

- [ ] **Step 7: コミット**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/main.ts .gitignore
git commit -m "chore: プロジェクトセットアップ（Three.js + TypeScript + Vite）"
```

---

## Task 2: Block定義

**Files:**
- Create: `src/world/Block.ts`, `src/world/Block.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// src/world/Block.test.ts
import { describe, it, expect } from 'vitest';
import { BlockType, isSolid, isDestructible, getBlockUVs, TEXTURE_NAMES } from './Block';

describe('Block', () => {
  it('AIR is not solid', () => {
    expect(isSolid(BlockType.AIR)).toBe(false);
  });

  it('GRASS, DIRT, STONE, BEDROCK are solid', () => {
    expect(isSolid(BlockType.GRASS)).toBe(true);
    expect(isSolid(BlockType.DIRT)).toBe(true);
    expect(isSolid(BlockType.STONE)).toBe(true);
    expect(isSolid(BlockType.BEDROCK)).toBe(true);
  });

  it('BEDROCK is not destructible', () => {
    expect(isDestructible(BlockType.BEDROCK)).toBe(false);
  });

  it('GRASS, DIRT, STONE are destructible', () => {
    expect(isDestructible(BlockType.GRASS)).toBe(true);
    expect(isDestructible(BlockType.DIRT)).toBe(true);
    expect(isDestructible(BlockType.STONE)).toBe(true);
  });

  it('GRASS has different textures for top/side/bottom', () => {
    const uvs = getBlockUVs(BlockType.GRASS);
    expect(uvs.top).not.toBe(uvs.side);
    expect(uvs.top).not.toBe(uvs.bottom);
  });

  it('STONE has same texture for all faces', () => {
    const uvs = getBlockUVs(BlockType.STONE);
    expect(uvs.top).toBe(uvs.side);
    expect(uvs.top).toBe(uvs.bottom);
  });

  it('TEXTURE_NAMES lists all unique texture names', () => {
    expect(TEXTURE_NAMES).toContain('grass_top');
    expect(TEXTURE_NAMES).toContain('grass_side');
    expect(TEXTURE_NAMES).toContain('dirt');
    expect(TEXTURE_NAMES).toContain('stone');
    expect(TEXTURE_NAMES).toContain('bedrock');
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/world/Block.test.ts`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: Block.ts を実装**

```typescript
// src/world/Block.ts
export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  BEDROCK = 4,
}

export function isSolid(type: BlockType): boolean {
  return type !== BlockType.AIR;
}

export function isDestructible(type: BlockType): boolean {
  return type !== BlockType.AIR && type !== BlockType.BEDROCK;
}

interface BlockUVs {
  top: number;
  side: number;
  bottom: number;
}

// テクスチャアトラス内のインデックス
const TEXTURE_INDEX: Record<string, number> = {
  grass_top: 0,
  grass_side: 1,
  dirt: 2,
  stone: 3,
  bedrock: 4,
};

export const TEXTURE_NAMES: string[] = Object.keys(TEXTURE_INDEX);

const BLOCK_UVS: Record<BlockType, BlockUVs> = {
  [BlockType.AIR]: { top: 0, side: 0, bottom: 0 },
  [BlockType.GRASS]: {
    top: TEXTURE_INDEX.grass_top,
    side: TEXTURE_INDEX.grass_side,
    bottom: TEXTURE_INDEX.dirt,
  },
  [BlockType.DIRT]: {
    top: TEXTURE_INDEX.dirt,
    side: TEXTURE_INDEX.dirt,
    bottom: TEXTURE_INDEX.dirt,
  },
  [BlockType.STONE]: {
    top: TEXTURE_INDEX.stone,
    side: TEXTURE_INDEX.stone,
    bottom: TEXTURE_INDEX.stone,
  },
  [BlockType.BEDROCK]: {
    top: TEXTURE_INDEX.bedrock,
    side: TEXTURE_INDEX.bedrock,
    bottom: TEXTURE_INDEX.bedrock,
  },
};

export function getBlockUVs(type: BlockType): BlockUVs {
  return BLOCK_UVS[type];
}

export const ATLAS_SIZE = TEXTURE_NAMES.length;
```

- [ ] **Step 4: テスト通過を確認**

Run: `npx vitest run src/world/Block.test.ts`
Expected: All tests PASS

- [ ] **Step 5: コミット**

```bash
git add src/world/Block.ts src/world/Block.test.ts
git commit -m "feat: Block型定義とテクスチャマッピング"
```

---

## Task 3: Chunkデータ構造

**Files:**
- Create: `src/world/Chunk.ts`, `src/world/Chunk.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// src/world/Chunk.test.ts
import { describe, it, expect } from 'vitest';
import { Chunk, CHUNK_SIZE } from './Chunk';
import { BlockType } from './Block';

describe('Chunk', () => {
  it('initializes all blocks as AIR', () => {
    const chunk = new Chunk(0, 0, 0);
    expect(chunk.getBlock(0, 0, 0)).toBe(BlockType.AIR);
    expect(chunk.getBlock(15, 15, 15)).toBe(BlockType.AIR);
  });

  it('sets and gets a block', () => {
    const chunk = new Chunk(0, 0, 0);
    chunk.setBlock(5, 3, 7, BlockType.STONE);
    expect(chunk.getBlock(5, 3, 7)).toBe(BlockType.STONE);
  });

  it('returns AIR for out-of-bounds coordinates', () => {
    const chunk = new Chunk(0, 0, 0);
    expect(chunk.getBlock(-1, 0, 0)).toBe(BlockType.AIR);
    expect(chunk.getBlock(16, 0, 0)).toBe(BlockType.AIR);
  });

  it('stores chunk world position', () => {
    const chunk = new Chunk(2, 0, 3);
    expect(chunk.worldX).toBe(32);
    expect(chunk.worldY).toBe(0);
    expect(chunk.worldZ).toBe(48);
  });

  it('CHUNK_SIZE is 16', () => {
    expect(CHUNK_SIZE).toBe(16);
  });

  it('marks dirty when a block changes', () => {
    const chunk = new Chunk(0, 0, 0);
    chunk.dirty = false;
    chunk.setBlock(0, 0, 0, BlockType.GRASS);
    expect(chunk.dirty).toBe(true);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/world/Chunk.test.ts`
Expected: FAIL

- [ ] **Step 3: Chunk.ts を実装**

```typescript
// src/world/Chunk.ts
import { BlockType } from './Block';

export const CHUNK_SIZE = 16;

export class Chunk {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly worldX: number;
  readonly worldY: number;
  readonly worldZ: number;
  dirty = true;

  private blocks: Uint8Array;

  constructor(cx: number, cy: number, cz: number) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.worldX = cx * CHUNK_SIZE;
    this.worldY = cy * CHUNK_SIZE;
    this.worldZ = cz * CHUNK_SIZE;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
  }

  private index(x: number, y: number, z: number): number {
    return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
  }

  private inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < CHUNK_SIZE &&
           y >= 0 && y < CHUNK_SIZE &&
           z >= 0 && z < CHUNK_SIZE;
  }

  getBlock(x: number, y: number, z: number): BlockType {
    if (!this.inBounds(x, y, z)) return BlockType.AIR;
    return this.blocks[this.index(x, y, z)] as BlockType;
  }

  setBlock(x: number, y: number, z: number, type: BlockType): void {
    if (!this.inBounds(x, y, z)) return;
    this.blocks[this.index(x, y, z)] = type;
    this.dirty = true;
  }
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `npx vitest run src/world/Chunk.test.ts`
Expected: All tests PASS

- [ ] **Step 5: コミット**

```bash
git add src/world/Chunk.ts src/world/Chunk.test.ts
git commit -m "feat: Chunkデータ構造（16x16x16ボクセル格納）"
```

---

## Task 4: Worldグローバル座標API

**Files:**
- Create: `src/world/World.ts`, `src/world/World.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// src/world/World.test.ts
import { describe, it, expect } from 'vitest';
import { World } from './World';
import { BlockType } from './Block';

describe('World', () => {
  it('getBlock returns AIR for empty world', () => {
    const world = new World();
    expect(world.getBlock(0, 0, 0)).toBe(BlockType.AIR);
  });

  it('setBlock and getBlock with world coordinates', () => {
    const world = new World();
    world.setBlock(5, 3, 7, BlockType.STONE);
    expect(world.getBlock(5, 3, 7)).toBe(BlockType.STONE);
  });

  it('handles negative coordinates', () => {
    const world = new World();
    world.setBlock(-1, 0, -1, BlockType.DIRT);
    expect(world.getBlock(-1, 0, -1)).toBe(BlockType.DIRT);
  });

  it('handles cross-chunk coordinates', () => {
    const world = new World();
    world.setBlock(17, 0, 0, BlockType.GRASS);
    expect(world.getBlock(17, 0, 0)).toBe(BlockType.GRASS);
    // chunk(0,0,0) should not have this block
    expect(world.getBlock(1, 0, 0)).toBe(BlockType.AIR);
  });

  it('getChunk returns the correct chunk', () => {
    const world = new World();
    world.setBlock(5, 3, 7, BlockType.STONE);
    const chunk = world.getChunk(0, 0, 0);
    expect(chunk).toBeDefined();
    expect(chunk!.getBlock(5, 3, 7)).toBe(BlockType.STONE);
  });

  it('isSolidBlock checks solidity at world coordinates', () => {
    const world = new World();
    world.setBlock(5, 3, 7, BlockType.STONE);
    expect(world.isSolidBlock(5, 3, 7)).toBe(true);
    expect(world.isSolidBlock(0, 0, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/world/World.test.ts`
Expected: FAIL

- [ ] **Step 3: World.ts を実装**

```typescript
// src/world/World.ts
import { Chunk, CHUNK_SIZE } from './Chunk';
import { BlockType, isSolid } from './Block';

export class World {
  private chunks = new Map<string, Chunk>();

  private key(cx: number, cy: number, cz: number): string {
    return `${cx},${cy},${cz}`;
  }

  private toChunkCoord(v: number): number {
    return Math.floor(v / CHUNK_SIZE);
  }

  private toLocalCoord(v: number): number {
    return ((v % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  }

  getChunk(cx: number, cy: number, cz: number): Chunk | undefined {
    return this.chunks.get(this.key(cx, cy, cz));
  }

  getOrCreateChunk(cx: number, cy: number, cz: number): Chunk {
    const k = this.key(cx, cy, cz);
    let chunk = this.chunks.get(k);
    if (!chunk) {
      chunk = new Chunk(cx, cy, cz);
      this.chunks.set(k, chunk);
    }
    return chunk;
  }

  getBlock(wx: number, wy: number, wz: number): BlockType {
    const cx = this.toChunkCoord(wx);
    const cy = this.toChunkCoord(wy);
    const cz = this.toChunkCoord(wz);
    const chunk = this.getChunk(cx, cy, cz);
    if (!chunk) return BlockType.AIR;
    return chunk.getBlock(
      this.toLocalCoord(wx),
      this.toLocalCoord(wy),
      this.toLocalCoord(wz),
    );
  }

  setBlock(wx: number, wy: number, wz: number, type: BlockType): void {
    const cx = this.toChunkCoord(wx);
    const cy = this.toChunkCoord(wy);
    const cz = this.toChunkCoord(wz);
    const chunk = this.getOrCreateChunk(cx, cy, cz);
    chunk.setBlock(
      this.toLocalCoord(wx),
      this.toLocalCoord(wy),
      this.toLocalCoord(wz),
      type,
    );
  }

  isSolidBlock(wx: number, wy: number, wz: number): boolean {
    return isSolid(this.getBlock(wx, wy, wz));
  }

  getAllChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `npx vitest run src/world/World.test.ts`
Expected: All tests PASS

- [ ] **Step 5: コミット**

```bash
git add src/world/World.ts src/world/World.test.ts
git commit -m "feat: Worldグローバル座標API（チャンク横断ブロック取得）"
```

---

## Task 5: ARAMマップ生成

**Files:**
- Create: `src/world/MapData.ts`, `src/world/MapData.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// src/world/MapData.test.ts
import { describe, it, expect } from 'vitest';
import { generateARAMMap, SPAWN_POSITION } from './MapData';
import { World } from './World';
import { BlockType } from './Block';

describe('MapData', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    generateARAMMap(world);
  });

  it('ground is GRASS at lane center', () => {
    // Lane center X ~ 7, ground Y = 3 (top of 4-block ground)
    expect(world.getBlock(7, 3, 10)).toBe(BlockType.GRASS);
  });

  it('below grass is DIRT', () => {
    expect(world.getBlock(7, 2, 10)).toBe(BlockType.DIRT);
    expect(world.getBlock(7, 1, 10)).toBe(BlockType.DIRT);
  });

  it('bottom layer is BEDROCK', () => {
    expect(world.getBlock(7, 0, 10)).toBe(BlockType.BEDROCK);
  });

  it('walls exist at lane edges', () => {
    // Left wall at x=1 (STONE inner), above ground level
    expect(world.getBlock(1, 4, 10)).toBe(BlockType.STONE);
    // Outer BEDROCK at x=0
    expect(world.getBlock(0, 4, 10)).toBe(BlockType.BEDROCK);
  });

  it('air above the lane', () => {
    // Above ground level in the center of the lane
    expect(world.getBlock(7, 4, 10)).toBe(BlockType.AIR);
  });

  it('lane extends in Z direction for 80+ blocks', () => {
    expect(world.getBlock(7, 3, 0)).not.toBe(BlockType.AIR);
    expect(world.getBlock(7, 3, 79)).not.toBe(BlockType.AIR);
  });

  it('wall reaches WALL_TOP_Y and air above', () => {
    // Outer BEDROCK wall at max height
    expect(world.getBlock(0, 8, 10)).toBe(BlockType.BEDROCK);
    // Air above wall
    expect(world.getBlock(0, 9, 10)).toBe(BlockType.AIR);
  });

  it('spawn position is above ground', () => {
    expect(SPAWN_POSITION.y).toBeGreaterThan(3);
    // Spawn block should be AIR
    expect(world.getBlock(
      Math.floor(SPAWN_POSITION.x),
      Math.floor(SPAWN_POSITION.y),
      Math.floor(SPAWN_POSITION.z),
    )).toBe(BlockType.AIR);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/world/MapData.test.ts`
Expected: FAIL

- [ ] **Step 3: MapData.ts を実装**

```typescript
// src/world/MapData.ts
import { World } from './World';
import { BlockType } from './Block';

// Map dimensions
const MAP_WIDTH = 15;   // X axis
const MAP_HEIGHT = 10;  // Y axis
const MAP_LENGTH = 84;  // Z axis

// Lane area (inner walkable area)
const LANE_X_START = 2;  // After BEDROCK outer + STONE inner wall
const LANE_X_END = 12;   // 11 blocks wide (2..12 inclusive)
const LANE_Z_START = 2;
const LANE_Z_END = 81;   // 80 blocks long

// Ground layers
const BEDROCK_Y = 0;
const DIRT_Y_START = 1;
const DIRT_Y_END = 2;
const GRASS_Y = 3;

// Wall height (above ground)
const WALL_TOP_Y = 8; // ground(3) + 5 blocks of wall

export const SPAWN_POSITION = {
  x: 7.5,
  y: GRASS_Y + 2,  // 2 blocks above ground
  z: LANE_Z_START + 2,
};

export function generateARAMMap(world: World): void {
  for (let z = 0; z < MAP_LENGTH; z++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const isLaneX = x >= LANE_X_START && x <= LANE_X_END;
      const isLaneZ = z >= LANE_Z_START && z <= LANE_Z_END;
      const isInnerWallX = x === 1 || x === MAP_WIDTH - 2;
      const isOuterWallX = x === 0 || x === MAP_WIDTH - 1;
      const isEndWallZ = z === 0 || z === 1 || z === MAP_LENGTH - 2 || z === MAP_LENGTH - 1;
      const isOuterEndZ = z === 0 || z === MAP_LENGTH - 1;

      // Ground layers for the entire map floor
      world.setBlock(x, BEDROCK_Y, z, BlockType.BEDROCK);

      if ((isLaneX && !isEndWallZ) || isInnerWallX || isOuterWallX) {
        world.setBlock(x, DIRT_Y_START, z, BlockType.DIRT);
        world.setBlock(x, DIRT_Y_END, z, BlockType.DIRT);
        world.setBlock(x, GRASS_Y, z, BlockType.GRASS);
      }

      // End walls (Z boundaries)
      if (isEndWallZ) {
        for (let y = BEDROCK_Y; y <= WALL_TOP_Y; y++) {
          if (isOuterEndZ) {
            world.setBlock(x, y, z, BlockType.BEDROCK);
          } else {
            world.setBlock(x, y, z, BlockType.STONE);
          }
        }
      }

      // Side walls (X boundaries)
      if (isOuterWallX) {
        for (let y = BEDROCK_Y; y <= WALL_TOP_Y; y++) {
          world.setBlock(x, y, z, BlockType.BEDROCK);
        }
      } else if (isInnerWallX) {
        for (let y = GRASS_Y + 1; y <= WALL_TOP_Y; y++) {
          world.setBlock(x, y, z, BlockType.STONE);
        }
      }
    }
  }
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `npx vitest run src/world/MapData.test.ts`
Expected: All tests PASS

- [ ] **Step 5: コミット**

```bash
git add src/world/MapData.ts src/world/MapData.test.ts
git commit -m "feat: ARAMレーン固定マップ生成"
```

---

## Task 6: テクスチャローダーとプレースホルダーテクスチャ

**Files:**
- Create: `src/utils/TextureLoader.ts`, `public/textures/*.png`（5ファイル）

- [ ] **Step 1: プレースホルダーテクスチャをプログラムで生成するスクリプトを作成・実行**

`scripts/generate-textures.ts` を作成し、`pngjs` で16×16のプレースホルダーPNGを生成する。node-canvasと違いネイティブビルド不要。決定論的パターン（ランダム性なし）。

```typescript
// scripts/generate-textures.ts
// Node.jsスクリプト — `npx tsx scripts/generate-textures.ts` で実行
import { writeFileSync, mkdirSync } from 'fs';
import { PNG } from 'pngjs';

mkdirSync('public/textures', { recursive: true });

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function createPng(
  width: number, height: number,
  fill: (x: number, y: number) => [number, number, number],
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y);
      const idx = (y * width + x) * 4;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

// Deterministic noise: checkerboard-like pattern
function withNoise(
  bg: [number, number, number],
  alt: [number, number, number],
  x: number, y: number,
): [number, number, number] {
  return ((x * 7 + y * 13) % 5 === 0) ? alt : bg;
}

const textures: Record<string, (x: number, y: number) => [number, number, number]> = {
  grass_top: (x, y) => withNoise(hexToRgb('#4a8c2a'), hexToRgb('#3d7a22'), x, y),
  grass_side: (x, y) => y < 3
    ? withNoise(hexToRgb('#4a8c2a'), hexToRgb('#3d7a22'), x, y)
    : withNoise(hexToRgb('#8B6914'), hexToRgb('#7a5c10'), x, y),
  dirt: (x, y) => withNoise(hexToRgb('#8B6914'), hexToRgb('#7a5c10'), x, y),
  stone: (x, y) => withNoise(hexToRgb('#888888'), hexToRgb('#777777'), x, y),
  bedrock: (x, y) => withNoise(hexToRgb('#333333'), hexToRgb('#222222'), x, y),
};

for (const [name, fill] of Object.entries(textures)) {
  const buf = createPng(16, 16, fill);
  writeFileSync(`public/textures/${name}.png`, buf);
  console.log(`Generated: public/textures/${name}.png`);
}
```

```bash
npm install -D pngjs tsx @types/pngjs
npx tsx scripts/generate-textures.ts
```

- [ ] **Step 2: TextureLoader.ts を実装**

```typescript
// src/utils/TextureLoader.ts
import * as THREE from 'three';
import { TEXTURE_NAMES, ATLAS_SIZE } from '../world/Block';

const TEXTURE_SIZE = 16;

export class TextureAtlas {
  readonly texture: THREE.CanvasTexture;
  readonly atlasColumns: number;
  readonly tileUV: number;

  private constructor(canvas: HTMLCanvasElement) {
    this.atlasColumns = ATLAS_SIZE;
    this.tileUV = 1 / this.atlasColumns;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  getUV(textureIndex: number): { u: number; v: number; size: number } {
    return {
      u: (textureIndex % this.atlasColumns) * this.tileUV,
      v: 0,
      size: this.tileUV,
    };
  }

  static async load(): Promise<TextureAtlas> {
    const images = await Promise.all(
      TEXTURE_NAMES.map(
        (name) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = `/textures/${name}.png`;
          }),
      ),
    );

    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE * ATLAS_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d')!;

    images.forEach((img, i) => {
      ctx.drawImage(img, i * TEXTURE_SIZE, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    });

    return new TextureAtlas(canvas);
  }
}
```

- [ ] **Step 3: コミット**

```bash
git add src/utils/TextureLoader.ts public/textures/ scripts/generate-textures.ts
git commit -m "feat: テクスチャアトラスローダーとプレースホルダーテクスチャ"
```

---

## Task 7: Culled Meshingによるチャンクメッシュ生成

**Files:**
- Create: `src/world/ChunkMesher.ts`, `src/world/ChunkMesher.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// src/world/ChunkMesher.test.ts
import { describe, it, expect } from 'vitest';
import { buildChunkGeometryData } from './ChunkMesher';
import { BlockType } from './Block';

// Mock getBlock function for testing
function createMockGetBlock(blocks: Map<string, BlockType>) {
  return (wx: number, wy: number, wz: number): BlockType => {
    return blocks.get(`${wx},${wy},${wz}`) ?? BlockType.AIR;
  };
}

describe('ChunkMesher', () => {
  it('generates no geometry for empty chunk', () => {
    const getBlock = createMockGetBlock(new Map());
    const data = buildChunkGeometryData(0, 0, 0, getBlock);
    expect(data.positions.length).toBe(0);
    expect(data.indices.length).toBe(0);
  });

  it('generates 6 faces (36 indices) for a single isolated block', () => {
    const blocks = new Map<string, BlockType>();
    blocks.set('5,5,5', BlockType.STONE);
    const getBlock = createMockGetBlock(blocks);
    const data = buildChunkGeometryData(0, 0, 0, getBlock);
    // 6 faces * 6 indices per face = 36
    expect(data.indices.length).toBe(36);
    // 6 faces * 4 vertices * 3 components = 72
    expect(data.positions.length).toBe(72);
  });

  it('culls faces between adjacent blocks', () => {
    const blocks = new Map<string, BlockType>();
    blocks.set('5,5,5', BlockType.STONE);
    blocks.set('6,5,5', BlockType.STONE);
    const getBlock = createMockGetBlock(blocks);
    const data = buildChunkGeometryData(0, 0, 0, getBlock);
    // 2 blocks * 6 faces - 2 shared faces = 10 faces
    expect(data.indices.length).toBe(10 * 6);
  });

  it('generates UV coordinates', () => {
    const blocks = new Map<string, BlockType>();
    blocks.set('0,0,0', BlockType.GRASS);
    const getBlock = createMockGetBlock(blocks);
    const data = buildChunkGeometryData(0, 0, 0, getBlock);
    expect(data.uvs.length).toBeGreaterThan(0);
  });

  it('generates normals', () => {
    const blocks = new Map<string, BlockType>();
    blocks.set('0,0,0', BlockType.STONE);
    const getBlock = createMockGetBlock(blocks);
    const data = buildChunkGeometryData(0, 0, 0, getBlock);
    expect(data.normals.length).toBe(data.positions.length);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/world/ChunkMesher.test.ts`
Expected: FAIL

- [ ] **Step 3: ChunkMesher.ts を実装**

```typescript
// src/world/ChunkMesher.ts
import { CHUNK_SIZE } from './Chunk';
import { BlockType, isSolid, getBlockUVs, ATLAS_SIZE } from './Block';

export interface ChunkGeometryData {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

type GetBlockFn = (wx: number, wy: number, wz: number) => BlockType;

// Face directions: [dx, dy, dz, normal axis, face vertices]
const FACES = [
  { dir: [1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], normal: [1,0,0], uvFace: 'side' as const },   // +X
  { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], normal: [-1,0,0], uvFace: 'side' as const },  // -X
  { dir: [0, 1, 0], corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]], normal: [0,1,0], uvFace: 'top' as const },     // +Y (top)
  { dir: [0, -1, 0], corners: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]], normal: [0,-1,0], uvFace: 'bottom' as const },// -Y (bottom)
  { dir: [0, 0, 1], corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], normal: [0,0,1], uvFace: 'side' as const },    // +Z
  { dir: [0, 0, -1], corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], normal: [0,0,-1], uvFace: 'side' as const },  // -Z
];

export function buildChunkGeometryData(
  chunkX: number,
  chunkY: number,
  chunkZ: number,
  getBlock: GetBlockFn,
): ChunkGeometryData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const tileSize = 1 / ATLAS_SIZE;

  const originX = chunkX * CHUNK_SIZE;
  const originY = chunkY * CHUNK_SIZE;
  const originZ = chunkZ * CHUNK_SIZE;

  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = originX + lx;
        const wy = originY + ly;
        const wz = originZ + lz;
        const block = getBlock(wx, wy, wz);
        if (!isSolid(block)) continue;

        const blockUVs = getBlockUVs(block);

        for (const face of FACES) {
          const nx = wx + face.dir[0];
          const ny = wy + face.dir[1];
          const nz = wz + face.dir[2];

          if (isSolid(getBlock(nx, ny, nz))) continue;

          const texIdx = blockUVs[face.uvFace];
          const u0 = texIdx * tileSize;
          const v0 = 0;
          const u1 = u0 + tileSize;
          const v1 = 1;

          const vertexStart = positions.length / 3;

          for (const corner of face.corners) {
            positions.push(wx + corner[0], wy + corner[1], wz + corner[2]);
            normals.push(face.normal[0], face.normal[1], face.normal[2]);
          }

          uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);

          indices.push(
            vertexStart, vertexStart + 1, vertexStart + 2,
            vertexStart, vertexStart + 2, vertexStart + 3,
          );
        }
      }
    }
  }

  return { positions, normals, uvs, indices };
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `npx vitest run src/world/ChunkMesher.test.ts`
Expected: All tests PASS

- [ ] **Step 5: コミット**

```bash
git add src/world/ChunkMesher.ts src/world/ChunkMesher.test.ts
git commit -m "feat: Culled Meshingによるチャンクメッシュ生成"
```

---

## Task 8: InputManager

**Files:**
- Create: `src/engine/InputManager.ts`

- [ ] **Step 1: InputManager.ts を実装**

```typescript
// src/engine/InputManager.ts
export class InputManager {
  private keys = new Set<string>();
  private mouseMovementX = 0;
  private mouseMovementY = 0;
  private mouseLeftClick = false;
  private mouseRightClick = false;
  private _isPointerLocked = false;

  constructor(private canvas: HTMLCanvasElement) {
    document.addEventListener('keydown', (e) => this.keys.add(e.code));
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    document.addEventListener('mousemove', (e) => {
      if (this._isPointerLocked) {
        this.mouseMovementX += e.movementX;
        this.mouseMovementY += e.movementY;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this._isPointerLocked) {
        canvas.requestPointerLock();
        return;
      }
      if (e.button === 0) this.mouseLeftClick = true;
      if (e.button === 2) this.mouseRightClick = true;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this._isPointerLocked = document.pointerLockElement === canvas;
    });
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  getMouseMovement(): { x: number; y: number } {
    const m = { x: this.mouseMovementX, y: this.mouseMovementY };
    this.mouseMovementX = 0;
    this.mouseMovementY = 0;
    return m;
  }

  consumeLeftClick(): boolean {
    const v = this.mouseLeftClick;
    this.mouseLeftClick = false;
    return v;
  }

  consumeRightClick(): boolean {
    const v = this.mouseRightClick;
    this.mouseRightClick = false;
    return v;
  }

  get isPointerLocked(): boolean {
    return this._isPointerLocked;
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add src/engine/InputManager.ts
git commit -m "feat: InputManager（キーボード・マウス入力管理）"
```

---

## Task 9: 一人称カメラ

**Files:**
- Create: `src/player/Camera.ts`

- [ ] **Step 1: Camera.ts を実装**

```typescript
// src/player/Camera.ts
import * as THREE from 'three';

const SENSITIVITY = 0.002; // rad/pixel
const PITCH_LIMIT = Math.PI / 2 - 0.01; // ~89 degrees

export class FPSCamera {
  readonly camera: THREE.PerspectiveCamera;
  private yaw = 0;
  private pitch = 0;

  constructor(fov: number, aspect: number, near: number, far: number) {
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  }

  rotate(deltaX: number, deltaY: number): void {
    this.yaw -= deltaX * SENSITIVITY;
    this.pitch -= deltaY * SENSITIVITY;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
    this.camera.quaternion.setFromEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'),
    );
  }

  setPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
  }

  getForward(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    dir.y = 0;
    dir.normalize();
    return dir;
  }

  getRight(): THREE.Vector3 {
    const dir = new THREE.Vector3(1, 0, 0);
    dir.applyQuaternion(this.camera.quaternion);
    dir.y = 0;
    dir.normalize();
    return dir;
  }

  getDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add src/player/Camera.ts
git commit -m "feat: 一人称カメラ制御（Pointer Lock + yaw/pitch）"
```

---

## Task 10: プレイヤー移動とAABB衝突判定

**Files:**
- Create: `src/player/Player.ts`, `src/player/Player.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// src/player/Player.test.ts
import { describe, it, expect } from 'vitest';
import { Player, PLAYER_WIDTH, PLAYER_HEIGHT } from './Player';
import { World } from '../world/World';
import { BlockType } from '../world/Block';

describe('Player', () => {
  it('initializes at given position', () => {
    const world = new World();
    const player = new Player(5, 10, 5, world);
    expect(player.x).toBe(5);
    expect(player.y).toBe(10);
    expect(player.z).toBe(5);
  });

  it('moves forward when no obstacles', () => {
    const world = new World();
    const player = new Player(5, 10, 5, world);
    // Move in -Z direction (default forward)
    player.move(0, -1, 1.0);
    expect(player.z).toBeLessThan(5);
  });

  it('does not move into solid blocks', () => {
    const world = new World();
    // Place a wall of stone at z=4
    for (let y = 9; y <= 12; y++) {
      for (let x = 3; x <= 7; x++) {
        world.setBlock(x, y, 4, BlockType.STONE);
      }
    }
    const player = new Player(5, 10, 5.5, world);
    // Try to move into the wall
    player.move(0, -1, 10.0); // large dt to ensure collision
    expect(player.z).toBeGreaterThanOrEqual(4 + 1 + PLAYER_WIDTH / 2);
  });

  it('Y position stays fixed', () => {
    const world = new World();
    const player = new Player(5, 10, 5, world);
    const initialY = player.y;
    player.move(0, -1, 1.0);
    expect(player.y).toBe(initialY);
  });

  it('slides along wall on diagonal movement', () => {
    const world = new World();
    // Wall at z=4, full width
    for (let y = 9; y <= 12; y++) {
      for (let x = 3; x <= 7; x++) {
        world.setBlock(x, y, 4, BlockType.STONE);
      }
    }
    const player = new Player(5, 10, 5.5, world);
    // Move diagonally: X should succeed, Z should be blocked
    player.move(1, -1, 1.0);
    expect(player.x).toBeGreaterThan(5); // X movement succeeded
    expect(player.z).toBeGreaterThanOrEqual(4 + 1 + PLAYER_WIDTH / 2); // Z blocked
  });

  it('PLAYER_WIDTH and PLAYER_HEIGHT match spec', () => {
    expect(PLAYER_WIDTH).toBeCloseTo(0.6);
    expect(PLAYER_HEIGHT).toBeCloseTo(1.8);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/player/Player.test.ts`
Expected: FAIL

- [ ] **Step 3: Player.ts を実装**

```typescript
// src/player/Player.ts
import { World } from '../world/World';

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.6;
const MOVE_SPEED = 4.3; // blocks/sec
const HALF_WIDTH = PLAYER_WIDTH / 2;

export class Player {
  x: number;
  y: number; // foot position
  z: number;

  constructor(x: number, y: number, z: number, private world: World) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  move(dx: number, dz: number, dt: number): void {
    const dist = MOVE_SPEED * dt;

    // Move on X axis
    if (dx !== 0) {
      const newX = this.x + dx * dist;
      if (!this.collides(newX, this.y, this.z)) {
        this.x = newX;
      }
    }

    // Move on Z axis
    if (dz !== 0) {
      const newZ = this.z + dz * dist;
      if (!this.collides(this.x, this.y, newZ)) {
        this.z = newZ;
      }
    }
  }

  private collides(px: number, py: number, pz: number): boolean {
    // AABB: player is a box centered at (px, pz) horizontally
    // Vertical range: py to py + PLAYER_HEIGHT
    const minX = Math.floor(px - HALF_WIDTH);
    const maxX = Math.floor(px + HALF_WIDTH);
    const minY = Math.floor(py);
    const maxY = Math.floor(py + PLAYER_HEIGHT);
    const minZ = Math.floor(pz - HALF_WIDTH);
    const maxZ = Math.floor(pz + HALF_WIDTH);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (this.world.isSolidBlock(bx, by, bz)) {
            // Check actual AABB overlap
            if (
              px + HALF_WIDTH > bx &&
              px - HALF_WIDTH < bx + 1 &&
              py + PLAYER_HEIGHT > by &&
              py < by + 1 &&
              pz + HALF_WIDTH > bz &&
              pz - HALF_WIDTH < bz + 1
            ) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  get eyeX(): number { return this.x; }
  get eyeY(): number { return this.y + PLAYER_EYE_HEIGHT; }
  get eyeZ(): number { return this.z; }
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `npx vitest run src/player/Player.test.ts`
Expected: All tests PASS

- [ ] **Step 5: コミット**

```bash
git add src/player/Player.ts src/player/Player.test.ts
git commit -m "feat: プレイヤー移動とAABB衝突判定"
```

---

## Task 11: DDAレイキャストとブロックインタラクション

**Files:**
- Create: `src/player/BlockInteraction.ts`, `src/player/BlockInteraction.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// src/player/BlockInteraction.test.ts
import { describe, it, expect } from 'vitest';
import { castRay } from './BlockInteraction';
import { World } from '../world/World';
import { BlockType, isDestructible, isSolid } from '../world/Block';

describe('BlockInteraction - DDA Raycast', () => {
  it('hits a block directly in front', () => {
    const world = new World();
    world.setBlock(5, 5, 3, BlockType.STONE);
    // Ray from (5.5, 5.5, 5.5) pointing in -Z direction
    const result = castRay(world, 5.5, 5.5, 5.5, 0, 0, -1, 5);
    expect(result).not.toBeNull();
    expect(result!.blockX).toBe(5);
    expect(result!.blockY).toBe(5);
    expect(result!.blockZ).toBe(3);
  });

  it('returns null when no block in range', () => {
    const world = new World();
    const result = castRay(world, 5.5, 5.5, 5.5, 0, 0, -1, 5);
    expect(result).toBeNull();
  });

  it('returns the adjacent face normal', () => {
    const world = new World();
    world.setBlock(5, 5, 3, BlockType.STONE);
    const result = castRay(world, 5.5, 5.5, 5.5, 0, 0, -1, 5);
    expect(result).not.toBeNull();
    // Hit from +Z side, so normal should be (0, 0, 1)
    expect(result!.normalX).toBe(0);
    expect(result!.normalY).toBe(0);
    expect(result!.normalZ).toBe(1);
  });

  it('respects max distance', () => {
    const world = new World();
    world.setBlock(5, 5, -10, BlockType.STONE);
    const result = castRay(world, 5.5, 5.5, 5.5, 0, 0, -1, 5);
    expect(result).toBeNull();
  });
});

describe('BlockInteraction - breakBlock / placeBlock', () => {
  it('breakBlock destroys a destructible block', () => {
    const world = new World();
    world.setBlock(5, 5, 3, BlockType.STONE);
    const hit = castRay(world, 5.5, 5.5, 5.5, 0, 0, -1, 5)!;
    // Manually test the logic
    expect(isDestructible(world.getBlock(hit.blockX, hit.blockY, hit.blockZ))).toBe(true);
    world.setBlock(hit.blockX, hit.blockY, hit.blockZ, BlockType.AIR);
    expect(world.getBlock(5, 5, 3)).toBe(BlockType.AIR);
  });

  it('breakBlock refuses to destroy BEDROCK', () => {
    const world = new World();
    world.setBlock(5, 5, 3, BlockType.BEDROCK);
    const hit = castRay(world, 5.5, 5.5, 5.5, 0, 0, -1, 5)!;
    expect(isDestructible(world.getBlock(hit.blockX, hit.blockY, hit.blockZ))).toBe(false);
  });

  it('placeBlock sets a block on the adjacent face', () => {
    const world = new World();
    world.setBlock(5, 5, 3, BlockType.STONE);
    const hit = castRay(world, 5.5, 5.5, 5.5, 0, 0, -1, 5)!;
    // Place on the +Z face
    const px = hit.blockX + hit.normalX;
    const py = hit.blockY + hit.normalY;
    const pz = hit.blockZ + hit.normalZ;
    expect(isSolid(world.getBlock(px, py, pz))).toBe(false);
    world.setBlock(px, py, pz, BlockType.STONE);
    expect(world.getBlock(px, py, pz)).toBe(BlockType.STONE);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/player/BlockInteraction.test.ts`
Expected: FAIL

- [ ] **Step 3: BlockInteraction.ts を実装**

```typescript
// src/player/BlockInteraction.ts
import * as THREE from 'three';
import { World } from '../world/World';
import { BlockType, isSolid, isDestructible } from '../world/Block';

export interface RaycastHit {
  blockX: number;
  blockY: number;
  blockZ: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  distance: number;
}

export function castRay(
  world: World,
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  maxDist: number,
): RaycastHit | null {
  // Amanatides & Woo DDA
  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);

  const stepX = dx >= 0 ? 1 : -1;
  const stepY = dy >= 0 ? 1 : -1;
  const stepZ = dz >= 0 ? 1 : -1;

  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;

  let tMaxX = dx !== 0 ? ((dx > 0 ? x + 1 - ox : ox - x) / Math.abs(dx)) : Infinity;
  let tMaxY = dy !== 0 ? ((dy > 0 ? y + 1 - oy : oy - y) / Math.abs(dy)) : Infinity;
  let tMaxZ = dz !== 0 ? ((dz > 0 ? z + 1 - oz : oz - z) / Math.abs(dz)) : Infinity;

  let normalX = 0, normalY = 0, normalZ = 0;
  let t = 0;

  for (let i = 0; i < maxDist * 3; i++) {
    if (isSolid(world.getBlock(x, y, z))) {
      return { blockX: x, blockY: y, blockZ: z, normalX, normalY, normalZ, distance: t };
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        t = tMaxX;
        if (t > maxDist) return null;
        x += stepX;
        tMaxX += tDeltaX;
        normalX = -stepX; normalY = 0; normalZ = 0;
      } else {
        t = tMaxZ;
        if (t > maxDist) return null;
        z += stepZ;
        tMaxZ += tDeltaZ;
        normalX = 0; normalY = 0; normalZ = -stepZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        t = tMaxY;
        if (t > maxDist) return null;
        y += stepY;
        tMaxY += tDeltaY;
        normalX = 0; normalY = -stepY; normalZ = 0;
      } else {
        t = tMaxZ;
        if (t > maxDist) return null;
        z += stepZ;
        tMaxZ += tDeltaZ;
        normalX = 0; normalY = 0; normalZ = -stepZ;
      }
    }
  }
  return null;
}

export class BlockInteraction {
  private highlightMesh: THREE.LineSegments;

  constructor(private world: World, scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(1.001, 1.001, 1.001);
    const edges = new THREE.EdgesGeometry(geo);
    this.highlightMesh = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }),
    );
    this.highlightMesh.visible = false;
    scene.add(this.highlightMesh);
  }

  update(
    eyeX: number, eyeY: number, eyeZ: number,
    dirX: number, dirY: number, dirZ: number,
  ): RaycastHit | null {
    const hit = castRay(this.world, eyeX, eyeY, eyeZ, dirX, dirY, dirZ, 5);
    if (hit) {
      this.highlightMesh.visible = true;
      this.highlightMesh.position.set(hit.blockX + 0.5, hit.blockY + 0.5, hit.blockZ + 0.5);
    } else {
      this.highlightMesh.visible = false;
    }
    return hit;
  }

  breakBlock(hit: RaycastHit): boolean {
    const type = this.world.getBlock(hit.blockX, hit.blockY, hit.blockZ);
    if (!isDestructible(type)) return false;
    this.world.setBlock(hit.blockX, hit.blockY, hit.blockZ, BlockType.AIR);
    return true;
  }

  placeBlock(hit: RaycastHit, playerX: number, playerY: number, playerZ: number): boolean {
    const px = hit.blockX + hit.normalX;
    const py = hit.blockY + hit.normalY;
    const pz = hit.blockZ + hit.normalZ;
    if (isSolid(this.world.getBlock(px, py, pz))) return false;
    // Prevent placing block inside player AABB
    const HALF_W = 0.3; // PLAYER_WIDTH / 2
    const P_HEIGHT = 1.8;
    if (
      px + 1 > playerX - HALF_W && px < playerX + HALF_W &&
      py + 1 > playerY && py < playerY + P_HEIGHT &&
      pz + 1 > playerZ - HALF_W && pz < playerZ + HALF_W
    ) {
      return false;
    }
    this.world.setBlock(px, py, pz, BlockType.STONE);
    return true;
  }
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `npx vitest run src/player/BlockInteraction.test.ts`
Expected: All tests PASS

- [ ] **Step 5: コミット**

```bash
git add src/player/BlockInteraction.ts src/player/BlockInteraction.test.ts
git commit -m "feat: DDAレイキャストとブロック破壊・設置"
```

---

## Task 12: Renderer

**Files:**
- Create: `src/engine/Renderer.ts`

- [ ] **Step 1: Renderer.ts を実装**

```typescript
// src/engine/Renderer.ts
import * as THREE from 'three';
import { FPSCamera } from '../player/Camera';

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly fpsCamera: FPSCamera;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    // Ambient + directional light for basic shading
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(1, 2, 1);
    this.scene.add(directional);

    this.fpsCamera = new FPSCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.fpsCamera.resize(window.innerWidth / window.innerHeight);
    });
  }

  render(): void {
    this.renderer.render(this.scene, this.fpsCamera.camera);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add src/engine/Renderer.ts
git commit -m "feat: Renderer（Three.jsシーン・ライト・カメラ管理）"
```

---

## Task 13: Game統合とHUD

**Files:**
- Create: `src/engine/Game.ts`
- Modify: `src/main.ts`, `index.html`

- [ ] **Step 1: index.htmlにHUDクロスヘアを追加**

`index.html` の `<body>` 内、scriptタグの前に追加:

```html
<div id="crosshair" style="
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 24px;
  font-family: monospace;
  pointer-events: none;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
  z-index: 10;
">+</div>
<div id="instructions" style="
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-family: monospace;
  font-size: 1.2rem;
  text-align: center;
  background: rgba(0,0,0,0.7);
  padding: 2rem;
  border-radius: 8px;
  z-index: 20;
">Click to play<br><small>WASD: Move | Mouse: Look | Left Click: Break | Right Click: Place</small></div>
```

- [ ] **Step 2: Game.ts を実装**

```typescript
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
    // Check WebGL2
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

    // World
    this.world = new World();
    generateARAMMap(this.world);

    // Player
    this.player = new Player(
      SPAWN_POSITION.x, SPAWN_POSITION.y, SPAWN_POSITION.z,
      this.world,
    );

    // Block interaction
    this.blockInteraction = new BlockInteraction(this.world, this.renderer.scene);

    // Build initial meshes
    this.rebuildAllChunks();

    // Instructions overlay
    this.instructionsEl = document.getElementById('instructions');

    // Start loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(time: number): void {
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    this.update(dt);
    this.renderer.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    // Instructions visibility
    if (this.instructionsEl) {
      this.instructionsEl.style.display = this.input.isPointerLocked ? 'none' : 'block';
    }

    if (!this.input.isPointerLocked) return;

    // Camera rotation
    const mouse = this.input.getMouseMovement();
    this.renderer.fpsCamera.rotate(mouse.x, mouse.y);

    // Player movement
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

    // Update camera position
    this.renderer.fpsCamera.setPosition(
      this.player.eyeX, this.player.eyeY, this.player.eyeZ,
    );

    // Block interaction
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
    // Also rebuild adjacent chunks (for boundary faces)
    // Simplified: rebuild all dirty after setBlock marks them
  }

  private rebuildChunkMesh(cx: number, cy: number, cz: number): void {
    const key = `${cx},${cy},${cz}`;

    // Remove old mesh
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
```

- [ ] **Step 3: main.ts を更新**

```typescript
// src/main.ts
import { Game } from './engine/Game';

const game = new Game();
game.init().catch((err) => {
  console.error('Failed to initialize CraftRift:', err);
});
```

- [ ] **Step 4: 動作確認**

Run: `npx vite --open`
Expected:
- ブラウザにボクセルワールドが表示される
- "Click to play" の案内が表示される
- クリックでPointer Lockが有効になり、WASDで移動、マウスで視点操作ができる
- 左クリックでブロック破壊、右クリックでブロック設置ができる
- ターゲットブロックにワイヤーフレーム枠が表示される

- [ ] **Step 5: コミット**

```bash
git add src/engine/Game.ts src/main.ts index.html
git commit -m "feat: Game統合、HUD、全モジュール接続完了"
```

---

## Task 14: 隣接チャンクの境界面再構築

**Files:**
- Modify: `src/world/World.ts`, `src/engine/Game.ts`

- [ ] **Step 1: World.ts にブロック変更時の隣接チャンクdirtyマーキングを追加**

`World.setBlock` メソッドを更新して、チャンク境界でブロックが変更された場合、隣接チャンクも `dirty = true` にする。

```typescript
// World.ts の setBlock を以下に置き換え
setBlock(wx: number, wy: number, wz: number, type: BlockType): void {
  const cx = this.toChunkCoord(wx);
  const cy = this.toChunkCoord(wy);
  const cz = this.toChunkCoord(wz);
  const chunk = this.getOrCreateChunk(cx, cy, cz);
  const lx = this.toLocalCoord(wx);
  const ly = this.toLocalCoord(wy);
  const lz = this.toLocalCoord(wz);
  chunk.setBlock(lx, ly, lz, type);

  // Mark adjacent chunks dirty if at chunk boundary
  if (lx === 0) this.markDirty(cx - 1, cy, cz);
  if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cy, cz);
  if (ly === 0) this.markDirty(cx, cy - 1, cz);
  if (ly === CHUNK_SIZE - 1) this.markDirty(cx, cy + 1, cz);
  if (lz === 0) this.markDirty(cx, cy, cz - 1);
  if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cy, cz + 1);
}

private markDirty(cx: number, cy: number, cz: number): void {
  const chunk = this.getChunk(cx, cy, cz);
  if (chunk) chunk.dirty = true;
}
```

- [ ] **Step 2: テスト通過を確認**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: 動作確認**

Run: `npx vite --open`
Expected: チャンク境界付近でブロックを破壊・設置した際に、隣接チャンクのメッシュも正しく更新される。

- [ ] **Step 4: コミット**

```bash
git add src/world/World.ts
git commit -m "feat: チャンク境界でのブロック変更時に隣接チャンクを再構築"
```

---

## Task 15: 最終統合テストと品質確認

- [ ] **Step 1: 全テスト実行**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: ブラウザでの手動動作確認**

チェックリスト:
- [ ] ボクセルワールドが表示される（GRASS/DIRT/STONE/BEDROCKのテクスチャ）
- [ ] WASDで水平移動できる
- [ ] マウスで視点操作できる
- [ ] 壁（BEDROCK/STONE）にぶつかって止まる
- [ ] 左クリックでブロック破壊（BEDROCKは不可）
- [ ] 右クリックでSTONEブロック設置
- [ ] ターゲットブロックにワイヤーフレーム表示
- [ ] クロスヘアが画面中央に表示
- [ ] ウィンドウリサイズに追従
- [ ] Escでポインタロック解除

- [ ] **Step 3: ビルド確認**

Run: `npx vite build`
Expected: `dist/` にビルド成果物が生成される。エラーなし。

- [ ] **Step 4: コミット（必要な修正があれば）**

```bash
git add -A
git commit -m "fix: 最終統合テスト・品質修正"
```
