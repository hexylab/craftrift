# ミニオンシステム リアーキテクチャ設計書

## 概要

CraftRiftのミニオンシステムに存在する挙動・グラフィック・アーキテクチャ上の問題を根本的に修正する。既存のパッチ的修正ではなく、物理エンジン共通化・AIステートマシン化・テクスチャ修正・UI追加をまとめて行うリアーキテクチャ。

## 背景

現在のミニオンシステムには以下の問題がある:

1. **物理**: ミニオンはY座標固定で地面に沿わない。重力・ブロック衝突・ジャンプがない
2. **AI**: フラットな条件分岐で毎フレーム再評価。LoL準拠のステートマシンになっていない
3. **テクスチャ**: SHEEP_MODELのskinRegion座標がMinecraft標準と一致しない（w/h/d入れ替わり、origin違い）
4. **描画**: 向きが逆、ダメージ表現なし、HP表示なし
5. **衝突**: プレイヤーとの衝突判定なし。パスファインディングのフォールバックが構造物をすり抜ける
6. **コード品質**: デッドコード、Date.now()ベースアニメーション、ハードコード文字列

## セクション1: 物理エンジンの共通化

### 目的

プレイヤー専用だった物理ロジック（重力、AABB衝突、ジャンプ）をエンティティ共通モジュールに抽出し、ミニオンにも適用する。

### 新設ファイル

**`src/physics/EntityPhysics.ts`**

```typescript
interface EntityBody {
  x: number; y: number; z: number;
  width: number; height: number;  // XZ断面は正方形（width x width）、heightはY軸
  velocityY: number;
  onGround: boolean;
}

function applyGravity(body: EntityBody, dt: number, world: World): void;
function moveWithCollision(body: EntityBody, dx: number, dz: number, world: World): void;
function tryJump(body: EntityBody): boolean;
function applyKnockback(body: EntityBody, kb: KnockbackState, dt: number, world: World): void;
```

- `applyGravity`: GRAVITY、TERMINAL_VELOCITY定数を使用。Y方向の衝突判定含む
- `moveWithCollision`: Player.moveAxis相当のAABBステッピング衝突。**構造物（Structure）もWorldのブロックとして衝突判定に含まれるため、既存のisInsideStructureチェックは不要になる**
- `tryJump`: onGround時にvelocityYをJUMP_VELOCITYに設定
- `applyKnockback`: ノックバック速度をmoveWithCollisionを通して適用（壁すり抜け防止）。Y方向のノックバック（KNOCKBACK_VERTICAL）はvelocityYに加算し、applyGravityで処理

**備考**: XZ断面は正方形前提（Player: 0.6x0.6、Minion: 0.8x0.8）。ミニオンのスポーン時は`onGround = false`で開始し、初フレームで重力により着地する。

### 変更ファイル

- **`src/player/Player.ts`**: 自前の物理ロジックをEntityPhysicsの呼び出しに置き換え。Player固有部分（eyeHeight、カメラ連動）のみ残す
- **`src/entity/Minion.ts`**: EntityBodyを実装。`velocityY`、`onGround`フィールドを追加
- **`src/entity/MinionWaveManager.ts`**: 各ミニオンの更新で`applyGravity`と`moveWithCollision`を使用。固定Y座標を廃止。自動ジャンプ（前方にブロックがあり前進不可の場合に`tryJump`呼び出し）

### テスト

- Player/Minionの両方で重力・衝突・ジャンプをテスト
- 穴からの自動ジャンプ脱出テスト
- 既存のPlayer物理テストが引き続きパスすること

---

## セクション2: ミニオンAIステートマシン

### 目的

毎フレーム全条件を再評価するフラットな構造から、LoL準拠の明確なステートマシンに書き換える。

### ステート遷移図

```
walking → chasing → attacking
   ↑         |          |
   └─────────┴──────────┘ (ターゲット消失/範囲外)
```

### ステート定義

| ステート | 動作 | 遷移条件 |
|---------|------|---------|
| walking | 最も自陣に近い未破壊の敵構造物に向かってA*移動 | DETECTION_RANGE内に敵が入ったら→chasing |
| chasing | ターゲットに向かってA*で接近 | ATTACK_RANGE内→attacking。LEASH_RANGE外→walking |
| attacking | 停止して攻撃 | ターゲット死亡/ATTACK_RANGE外→chasing。LEASH_RANGE外→walking |

### 定数

- `DETECTION_RANGE = 8.0` — 敵を検知して追跡開始する距離
- `ATTACK_RANGE = 2.0` — 攻撃射程
- `LEASH_RANGE = 12.0` — 追跡を諦めてwalkingに戻る距離

