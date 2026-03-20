# ミニオン＋プレイヤーモデル Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ミニオン（Minecraft羊モデル）のウェーブスポーン・レーン歩行・戦闘AIと、プレイヤーキャラクターモデル（一人称/三人称切り替え）を追加する。

**Architecture:** SkinParser→MobModel→Animatorの3層モデルシステムでMinecraftスキンPNGからBoxGeometryを組み立てる。ミニオンはEntity継承でMinionAIがLoL準拠のターゲット優先度と状態遷移を制御。TowerAI/Projectileをエンティティベースターゲットに拡張し、ミニオン優先攻撃を実現。

**Tech Stack:** Three.js, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-20-minion-player-model-design.md`

---

## ファイル構成

### 新規作成
| ファイル | 責務 |
|---------|------|
| `src/model/SkinParser.ts` | Minecraftスキン64x64 PNG→パーツごとの6面UV座標マップ |
| `src/model/SkinParser.test.ts` | SkinParserユニットテスト |
| `src/model/ModelDefinitions.ts` | プレイヤー/羊のパーツ寸法・UV展開図座標・ピボット定義 |
| `src/model/MobModel.ts` | パーツ定義+UV→BoxGeometry組み立て→THREE.Group |
| `src/model/MobModel.test.ts` | MobModelユニットテスト |
| `src/model/Animator.ts` | Walk/Idle/Attackアニメーション制御 |
| `src/model/Animator.test.ts` | Animatorユニットテスト |
| `src/physics/Knockback.ts` | ダメージ時の方向付きノックバック速度 |
| `src/physics/Knockback.test.ts` | Knockbackユニットテスト |
| `src/entity/Minion.ts` | ミニオンEntity（HP150, 攻撃力10, 速度3.5） |
| `src/entity/MinionAI.ts` | LoL準拠ターゲット優先度・状態遷移（walking/attacking/returning） |
| `src/entity/MinionAI.test.ts` | MinionAIユニットテスト |
| `src/entity/MinionWaveManager.ts` | 30秒ウェーブ×3体スポーン、全ミニオンの更新・死亡削除 |
| `src/entity/MinionWaveManager.test.ts` | MinionWaveManagerユニットテスト |
| `src/player/ViewMode.ts` | 一人称/三人称背面/三人称前面のF5切り替え |
| `src/player/ViewMode.test.ts` | ViewModeユニットテスト |

### 変更
| ファイル | 変更内容 |
|---------|---------|
| `src/player/PlayerState.ts` | PLAYER_MAX_HP: 100→500 |
| `src/entity/TowerAI.ts` | TOWER_DAMAGE: 25→50, ターゲット優先度変更（ミニオン優先） |
| `src/entity/Projectile.ts` | ProjectileTarget参照をコンストラクタで受け取り、update()で自動追尾 |
| `src/entity/ProjectileManager.ts` | spawn/updateをProjectileTarget対応に変更 |
| `src/player/Player.ts` | ノックバック水平速度フィールド追加 |
| `src/engine/Game.ts` | ミニオン更新・視点切り替え・ノックバック統合 |

---

### Task 1: バランス調整（定数変更）

**Files:**
- Modify: `src/player/PlayerState.ts:2`
- Modify: `src/entity/TowerAI.ts:5`
- Modify: `src/engine/Game.ts:19`
- Modify: 関連テストファイル

- [ ] **Step 1: PlayerState.tsの定数変更**

```typescript
// src/player/PlayerState.ts:2
export const PLAYER_MAX_HP = 500;
```

- [ ] **Step 2: TowerAI.tsのダメージ変更**

```typescript
// src/entity/TowerAI.ts:5
export const TOWER_DAMAGE = 50;
```

- [ ] **Step 3: Game.tsのデバッグダメージ変更**

```typescript
// src/engine/Game.ts:19
const DEBUG_DAMAGE = 100;
```

- [ ] **Step 4: 既存テストの修正**

PlayerState.test.tsのHP関連テストを500に更新。TowerAI.test.tsのダメージ期待値を50に更新。grepで`100`（旧PLAYER_MAX_HP）と`25`（旧TOWER_DAMAGE）を検索し、テスト内のハードコードされた値を更新。

- [ ] **Step 5: テスト実行**

Run: `npx vitest run`
Expected: 全テストパス

- [ ] **Step 6: コミット**

```bash
git add -A && git commit -m "feat: rebalance HP and damage for minion phase

- PLAYER_MAX_HP: 100 → 500
- TOWER_DAMAGE: 25 → 50
- DEBUG_DAMAGE: 50 → 100"
```

---

### Task 2: SkinParser — スキンテクスチャのUV解析

**Files:**
- Create: `src/model/SkinParser.ts`
- Create: `src/model/SkinParser.test.ts`

- [ ] **Step 1: テスト作成**

```typescript
// src/model/SkinParser.test.ts
import { describe, it, expect } from 'vitest';
import { computeFaceUVs, FaceUVs } from './SkinParser';

