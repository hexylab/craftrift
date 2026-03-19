# ジャンプ・重力システム Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Minecraft風のジャンプ・重力システムをPlayer.tsに追加し、Game.tsに統合する。

**Architecture:** Player.tsに `velocityY`, `onGround` 状態と `jump()`, `updatePhysics()`, `moveAxisY()` メソッドを追加する。既存のX/Z軸サブステッピング衝突解決パターンをY軸に適用。Game.tsではdtクランプ + ジャンプ入力 + 物理更新を既存のゲームループに組み込む。

**Tech Stack:** TypeScript, Three.js, Vite, vitest

**Spec:** `docs/superpowers/specs/2026-03-19-jump-gravity-design.md`

---

## ファイル構成

| ファイル | 操作 | 責務 |
|---|---|---|
| `src/player/Player.ts` | 修正 | velocityY, onGround, jump(), updatePhysics(), moveAxisY() 追加 |
| `src/engine/Game.ts` | 修正 | dtクランプ, ジャンプ入力, updatePhysics()呼び出し追加 |
| `src/player/Player.test.ts` | 修正 | 9テスト追加（重力3, ジャンプ3, 天井1, 終端速度1, dt堅牢性1） |

変更しないファイル: InputManager.ts, Camera.ts, BlockInteraction.ts, World.ts, Chunk.ts, ChunkMesher.ts, MapData.ts

**Note:** 空中制御（空中でもWASD移動可能）は、既存の `move()` が `onGround` を参照しないため追加実装不要。自動的に実現される。

---

### Task 1: 重力による落下

物理定数と `updatePhysics()` / `moveAxisY()` を追加し、空中のプレイヤーが落下することを検証する。

**Files:**
- Modify: `src/player/Player.ts:1-85`
- Modify: `src/player/Player.test.ts:1-59`

- [ ] **Step 1: 落下テストを書く**

`src/player/Player.test.ts` の末尾（`});` の直前）に追加:

```typescript
  describe('gravity', () => {
    it('falls when no block below', () => {
      const world = new World();
      // プレイヤーを空中に配置（足元にブロックなし）
      const player = new Player(5, 10, 5, world);
      player.updatePhysics(1 / 60);
      expect(player.y).toBeLessThan(10);
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/player/Player.test.ts`
Expected: FAIL — `player.updatePhysics is not a function`

- [ ] **Step 3: 最小限の実装**

`src/player/Player.ts` を以下のように変更:

定数を追加（`HALF_WIDTH` の後、L8以降に）。`GRAVITY` と `JUMP_VELOCITY` はテストで使用するため export する:
```typescript
export const GRAVITY = 32;
export const JUMP_VELOCITY = 9.0;
const TERMINAL_VELOCITY = 78.4;
```

Player クラスにプロパティを追加（`x`, `y`, `z` の後に）:
```typescript
  velocityY = 0;
  onGround = false;
```

Player クラスに `updatePhysics` メソッドを追加（`move()` メソッドの後に）:
```typescript
  updatePhysics(dt: number): void {
    this.velocityY -= GRAVITY * dt;
    this.velocityY = Math.max(this.velocityY, -TERMINAL_VELOCITY);
    this.moveAxisY(this.velocityY * dt);
  }
```

