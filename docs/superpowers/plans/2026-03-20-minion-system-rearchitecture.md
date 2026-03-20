# ミニオンシステム リアーキテクチャ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ミニオンの物理・AI・テクスチャ・UIを根本的に修正し、LoL準拠の挙動と正しいMinecraftモデル表示を実現する。

**Architecture:** Player.tsの物理ロジックをEntityPhysicsに抽出しMinion/Playerが共有する。MinionAIをwalking/chasing/attackingの明確なステートマシンに書き直す。SHEEP_MODELをMinecraftデコンパイルソース準拠に修正し、ダメージフラッシュ・HPバーを追加する。

**Tech Stack:** TypeScript, Three.js, Vitest, pngjs

**Spec:** `docs/superpowers/specs/2026-03-20-minion-system-rearchitecture-design.md`

---

## ファイル構成

### 新設
| ファイル | 責務 |
|---------|------|
| `src/physics/EntityPhysics.ts` | 重力・AABB衝突・ジャンプの共通物理 |
| `src/physics/EntityPhysics.test.ts` | EntityPhysicsのテスト |
| `src/model/DamageFlash.ts` | ダメージフラッシュエフェクト |
| `src/model/DamageFlash.test.ts` | DamageFlashのテスト |
| `src/ui/HealthBar3D.ts` | ミニオン頭上HPバー |
| `src/ui/HealthBar3D.test.ts` | HealthBar3Dのテスト |
| `scripts/generate-placeholder-textures.ts` | プレースホルダテクスチャ生成 |

### 大幅修正
| ファイル | 内容 |
|---------|------|
| `src/entity/MinionAI.ts` | ステートマシン完全書き直し |
| `src/entity/MinionAI.test.ts` | テスト全面書き直し |
| `src/entity/Minion.ts` | velocityY/onGround追加 |
| `src/entity/MinionWaveManager.ts` | 物理統合、アニメーション統一 |
| `src/entity/MinionWaveManager.test.ts` | テスト更新 |
| `src/model/ModelDefinitions.ts` | SHEEP_MODEL修正、forwardAngle追加 |
| `src/player/Player.ts` | EntityPhysicsに委譲 |
| `src/player/Player.test.ts` | EntityPhysics経由のテストに更新 |

### 軽微修正
| ファイル | 内容 |
|---------|------|
| `src/physics/Pathfinding.ts` | フォールバック修正、マージン対称化 |
| `src/physics/Pathfinding.test.ts` | テスト追加 |
| `src/physics/Knockback.ts` | vy削除 |
| `src/physics/Knockback.test.ts` | テスト更新 |
| `src/model/MobModel.ts` | forwardAngle対応 |
| `src/engine/Game.ts` | ダメージフラッシュ・クリーンアップ統合 |

---

### Task 1: EntityPhysics — 共通物理エンジンの新設

**Files:**
- Create: `src/physics/EntityPhysics.ts`
- Create: `src/physics/EntityPhysics.test.ts`
- Reference: `src/player/Player.ts` (物理ロジック抽出元)

- [ ] **Step 1: EntityBodyインタフェースと重力テストを書く**

```typescript
// src/physics/EntityPhysics.test.ts
import { describe, it, expect } from 'vitest';
import { applyGravity, EntityBody, GRAVITY, TERMINAL_VELOCITY } from './EntityPhysics';

function makeBody(overrides: Partial<EntityBody> = {}): EntityBody {
  return { x: 5, y: 10, z: 5, width: 0.6, height: 1.8, velocityY: 0, onGround: false, ...overrides };
}

// テスト用のシンプルなワールド（Y=3に地面ブロック）
function makeWorld(groundY = 3) {
  return {
    getBlock: (x: number, y: number, z: number) => {
      if (y <= groundY && y >= 0) return { type: 1 }; // 固体ブロック
      return null;
    },
  };
}

describe('EntityPhysics', () => {
  describe('applyGravity', () => {
    it('applies gravity to velocityY', () => {
      const body = makeBody({ y: 10, velocityY: 0, onGround: false });
      applyGravity(body, 0.1, makeWorld(-100)); // 地面なし
      expect(body.velocityY).toBeLessThan(0);
    });

    it('sets onGround when landing', () => {
      const body = makeBody({ y: 4.5, velocityY: -5, onGround: false });
      applyGravity(body, 0.5, makeWorld(3));
      expect(body.onGround).toBe(true);
      expect(body.velocityY).toBe(0);
    });

    it('caps velocityY at TERMINAL_VELOCITY', () => {
      const body = makeBody({ y: 100, velocityY: -100, onGround: false });
      applyGravity(body, 0.1, makeWorld(-100));
      expect(body.velocityY).toBeGreaterThanOrEqual(-TERMINAL_VELOCITY);
    });
  });
});
```