### ターゲット優先順位（chasing/attacking時）

1. 自分を攻撃中の敵（プレイヤーまたはミニオン）
2. 探索範囲内の最も近い敵ミニオン
3. 探索範囲内の敵プレイヤー

**構造物への攻撃**: 構造物はchasing/attackingのターゲットにはならない。walkingステートでA*移動中に、攻撃射程内に敵構造物が入った場合、walkingステートのまま停止して構造物を攻撃する。構造物が破壊されたらA*の目的地を再計算して次の構造物に向かう。

### MinionAIResult の変更

```typescript
export type MinionAIState = 'walking' | 'chasing' | 'attacking';

export interface MinionAIResult {
  state: MinionAIState;  // 'chasing'を追加
  moveX: number;
  moveZ: number;
  targetId: string | null;
  damage: number;
  shouldJump: boolean;   // 自動ジャンプ要求フラグ（物理エンジンに伝達）
}
```

### 変更ファイル

- **`src/entity/MinionAI.ts`**: 完全書き直し
  - `MinionAIState = 'walking' | 'chasing' | 'attacking'`
  - `currentTarget: Entity | null`
  - ステートごとのupdateメソッド分離
  - デッドコード（'returning'状態等）除去

### テスト

- 各ステート遷移をユニットテストで検証
- 境界条件: DETECTION_RANGEギリギリ、LEASH_RANGEギリギリ
- ターゲット優先順位のテスト

---

## セクション3: テクスチャ・モデルシステムの修正

### 3a. SHEEP_MODELをMinecraft標準に修正

MinecraftデコンパイルのModelSheep2.javaソースコード準拠:

| パーツ | 現在(誤) | 修正後(正) |
|--------|---------|-----------|
| Head size | [8,8,6] | [6,6,8] |
| Head skinRegion | (0,0) w=8,h=8,d=6 | (0,0) w=6,h=6,d=8 |
| Body size | [6,10,16] | [8,16,6] |
| Body skinRegion | (16,16) w=6,h=10,d=16 | (28,8) w=8,h=16,d=6 |
| Legs | 変更なし | 変更なし |

