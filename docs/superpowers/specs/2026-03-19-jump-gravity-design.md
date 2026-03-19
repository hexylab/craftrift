# CraftRift: ジャンプ・重力システム 設計仕様書

## 概要

Phase 1で構築したボクセルFPS基盤に、Minecraft風のジャンプ・重力システムを追加する。プレイヤーは重力で落下し、スペースキーでジャンプして1ブロックの段差を乗り越えられる。空中でもWASD操作が可能（空中制御あり）。

## スコープ

### 含まれるもの
- 重力による落下（速度ベース物理）
- スペースキーによるジャンプ（接地時のみ）
- 接地判定（onGround）
- 天井衝突（頭上のブロックにぶつかると上昇停止）
- 終端速度の制限
- dtクランプによる物理安定性の確保
- 空中制御（空中でもWASD移動可能、地上と同じ速度）

### 含まれないもの
- 落下ダメージ（HPシステムがまだないため）
- 水泳・水中挙動（マップに水がないため）
- 二段ジャンプ
- 空中と地上での移動速度の差
- クライミングや梯子

## 物理パラメータ

| パラメータ | 定数名 | 値 | 根拠 |
|---|---|---|---|
| 重力加速度 | GRAVITY | 32 blocks/s² | Minecraftの重力加速度と同等 |
| ジャンプ初速度 | JUMP_VELOCITY | 9.0 blocks/s | 最高到達点 ≈ 1.27ブロック（1ブロック段差を乗り越え可能） |
| 終端速度 | TERMINAL_VELOCITY | 78.4 blocks/s | Minecraftと同等 |
| 最大dt | MAX_DT | 0.05s (50ms) | 大きなdtによる物理のすり抜けを防止 |

### ジャンプ最高到達点の計算

```
h = v² / (2g) = 9.0² / (2 × 32) ≈ 1.27ブロック
```

1ブロックの段差を余裕で乗り越え可能。2ブロックの壁は越えられない。

## 技術設計

### Player.ts の変更

#### 新しい状態

```typescript
velocityY: number = 0;   // Y軸速度（正が上方向）
onGround: boolean = false; // 接地フラグ
```

#### 新しいメソッド

**`jump(): void`**
- 条件: `onGround === true`
- 動作: `velocityY = JUMP_VELOCITY`
- 空中で呼ばれた場合は何もしない

**`updatePhysics(dt: number): void`**
- 毎フレーム呼び出される。以下の順序で処理:
  1. 重力を適用: `velocityY -= GRAVITY * dt`
  2. 終端速度でクランプ: `velocityY = Math.max(velocityY, -TERMINAL_VELOCITY)`
  3. Y軸移動: `moveAxisY(velocityY * dt)` を呼ぶ

**`moveAxisY(delta: number): void`** (private)
- 既存のmoveAxis()と同様のサブステッピング方式をY軸に適用
- ステップサイズ: `PLAYER_WIDTH / 2`（既存と同じ）
- 上昇時に衝突: `velocityY = 0`（天井衝突）
- 下降時に衝突: `velocityY = 0`, `onGround = true`, 位置をブロック上端にスナップ
- 移動中に衝突なし: `onGround = false`

#### 既存メソッドへの影響

- `move(dx, dz, dt)`: 変更なし。X/Z軸移動はそのまま
- `moveAxis()`: 変更なし
- `collides()`: 変更なし。既にY軸を含むAABB判定を持つ

### Game.ts の変更

#### dtクランプ

`loop()` メソッド内で:
```typescript
const dt = Math.min((time - this.lastTime) / 1000, 0.05);
```

#### update() の処理順序

```
1. マウス入力 → カメラ回転
2. ジャンプ入力: Space押下中 → player.jump()
3. 重力・Y軸移動: player.updatePhysics(dt)
4. X/Z移動: 既存のWASD処理（変更なし）
5. カメラ位置更新
6. ブロックインタラクション
```

### 変更しないファイル

- `InputManager.ts`: スペースキーは `isKeyDown('Space')` で取得可能。新しい入力は不要
- `Camera.ts`: 変更なし
- `BlockInteraction.ts`: 変更なし
- `World.ts`, `Chunk.ts`, `ChunkMesher.ts`, `MapData.ts`: 変更なし

## テスト設計

既存の `Player.test.ts`（6テスト）に以下の9テストを追加する:

### 重力テスト
- **空中で落下する**: 足元にブロックがない状態でupdatePhysics → Y座標が下がる
- **地面に着地する**: 落下中にブロックに到達 → onGround = true, velocityY = 0
- **地面の上では落下しない**: 足元にブロックがある状態 → Y座標が変わらない

### ジャンプテスト
- **接地時にジャンプできる**: onGround = true で jump() → velocityY = JUMP_VELOCITY
- **空中ではジャンプできない**: onGround = false で jump() → velocityY 変化なし
- **ジャンプ高さが約1.25ブロック**: ジャンプ後に複数フレームシミュレーション → 最高到達点を検証

### 天井衝突テスト
- **上昇中に天井にぶつかる**: 頭上にブロック → velocityY = 0, 位置がスナップ

### 終端速度テスト
- **落下速度が終端速度を超えない**: 長時間落下 → velocityY ≧ -TERMINAL_VELOCITY

### dtクランプテスト
- **大きなdtでもすり抜けない**: dt=1.0等でもブロックを貫通しない

## 将来の拡張ポイント

- 落下ダメージ（HPシステム実装後）
- 水泳・水中物理（水ブロック追加時）
- 空中と地上での移動速度差
- ノックバック（velocityYを外部から設定可能な設計にしておく）