- [ ] **Step 2: テスト実行 → FAIL確認**

Run: `npx vitest run src/physics/EntityPhysics.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: EntityPhysics基本実装（applyGravity）**

```typescript
// src/physics/EntityPhysics.ts
import type { World } from '../world/World';

export interface EntityBody {
  x: number; y: number; z: number;
  width: number;  // XZ断面は正方形 (width x width)
  height: number; // Y軸の高さ
  velocityY: number;
  onGround: boolean;
}

export const GRAVITY = 32;
export const JUMP_VELOCITY = 9.0;
export const TERMINAL_VELOCITY = 78.4;

export function applyGravity(body: EntityBody, dt: number, world: { getBlock: (x: number, y: number, z: number) => unknown | null }): void {
  body.velocityY -= GRAVITY * dt;
  if (body.velocityY < -TERMINAL_VELOCITY) {
    body.velocityY = -TERMINAL_VELOCITY;
  }
  const newY = body.y + body.velocityY * dt;
  if (body.velocityY <= 0 && collidesAt(body, body.x, newY, body.z, world)) {
    body.y = Math.ceil(newY + body.height) - body.height; // 地面に合わせる
    body.velocityY = 0;
    body.onGround = true;
  } else {
    body.y = newY;
    body.onGround = false;
  }
}

function collidesAt(
  body: EntityBody, px: number, py: number, pz: number,
  world: { getBlock: (x: number, y: number, z: number) => unknown | null },
): boolean {
  const hw = body.width / 2;
  const minX = Math.floor(px - hw);
  const maxX = Math.floor(px + hw);
  const minY = Math.floor(py);
  const maxY = Math.floor(py + body.height);
  const minZ = Math.floor(pz - hw);
  const maxZ = Math.floor(pz + hw);
  for (let bx = minX; bx <= maxX; bx++) {
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        if (world.getBlock(bx, by, bz)) return true;
      }
    }
  }
  return false;
}
```

Note: この実装はPlayer.tsのcollides/moveAxisYロジックを参考に、EntityBody向けに汎化したもの。正確な着地位置計算はPlayer.tsの実装を参照して調整すること。

- [ ] **Step 4: テスト実行 → PASS確認**

Run: `npx vitest run src/physics/EntityPhysics.test.ts`
Expected: PASS

- [ ] **Step 5: moveWithCollision、tryJump、applyEntityKnockbackのテスト追加**

```typescript
// EntityPhysics.test.tsに追加
import { moveWithCollision, tryJump, JUMP_VELOCITY } from './EntityPhysics';

describe('moveWithCollision', () => {
  it('moves freely when no obstacles', () => {
    const body = makeBody({ x: 5, z: 5 });
    moveWithCollision(body, 1, 0, makeWorld(3));
    expect(body.x).toBeCloseTo(6);
  });

  it('stops at wall', () => {
    const body = makeBody({ x: 5, y: 4, z: 5 });
    // 壁ワールド: x=6に壁
    const wallWorld = {
      getBlock: (x: number, y: number, z: number) => {
        if (y <= 3) return { type: 1 }; // 地面
        if (x === 6 && y === 4) return { type: 1 }; // 壁
        return null;
      },
    };
    moveWithCollision(body, 2, 0, wallWorld);
    expect(body.x).toBeLessThan(6);
  });
});

describe('tryJump', () => {
  it('sets velocityY when on ground', () => {
    const body = makeBody({ onGround: true, velocityY: 0 });
    const jumped = tryJump(body);
    expect(jumped).toBe(true);
    expect(body.velocityY).toBe(JUMP_VELOCITY);
  });

  it('does nothing when in air', () => {
    const body = makeBody({ onGround: false, velocityY: -1 });
    const jumped = tryJump(body);
    expect(jumped).toBe(false);
    expect(body.velocityY).toBe(-1);
  });
});
```

- [ ] **Step 6: moveWithCollision、tryJump、applyEntityKnockback実装**

```typescript
// EntityPhysics.tsに追加
import { KnockbackState, hasKnockback, updateKnockback, KNOCKBACK_VERTICAL } from './Knockback';

export function applyEntityKnockback(
  body: EntityBody, kb: KnockbackState, dt: number,
  world: { getBlock: (x: number, y: number, z: number) => unknown | null },
): void {
  if (!hasKnockback(kb)) return;
  // ノックバック移動をmoveWithCollision経由で適用（壁すり抜け防止）
  moveWithCollision(body, kb.vx * dt, kb.vz * dt, world);
  updateKnockback(kb, dt);
}