出典: [ModelSheep2.java (decompiled 1.8.9)](https://github.com/MinecraftModdedClients/Resilience-Client-Source/blob/master/net/minecraft/client/model/ModelSheep2.java)

pivotも羊の体型に合わせて再調整。各パーツの用途・座標根拠をコメントで明記。

### 3b. テクスチャをプレースホルダに置き換え

64x64のプレースホルダPNGを生成。各面を色分け:
- Head: 赤系（face/top/side等で色分け）
- Body: 青系
- Legs: 緑系

面ごとに異なる色にすることで、UV座標が正しいかゲーム内で一目で確認可能。

**新設**: `scripts/generate-placeholder-textures.ts` — プレースホルダPNG自動生成スクリプト

実際のデザインはユーザーが後日差し替え。

### 3c. モデル前方向の修正

`ModelDefinition`に`forwardAngle`プロパティを追加:

```typescript
export interface ModelDefinition {
  parts: PartDefinition[];
  textureWidth: number;
  textureHeight: number;
  pixelScale: number;
  forwardAngle: number; // モデルのデフォルト前方向（ラジアン）
}
```

向き計算: `mesh.rotation.y = atan2(moveX, moveZ) + definition.forwardAngle`

`forwardAngle`はMinionWaveManagerがモデル構築時に`buildMinionModel`コールバック経由で取得し、meshes Mapと並列に`forwardAngles: Map<string, number>`として保持する。

### テスト

- skinRegion値がMinecraft標準と一致するスナップショットテスト
- forwardAngleが正しく適用されるテスト

---

## セクション4: ダメージフラッシュとHPバー

### 4a. ダメージフラッシュ

被弾時にモデル全体を赤く光らせるエフェクト。ミニオン・プレイヤー両方に適用。

**新設: `src/model/DamageFlash.ts`**

```typescript
interface DamageFlashState { timer: number; active: boolean; }

function createDamageFlash(): DamageFlashState;
function triggerFlash(state: DamageFlashState): void;
function updateFlash(state: DamageFlashState, dt: number): void;
function applyFlashToMesh(mesh: THREE.Group, state: DamageFlashState): void;
```

- `FLASH_DURATION = 0.3` 秒
- `applyFlashToMesh`: active時にMeshLambertMaterialの`emissive`を赤(0xff0000)に設定、非active時に黒(0x000000)に戻す

**適用箇所:**
- `MinionWaveManager.ts`: ミニオンがダメージを受けたときに`triggerFlash`
- `Game.ts`: プレイヤーモデルがダメージを受けたときに`triggerFlash`

### 4b. ミニオン頭上HPバー

**新設: `src/ui/HealthBar3D.ts`**

```typescript
function createHealthBar(modelHeight: number): THREE.Sprite;
function updateHealthBar(sprite: THREE.Sprite, hp: number, maxHp: number): void;
```

- `modelHeight`: HPバーのY位置を決定するためのモデル高さ（ピクセルスケール適用後）

- 背景（黒）＋前景（HP割合で緑→黄→赤グラデーション）のCanvasテクスチャからSprite生成
- ミニオンのmesh Groupにchildとして追加。billboard表示
- HP100%のミニオンはHPバー非表示（ダメージを受けたら表示開始）
- 死亡時は非表示

### テスト

- DamageFlash: タイマー制御、active/inactive切り替え
- HealthBar3D: HP割合に応じた表示/非表示

---

## セクション5: 衝突・パスファインディング・クリーンアップ

### 5a. プレイヤー⇔ミニオン衝突

`MinionWaveManager.ts`の分離ロジックを拡張:

- 各ミニオンとプレイヤー間の距離チェック、`PLAYER_RADIUS(0.3) + MINION_RADIUS(0.4)` 以内なら押し出し
- 押し出し比率: ミニオン:プレイヤー = 8:2（ミニオンが主に押される）

### 5b. パスファインディング堅牢化

- `Pathfinding.ts:163` のフォールバック修正: A*失敗時に空配列を返す（その場で待機）。ただし**スタック防止として、空配列を受け取ったMinionAIはpathTimerを0.5秒に短縮して早期リトライ**する（通常の2秒ではなく）。3回連続で空配列の場合はフォールバックとして直線移動を許可する
- 障害物マップのマージンを対称化: min側-1、max側+1
- テストケース追加: A*がイテレーション上限に達した場合

### 5c. デッドコード・不整合の除去

| 対象 | 内容 |
|------|------|
| MinionWaveManager.ts:108 | `'returning'`状態チェック削除 |
| Knockback.ts | `vy`フィールド削除。Y方向ノックバックはEntityPhysics.applyKnockbackでvelocityYに直接加算する方式に変更 |
| Game.ts:29,461 | `DEBUG_DAMAGE`定数とK-key処理削除 |
| MinionWaveManager.ts:99-117 | Date.now()ベースアニメーションをAnimatorクラスに統一 |
| Game.ts, MinionWaveManager.ts | ハードコードのパーツ名文字列を定数化 |

### 5d. ミニオンアニメーションのAnimator統一

MinionWaveManager内のDate.now()ベースのアニメーション処理を廃止し、既存の`Animator.ts`の`WalkAnimator`をミニオンにも適用:

- 各ミニオンに`WalkAnimator`インスタンスを保持
- `AttackAnimator`も頭の振りモーションとして適用

### テスト

- プレイヤー⇔ミニオン衝突: 押し出し比率、境界条件、Y座標が異なる場合（ジャンプ中）は押し出し不適用
- パスファインディング: フォールバック時の挙動、マージン対称性、スタック防止リトライ
- アニメーション統一: WalkAnimatorのミニオン適用、位相ずれテスト
- 全テストスイートがパスすること

---

## ファイル構成（変更一覧）

### 新設
| ファイル | 用途 |
|---------|------|
| `src/physics/EntityPhysics.ts` | 共通物理エンジン |
| `src/model/DamageFlash.ts` | ダメージフラッシュエフェクト |
| `src/ui/HealthBar3D.ts` | ミニオン頭上HPバー |
| `scripts/generate-placeholder-textures.ts` | プレースホルダテクスチャ生成 |

### 大幅修正
| ファイル | 内容 |
|---------|------|
| `src/entity/MinionAI.ts` | ステートマシン化（書き直し） |
| `src/entity/MinionWaveManager.ts` | 物理共通化、アニメーション統一、衝突拡張 |
| `src/entity/Minion.ts` | EntityBody実装 |
| `src/model/ModelDefinitions.ts` | SHEEP_MODEL修正、forwardAngle追加 |
| `src/player/Player.ts` | 物理ロジックをEntityPhysicsに委譲 |

### 軽微修正
| ファイル | 内容 |
|---------|------|
| `src/physics/Pathfinding.ts` | フォールバック修正、マージン対称化 |
| `src/physics/Knockback.ts` | vy削除 |
| `src/model/Animator.ts` | ミニオン用拡張（必要に応じて） |
| `src/engine/Game.ts` | デバッグコード削除、ダメージフラッシュ統合 |
| `public/textures/mobs/minion_blue.png` | プレースホルダに置き換え |
| `public/textures/mobs/minion_red.png` | プレースホルダに置き換え |