Player クラスに `moveAxisY` メソッドを追加（`moveAxis()` メソッドの後に）:
```typescript
  private moveAxisY(delta: number): void {
    if (delta === 0) return;
    const STEP = PLAYER_WIDTH / 2;
    let remaining = Math.abs(delta);
    const sign = delta > 0 ? 1 : -1;
    let hitBlock = false;

    while (remaining > 0) {
      const step = Math.min(remaining, STEP);
      const nextY = this.y + sign * step;
      if (this.collides(this.x, nextY, this.z)) {
        hitBlock = true;
        break;
      }
      this.y = nextY;
      remaining -= step;
    }

    if (hitBlock) {
      if (delta < 0) {
        this.onGround = true;
      }
      this.velocityY = 0;
    } else {
      this.onGround = false;
    }
  }
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `npx vitest run src/player/Player.test.ts`
Expected: ALL PASS（既存6 + 新規1 = 7テスト）

- [ ] **Step 5: コミット**

```bash
git add src/player/Player.ts src/player/Player.test.ts
git commit -m "feat: add gravity - player falls when no block below"
```

---

### Task 2: 着地と接地状態

落下中に地面のブロックに着地する挙動と、地面に立っている時にY座標が変わらない挙動を検証する。

**Files:**
- Modify: `src/player/Player.test.ts`

- [ ] **Step 1: 着地テストと接地テストを書く**

`src/player/Player.test.ts` の `describe('gravity')` 内に追加:

```typescript
    it('lands on a block and sets onGround', () => {
      const world = new World();
      // y=5 にブロックを敷く（ブロック上面 = y=6）
      for (let x = 4; x <= 6; x++) {
        for (let z = 4; z <= 6; z++) {
          world.setBlock(x, 5, z, BlockType.STONE);
        }
      }
      // プレイヤーを y=7 に配置（ブロック上面 y=6 の1ブロック上）
      const player = new Player(5, 7, 5, world);
      // 複数フレーム落下させる
      for (let i = 0; i < 120; i++) {
        player.updatePhysics(1 / 60);
      }
      expect(player.onGround).toBe(true);
      expect(player.velocityY).toBe(0);
      // ブロック上面(y=6)付近に着地しているはず
      expect(player.y).toBeGreaterThanOrEqual(6);
      expect(player.y).toBeLessThan(6.1);
    });

    it('does not fall when standing on ground', () => {
      const world = new World();
      // y=5 にブロックを敷く（ブロック上面 = y=6）
      for (let x = 4; x <= 6; x++) {
        for (let z = 4; z <= 6; z++) {
          world.setBlock(x, 5, z, BlockType.STONE);
        }
      }
      // まず着地させる
      const player = new Player(5, 7, 5, world);
      for (let i = 0; i < 120; i++) {
        player.updatePhysics(1 / 60);
      }
      const yAfterLanding = player.y;
      // さらに数フレーム実行してもY座標が変わらない
      for (let i = 0; i < 60; i++) {
        player.updatePhysics(1 / 60);
      }
      expect(player.y).toBeCloseTo(yAfterLanding, 5);
    });
```

- [ ] **Step 2: テストがパスすることを確認**

Run: `npx vitest run src/player/Player.test.ts`
Expected: ALL PASS（既存6 + 新規3 = 9テスト）

Note: Task 1 の実装で着地ロジック（`moveAxisY` 内の `onGround = true`）は既に含まれているため、追加実装なしでパスするはず。パスしなければ `moveAxisY` を修正する。

- [ ] **Step 3: コミット**

```bash
git add src/player/Player.test.ts
git commit -m "test: add landing and standing-on-ground tests"
```

---

### Task 3: ジャンプ

`jump()` メソッドを追加し、接地時のみジャンプできることを検証する。

**Files:**
- Modify: `src/player/Player.ts`
- Modify: `src/player/Player.test.ts`

- [ ] **Step 1: ジャンプテストを書く**

`src/player/Player.test.ts` に新しい `describe('jump')` を追加（`describe('gravity')` の後に）:

```typescript
  describe('jump', () => {
    it('can jump when on ground', () => {
      const world = new World();
      for (let x = 4; x <= 6; x++) {
        for (let z = 4; z <= 6; z++) {
          world.setBlock(x, 5, z, BlockType.STONE);
        }
      }
      const player = new Player(5, 7, 5, world);
      // 着地させる
      for (let i = 0; i < 120; i++) {
        player.updatePhysics(1 / 60);
      }
      expect(player.onGround).toBe(true);
      player.jump();
      expect(player.velocityY).toBe(JUMP_VELOCITY);
    });

    it('cannot jump when in air', () => {
      const world = new World();
      const player = new Player(5, 10, 5, world);
      expect(player.onGround).toBe(false);
      player.jump();
      expect(player.velocityY).toBe(0);
    });
  });