export function moveWithCollision(
  body: EntityBody, dx: number, dz: number,
  world: { getBlock: (x: number, y: number, z: number) => unknown | null },
): void {
  // X軸方向の移動（ステッピング）
  if (dx !== 0) {
    const step = body.width / 2;
    const steps = Math.ceil(Math.abs(dx) / step);
    const stepDx = dx / steps;
    for (let i = 0; i < steps; i++) {
      const newX = body.x + stepDx;
      if (!collidesAt(body, newX, body.y, body.z, world)) {
        body.x = newX;
      } else {
        break;
      }
    }
  }
  // Z軸方向の移動（ステッピング）
  if (dz !== 0) {
    const step = body.width / 2;
    const steps = Math.ceil(Math.abs(dz) / step);
    const stepDz = dz / steps;
    for (let i = 0; i < steps; i++) {
      const newZ = body.z + stepDz;
      if (!collidesAt(body, body.x, body.y, newZ, world)) {
        body.z = newZ;
      } else {
        break;
      }
    }
  }
}

export function tryJump(body: EntityBody): boolean {
  if (body.onGround) {
    body.velocityY = JUMP_VELOCITY;
    body.onGround = false;
    return true;
  }
  return false;
}
```

- [ ] **Step 7: 全テスト実行 → PASS確認**

Run: `npx vitest run src/physics/EntityPhysics.test.ts`
Expected: ALL PASS

- [ ] **Step 8: コミット**

```bash
git add src/physics/EntityPhysics.ts src/physics/EntityPhysics.test.ts
git commit -m "feat: add EntityPhysics shared physics engine"
```

---

### Task 2: Player.tsをEntityPhysicsに移行

**Files:**
- Modify: `src/player/Player.ts`
- Modify: `src/player/Player.test.ts`
- Reference: `src/physics/EntityPhysics.ts`

- [ ] **Step 1: Player.tsにEntityBodyフィールドを追加し、updatePhysicsをEntityPhysicsに委譲**

Player.tsの`updatePhysics`内の重力処理・ノックバック処理をEntityPhysicsの`applyGravity`と`moveWithCollision`の呼び出しに置き換える。`move`メソッドもmoveWithCollision経由にする。

Player固有の部分（eyeHeight getters、カメラ連動）はそのまま残す。`GRAVITY`、`JUMP_VELOCITY`、`TERMINAL_VELOCITY`はEntityPhysicsからre-exportする。

- [ ] **Step 2: 既存のPlayer.test.tsを実行 → 全PASSを確認**

Run: `npx vitest run src/player/Player.test.ts`
Expected: ALL PASS（リファクタリングなので既存テストがそのまま通ること）

- [ ] **Step 3: 全テストスイート実行**

Run: `npx vitest run`
Expected: ALL 210+ tests PASS

- [ ] **Step 4: コミット**

```bash
git add src/player/Player.ts
git commit -m "refactor: Player.ts delegates physics to EntityPhysics"
```

---

### Task 3: Knockback.ts修正 — vy削除とEntityPhysics統合

**Files:**
- Modify: `src/physics/Knockback.ts`
- Modify: `src/physics/Knockback.test.ts`

- [ ] **Step 1: KnockbackStateからvyを削除するテストを更新**

Knockback.test.tsの既存テストで`vy`を参照している箇所を削除。`applyKnockback`がvxとvzのみを設定することを確認するテストに変更。

- [ ] **Step 2: Knockback.tsからvy関連コードを削除**

- `KnockbackState`から`vy`フィールド削除
- `applyKnockback`から`state.vy = KNOCKBACK_VERTICAL`行を削除
- `updateKnockback`から`state.vy = 0`行を削除
- `KNOCKBACK_VERTICAL`はexportを維持（Game.tsのvelocityY加算で使用）

- [ ] **Step 3: テスト実行 → PASS確認**

Run: `npx vitest run src/physics/Knockback.test.ts`
Expected: ALL PASS

- [ ] **Step 4: 全テストスイート実行（依存するGame.ts等の修正が必要な場合はここで対応）**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add src/physics/Knockback.ts src/physics/Knockback.test.ts
git commit -m "refactor: remove vy from KnockbackState, use velocityY directly"
```

---

### Task 4: Pathfinding修正 — フォールバックとマージン

**Files:**
- Modify: `src/physics/Pathfinding.ts`
- Modify: `src/physics/Pathfinding.test.ts`

- [ ] **Step 1: フォールバック修正のテストを追加**