describe('computeFaceUVs', () => {
  const TEX_W = 64;
  const TEX_H = 64;

  it('computes head face UVs (8x8x8 at origin 0,0)', () => {
    const uvs = computeFaceUVs(0, 0, 8, 8, 8, TEX_W, TEX_H);
    // top: (d=8, 0) size w×d = 8×8 → pixel (8,0)→(16,8)
    expect(uvs.top).toEqual({ u: 8/64, v: 0/64, w: 8/64, h: 8/64 });
    // front: (d=8, d=8) size w×h = 8×8 → pixel (8,8)→(16,16)
    expect(uvs.front).toEqual({ u: 8/64, v: 8/64, w: 8/64, h: 8/64 });
    // right: (d+w=16, d=8) size d×h = 8×8
    expect(uvs.right).toEqual({ u: 16/64, v: 8/64, w: 8/64, h: 8/64 });
    // left: (0, d=8) size d×h = 8×8
    expect(uvs.left).toEqual({ u: 0/64, v: 8/64, w: 8/64, h: 8/64 });
    // back: (d+w+d=24, d=8) size w×h = 8×8
    expect(uvs.back).toEqual({ u: 24/64, v: 8/64, w: 8/64, h: 8/64 });
    // bottom: (d+w=16, 0) size w×d = 8×8
    expect(uvs.bottom).toEqual({ u: 16/64, v: 0/64, w: 8/64, h: 8/64 });
  });

  it('computes body face UVs (8x12x4 at origin 16,16)', () => {
    const uvs = computeFaceUVs(16, 16, 8, 12, 4, TEX_W, TEX_H);
    // top: origin + (d=4, 0) → pixel (20, 16) size 8×4
    expect(uvs.top).toEqual({ u: 20/64, v: 16/64, w: 8/64, h: 4/64 });
    // front: origin + (4, 4) → pixel (20, 20) size 8×12
    expect(uvs.front).toEqual({ u: 20/64, v: 20/64, w: 8/64, h: 12/64 });
  });

  it('computes right arm face UVs (4x12x4 at origin 40,16)', () => {
    const uvs = computeFaceUVs(40, 16, 4, 12, 4, TEX_W, TEX_H);
    // front: origin + (4, 4) → pixel (44, 20) size 4×12
    expect(uvs.front).toEqual({ u: 44/64, v: 20/64, w: 4/64, h: 12/64 });
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/model/SkinParser.test.ts`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: SkinParser実装**

```typescript
// src/model/SkinParser.ts

/** 1面分のUV座標（0.0〜1.0正規化済み） */
export interface FaceUV {
  u: number;  // 左上U
  v: number;  // 左上V
  w: number;  // 幅
  h: number;  // 高さ
}

/** パーツの6面分のUV */
export interface FaceUVs {
  top: FaceUV;
  bottom: FaceUV;
  front: FaceUV;
  back: FaceUV;
  left: FaceUV;
  right: FaceUV;
}

/**
 * Minecraftキューブネットレイアウトから6面のUVを計算する。
 *
 * 展開図内の配置:
 *   行1: [空(d)] [top(w×d)]    [bottom(w×d)] [空]
 *   行2: [left(d×h)] [front(w×h)] [right(d×h)]  [back(w×h)]
 *
 * @param originX 展開図の左上ピクセルX座標
 * @param originY 展開図の左上ピクセルY座標
 * @param w パーツ幅（ピクセル）
 * @param h パーツ高さ（ピクセル）
 * @param d パーツ奥行き（ピクセル）
 * @param texW テクスチャ全体の幅（ピクセル）
 * @param texH テクスチャ全体の高さ（ピクセル）
 */
export function computeFaceUVs(
  originX: number, originY: number,
  w: number, h: number, d: number,
  texW: number, texH: number,
): FaceUVs {
  const norm = (px: number, py: number, pw: number, ph: number): FaceUV => ({
    u: (originX + px) / texW,
    v: (originY + py) / texH,
    w: pw / texW,
    h: ph / texH,
  });

  return {
    top:    norm(d, 0, w, d),
    bottom: norm(d + w, 0, w, d),
    left:   norm(0, d, d, h),
    front:  norm(d, d, w, h),
    right:  norm(d + w, d, d, h),
    back:   norm(d + w + d, d, w, h),
  };
}
```

- [ ] **Step 4: テスト実行**

Run: `npx vitest run src/model/SkinParser.test.ts`
Expected: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add src/model/SkinParser.ts src/model/SkinParser.test.ts
git commit -m "feat: add SkinParser for Minecraft skin UV extraction"
```

---

### Task 3: ModelDefinitions — パーツ定義

**Files:**
- Create: `src/model/ModelDefinitions.ts`

- [ ] **Step 1: パーツ定義の型とプレイヤー/羊定義を作成**

```typescript
// src/model/ModelDefinitions.ts

/** スキン展開図上でのパーツのUVソース位置 */
export interface SkinRegion {
  originX: number;  // 展開図左上ピクセルX
  originY: number;  // 展開図左上ピクセルY
  w: number;        // パーツ幅（ピクセル）
  h: number;        // パーツ高さ（ピクセル）
  d: number;        // パーツ奥行き（ピクセル）
}

/** 1パーツの定義 */
export interface PartDefinition {
  name: string;
  size: [number, number, number];    // [w, h, d] ピクセル単位
  pivot: [number, number, number];   // 回転軸の位置（モデル原点からのピクセルオフセット）
  skinRegion: SkinRegion;
}

/** モデル全体の定義 */
export interface ModelDefinition {
  parts: PartDefinition[];
  textureWidth: number;   // 64
  textureHeight: number;  // 64
  /** ピクセル→ワールド単位の変換スケール */
  pixelScale: number;
}

// Minecraft: 1ピクセル = 1/16ブロック
const PX = 1 / 16;

/**
 * プレイヤーモデル（Minecraft Steve準拠）
 * 32ピクセル高 = 2.0ブロック → PLAYER_HEIGHT=1.8に合わせてpixelScaleで調整
 */
export const PLAYER_MODEL: ModelDefinition = {
  textureWidth: 64,
  textureHeight: 64,
  pixelScale: 1.8 / 32, // 32pxの身長を1.8ブロックに
  parts: [
    { name: 'head',     size: [8, 8, 8],   pivot: [0, 24, 0],   skinRegion: { originX: 0,  originY: 0,  w: 8, h: 8, d: 8 } },
    { name: 'body',     size: [8, 12, 4],  pivot: [0, 12, 0],   skinRegion: { originX: 16, originY: 16, w: 8, h: 12, d: 4 } },
    { name: 'rightArm', size: [4, 12, 4],  pivot: [-6, 22, 0],  skinRegion: { originX: 40, originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftArm',  size: [4, 12, 4],  pivot: [6, 22, 0],   skinRegion: { originX: 32, originY: 48, w: 4, h: 12, d: 4 } },
    { name: 'rightLeg', size: [4, 12, 4],  pivot: [-2, 12, 0],  skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftLeg',  size: [4, 12, 4],  pivot: [2, 12, 0],   skinRegion: { originX: 16, originY: 48, w: 4, h: 12, d: 4 } },
  ],
};

/**
 * 羊モデル（Minecraft Sheep準拠）
 * ユーザー作成のカスタムスキン（64x64、同じキューブネットフォーマット）
 * 羊の身長は約20ピクセル
 */
export const SHEEP_MODEL: ModelDefinition = {
  textureWidth: 64,
  textureHeight: 64,
  pixelScale: PX,
  parts: [
    { name: 'head',         size: [8, 8, 6],   pivot: [0, 16, -8],  skinRegion: { originX: 0,  originY: 0,  w: 8, h: 8, d: 6 } },
    { name: 'body',         size: [6, 10, 16],  pivot: [0, 13, 0],   skinRegion: { originX: 16, originY: 16, w: 6, h: 10, d: 16 } },
    { name: 'rightFrontLeg', size: [4, 12, 4],  pivot: [-2, 6, -5],  skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftFrontLeg',  size: [4, 12, 4],  pivot: [2, 6, -5],   skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'rightBackLeg',  size: [4, 12, 4],  pivot: [-2, 6, 5],   skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftBackLeg',   size: [4, 12, 4],  pivot: [2, 6, 5],    skinRegion: { originX: 0,  originY: 16, w: 4, h: 12, d: 4 } },
  ],
};
```

- [ ] **Step 2: コミット**

```bash
git add src/model/ModelDefinitions.ts
git commit -m "feat: add player and sheep model part definitions"
```

---

### Task 4: MobModel — BoxGeometryモデル構築

**Files:**
- Create: `src/model/MobModel.ts`
- Create: `src/model/MobModel.test.ts`

- [ ] **Step 1: テスト作成**

```typescript
// src/model/MobModel.test.ts
import { describe, it, expect, vi } from 'vitest';

// Three.jsをモック
vi.mock('three', () => {
  class MockBoxGeometry {
    attributes: Record<string, { array: Float32Array }> = {};
    constructor(public w: number, public h: number, public d: number) {}
    setAttribute(name: string, attr: { array: Float32Array }) {
      this.attributes[name] = attr;
    }
  }
  class MockMeshBasicMaterial { constructor(public opts: Record<string,unknown>) {} }
  class MockMesh {
    position = { set: vi.fn() };
    geometry: MockBoxGeometry;
    material: MockMeshBasicMaterial;
    constructor(g: MockBoxGeometry, m: MockMeshBasicMaterial) {
      this.geometry = g; this.material = m;
    }
  }
  class MockGroup {
    children: unknown[] = [];
    position = { set: vi.fn() };
    rotation = { set: vi.fn() };
    add(child: unknown) { this.children.push(child); }
  }
  class MockTexture {
    magFilter = 0;
    minFilter = 0;
    needsUpdate = false;
  }
  return {
    BoxGeometry: MockBoxGeometry,
    MeshBasicMaterial: MockMeshBasicMaterial,
    Mesh: MockMesh,
    Group: MockGroup,
    Texture: MockTexture,
    NearestFilter: 1003,
    Float32BufferAttribute: class { constructor(public array: Float32Array, public size: number) {} },
  };
});

import { buildModel } from './MobModel';
import { PLAYER_MODEL } from './ModelDefinitions';
import * as THREE from 'three';

describe('buildModel', () => {
  it('creates a Group with correct number of parts for player', () => {
    const texture = new THREE.Texture();
    const group = buildModel(PLAYER_MODEL, texture);
    // 6パーツ: head, body, rightArm, leftArm, rightLeg, leftLeg
    // 各パーツはピボットグループ→メッシュの構造なので、トップレベルのchildren=6
    expect(group.children.length).toBe(6);
  });

  it('creates a Group with correct number of parts for sheep', () => {
    const { SHEEP_MODEL } = require('./ModelDefinitions');
    const texture = new THREE.Texture();
    const group = buildModel(SHEEP_MODEL, texture);
    expect(group.children.length).toBe(6);
  });

  it('returns named parts accessible by name', () => {
    const texture = new THREE.Texture();
    const group = buildModel(PLAYER_MODEL, texture);
    // getPartByName でアクセス可能
    expect(group.children.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/model/MobModel.test.ts`
Expected: FAIL

- [ ] **Step 3: MobModel実装**

```typescript
// src/model/MobModel.ts
import * as THREE from 'three';
import { ModelDefinition, PartDefinition } from './ModelDefinitions';
import { computeFaceUVs } from './SkinParser';

/**
 * BoxGeometryの各面にスキンUVを適用する。
 * Three.jsのBoxGeometryの面順序: +x, -x, +y, -y, +z, -z
 * Minecraft対応: right, left, top, bottom, front, back
 */
function applyFaceUVs(geometry: THREE.BoxGeometry, part: PartDefinition, texW: number, texH: number): void {
  const uvs = computeFaceUVs(
    part.skinRegion.originX, part.skinRegion.originY,
    part.skinRegion.w, part.skinRegion.h, part.skinRegion.d,
    texW, texH,
  );

  const uvAttr = geometry.getAttribute('uv') as THREE.BufferAttribute;
  const arr = uvAttr.array as Float32Array;

  // Three.js BoxGeometry face order: +x(right), -x(left), +y(top), -y(bottom), +z(front), -z(back)
  const faceOrder = [uvs.right, uvs.left, uvs.top, uvs.bottom, uvs.front, uvs.back];

  for (let face = 0; face < 6; face++) {
    const faceUV = faceOrder[face];
    const base = face * 8; // 4 vertices * 2 components per face
    // 各面の4頂点UV: 左上、右上、左下、右下
    arr[base + 0] = faceUV.u;              arr[base + 1] = 1 - faceUV.v;
    arr[base + 2] = faceUV.u + faceUV.w;   arr[base + 3] = 1 - faceUV.v;
    arr[base + 4] = faceUV.u;              arr[base + 5] = 1 - (faceUV.v + faceUV.h);
    arr[base + 6] = faceUV.u + faceUV.w;   arr[base + 7] = 1 - (faceUV.v + faceUV.h);
  }
  uvAttr.needsUpdate = true;
}

/**
 * ModelDefinitionからThree.js Groupを構築する。
 * 各パーツはピボットグループの子として配置され、アニメーション時はピボットグループのrotationを変更する。
 */
export function buildModel(def: ModelDefinition, texture: THREE.Texture): THREE.Group {
  const root = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({
    map: texture,
    // Minecraftのピクセル感を維持
  });

  for (const part of def.parts) {
    const [w, h, d] = part.size;
    const scale = def.pixelScale;

    const geometry = new THREE.BoxGeometry(w * scale, h * scale, d * scale);
    applyFaceUVs(geometry, part, def.textureWidth, def.textureHeight);

    const mesh = new THREE.Mesh(geometry, material);

    // ピボットグループ: パーツの回転軸をpivot位置に設定
    const pivotGroup = new THREE.Group();
    pivotGroup.name = part.name;
    pivotGroup.position.set(
      part.pivot[0] * scale,
      part.pivot[1] * scale,
      part.pivot[2] * scale,
    );

    // メッシュはピボットからの相対位置（パーツ中心がピボットからずれる分）
    // ピボットはパーツの回転軸（通常は上端付近）、メッシュ中心はパーツ中央
    mesh.position.set(0, -h * scale / 2, 0);

    pivotGroup.add(mesh);
    root.add(pivotGroup);
  }

  return root;
}
```

- [ ] **Step 4: テスト実行**

Run: `npx vitest run src/model/MobModel.test.ts`
Expected: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add src/model/MobModel.ts src/model/MobModel.test.ts
git commit -m "feat: add MobModel BoxGeometry builder with skin UV mapping"
```

---

### Task 5: Animator — 歩行・待機・攻撃アニメーション

**Files:**
- Create: `src/model/Animator.ts`
- Create: `src/model/Animator.test.ts`

- [ ] **Step 1: テスト作成**

```typescript
// src/model/Animator.test.ts
import { describe, it, expect } from 'vitest';
import { WalkAnimator, WALK_AMPLITUDE, WALK_SPEED_FACTOR } from './Animator';

describe('WalkAnimator', () => {
  it('does not move limbs when not walking', () => {
    const animator = new WalkAnimator();
    const result = animator.update(0.1, false, 0);
    // 静止時は全リムが0に収束
    expect(Math.abs(result.rightArm)).toBeLessThan(0.01);
    expect(Math.abs(result.leftArm)).toBeLessThan(0.01);
    expect(Math.abs(result.rightLeg)).toBeLessThan(0.01);
    expect(Math.abs(result.leftLeg)).toBeLessThan(0.01);
  });

  it('swings limbs when walking', () => {
    const animator = new WalkAnimator();
    // 歩行を開始して十分時間を進める
    animator.update(0.5, true, 3.5);
    const result = animator.update(0.1, true, 3.5);
    // 何らかの角度が付いているはず
    const maxAngle = WALK_AMPLITUDE;
    expect(Math.abs(result.rightArm)).toBeLessThanOrEqual(maxAngle + 0.01);
    expect(Math.abs(result.rightLeg)).toBeLessThanOrEqual(maxAngle + 0.01);
  });

  it('right arm and right leg swing in opposite directions', () => {
    const animator = new WalkAnimator();
    animator.update(0.25, true, 3.5);
    const result = animator.update(0.01, true, 3.5);
    // 右腕と右脚は逆符号
    if (Math.abs(result.rightArm) > 0.01) {
      expect(Math.sign(result.rightArm)).toBe(-Math.sign(result.rightLeg));
    }
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/model/Animator.test.ts`
Expected: FAIL

- [ ] **Step 3: Animator実装**

```typescript
// src/model/Animator.ts

export const WALK_AMPLITUDE = 0.5;     // ラジアン（≈29度）
export const WALK_SPEED_FACTOR = 8.0;  // 移動速度→アニメ速度の変換係数
const IDLE_AMPLITUDE = 0.02;
const IDLE_SPEED = 1.5;
const BLEND_SPEED = 8.0; // Walk⇔Idle遷移速度

/** リム回転角度の結果 */
export interface LimbAngles {
  rightArm: number;
  leftArm: number;
  rightLeg: number;
  leftLeg: number;
  head: number;
}

/**
 * 歩行・待機アニメーション（skinview3d参考）
 * 羊の場合: rightArm→rightFrontLeg, leftArm→leftFrontLeg,
 *           rightLeg→rightBackLeg, leftLeg→leftBackLeg
 */
export class WalkAnimator {
  private phase = 0;
  private walkBlend = 0; // 0=idle, 1=walk

  update(dt: number, isMoving: boolean, moveSpeed: number): LimbAngles {
    // Walk⇔Idle遷移のブレンド
    const targetBlend = isMoving ? 1 : 0;
    this.walkBlend += (targetBlend - this.walkBlend) * Math.min(1, BLEND_SPEED * dt);

    // フェーズ進行
    const animSpeed = isMoving ? moveSpeed * WALK_SPEED_FACTOR : IDLE_SPEED;
    this.phase += dt * animSpeed;

    const walkAngle = Math.sin(this.phase) * WALK_AMPLITUDE;
    const idleAngle = Math.sin(this.phase) * IDLE_AMPLITUDE;

    const limbAngle = walkAngle * this.walkBlend + idleAngle * (1 - this.walkBlend);

    return {
      rightArm: -limbAngle,
      leftArm: limbAngle,
      rightLeg: limbAngle,
      leftLeg: -limbAngle,
      head: idleAngle * (1 - this.walkBlend), // 待機時のみ微小な頭の揺れ
    };
  }
}

/**
 * 攻撃アニメーション（右腕を振り下ろす）
 */
export class AttackAnimator {
  private timer = 0;
  private active = false;
  private static readonly DURATION = 0.3;

  play(): void {
    this.timer = AttackAnimator.DURATION;
    this.active = true;
  }

  update(dt: number): number {
    if (!this.active) return 0;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.active = false;
      return 0;
    }
    // 振り下ろし: 0→-90度→0度（sin波の半周期）
    const progress = 1 - this.timer / AttackAnimator.DURATION;
    return -Math.sin(progress * Math.PI) * 1.5; // 1.5ラジアン ≈ 86度
  }

  get isPlaying(): boolean { return this.active; }
}
```

- [ ] **Step 4: テスト実行**

Run: `npx vitest run src/model/Animator.test.ts`
Expected: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add src/model/Animator.ts src/model/Animator.test.ts
git commit -m "feat: add WalkAnimator and AttackAnimator with skinview3d-style limb swing"
```

---

### Task 6: Knockback — ノックバック物理

**Files:**
- Create: `src/physics/Knockback.ts`
- Create: `src/physics/Knockback.test.ts`

- [ ] **Step 1: テスト作成**

```typescript
// src/physics/Knockback.test.ts
import { describe, it, expect } from 'vitest';
import { KnockbackState, applyKnockback, updateKnockback,
  KNOCKBACK_HORIZONTAL, KNOCKBACK_VERTICAL, KNOCKBACK_FRICTION } from './Knockback';

describe('applyKnockback', () => {
  it('applies velocity away from source', () => {
    const state: KnockbackState = { vx: 0, vy: 0, vz: 0 };
    // ソースはx=0,z=0、ターゲットはx=10,z=0 → +x方向にノックバック
    applyKnockback(state, 0, 0, 0, 10, 0, 0);
    expect(state.vx).toBeCloseTo(KNOCKBACK_HORIZONTAL);
    expect(state.vy).toBeCloseTo(KNOCKBACK_VERTICAL);
    expect(state.vz).toBeCloseTo(0);
  });

  it('applies diagonal knockback', () => {
    const state: KnockbackState = { vx: 0, vy: 0, vz: 0 };
    applyKnockback(state, 0, 0, 0, 1, 0, 1);
    // 45度方向なのでvxとvzは同じ大きさ
    expect(Math.abs(state.vx - state.vz)).toBeLessThan(0.001);
    const horizontal = Math.sqrt(state.vx ** 2 + state.vz ** 2);
    expect(horizontal).toBeCloseTo(KNOCKBACK_HORIZONTAL);
  });

  it('handles zero distance (source on top of target)', () => {
    const state: KnockbackState = { vx: 0, vy: 0, vz: 0 };
    applyKnockback(state, 5, 0, 5, 5, 0, 5);
    // ゼロ距離の場合、デフォルト方向（+z）にノックバック
    expect(state.vy).toBeCloseTo(KNOCKBACK_VERTICAL);
  });
});

describe('updateKnockback', () => {
  it('decays velocity over time', () => {
    const state: KnockbackState = { vx: 3.0, vy: 2.0, vz: 0 };
    updateKnockback(state, 0.1);
    expect(state.vx).toBeLessThan(3.0);
    expect(state.vx).toBeGreaterThan(0);
  });

  it('reaches near-zero after sufficient time', () => {
    const state: KnockbackState = { vx: 3.0, vy: 0, vz: 3.0 };
    for (let i = 0; i < 30; i++) updateKnockback(state, 0.05);
    expect(Math.abs(state.vx)).toBeLessThan(0.01);
    expect(Math.abs(state.vz)).toBeLessThan(0.01);
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/physics/Knockback.test.ts`
Expected: FAIL

- [ ] **Step 3: Knockback実装**

```typescript
// src/physics/Knockback.ts

export const KNOCKBACK_HORIZONTAL = 3.0;  // blocks/s
export const KNOCKBACK_VERTICAL = 2.0;    // blocks/s
export const KNOCKBACK_FRICTION = 10.0;   // 減衰係数

export interface KnockbackState {
  vx: number;
  vy: number;
  vz: number;
}

/**
 * ダメージ源の位置から被ダメージ者へのノックバック速度を設定する。
 */
export function applyKnockback(
  state: KnockbackState,
  sourceX: number, sourceY: number, sourceZ: number,
  targetX: number, targetY: number, targetZ: number,
): void {
  let dx = targetX - sourceX;
  let dz = targetZ - sourceZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist > 0.001) {
    dx /= dist;
    dz /= dist;
  } else {
    // ゼロ距離の場合デフォルト方向
    dx = 0;
    dz = 1;
  }

  state.vx = dx * KNOCKBACK_HORIZONTAL;
  state.vy = KNOCKBACK_VERTICAL;
  state.vz = dz * KNOCKBACK_HORIZONTAL;
}

/**
 * ノックバック速度を毎フレーム減衰させる。
 */
export function updateKnockback(state: KnockbackState, dt: number): void {
  const decay = Math.max(0, 1 - KNOCKBACK_FRICTION * dt);
  state.vx *= decay;
  state.vz *= decay;
  // Y方向は重力に任せるので減衰しない（Player.updatePhysicsが処理）
  // ただしvy自体はノックバック適用時の初速のみ
  state.vy = 0; // 初回適用後はゼロに（重力はPlayer側で処理）
}

export function createKnockbackState(): KnockbackState {
  return { vx: 0, vy: 0, vz: 0 };
}

export function hasKnockback(state: KnockbackState): boolean {
  return Math.abs(state.vx) > 0.01 || Math.abs(state.vz) > 0.01;
}
```

- [ ] **Step 4: テスト実行**

Run: `npx vitest run src/physics/Knockback.test.ts`
Expected: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add src/physics/Knockback.ts src/physics/Knockback.test.ts
git commit -m "feat: add knockback physics system"
```

---

### Task 7: Minion + MinionAI — ミニオンエンティティと戦闘AI

**Files:**
- Create: `src/entity/Minion.ts`
- Create: `src/entity/MinionAI.ts`
- Create: `src/entity/MinionAI.test.ts`

- [ ] **Step 1: MinionAIテスト作成**

```typescript
// src/entity/MinionAI.test.ts
import { describe, it, expect } from 'vitest';
import { MinionAI, MinionAIState, LANE_CENTER_X } from './MinionAI';
import { Minion, MINION_ATTACK_RANGE, MINION_MOVE_SPEED } from './Minion';
import { Structure } from './Structure';
import { BlockType } from '../world/Block';

function createMinion(team: 'blue' | 'red', x = 9, y = 5, z = 50): Minion {
  return new Minion(`test-${team}-${Math.random()}`, team, x, y, z);
}

function createStructure(id: string, team: 'blue' | 'red', z: number): Structure {
  return new Structure(id, team, 8, 4, z, 'tower', 1500, 3, 6, 3, BlockType.RED_TOWER, null);
}

describe('MinionAI', () => {
  it('walks toward enemy side when no enemies nearby', () => {
    const minion = createMinion('blue', 9, 5, 50);
    const ai = new MinionAI(minion);
    const result = ai.update(0.1, [], []);
    expect(result.state).toBe('walking');
    // Blue→Red（Z増加方向）
    expect(result.moveZ).toBeGreaterThan(0);
  });

  it('red minion walks toward blue side (Z decrease)', () => {
    const minion = createMinion('red', 9, 5, 150);
    const ai = new MinionAI(minion);
    const result = ai.update(0.1, [], []);
    expect(result.moveZ).toBeLessThan(0);
  });

  it('attacks enemy minion in range', () => {
    const blue = createMinion('blue', 9, 5, 50);
    const red = createMinion('red', 9, 5, 51); // 1ブロック先（射程2.0内）
    const ai = new MinionAI(blue);
    const result = ai.update(0.1, [red], []);
    expect(result.state).toBe('attacking');
    expect(result.targetId).toBe(red.id);
  });

  it('does not attack ally minion', () => {
    const blue1 = createMinion('blue', 9, 5, 50);
    const blue2 = createMinion('blue', 9, 5, 51);
    const ai = new MinionAI(blue1);
    const result = ai.update(0.1, [blue2], []);
    expect(result.state).toBe('walking');
  });

  it('prioritizes enemy minion attacking self', () => {
    const blue = createMinion('blue', 9, 5, 50);
    const red1 = createMinion('red', 9, 5, 51);
    const red2 = createMinion('red', 9, 5, 51.5);
    const ai = new MinionAI(blue);
    // red2がblueを攻撃中
    const result = ai.update(0.1, [red1, red2], [], red2.id);
    expect(result.targetId).toBe(red2.id);
  });

  it('attacks enemy structure when no enemy minions', () => {
    const blue = createMinion('blue', 9, 5, 135);
    const redTower = createStructure('red-t1', 'red', 136);
    const ai = new MinionAI(blue);
    const result = ai.update(0.1, [], [redTower]);
    // タワーの近くにいるので攻撃状態
    expect(result.state).toBe('attacking');
  });

  it('returns to lane center when displaced', () => {
    const blue = createMinion('blue', 5, 5, 50); // X=5、レーン中央X=9からずれ
    const ai = new MinionAI(blue);
    const result = ai.update(0.1, [], []);
    // X方向にレーン中央へ向かう成分がある
    expect(result.moveX).toBeGreaterThan(0);
  });

  it('does not attack protected structures', () => {
    const blue = createMinion('blue', 9, 5, 167);
    const redT1 = createStructure('red-t1', 'red', 136);
    const redT2 = createStructure('red-t2', 'red', 168);
    redT2.protectedBy = redT1;
    const ai = new MinionAI(blue);
    const result = ai.update(0.1, [], [redT1, redT2]);
    // T2は保護されているのでT1方向へ歩く
    expect(result.state).toBe('walking');
  });
});
```

- [ ] **Step 2: Minion + MinionAI実装**

```typescript
// src/entity/Minion.ts
import { Entity, Team } from './Entity';

export const MINION_HP = 150;
export const MINION_DAMAGE = 10;
export const MINION_ATTACK_INTERVAL = 1.0;
export const MINION_ATTACK_RANGE = 2.0;
export const MINION_MOVE_SPEED = 3.5;

export class Minion extends Entity {
  attackTimer = 0;

  constructor(id: string, team: Team, x: number, y: number, z: number) {
    super(id, team, x, y, z, MINION_HP);
  }

  /** 攻撃タイマーを進め、攻撃可能ならtrueを返す */
  tryAttack(dt: number): boolean {
    this.attackTimer += dt;
    if (this.attackTimer >= MINION_ATTACK_INTERVAL) {
      this.attackTimer -= MINION_ATTACK_INTERVAL;
      return true;
    }
    return false;
  }

  resetAttackTimer(): void {
    this.attackTimer = 0;
  }
}
```

```typescript
// src/entity/MinionAI.ts
import { Minion, MINION_ATTACK_RANGE, MINION_MOVE_SPEED } from './Minion';
import { Structure } from './Structure';
import { Entity } from './Entity';

export const LANE_CENTER_X = 9.0;

export type MinionAIState = 'walking' | 'attacking' | 'returning';

export interface MinionAIResult {
  state: MinionAIState;
  moveX: number;  // X方向移動量
  moveZ: number;  // Z方向移動量
  targetId: string | null; // 攻撃対象のID
  damage: number; // このフレームのダメージ（0 or MINION_DAMAGE）
}

export class MinionAI {
  private state: MinionAIState = 'walking';

  constructor(private minion: Minion) {}

  /**
   * @param dt フレーム時間
   * @param allMinions 全ミニオン（味方含む）
   * @param structures 全構造物
   * @param attackingMeId 自分を攻撃中の敵ミニオンID（あれば）
   */
  update(
    dt: number,
    allMinions: Minion[],
    structures: Structure[],
    attackingMeId?: string,
  ): MinionAIResult {
    if (!this.minion.isAlive) {
      return { state: 'walking', moveX: 0, moveZ: 0, targetId: null, damage: 0 };
    }

    const direction = this.minion.team === 'blue' ? 1 : -1; // Z方向
    const enemyMinions = allMinions.filter(m => m.team !== this.minion.team && m.isAlive);
    const enemyStructures = structures.filter(s => s.team !== this.minion.team && s.isAlive && !s.isProtected());

    // ターゲット優先度:
    // 1. 自分を攻撃中の敵ミニオン
    // 2. 射程内の最も近い敵ミニオン
    // 3. 射程内の敵構造物
    let target: Entity | null = null;

    if (attackingMeId) {
      const attacker = enemyMinions.find(m => m.id === attackingMeId);
      if (attacker && this.distanceTo(attacker) <= MINION_ATTACK_RANGE) {
        target = attacker;
      }
    }

    if (!target) {
      let closest: Minion | null = null;
      let closestDist = Infinity;
      for (const enemy of enemyMinions) {
        const d = this.distanceTo(enemy);
        if (d <= MINION_ATTACK_RANGE && d < closestDist) {
          closest = enemy;
          closestDist = d;
        }
      }
      target = closest;
    }

    if (!target) {
      // 構造物: 中心点との距離で判定
      for (const s of enemyStructures) {
        const cx = s.x + s.width / 2;
        const cy = s.y + s.height / 2;
        const cz = s.z + s.depth / 2;
        const dx = this.minion.x - cx;
        const dy = this.minion.y - cy;
        const dz = this.minion.z - cz;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d <= MINION_ATTACK_RANGE + s.width / 2) {
          target = s;
          break;
        }
      }
    }

    // 攻撃状態
    if (target) {
      this.state = 'attacking';
      let damage = 0;
      if (this.minion.tryAttack(dt)) {
        damage = MINION_DAMAGE;
      }
      return {
        state: 'attacking',
        moveX: 0,
        moveZ: 0,
        targetId: target.id,
        damage,
      };
    }

    // 歩行状態: レーン中央に向かいつつ進行方向へ
    this.minion.resetAttackTimer();
    const targetX = LANE_CENTER_X;
    const dx = targetX - this.minion.x;
    let moveX = 0;
    let moveZ = direction * MINION_MOVE_SPEED * dt;

    if (Math.abs(dx) > 0.1) {
      this.state = 'returning';
      // レーン中央に向かう方向ベクトル
      const totalDist = Math.sqrt(dx * dx + (MINION_MOVE_SPEED * dt) ** 2);
      moveX = (dx / totalDist) * MINION_MOVE_SPEED * dt;
      moveZ = (direction * MINION_MOVE_SPEED * dt / totalDist) * MINION_MOVE_SPEED * dt;
    } else {
      this.state = 'walking';
    }

    return {
      state: this.state,
      moveX,
      moveZ,
      targetId: null,
      damage: 0,
    };
  }

  private distanceTo(entity: Entity): number {
    const dx = this.minion.x - entity.x;
    const dy = this.minion.y - entity.y;
    const dz = this.minion.z - entity.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
```

- [ ] **Step 3: テスト実行**

Run: `npx vitest run src/entity/MinionAI.test.ts`
Expected: 全テストパス

- [ ] **Step 4: コミット**

```bash
git add src/entity/Minion.ts src/entity/MinionAI.ts src/entity/MinionAI.test.ts
git commit -m "feat: add Minion entity and MinionAI with LoL-style targeting"
```

---

### Task 8: Projectile/ProjectileManager リファクタ — エンティティベースターゲット

**Files:**
- Modify: `src/entity/Projectile.ts`
- Modify: `src/entity/ProjectileManager.ts`
- Modify: existing tests

**重要:** 既存テストが壊れないようにする。段階的に変更する。

- [ ] **Step 1: ProjectileTargetインターフェースを追加**

`src/entity/Projectile.ts`の先頭にインターフェースを追加:
```typescript
export interface ProjectileTarget {
  x: number;
  y: number;
  z: number;
  isAlive: boolean;
}
```

- [ ] **Step 2: Projectileをリファクタ**

Projectileのコンストラクタに`target: ProjectileTarget`を追加。`update()`からtargetX/Y/Z引数を削除し、`this.target`の座標を直接参照する。ターゲットが死亡したら弾も消滅。

```typescript
export class Projectile {
  // ... 既存フィールド
  readonly target: ProjectileTarget;

  constructor(x: number, y: number, z: number, damage: number, team: Team,
    target: ProjectileTarget) {
    // 初期方向はtarget座標に向かう
    this.target = target;
    const dx = target.x - x; const dy = target.y - y; const dz = target.z - z;
    // ... 既存の方向計算
  }

  update(dt: number): boolean {
    // targetX → this.target.x に全置換
    // ターゲット死亡時は弾を消滅
    if (!this.target.isAlive) { this.alive = false; return false; }
    // ... 既存の追尾ロジック（引数のtargetX/Y/Zをthis.target.x/y/zに変更）
  }
}
```

- [ ] **Step 3: ProjectileManagerをリファクタ**

```typescript
// spawn: FireCommand + ProjectileTarget → Projectile生成
spawn(command: FireCommand, target: ProjectileTarget): void {
  const projectile = new Projectile(
    command.originX, command.originY, command.originZ,
    command.damage, command.team, target,
  );
  // ... メッシュ生成（変更なし）
}

// HitResultにターゲット参照を追加（ミニオン/プレイヤー判別用）
export interface HitResult {
  damage: number;
  team: Team;
  target: ProjectileTarget; // 命中したターゲット
}

// update: ターゲット座標引数を削除
update(dt: number): HitResult[] {
  const hits: HitResult[] = [];
  for (const p of this.projectiles) {
    const hit = p.update(dt); // 引数なし
    if (hit) hits.push({ damage: p.damage, team: p.team, target: p.target });
  }
  // ... 既存のクリーンアップ
}
```

- [ ] **Step 4: 既存テスト修正**

Projectile.test.ts: `new Projectile(x,y,z,dmg,team,tx,ty,tz)` → `new Projectile(x,y,z,dmg,team,{x:tx,y:ty,z:tz,isAlive:true})`
ProjectileManager.test.ts: `spawn(cmd,tx,ty,tz)` → `spawn(cmd,{x:tx,y:ty,z:tz,isAlive:true})`, `update(dt,tx,ty,tz)` → `update(dt)`

- [ ] **Step 5: テスト実行**

Run: `npx vitest run`
Expected: 全テストパス

- [ ] **Step 6: コミット**

```bash
git add src/entity/Projectile.ts src/entity/ProjectileManager.ts src/entity/*.test.ts
git commit -m "refactor: Projectile/ProjectileManager to entity-based targeting

Each projectile now holds a ProjectileTarget reference and automatically
tracks the target's coordinates. This enables tower projectiles to target
both players and minions independently."
```

---

### Task 9: TowerAI変更 — ミニオン優先ターゲット

**Files:**
- Modify: `src/entity/TowerAI.ts`
- Modify: `src/entity/TowerAI.test.ts`

- [ ] **Step 1: テスト追加**

TowerAI.test.tsに以下のテストを追加:

```typescript
import { Minion } from './Minion';

describe('TowerAI with minion targeting', () => {
  it('targets minion over player when both in range', () => {
    const structure = createStructure('red', 8, 4, 136);
    const ai = new TowerAI(structure);
    const minion = new Minion('blue-m1', 'blue', 9, 5, 140);
    const playerTarget = { x: 9, y: 5, z: 140, isAlive: true };

    const result = ai.update(2.1, playerTarget, [minion]);
    expect(result).not.toBeNull();
    // FireCommandにtarget情報が含まれる
    expect(result!.targetId).toBe('blue-m1');
  });

  it('targets player when no minions in range', () => {
    const structure = createStructure('red', 8, 4, 136);
    const ai = new TowerAI(structure);
    const playerTarget = { x: 9, y: 5, z: 140, isAlive: true };

    const result = ai.update(2.1, playerTarget, []);
    expect(result).not.toBeNull();
    expect(result!.targetId).toBeUndefined(); // プレイヤー向け
  });

  it('does not fire at dead minion', () => {
    const structure = createStructure('red', 8, 4, 136);
    const ai = new TowerAI(structure);
    const deadMinion = new Minion('blue-m1', 'blue', 9, 5, 140);
    deadMinion.takeDamage(150);

    const result = ai.update(2.1, { x: 99, y: 5, z: 99, isAlive: true }, [deadMinion]);
    expect(result).toBeNull(); // 死んだミニオンは無視、プレイヤーは射程外
  });
});
```

- [ ] **Step 2: TowerAI.update()シグネチャ変更**

```typescript
export interface FireCommand {
  originX: number;
  originY: number;
  originZ: number;
  damage: number;
  team: Team;
  targetId?: string; // ミニオンターゲット時のID
}

update(
  dt: number,
  playerTarget: { x: number; y: number; z: number; isAlive: boolean },
  enemyMinions: Minion[],
): FireCommand | null {
  if (!this.structure.isAlive) return null;

  // 1. 射程内の生存ミニオンを探す（最も近い）
  let minionTarget: Minion | null = null;
  let minDist = Infinity;
  for (const m of enemyMinions) {
    if (!m.isAlive) continue;
    if (!this.isInRange(m.x, m.y, m.z)) continue;
    const dx = m.x - this.getCenterX();
    const dy = m.y - this.getCenterY();
    const dz = m.z - this.getCenterZ();
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < minDist) { minDist = d; minionTarget = m; }
  }

  // 2. ミニオンがいなければプレイヤー
  const hasTarget = minionTarget !== null ||
    (playerTarget.isAlive && this.isInRange(playerTarget.x, playerTarget.y, playerTarget.z));

  if (!hasTarget) {
    this.attackTimer = 0;
    return null;
  }

  this.attackTimer += dt;
  if (this.attackTimer >= TOWER_ATTACK_INTERVAL) {
    this.attackTimer -= TOWER_ATTACK_INTERVAL;
    return {
      originX: this.getCenterX(),
      originY: this.getCenterY(),
      originZ: this.getCenterZ(),
      damage: TOWER_DAMAGE,
      team: this.structure.team,
      targetId: minionTarget?.id,
    };
  }
  return null;
}
```

- [ ] **Step 3: 既存テスト修正**

既存のTowerAI.test.tsで `update(dt, x, y, z, alive)` → `update(dt, {x, y, z, isAlive: alive}, [])` に更新。

- [ ] **Step 4: テスト実行**

Run: `npx vitest run`
Expected: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add src/entity/TowerAI.ts src/entity/TowerAI.test.ts
git commit -m "feat: TowerAI prioritizes minion targets over player"
```

---

### Task 10: MinionWaveManager — ウェーブスポーンと全体管理

**Files:**
- Create: `src/entity/MinionWaveManager.ts`
- Create: `src/entity/MinionWaveManager.test.ts`

- [ ] **Step 1: テスト作成**

```typescript
// src/entity/MinionWaveManager.test.ts
import { describe, it, expect, vi } from 'vitest';
import { MinionWaveManager, WAVE_INTERVAL, WAVE_SIZE } from './MinionWaveManager';

// Three.js Scene のモック
const mockScene = {
  add: vi.fn(),
  remove: vi.fn(),
};

describe('MinionWaveManager', () => {
  it('spawns first wave immediately', () => {
    const manager = new MinionWaveManager(mockScene as any, []);
    manager.update(0.1, []);
    // Blue 3体 + Red 3体 = 6体
    expect(manager.getAllMinions().length).toBe(6);
  });

  it('spawns next wave after interval', () => {
    const manager = new MinionWaveManager(mockScene as any, []);
    manager.update(0.1, []);
    expect(manager.getAllMinions().length).toBe(6);

    // WAVE_INTERVAL秒後に次のウェーブ
    manager.update(WAVE_INTERVAL, []);
    expect(manager.getAllMinions().length).toBe(12);
  });

  it('removes dead minions', () => {
    const manager = new MinionWaveManager(mockScene as any, []);
    manager.update(0.1, []);
    const minions = manager.getAllMinions();
    minions[0].takeDamage(150); // 即死
    manager.update(0.1, []);
    expect(manager.getAllMinions().length).toBe(5);
  });

  it('blue minions spawn at low-z, red at high-z', () => {
    const manager = new MinionWaveManager(mockScene as any, []);
    manager.update(0.1, []);
    const blues = manager.getTeamMinions('blue');
    const reds = manager.getTeamMinions('red');
    expect(blues.length).toBe(WAVE_SIZE);
    expect(reds.length).toBe(WAVE_SIZE);
    expect(blues[0].z).toBeLessThan(50);
    expect(reds[0].z).toBeGreaterThan(150);
  });
});
```

- [ ] **Step 2: MinionWaveManager実装**

```typescript
// src/entity/MinionWaveManager.ts
import * as THREE from 'three';
import { Minion, MINION_MOVE_SPEED, MINION_DAMAGE } from './Minion';
import { MinionAI } from './MinionAI';
import { Structure } from './Structure';
import { Team } from './Entity';
import { KnockbackState, createKnockbackState, updateKnockback, hasKnockback } from '../physics/Knockback';

export const WAVE_INTERVAL = 30.0;
export const WAVE_SIZE = 3;
export const BLUE_SPAWN_Z = 10;
export const RED_SPAWN_Z = 200;
export const SPAWN_X = 9.0;
const SPAWN_Y = 5; // GRASS_Y + 2 相当

export class MinionWaveManager {
  private minions: Minion[] = [];
  private ais: Map<string, MinionAI> = new Map();
  private knockbacks: Map<string, KnockbackState> = new Map();
  private meshes: Map<string, THREE.Group> = new Map();
  private waveTimer = WAVE_INTERVAL; // 即座に最初のウェーブをスポーン
  private waveCount = 0;

  constructor(
    private scene: THREE.Scene,
    private structures: Structure[],
  ) {}

  update(dt: number, structures: Structure[]): void {
    this.structures = structures;

    // ウェーブスポーン
    this.waveTimer += dt;
    if (this.waveTimer >= WAVE_INTERVAL) {
      this.waveTimer -= WAVE_INTERVAL;
      this.spawnWave('blue');
      this.spawnWave('red');
      this.waveCount++;
    }

    // 各ミニオンのAI更新
    for (const minion of this.minions) {
      if (!minion.isAlive) continue;

      const ai = this.ais.get(minion.id);
      if (!ai) continue;

      // ノックバック更新
      const kb = this.knockbacks.get(minion.id);
      if (kb && hasKnockback(kb)) {
        minion.x += kb.vx * dt;
        minion.z += kb.vz * dt;
        updateKnockback(kb, dt);
      }

      // AI更新
      const result = ai.update(dt, this.minions, this.structures);

      // 移動適用
      minion.x += result.moveX;
      minion.z += result.moveZ;

      // ダメージ適用
      if (result.damage > 0 && result.targetId) {
        const target = this.minions.find(m => m.id === result.targetId) ??
          this.structures.find(s => s.id === result.targetId);
        if (target && target.isAlive) {
          target.takeDamage(result.damage);
        }
      }

      // メッシュ同期
      const mesh = this.meshes.get(minion.id);
      if (mesh) {
        mesh.position.set(minion.x, minion.y, minion.z);
      }
    }

    // 死亡ミニオン削除
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
      const offsetX = (i - 1) * 1.5; // 3体を横に少しずらす
      const minion = new Minion(id, team, SPAWN_X + offsetX, SPAWN_Y, z);
      this.minions.push(minion);
      this.ais.set(id, new MinionAI(minion));
      this.knockbacks.set(id, createKnockbackState());

      // メッシュ生成（プレースホルダー: 色付きボックス。後でMobModelに差し替え）
      const color = team === 'blue' ? 0x4488ff : 0xff4444;
      const geometry = new THREE.BoxGeometry(0.6, 0.8, 0.6);
      const material = new THREE.MeshLambertMaterial({ color });
      const mesh = new THREE.Group();
      const box = new THREE.Mesh(geometry, material);
      mesh.add(box);
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
```

**注意:** メッシュ生成は最初はプレースホルダー（色付きBoxGeometry）で実装する。Task 12のGame.ts統合時にMobModel/SkinParser/Animatorで羊モデルに差し替える。これにより、ミニオンのゲームプレイロジックを先にテスト・動作確認できる。

- [ ] **Step 3: テスト実行**

Run: `npx vitest run src/entity/MinionWaveManager.test.ts`
Expected: 全テストパス

- [ ] **Step 4: コミット**

```bash
git add src/entity/MinionWaveManager.ts src/entity/MinionWaveManager.test.ts
git commit -m "feat: add MinionWaveManager with wave spawning and AI orchestration"
```

---

### Task 11: ViewMode + プレイヤーモデル — 一人称/三人称切り替え

**Files:**
- Create: `src/player/ViewMode.ts`
- Create: `src/player/ViewMode.test.ts`

- [ ] **Step 1: テスト作成**

```typescript
// src/player/ViewMode.test.ts
import { describe, it, expect } from 'vitest';
import { ViewMode, ViewModeType } from './ViewMode';

describe('ViewMode', () => {
  it('starts in first-person mode', () => {
    const vm = new ViewMode();
    expect(vm.current).toBe('first-person');
  });

  it('cycles through modes on toggle', () => {
    const vm = new ViewMode();
    vm.toggle();
    expect(vm.current).toBe('third-person-back');
    vm.toggle();
    expect(vm.current).toBe('third-person-front');
    vm.toggle();
    expect(vm.current).toBe('first-person');
  });

  it('reports isFirstPerson correctly', () => {
    const vm = new ViewMode();
    expect(vm.isFirstPerson).toBe(true);
    vm.toggle();
    expect(vm.isFirstPerson).toBe(false);
  });

  it('computes camera offset for third-person-back', () => {
    const vm = new ViewMode();
    vm.toggle(); // → third-person-back
    const offset = vm.getCameraOffset(0, 0, -1); // 前方を向いている
    expect(offset.z).toBeGreaterThan(0); // 後ろに下がる
  });

  it('computes camera offset for third-person-front', () => {
    const vm = new ViewMode();
    vm.toggle(); // → third-person-back
    vm.toggle(); // → third-person-front
    const offset = vm.getCameraOffset(0, 0, -1);
    expect(offset.z).toBeLessThan(0); // 前方に出る
  });
});
```

- [ ] **Step 2: ViewMode実装**

```typescript
// src/player/ViewMode.ts

export type ViewModeType = 'first-person' | 'third-person-back' | 'third-person-front';

export const THIRD_PERSON_DISTANCE = 4.0;

const MODE_CYCLE: ViewModeType[] = ['first-person', 'third-person-back', 'third-person-front'];

export class ViewMode {
  private modeIndex = 0;

  get current(): ViewModeType {
    return MODE_CYCLE[this.modeIndex];
  }

  get isFirstPerson(): boolean {
    return this.current === 'first-person';
  }

  toggle(): void {
    this.modeIndex = (this.modeIndex + 1) % MODE_CYCLE.length;
  }

  /**
   * 三人称カメラのオフセットを計算する。
   * @param forwardX カメラの前方向X
   * @param forwardY カメラの前方向Y
   * @param forwardZ カメラの前方向Z
   */
  getCameraOffset(forwardX: number, forwardY: number, forwardZ: number): { x: number; y: number; z: number } {
    if (this.current === 'first-person') {
      return { x: 0, y: 0, z: 0 };
    }

    const sign = this.current === 'third-person-back' ? -1 : 1;
    return {
      x: forwardX * sign * THIRD_PERSON_DISTANCE,
      y: 1.0, // 少し上から見下ろす
      z: forwardZ * sign * THIRD_PERSON_DISTANCE,
    };
  }
}
```

- [ ] **Step 3: テスト実行**

Run: `npx vitest run src/player/ViewMode.test.ts`
Expected: 全テストパス

- [ ] **Step 4: コミット**

```bash
git add src/player/ViewMode.ts src/player/ViewMode.test.ts
git commit -m "feat: add ViewMode for first/third-person camera switching"
```

---

### Task 12: Game.ts統合 — 全システム接続

**Files:**
- Modify: `src/engine/Game.ts`
- Modify: `src/player/Player.ts`

**注意:** このタスクは全タスクの中で最も大きい。段階的に進める。

- [ ] **Step 1: Player.tsにノックバックフィールドを追加**

```typescript
// Player.ts に追加
import { KnockbackState, createKnockbackState, updateKnockback, hasKnockback } from '../physics/Knockback';

export class Player {
  // 既存フィールド
  knockback: KnockbackState = createKnockbackState();

  // updatePhysics内でノックバック適用
  updatePhysics(dt: number): void {
    // ノックバック水平移動
    if (hasKnockback(this.knockback)) {
      const kbX = this.knockback.vx * dt;
      const kbZ = this.knockback.vz * dt;
      if (kbX !== 0) this.x = this.moveAxis('x', kbX);
      if (kbZ !== 0) this.z = this.moveAxis('z', kbZ);
      updateKnockback(this.knockback, dt);
    }

    // 既存の重力処理
    this.velocityY -= GRAVITY * dt;
    this.velocityY = Math.max(this.velocityY, -TERMINAL_VELOCITY);
    this.moveAxisY(this.velocityY * dt);
  }

  // moveAxisをpublicに変更（ノックバックからアクセスするため）
  moveAxis(axis: 'x' | 'z', delta: number): number { ... }
}
```

- [ ] **Step 2: Game.tsにインポートを追加**

```typescript
import { MinionWaveManager } from '../entity/MinionWaveManager';
import { ViewMode } from '../player/ViewMode';
import { applyKnockback } from '../physics/Knockback';
import { ProjectileTarget } from '../entity/Projectile';
```

- [ ] **Step 3: Game.tsにフィールドを追加**

```typescript
private minionWaveManager!: MinionWaveManager;
private viewMode!: ViewMode;
// playerModel関連（MobModel統合後に追加）
```

- [ ] **Step 4: init()でMinionWaveManagerとViewModeを初期化**

```typescript
this.minionWaveManager = new MinionWaveManager(this.renderer.scene, this.structures);
this.viewMode = new ViewMode();
```

- [ ] **Step 5: update()のシミュレーションセクションにミニオン更新を追加**

```typescript
// ミニオンウェーブ更新
this.minionWaveManager.update(dt, this.structures);

// TowerAI更新をミニオン対応に変更
for (const ai of this.towerAIs) {
  if (ai.structure.team === 'blue') continue;
  const playerTarget: ProjectileTarget = {
    x: this.player.x,
    y: this.player.y + PLAYER_HEIGHT / 2,
    z: this.player.z,
    isAlive: this.playerState.isAlive,
  };
  const enemyMinions = this.minionWaveManager.getTeamMinions('blue');
  const cmd = ai.update(dt, playerTarget, enemyMinions);
  if (cmd) {
    // ターゲット決定: ミニオンかプレイヤーか
    let target: ProjectileTarget;
    if (cmd.targetId) {
      const minion = enemyMinions.find(m => m.id === cmd.targetId);
      if (minion) target = minion;
      else target = playerTarget;
    } else {
      target = playerTarget;
    }
    this.projectileManager.spawn(cmd, target);
  }
}

// Blue側タワーも同様（Red側ミニオンを攻撃）
for (const ai of this.towerAIs) {
  if (ai.structure.team === 'red') continue;
  const enemyMinions = this.minionWaveManager.getTeamMinions('red');
  // Blue側タワーはRedミニオンを攻撃（プレイヤーは味方なので攻撃しない）
  const dummyPlayer = { x: 0, y: -999, z: 0, isAlive: false };
  const cmd = ai.update(dt, dummyPlayer, enemyMinions);
  if (cmd && cmd.targetId) {
    const minion = enemyMinions.find(m => m.id === cmd.targetId);
    if (minion) this.projectileManager.spawn(cmd, minion);
  }
}
```

- [ ] **Step 6: プロジェクタイルヒット時のダメージ＋ノックバック処理**

```typescript
// プロジェクタイルヒット時（プレイヤー/ミニオンを判別して処理）
const playerTarget = this.playerProjectileTarget; // Step 5で作成したアダプター
for (const hit of projectileHits) {
  if (hit.target === playerTarget) {
    // プレイヤーへの命中
    if (!this.playerState.isInvincible()) {
      this.playerState.takeDamage(hit.damage);
      this.screenShake.trigger();
      this.hud.triggerDamageFlash();
      // ノックバック: タワー中心からプレイヤーへの方向
      const tower = this.towerAIs.find(ai => ai.structure.team === hit.team);
      if (tower) {
        applyKnockback(this.player.knockback,
          tower.getCenterX(), tower.getCenterY(), tower.getCenterZ(),
          this.player.x, this.player.y, this.player.z);
        this.player.velocityY += KNOCKBACK_VERTICAL;
      }
    }
  } else {
    // ミニオンへの命中: targetはMinion（Entity）なのでtakeDamageを呼ぶ
    const minion = hit.target as Entity;
    if (minion.isAlive) {
      minion.takeDamage(hit.damage);
      // ミニオンのノックバック
      const kb = this.minionWaveManager.getKnockback(minion.id);
      if (kb) {
        const tower = this.towerAIs.find(ai => ai.structure.team === hit.team);
        if (tower) {
          applyKnockback(kb,
            tower.getCenterX(), tower.getCenterY(), tower.getCenterZ(),
            minion.x, minion.y, minion.z);
        }
      }
    }
  }
}
```

- [ ] **Step 7: F5キーによる視点切り替え**

```typescript
// 入力処理セクション内
if (this.input.consumeKeyPress('F5')) {
  this.viewMode.toggle();
}

// カメラ位置更新（視点モードに応じて）
if (this.viewMode.isFirstPerson) {
  this.renderer.fpsCamera.setPosition(
    this.player.eyeX, this.player.eyeY, this.player.eyeZ,
  );
} else {
  const forward = this.renderer.fpsCamera.getForward();
  const offset = this.viewMode.getCameraOffset(forward.x, forward.y, forward.z);
  this.renderer.fpsCamera.setPosition(
    this.player.eyeX + offset.x,
    this.player.eyeY + offset.y,
    this.player.eyeZ + offset.z,
  );
}
```

- [ ] **Step 8: テスト実行**

Run: `npx vitest run`
Expected: 全テストパス

- [ ] **Step 9: 手動テスト**

Run: `npx vite`
確認項目:
- [ ] ミニオンが30秒ごとにウェーブスポーンする
- [ ] Blue/Red両チームのミニオンがレーンを歩く
- [ ] ミニオン同士が遭遇すると戦闘する
- [ ] タワーがミニオンを優先攻撃する
- [ ] F5キーで視点が切り替わる
- [ ] ダメージ時にノックバックする
- [ ] プレイヤーHP=500が正しく動作する

- [ ] **Step 10: コミット**

```bash
git add -A
git commit -m "feat: integrate minions, knockback, view mode into game loop

- MinionWaveManager spawns waves every 30s from both nexuses
- TowerAI targets minions over players
- Projectiles track individual entity targets
- F5 toggles first/third-person camera
- Knockback on player damage
- Player HP rebalanced to 500"
```

---

### Task 13: 羊モデル統合 — プレースホルダーをMobModelに差し替え

**Files:**
- Modify: `src/entity/MinionWaveManager.ts`
- Modify: `src/engine/Game.ts`

- [ ] **Step 1: テクスチャ読み込みユーティリティ追加**

Game.tsのinit()で羊スキンテクスチャを読み込む:

```typescript
// テクスチャ読み込み（THREE.TextureLoaderを使用）
const textureLoader = new THREE.TextureLoader();
const sheepBlueTexture = await textureLoader.loadAsync('/textures/mobs/minion_blue.png');
sheepBlueTexture.magFilter = THREE.NearestFilter;
sheepBlueTexture.minFilter = THREE.NearestFilter;
const sheepRedTexture = await textureLoader.loadAsync('/textures/mobs/minion_red.png');
sheepRedTexture.magFilter = THREE.NearestFilter;
sheepRedTexture.minFilter = THREE.NearestFilter;
```

- [ ] **Step 2: MinionWaveManagerにモデルビルダー注入**

MinionWaveManagerのコンストラクタにモデル生成コールバックを追加:

```typescript
constructor(
  private scene: THREE.Scene,
  private structures: Structure[],
  private buildMinionModel: (team: Team) => THREE.Group,
) {}

// spawnWave内でプレースホルダーをモデルに差し替え
private spawnWave(team: Team): void {
  // ...
  const mesh = this.buildMinionModel(team);
  mesh.position.set(minion.x, minion.y, minion.z);
  this.scene.add(mesh);
  this.meshes.set(id, mesh);
}
```

- [ ] **Step 3: Game.tsでモデルビルダーを渡す**

```typescript
import { buildModel } from '../model/MobModel';
import { SHEEP_MODEL } from '../model/ModelDefinitions';

this.minionWaveManager = new MinionWaveManager(
  this.renderer.scene,
  this.structures,
  (team) => buildModel(SHEEP_MODEL, team === 'blue' ? sheepBlueTexture : sheepRedTexture),
);
```

- [ ] **Step 4: Animator統合**

MinionWaveManagerのupdate内でAnimator更新を追加:

```typescript
// 各ミニオンにWalkAnimatorを持たせ、update内で更新
const isMoving = result.state === 'walking' || result.state === 'returning';
const angles = animator.update(dt, isMoving, MINION_MOVE_SPEED);
// mesh内のパーツにrotation適用
```

- [ ] **Step 5: テスト実行 + 手動確認**

Run: `npx vitest run`
Expected: 全テストパス

手動確認: ミニオンが羊モデルで表示され、歩行アニメーションが付いている

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "feat: replace minion placeholder with sheep model and walk animation"
```

---

### Task 14: プレイヤーモデル — 一人称アーム＋三人称全身

**Files:**
- Modify: `src/engine/Game.ts`

- [ ] **Step 1: プレイヤーテクスチャ読み込み**

```typescript
const playerTexture = await textureLoader.loadAsync('/textures/mobs/player_default.png');
playerTexture.magFilter = THREE.NearestFilter;
playerTexture.minFilter = THREE.NearestFilter;
```

- [ ] **Step 2: プレイヤーモデル作成**

```typescript
import { PLAYER_MODEL } from '../model/ModelDefinitions';

const playerModel = buildModel(PLAYER_MODEL, playerTexture);
playerModel.visible = false; // 一人称時は非表示
this.renderer.scene.add(playerModel);
```

- [ ] **Step 3: 一人称アームモデル作成**

```typescript
// 右腕パーツのみ取り出してカメラの子に追加
const armModel = buildModel(PLAYER_MODEL, playerTexture);
// head, body, leftArm, leftLeg, rightLeg を非表示にし、rightArmのみ表示
for (const child of armModel.children) {
  if ((child as THREE.Group).name !== 'rightArm') {
    (child as THREE.Object3D).visible = false;
  }
}
// カメラの子として配置（画面右下）
armModel.position.set(0.4, -0.3, -0.5);
this.renderer.fpsCamera.camera.add(armModel);
```

- [ ] **Step 4: update内でモデル同期**

```typescript
// 三人称モデルをプレイヤー座標に追従
playerModel.position.set(this.player.x, this.player.y, this.player.z);

// 視点切り替え時の表示切り替え
if (this.viewMode.isFirstPerson) {
  playerModel.visible = false;
  armModel.visible = true;
} else {
  playerModel.visible = true;
  armModel.visible = false;
}
```

- [ ] **Step 5: テスト実行 + 手動確認**

Run: `npx vitest run`
Expected: 全テストパス

手動確認:
- [ ] 一人称で右腕が画面右下に表示
- [ ] F5で三人称に切り替えると全身モデル表示
- [ ] 歩行時にアニメーション

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "feat: add player character model with first/third-person rendering"
```

---

## 依存関係

```
Task 1 (Balance) ─────────────────────────────────┐
Task 2 (SkinParser) ──┐                           │
Task 3 (ModelDefs) ───┤                           │
                      ├── Task 4 (MobModel) ──┐   │
                      │                       ├── Task 13 (羊モデル統合) ──┐
Task 5 (Animator) ────┘                       │                          │
                                              ├── Task 14 (プレイヤーモデル)│
Task 6 (Knockback) ──────────────────────────┐│                          │
                                             ││                          │
Task 7 (Minion+AI) ─────┐                   ││                          │
                         ├── Task 10 (WaveManager) ──────────────────────┤
Task 8 (Projectile refactor) ──┤                                        │
                               ├── Task 9 (TowerAI) ───────────────────┤
                               │                                       │
Task 11 (ViewMode) ────────────────────────────────── Task 12 (Game.ts統合)
```

**並列実行可能なグループ:**
- Group A: Task 1, Task 2, Task 3, Task 5, Task 6, Task 7, Task 11（全て独立）
- Group B: Task 4（Task 2, 3依存）, Task 8（独立リファクタ）
- Group C: Task 9（Task 8依存）, Task 10（Task 7依存）
- Group D: Task 12（Task 1,8,9,10,11依存）
- Group E: Task 13（Task 4,10依存）, Task 14（Task 4,12依存）