```

テストファイルのimportに `JUMP_VELOCITY` を追加:
```typescript
import { Player, PLAYER_WIDTH, PLAYER_HEIGHT, JUMP_VELOCITY } from './Player';
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/player/Player.test.ts`
Expected: FAIL — `player.jump is not a function`

- [ ] **Step 3: jump() メソッドを実装**

`src/player/Player.ts` の Player クラスに追加（`updatePhysics()` の後に）:

```typescript
  jump(): void {
    if (this.onGround) {
      this.velocityY = JUMP_VELOCITY;
    }
  }
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `npx vitest run src/player/Player.test.ts`
Expected: ALL PASS（既存6 + 新規5 = 11テスト）

- [ ] **Step 5: コミット**

```bash
git add src/player/Player.ts src/player/Player.test.ts
git commit -m "feat: add jump() method - jump only when on ground"
```

---

### Task 4: ジャンプ高さの検証

ジャンプ後の最高到達点が理論値（≈1.27ブロック）に近いことをシミュレーションで検証する。

**Files:**
- Modify: `src/player/Player.test.ts`

- [ ] **Step 1: ジャンプ高さテストを書く**

`src/player/Player.test.ts` の `describe('jump')` 内に追加:

```typescript
    it('reaches approximately 1.27 blocks height', () => {
      const world = new World();
      for (let x = 4; x <= 6; x++) {
        for (let z = 4; z <= 6; z++) {
          world.setBlock(x, 5, z, BlockType.STONE);
        }
      }
      const player = new Player(5, 7, 5, world);
      // 着地させる
      for (let i = 0; i < 120; i++) {
        player.updatePhysics(1 / 60);
      }
      const groundY = player.y;
      player.jump();
      // 60fpsでジャンプをシミュレーション
      let maxY = player.y;
      for (let i = 0; i < 120; i++) {
        player.updatePhysics(1 / 60);
        if (player.y > maxY) maxY = player.y;
      }
      const jumpHeight = maxY - groundY;
      // 理論値 v²/(2g) = 9²/(2*32) ≈ 1.27
      // 離散シミュレーションのため許容範囲 1.1～1.3
      expect(jumpHeight).toBeGreaterThan(1.1);
      expect(jumpHeight).toBeLessThan(1.3);
    });
```

- [ ] **Step 2: テストがパスすることを確認**

Run: `npx vitest run src/player/Player.test.ts`
Expected: ALL PASS（既存6 + 新規6 = 12テスト）

Note: 実装は既に完了しているため、テスト追加のみ。パスしなければ物理パラメータを調整する。

- [ ] **Step 3: コミット**

```bash
git add src/player/Player.test.ts
git commit -m "test: verify jump height approximately 1.27 blocks"
```

---

### Task 5: 天井衝突

上昇中にブロックにぶつかった時に `velocityY` が0にリセットされることを検証する。

**Files:**
- Modify: `src/player/Player.test.ts`

- [ ] **Step 1: 天井衝突テストを書く**

`src/player/Player.test.ts` に新しい `describe('ceiling collision')` を追加:

```typescript
  describe('ceiling collision', () => {
    it('stops upward velocity when hitting ceiling', () => {
      const world = new World();
      // 地面 y=5（上面 y=6）
      for (let x = 4; x <= 6; x++) {
        for (let z = 4; z <= 6; z++) {
          world.setBlock(x, 5, z, BlockType.STONE);
        }
      }
      // 天井 y=8（下面 y=8）。着地後 y≈6.0、ジャンプ最高到達 y≈7.27。
      // 頭の位置 y + 1.8 ≈ 9.07 なので天井下面 y=8 に衝突する。
      for (let x = 4; x <= 6; x++) {
        for (let z = 4; z <= 6; z++) {
          world.setBlock(x, 8, z, BlockType.STONE);
        }
      }
      // プレイヤーを地面のすぐ上にスポーン（天井とは重ならない位置）
      const player = new Player(5, 6.1, 5, world);
      // 着地させる
      for (let i = 0; i < 120; i++) {
        player.updatePhysics(1 / 60);
      }
      expect(player.onGround).toBe(true);
      player.jump();
      // 数フレーム進めて天井に当たるはず
      for (let i = 0; i < 30; i++) {
        player.updatePhysics(1 / 60);
      }
      // velocityYは0以下（天井衝突でリセットされ、その後重力で負に）
      expect(player.velocityY).toBeLessThanOrEqual(0);
      // 天井(y=8)の下面を超えていない: プレイヤーy + PLAYER_HEIGHT <= 8
      expect(player.y + PLAYER_HEIGHT).toBeLessThanOrEqual(8);
    });
  });
```