```typescript
// Pathfinding.test.tsに追加
it('returns empty array when path is unreachable', () => {
  // 完全にブロックされた壁を作る
  const blocked = new Set<string>();
  for (let x = LANE_X_MIN; x <= LANE_X_MAX; x++) {
    blocked.add(`${x},50`);
  }
  const path = findPath(9, 45, 9, 55, blocked);
  expect(path.length).toBe(0);
});

it('has symmetric obstacle margins', () => {
  const s = createStructure(8, 70, 3, 3); // X=8-11, Z=70-73
  const blocked = buildObstacleMap([s]);
  // min側マージン
  expect(blocked.has('7,69')).toBe(true);
  // max側マージン
  expect(blocked.has('11,73')).toBe(true);
});
```

- [ ] **Step 2: テスト実行 → FAIL確認**

Run: `npx vitest run src/physics/Pathfinding.test.ts`
Expected: FAIL（現在はフォールバックで直線パスを返す / マージンが非対称）

- [ ] **Step 3: Pathfinding.ts修正**

1. L163: `return [{ x: goalX, z: goalZ }]` → `return []`
2. L33-36: 障害物マージンを対称化
```typescript
const minX = Math.floor(s.x) - 1;
const maxX = Math.floor(s.x + s.width) + 1; // +1追加
const minZ = Math.floor(s.z) - 1;
const maxZ = Math.floor(s.z + s.depth) + 1; // +1追加
```

- [ ] **Step 4: テスト実行 → PASS確認**

Run: `npx vitest run src/physics/Pathfinding.test.ts`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add src/physics/Pathfinding.ts src/physics/Pathfinding.test.ts
git commit -m "fix: pathfinding returns empty on failure, symmetric obstacle margins"
```

---

### Task 5: MinionAIステートマシン書き直し

**Files:**
- Rewrite: `src/entity/MinionAI.ts`
- Rewrite: `src/entity/MinionAI.test.ts`
- Reference: `src/entity/Minion.ts`, `src/entity/Structure.ts`

- [ ] **Step 1: ステートマシン遷移のテストを書く**

MinionAI.test.tsを全面書き直し。以下のテストケースを含む:
- walking: 敵構造物に向かって移動（moveZ > 0 for blue）
- walking→chasing: DETECTION_RANGE内に敵ミニオンが入った
- chasing→attacking: ATTACK_RANGE内に到達
- attacking→walking: ターゲットがLEASH_RANGE外に移動
- attacking: ダメージタイマーが経過したらdamage > 0
- walking中の構造物攻撃: 攻撃射程内の未保護敵構造物を攻撃
- ターゲット優先順位: 自分を攻撃中の敵 > 最も近い敵ミニオン > プレイヤー
- shouldJump: MinionAIResultにshouldJumpフラグが含まれること

- [ ] **Step 2: テスト実行 → FAIL確認**

Run: `npx vitest run src/entity/MinionAI.test.ts`
Expected: FAIL

- [ ] **Step 3: MinionAI.ts完全書き直し**

```typescript
export type MinionAIState = 'walking' | 'chasing' | 'attacking';

export interface MinionAIResult {
  state: MinionAIState;
  moveX: number;
  moveZ: number;
  targetId: string | null;
  damage: number;
  shouldJump: boolean;
}

export const DETECTION_RANGE = 8.0;
export const LEASH_RANGE = 12.0;

export class MinionAI {
  private state: MinionAIState = 'walking';
  private currentTarget: Entity | null = null;
  private pathFailCount = 0;
  private waypoints: { x: number; z: number }[] = [];
  private waypointIndex = 0;
  private pathTimer = PATH_RECALC_INTERVAL;

  update(dt, allMinions, structures, attackingMeId?, enemyPlayer?): MinionAIResult {
    if (!this.minion.isAlive) return idle result;
    switch (this.state) {
      case 'walking': return this.updateWalking(dt, ...);
      case 'chasing': return this.updateChasing(dt, ...);
      case 'attacking': return this.updateAttacking(dt, ...);
    }
  }
}
```

**updateWalking詳細:**
1. DETECTION_RANGE内の敵をスキャン → 見つかったら`state = 'chasing'`, `currentTarget = enemy`
2. 攻撃射程内の未保護敵構造物チェック → あれば停止して攻撃（stateはwalkingのまま）
3. A*でfindNearestEnemyStructureに向かう。パス再計算は2秒ごと
4. findPathが空配列を返したら`pathFailCount++`、pathTimerを0.5秒に短縮
5. `pathFailCount >= 3`で直線移動フォールバック（パス成功でリセット）
6. moveToward()でウェイポイントに向かう

**updateChasing詳細:**
1. currentTargetが死亡/null → `state = 'walking'`
2. ターゲットとの距離 > LEASH_RANGE → `state = 'walking'`
3. ターゲットとの距離 <= ATTACK_RANGE → `state = 'attacking'`
4. A*でcurrentTargetの位置に向かう

**updateAttacking詳細:**
1. currentTargetが死亡/null → `state = 'walking'`
2. ターゲットとの距離 > LEASH_RANGE → `state = 'walking'`
3. ターゲットとの距離 > ATTACK_RANGE → `state = 'chasing'`
4. 停止してtryAttack(dt) → damage返却

**ターゲット選択 (findTarget):**
1. attackingMeIdに該当する敵（DETECTION_RANGE内）
2. 最も近い敵ミニオン（DETECTION_RANGE内）
3. 敵プレイヤー（DETECTION_RANGE内）

- [ ] **Step 4: テスト実行 → PASS確認**

Run: `npx vitest run src/entity/MinionAI.test.ts`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add src/entity/MinionAI.ts src/entity/MinionAI.test.ts
git commit -m "feat: rewrite MinionAI as walking/chasing/attacking state machine"
```

---

### Task 6: ModelDefinitions修正 — SHEEP_MODEL + forwardAngle

**Files:**
- Modify: `src/model/ModelDefinitions.ts`
- Modify: `src/model/MobModel.ts`
- Create or modify: `src/model/ModelDefinitions.test.ts`

- [ ] **Step 1: SHEEP_MODELの正しい値をテストで定義**

```typescript
// ModelDefinitions.test.tsに追加
import { SHEEP_MODEL, PLAYER_MODEL } from './ModelDefinitions';

describe('SHEEP_MODEL Minecraft compliance', () => {
  it('head has correct dimensions (ModelSheep2.java: 6,6,8)', () => {
    const head = SHEEP_MODEL.parts.find(p => p.name === 'head')!;
    expect(head.size).toEqual([6, 6, 8]);
    expect(head.skinRegion).toEqual({ originX: 0, originY: 0, w: 6, h: 6, d: 8 });
  });

  it('body has correct dimensions (ModelSheep2.java: 8,16,6 at 28,8)', () => {
    const body = SHEEP_MODEL.parts.find(p => p.name === 'body')!;
    expect(body.size).toEqual([8, 16, 6]);
    expect(body.skinRegion).toEqual({ originX: 28, originY: 8, w: 8, h: 16, d: 6 });
  });

  it('has forwardAngle defined', () => {
    expect(typeof SHEEP_MODEL.forwardAngle).toBe('number');
  });
});
```

- [ ] **Step 2: テスト実行 → FAIL確認**

- [ ] **Step 3: ModelDefinitions.ts修正**

```typescript
export interface ModelDefinition {
  parts: PartDefinition[];
  textureWidth: number;
  textureHeight: number;
  pixelScale: number;
  forwardAngle: number; // モデルのデフォルト前方向（ラジアン）
}

// Minecraft ModelSheep2.java (decompiled 1.8.9) 準拠
// Head: texOffs(0,0), addBox(-3,-4,-6, 6,6,8)
// Body: texOffs(28,8), addBox(-4,-10,-7, 8,16,6)
// Legs: texOffs(0,16), addBox(-2,0,-2, 4,12,4)
export const SHEEP_MODEL: ModelDefinition = {
  textureWidth: 64,
  textureHeight: 32, // Minecraft標準は64x32
  pixelScale: 1 / 16,
  forwardAngle: 0, // -Z方向が前、調整はテスト時に確認
  parts: [
    { name: 'head', size: [6, 6, 8], pivot: [0, 18, -8],
      skinRegion: { originX: 0, originY: 0, w: 6, h: 6, d: 8 }, anchor: 'bottom' },
    { name: 'body', size: [8, 16, 6], pivot: [0, 13, 0],
      skinRegion: { originX: 28, originY: 8, w: 8, h: 16, d: 6 }, anchor: 'bottom' },
    { name: 'rightFrontLeg', size: [4, 12, 4], pivot: [-2, 12, -5],
      skinRegion: { originX: 0, originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftFrontLeg', size: [4, 12, 4], pivot: [2, 12, -5],
      skinRegion: { originX: 0, originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'rightBackLeg', size: [4, 12, 4], pivot: [-2, 12, 5],
      skinRegion: { originX: 0, originY: 16, w: 4, h: 12, d: 4 } },
    { name: 'leftBackLeg', size: [4, 12, 4], pivot: [2, 12, 5],
      skinRegion: { originX: 0, originY: 16, w: 4, h: 12, d: 4 } },
  ],
};
```