- [ ] **Step 2: テストがパスすることを確認**

Run: `npx vitest run src/player/Player.test.ts`
Expected: ALL PASS（既存6 + 新規7 = 13テスト）

Note: `moveAxisY` の既存の天井衝突ロジックで対応済みのはず。

- [ ] **Step 3: コミット**

```bash
git add src/player/Player.test.ts
git commit -m "test: verify ceiling collision stops upward velocity"
```

---

### Task 6: 終端速度と大dt堅牢性

長時間落下時の終端速度制限と、大きなdtでブロックをすり抜けないことを検証する。

**Files:**
- Modify: `src/player/Player.test.ts`

- [ ] **Step 1: 終端速度テストと大dtテストを書く**

`src/player/Player.test.ts` に追加:

```typescript
  describe('terminal velocity', () => {
    it('does not exceed terminal velocity', () => {
      const world = new World();
      const player = new Player(5, 1000, 5, world);
      // 長時間落下（10秒相当）
      for (let i = 0; i < 600; i++) {
        player.updatePhysics(1 / 60);
      }
      expect(player.velocityY).toBeGreaterThanOrEqual(-78.4);
    });
  });

  describe('large dt robustness', () => {
    it('does not fall through blocks with large dt', () => {
      const world = new World();
      // 地面 y=0（上面 y=1）
      for (let x = 4; x <= 6; x++) {
        for (let z = 4; z <= 6; z++) {
          world.setBlock(x, 0, z, BlockType.STONE);
        }
      }
      const player = new Player(5, 5, 5, world);
      // 大きなdt（1秒）で物理更新
      player.updatePhysics(1.0);
      // ブロック上面(y=1)を突き抜けていないこと
      expect(player.y).toBeGreaterThanOrEqual(1);
    });
  });
```

- [ ] **Step 2: テストがパスすることを確認**

Run: `npx vitest run src/player/Player.test.ts`
Expected: ALL PASS（既存6 + 新規9 = 15テスト）

- [ ] **Step 3: コミット**

```bash
git add src/player/Player.test.ts
git commit -m "test: verify terminal velocity and large dt robustness"
```

---

### Task 7: Game.ts 統合

Game.tsにdtクランプ、ジャンプ入力、物理更新を組み込む。

**Files:**
- Modify: `src/engine/Game.ts:58-89`

- [ ] **Step 1: dtクランプを追加**

`src/engine/Game.ts` の `loop()` メソッド（L58-66）を変更:

変更前:
```typescript
  private loop(time: number): void {
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
```

変更後:
```typescript
  private loop(time: number): void {
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;
```

- [ ] **Step 2: ジャンプ入力と物理更新を追加**

`src/engine/Game.ts` の `update()` メソッド内、カメラ回転の後（L77の後）、WASD移動の前に追加:

```typescript
    if (this.input.isKeyDown('Space')) {
      this.player.jump();
    }
    this.player.updatePhysics(dt);
```

つまり、以下の順序になる:
```typescript
    const mouse = this.input.getMouseMovement();
    this.renderer.fpsCamera.rotate(mouse.x, mouse.y);

    // ジャンプ + 重力（新規）
    if (this.input.isKeyDown('Space')) {
      this.player.jump();
    }
    this.player.updatePhysics(dt);

    // X/Z移動（既存、変更なし）
    const forward = this.renderer.fpsCamera.getForward();
    ...
```

- [ ] **Step 3: ビルドが通ることを確認**

Run: `npx vitest run`
Expected: ALL PASS（全テスト）

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/engine/Game.ts
git commit -m "feat: integrate jump and gravity into game loop"
```

- [ ] **Step 5: 開発サーバーで動作確認**

Run: `npx vite`

ブラウザで http://localhost:5173/ を開き、以下を確認:
- スポーン後に自然に落下して地面に着地する
- Spaceキーでジャンプできる
- 1ブロックの段差を飛び越えられる
- ブロックの上を歩ける
- 空中でWASD移動できる
- 天井のあるトンネル内でジャンプすると天井で止まる