PLAYER_MODELにも`forwardAngle: 0`を追加。pivot値は3Dモデルのテスト時に微調整する。

- [ ] **Step 4: MobModel.tsにforwardAngle参照不要（メッシュ回転はMinionWaveManagerが担当）— 変更なし確認**

- [ ] **Step 5: テスト実行 → PASS確認**

Run: `npx vitest run src/model/ModelDefinitions.test.ts`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add src/model/ModelDefinitions.ts src/model/ModelDefinitions.test.ts
git commit -m "fix: correct SHEEP_MODEL to Minecraft ModelSheep2.java spec, add forwardAngle"
```

---

### Task 7: プレースホルダテクスチャ生成

**Files:**
- Create: `scripts/generate-placeholder-textures.ts`
- Replace: `public/textures/mobs/minion_blue.png`
- Replace: `public/textures/mobs/minion_red.png`

- [ ] **Step 1: プレースホルダ生成スクリプト作成**

pngjsを使用して64x64のPNGを生成。SHEEP_MODELのskinRegionに基づき各面を色分け:
- Head faces: 赤系（top=#ff8888, front=#ff4444, sides=#ff6666, back=#ffaaaa, bottom=#ff2222）
- Body faces: 青系（top=#8888ff, front=#4444ff, sides=#6666ff, back=#aaaaff, bottom=#2222ff）
- Legs faces: 緑系（top=#88ff88, front=#44ff44, sides=#66ff66, back=#aaffaa, bottom=#22ff22）
- 未使用領域: グレー(#333333)

Blue/Red版: Body色をそれぞれ青系/赤系にする。

- [ ] **Step 2: スクリプト実行**

Run: `npx tsx scripts/generate-placeholder-textures.ts`
Expected: `public/textures/mobs/minion_blue.png` と `minion_red.png` が生成される

- [ ] **Step 3: ゲームを起動してテクスチャが正しくマッピングされているかブラウザで確認**

Run: `npx vite --port 5174`
Expected: 羊モデルの各面が色分けされて表示される

- [ ] **Step 4: コミット**

```bash
git add scripts/generate-placeholder-textures.ts public/textures/mobs/minion_blue.png public/textures/mobs/minion_red.png
git commit -m "feat: replace sheep textures with placeholder (colored by face/part)"
```

---

### Task 8: DamageFlash — ダメージフラッシュエフェクト

**Files:**
- Create: `src/model/DamageFlash.ts`
- Create: `src/model/DamageFlash.test.ts`

- [ ] **Step 1: テスト作成**

```typescript
import { describe, it, expect } from 'vitest';
import { createDamageFlash, triggerFlash, updateFlash, FLASH_DURATION } from './DamageFlash';

describe('DamageFlash', () => {
  it('starts inactive', () => {
    const flash = createDamageFlash();
    expect(flash.active).toBe(false);
  });

  it('becomes active after trigger', () => {
    const flash = createDamageFlash();
    triggerFlash(flash);
    expect(flash.active).toBe(true);
    expect(flash.timer).toBe(FLASH_DURATION);
  });

  it('deactivates after duration', () => {
    const flash = createDamageFlash();
    triggerFlash(flash);
    updateFlash(flash, FLASH_DURATION + 0.01);
    expect(flash.active).toBe(false);
  });

  it('stays active during duration', () => {
    const flash = createDamageFlash();
    triggerFlash(flash);
    updateFlash(flash, FLASH_DURATION * 0.5);
    expect(flash.active).toBe(true);
  });
});
```

- [ ] **Step 2: テスト実行 → FAIL確認**

- [ ] **Step 3: DamageFlash.ts実装**

```typescript
import * as THREE from 'three';

export const FLASH_DURATION = 0.3;

export interface DamageFlashState {
  timer: number;
  active: boolean;
}

export function createDamageFlash(): DamageFlashState {
  return { timer: 0, active: false };
}

export function triggerFlash(state: DamageFlashState): void {
  state.timer = FLASH_DURATION;
  state.active = true;
}

export function updateFlash(state: DamageFlashState, dt: number): void {
  if (!state.active) return;
  state.timer -= dt;
  if (state.timer <= 0) {
    state.timer = 0;
    state.active = false;
  }
}

export function applyFlashToMesh(mesh: THREE.Group, state: DamageFlashState): void {
  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
      child.material.emissive.setHex(state.active ? 0xff0000 : 0x000000);
    }
  });
}
```

- [ ] **Step 4: テスト実行 → PASS確認**

- [ ] **Step 5: コミット**

```bash
git add src/model/DamageFlash.ts src/model/DamageFlash.test.ts
git commit -m "feat: add DamageFlash effect for hit feedback"
```

---

### Task 9: HealthBar3D — ミニオン頭上HPバー

**Files:**
- Create: `src/ui/HealthBar3D.ts`
- Create: `src/ui/HealthBar3D.test.ts`

- [ ] **Step 1: テスト作成**

```typescript
import { describe, it, expect } from 'vitest';
import { createHealthBar, updateHealthBar } from './HealthBar3D';

describe('HealthBar3D', () => {
  it('creates a sprite with correct position', () => {
    const sprite = createHealthBar(1.5);
    expect(sprite).toBeDefined();
    expect(sprite.position.y).toBeGreaterThan(1.5); // モデル頭上
  });

  it('is invisible at full HP', () => {
    const sprite = createHealthBar(1.5);
    updateHealthBar(sprite, 150, 150);
    expect(sprite.visible).toBe(false);
  });

  it('becomes visible when damaged', () => {
    const sprite = createHealthBar(1.5);
    updateHealthBar(sprite, 100, 150);
    expect(sprite.visible).toBe(true);
  });

  it('is invisible when dead', () => {
    const sprite = createHealthBar(1.5);
    updateHealthBar(sprite, 0, 150);
    expect(sprite.visible).toBe(false);
  });
});
```

- [ ] **Step 2: テスト実行 → FAIL確認**

- [ ] **Step 3: HealthBar3D.ts実装**

CanvasベースのSprite。背景黒 + HPバー（緑→黄→赤グラデーション）。billboard自動。

- [ ] **Step 4: テスト実行 → PASS確認**

- [ ] **Step 5: コミット**

```bash
git add src/ui/HealthBar3D.ts src/ui/HealthBar3D.test.ts
git commit -m "feat: add HealthBar3D for minion overhead HP display"
```

---

### Task 10a: Minion.ts — EntityBody実装 + MinionWaveManager物理統合

**Files:**
- Modify: `src/entity/Minion.ts`
- Modify: `src/entity/MinionWaveManager.ts`
- Modify: `src/entity/MinionWaveManager.test.ts`

- [ ] **Step 1: Minion.tsにvelocityY/onGroundを追加**

```typescript
export class Minion extends Entity {
  velocityY = 0;
  onGround = false;
  // ... existing attack timer logic
}
```

- [ ] **Step 2: MinionWaveManager — 物理統合**

- `update()`にworld引数を追加（`update(dt, structures, world, playerInfo?)`）
- 各ミニオンの更新ループ内:
  - `applyEntityKnockback(minion, kb, dt, world)` でノックバック適用
  - AI結果の`moveX/moveZ`を`moveWithCollision(minion, moveX, moveZ, world)`で適用
  - AI結果の`shouldJump`が`true`なら`tryJump(minion)`呼び出し
  - `applyGravity(minion, dt, world)`で重力適用
- `isInsideStructure`メソッドを削除（EntityPhysicsの衝突判定に統合済み）
- SPAWN_Y固定値を廃止。スポーン時`onGround = false`で開始、重力で着地

- [ ] **Step 3: MinionWaveManager.test.ts更新 — world引数モック追加**

- [ ] **Step 4: テスト実行 → PASS確認**

Run: `npx vitest run src/entity/MinionWaveManager.test.ts`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add src/entity/Minion.ts src/entity/MinionWaveManager.ts src/entity/MinionWaveManager.test.ts
git commit -m "feat: integrate EntityPhysics into MinionWaveManager"
```

---

### Task 10b: MinionWaveManager — アニメーション統一 + 向き修正

**Files:**
- Modify: `src/entity/MinionWaveManager.ts`
- Reference: `src/model/Animator.ts`

- [ ] **Step 1: Date.now()ベースアニメーションをAnimatorに置き換え**

- `walkAnimators: Map<string, WalkAnimator>`を追加。spawnWave時にインスタンス生成
- update()内のDate.now()アニメーション処理（L99-117相当）を削除
- 代わりにWalkAnimator.update(dt, isMoving, moveSpeed)を呼び出し
- WalkAnimatorのLimbAngles出力を羊モデルにマッピング:
  - `rightArm` → `rightFrontLeg`
  - `leftArm` → `leftFrontLeg`
  - `rightLeg` → `rightBackLeg`
  - `leftLeg` → `leftBackLeg`
  - `head` → `head`
- 攻撃時: AttackAnimatorで頭の振りモーションを適用

- [ ] **Step 2: 向き修正 — forwardAngle適用**

- `forwardAngles: Map<string, number>`を追加
- buildMinionModel コールバックの型を`(team: Team) => { mesh: THREE.Group; forwardAngle: number }`に変更
- 向き計算: `mesh.rotation.y = Math.atan2(moveX, moveZ) + forwardAngle`

- [ ] **Step 3: テスト実行 → PASS確認**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: コミット**

```bash
git add src/entity/MinionWaveManager.ts
git commit -m "feat: unify minion animation with Animator, fix facing direction"
```

---

### Task 10c: MinionWaveManager — ダメージフラッシュ + HPバー + プレイヤー衝突

**Files:**
- Modify: `src/entity/MinionWaveManager.ts`
- Modify: `src/entity/MinionWaveManager.test.ts`

- [ ] **Step 1: ダメージフラッシュ統合**

- `damageFlashes: Map<string, DamageFlashState>`を追加
- ミニオンがダメージを受けたとき（target.takeDamage呼び出し箇所）で`triggerFlash`
- 毎フレーム`updateFlash` + `applyFlashToMesh`

- [ ] **Step 2: HPバー統合**

- spawnWave時に`createHealthBar(modelHeight)`でSpriteを作成しmesh Groupにchild追加
- `healthBars: Map<string, THREE.Sprite>`で管理
- 毎フレーム`updateHealthBar(sprite, minion.hp, minion.maxHp)`

- [ ] **Step 3: プレイヤー⇔ミニオン衝突**

- 既存のミニオン同士の分離ループ後に、プレイヤー⇔ミニオンの分離ループを追加
- `PLAYER_RADIUS = 0.3`, `MINION_RADIUS = 0.4`
- Y座標差が1.0以上なら押し出しスキップ（ジャンプ中等）
- 押し出し比率: ミニオン80%, プレイヤー20%

- [ ] **Step 4: テスト追加 — プレイヤー衝突、ダメージフラッシュトリガー**

```typescript
it('pushes minion away from player', () => { /* ... */ });
it('skips push when Y difference > 1.0', () => { /* ... */ });
it('triggers damage flash when minion takes damage', () => { /* ... */ });
```

- [ ] **Step 5: テスト実行 → PASS確認**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add src/entity/MinionWaveManager.ts src/entity/MinionWaveManager.test.ts
git commit -m "feat: add DamageFlash, HealthBar, player-minion collision to MinionWaveManager"
```

---

### Task 11: Game.ts統合 — ダメージフラッシュ + クリーンアップ

**Files:**
- Modify: `src/engine/Game.ts`

- [ ] **Step 1: Game.tsの変更**

1. **DEBUG_DAMAGE定数とK-key処理を削除**
2. **MinionWaveManager.update()にworld引数を追加**
3. **プレイヤーダメージフラッシュ統合**: playerState.takeDamage時に`triggerFlash`
4. **プレイヤーモデルにapplyFlashToMesh適用**（毎フレームupdateFlash + applyFlash）
5. **ミニオンのforwardAngle**: buildMinionModelコールバックでSHEEP_MODEL.forwardAngleを返すように拡張
6. **textureHeight対応**: SHEEP_MODELのtextureHeightが32に変更されたため、テクスチャロード時にそれに合わせる

- [ ] **Step 2: 全テストスイート実行**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: ブラウザで統合テスト**

Dev server起動: `npx vite --port 5174`
確認項目:
- ミニオンが地面に沿って移動する（宙に浮かない）
- ミニオンの向きが進行方向を向く
- ミニオンがタワーを迂回する
- プレースホルダテクスチャの色分けが正しい
- ミニオンに攻撃すると赤くフラッシュする
- ミニオンのHPバーが頭上に表示される
- プレイヤーがダメージを受けるとモデルが赤くフラッシュする
- F5で三人称にするとプレイヤーモデルが見える

- [ ] **Step 4: コミット**

```bash
git add src/engine/Game.ts
git commit -m "feat: integrate DamageFlash into Game.ts, cleanup debug code"
```

---

### Task 12: 最終テスト・クリーンアップ

**Files:**
- All modified files

- [ ] **Step 1: 全テストスイート実行**

Run: `npx vitest run`
Expected: ALL PASS、テスト数は既存210+新規テスト

- [ ] **Step 2: TypeScript型チェック**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: 未使用コード・ハードコード文字列の確認**

- MinionWaveManagerの`isInsideStructure`が完全に不要になったことを確認
- `'returning'`文字列が一切残っていないことをgrep確認
- Date.now()がアニメーションに使われていないことを確認
- パーツ名文字列（'head', 'rightArm'等）がハードコードされている箇所を確認し、ModelDefinitions.tsまたはAnimator.ts由来の定数に置き換え

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "chore: final cleanup and test verification"
```
