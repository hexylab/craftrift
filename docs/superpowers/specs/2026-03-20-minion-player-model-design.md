# ミニオン＋プレイヤーキャラクターモデル 設計仕様

## 概要

CraftRiftにミニオン（Minecraft羊モデル）とプレイヤーキャラクターモデル（Minecraftスキン）を追加する。
3Dモデルシステム（SkinParser + MobModel + Animator）を自前実装し、skinview3dのアニメーションロジックを参考にMinecraft準拠の動きを再現する。

## スコープ

### 追加するもの
- 3Dモデルレンダリングシステム（SkinParser, MobModel, Animator）
- ミニオンAI（ウェーブスポーン、レーン歩行、戦闘）
- ミニオン-タワー間のアグロ連携
- プレイヤーキャラクターモデル（一人称アーム＋三人称全身）
- F5キーによる視点切り替え（一人称 → 三人称背面 → 三人称前面）
- ノックバックシステム（ダメージ時の押し戻し）
- バランス調整（プレイヤーHP、タワーダメージ）

### 変更するもの
- PlayerState: HP 100 → 500
- TowerAI: ダメージ 25 → 50、ターゲット優先度変更（ミニオン優先）
- ProjectileManager: ターゲットをエンティティベースに変更
- Game.ts: ミニオン更新ループ追加

---

## 1. 3Dモデルシステム

### アーキテクチャ

```
SkinParser (PNGテクスチャ → UV領域マップ)
    ↓
MobModel (BoxGeometry組み立て + UVマッピング → THREE.Group)
    ↓
Animator (歩行・待機アニメーション → パーツrotation制御)
```

### 1.1 SkinParser

**責務:** Minecraftスキンレイアウト（64x64）からパーツごとのUV座標を抽出する。

**入力:** スキンPNG画像パス、パーツレイアウト定義
**出力:** パーツ名 → UV座標マップ（6面: front, back, left, right, top, bottom）

**ファイル:** `src/model/SkinParser.ts`

**Minecraftスキンレイアウト（プレイヤー 64x64）:**

各パーツの展開図はMinecraft標準のキューブネットレイアウトに従う。
展開図の領域内で、6面は以下の配置で格納される:

```
展開図領域内の配置（パーツ寸法 w×h×d の場合）:
行1: [  空(w)  ] [  top(w×d)  ] [    空     ] [    空     ]
行2: [ left(d×h) ] [ front(w×h) ] [ right(d×h) ] [ back(w×h) ]
     ← オフセットは左上座標からの相対位置 →
```

| パーツ | 展開図左上座標 | 展開図サイズ | パーツ寸法(w,h,d) |
|--------|---------------|-------------|-------------------|
| 頭 | (0,0) | 32×16 | 8,8,8 |
| 胴体 | (16,16) | 24×16 | 8,12,4 |
| 右腕 | (40,16) | 16×16 | 4,12,4 |
| 左腕 | (32,48) | 16×16 | 4,12,4 |
| 右脚 | (0,16) | 16×16 | 4,12,4 |
| 左脚 | (16,48) | 16×16 | 4,12,4 |

**各面のピクセルオフセット（展開図左上からの相対座標）:**
- top: (d, 0) サイズ w×d
- bottom: (d+w, 0) サイズ w×d
- left: (0, d) サイズ d×h
- front: (d, d) サイズ w×h
- right: (d+w, d) サイズ d×h
- back: (d+w+d, d) サイズ w×h

**羊スキンレイアウト:**
ユーザーが作成したカスタムレイアウト（64x64）。プレイヤースキンと同じキューブネットフォーマットで、羊のパーツ（頭、胴体、脚×4）を配置。パーツ寸法が異なるため展開図領域のサイズも異なるが、6面の配置ルールは同一。

**処理:**
1. HTMLCanvasElementにPNGを描画
2. パーツ定義の展開図左上座標とパーツ寸法から、上記ルールで6面のピクセル座標を算出
3. ピクセル座標 → 0.0〜1.0の正規化UV座標に変換
4. UVマップオブジェクトを返す

### 1.2 MobModel

**責務:** パーツ定義からThree.jsのGroupを構築する。

**入力:** パーツ定義リスト、UVマップ、テクスチャ
**出力:** THREE.Group（シーンに追加可能）

**ファイル:** `src/model/MobModel.ts`

**パーツ定義:**
```typescript
interface PartDefinition {
  name: string;           // 'head', 'body', 'leftArm', etc.
  size: [number, number, number];  // [width, height, depth] ピクセル単位
  offset: [number, number, number]; // 親からの相対位置
  pivot: [number, number, number];  // 回転軸の位置
  parent?: string;        // 親パーツ名（未指定=ルート）
}
```

**プレイヤーモデル定義（Minecraft準拠、ピクセル単位）:**

| パーツ | サイズ(w,h,d) | ピボット |
|--------|--------------|---------|
| 頭 | 8×8×8 | (0, 24, 0) |
| 胴体 | 8×12×4 | (0, 12, 0) |
| 右腕 | 4×12×4 | (-6, 22, 0) |
| 左腕 | 4×12×4 | (6, 22, 0) |
| 右脚 | 4×12×4 | (-2, 12, 0) |
| 左脚 | 4×12×4 | (2, 12, 0) |

※1ピクセル = 1/16ブロック。PLAYER_HEIGHT=1.8に合わせてスケーリング。

**羊モデル定義（Minecraft準拠）:**

| パーツ | サイズ(w,h,d) | ピボット |
|--------|--------------|---------|
| 頭 | 8×8×6 | (0, 16, -8) |
| 胴体 | 6×10×16 | (0, 13, 0) |
| 右前脚 | 4×12×4 | (-2, 6, -5) |
| 左前脚 | 4×12×4 | (2, 6, -5) |
| 右後脚 | 4×12×4 | (-2, 6, 5) |
| 左後脚 | 4×12×4 | (2, 6, 5) |

**メッシュ生成処理:**
1. 各パーツに対してBoxGeometryを作成
2. SkinParserのUV座標をジオメトリの各面に適用
3. THREE.Meshを作成し、pivotに基づいてグループ階層を構築
4. ルートGroupを返す

**テクスチャ管理:**
- 各モデルは独自のTHREE.Texture（スキンPNG）を使用
- 既存のテクスチャアトラス（ブロック用）とは別管理
- `THREE.NearestFilter`でMinecraftのピクセル感を維持

### 1.3 Animator

**責務:** モデルパーツのrotationを時間で更新し、アニメーションを実現する。

**ファイル:** `src/model/Animator.ts`

**アニメーション種類:**

| 名前 | 対象パーツ | 動き | 参考 |
|------|----------|------|------|
| Walk | 腕×2, 脚×2 | sin波で前後に振る | skinview3d WalkingAnimation |
| Idle | 頭, 腕 | 微小な揺れ（呼吸感） | skinview3d IdleAnimation |
| Attack | 右腕 | 振り下ろしモーション | skinview3d参考 |

**歩行アニメーション（skinview3d参考）:**
```
limbAngle = sin(time * speed) * amplitude
rightArm.rotation.x = -limbAngle
leftArm.rotation.x = limbAngle
rightLeg.rotation.x = limbAngle
leftLeg.rotation.x = -limbAngle
```

- `speed`: 移動速度に比例（静止時はIdleに遷移）
- `amplitude`: 約0.5ラジアン（≈29度）

**インターフェース:**
```typescript
interface Animator {
  update(dt: number, isMoving: boolean, moveSpeed: number): void;
  playAttack(): void;
}
```

---

## 2. ミニオンシステム

### 2.1 Minion クラス

**ファイル:** `src/entity/Minion.ts`

**Entityを継承:**
```typescript
class Minion extends Entity {
  team: Team;
  hp: number;           // 150
  moveSpeed: number;    // 3.5 blocks/s
  attackDamage: number; // 10
  attackRange: number;  // 2.0 blocks
  attackInterval: number; // 1.0秒
  model: THREE.Group;   // MobModelが生成
  animator: Animator;
  knockbackVelocity: { x: number, y: number, z: number };
}
```

**スタッツ定数:**

| パラメータ | 値 |
|---|---|
| MINION_HP | 150 |
| MINION_DAMAGE | 10 |
| MINION_ATTACK_INTERVAL | 1.0秒 |
| MINION_ATTACK_RANGE | 2.0 blocks |
| MINION_MOVE_SPEED | 3.5 blocks/s |

### 2.2 MinionAI

**ファイル:** `src/entity/MinionAI.ts`

**ターゲット優先度（LoL準拠）:**
1. 自分を攻撃中の敵ミニオン（最も近い）
2. 他の敵ミニオン（最も近い）
3. 敵構造物（保護チェーンで攻撃可能なもの）

※ミニオンはプレイヤーを攻撃しない（LoL ARAMと同様、ミニオンはチャンピオンを無視）。将来マルチプレイヤーで敵チャンピオンが追加された際に、「プレイヤーが近くの味方ミニオンを攻撃した場合にアグロ」のルールを追加する。

**状態:**
- `walking` — レーン中央（X=9）に向かいつつ敵方向へ前進
- `attacking` — 立ち止まってターゲットを攻撃
- `returning` — レーンからずれた場合、レーン中央に戻りながら前進

**レーン復帰パス:**
- 毎フレーム目標座標を計算: (X=LANE_CENTER, Z=現在Z+進行方向)
- 現在位置から目標への方向ベクトルで移動
- ノックバックでレーンから外れても自然にレーン中央に収束する

**状態遷移:**
```
walking → 射程内に敵発見 → attacking
attacking → ターゲット死亡 or 射程外 → walking
walking/attacking → ノックバック発生 → returning → レーン中央に復帰 → walking
```

### 2.3 MinionWaveManager

**ファイル:** `src/entity/MinionWaveManager.ts`

**責務:** ウェーブタイマー管理、ミニオンのスポーンと全体更新。

**定数:**

| パラメータ | 値 |
|---|---|
| WAVE_INTERVAL | 30.0秒 |
| WAVE_SIZE | 3体 |
| BLUE_SPAWN_Z | 10 |
| RED_SPAWN_Z | 200 |
| SPAWN_X | 9.0（レーン中央） |

**処理フロー:**
1. `update(dt)` でウェーブタイマーを進める
2. タイマー到達時、Blue/Red各3体をスポーン
3. 各ミニオンのAI更新（移動・戦闘判定）
4. 各ミニオンのAnimator更新
5. HP≤0のミニオンを削除（メッシュもsceneから除去）

**Game.tsとの統合:**
```typescript
// シミュレーションセクションに追加
this.minionWaveManager.update(dt, this.structures, this.player);
```

---

## 3. ノックバックシステム

**ファイル:** `src/physics/Knockback.ts`

**適用対象:** プレイヤー、ミニオン

**パラメータ:**

| 定数 | 値 | 説明 |
|------|-----|------|
| KNOCKBACK_HORIZONTAL | 3.0 blocks/s | 水平方向の初速 |
| KNOCKBACK_VERTICAL | 2.0 blocks/s | 上方向の初速（小ジャンプ） |
| KNOCKBACK_FRICTION | 10.0 | 減衰係数（約0.3秒で停止） |

**処理:**
1. ダメージ発生時、ダメージ源の位置から被ダメージ者への方向ベクトルを計算
2. 水平方向にKNOCKBACK_HORIZONTAL、垂直方向にKNOCKBACK_VERTICALの速度を付与
3. 毎フレーム摩擦で減衰: `velocity *= max(0, 1 - KNOCKBACK_FRICTION * dt)`
4. プレイヤー: 既存のPlayer.velocityYに上方速度を加算、水平はノックバック専用速度
5. ミニオン: 位置に直接速度を適用

**Minecraft風の見た目:**
- ダメージ時に少し浮き上がる（上方速度）
- 水平方向にスライドして減速停止
- 既存のScreenShake + ダメージフラッシュと同時発動

---

## 4. プレイヤーキャラクターモデル

### 4.1 一人称表示

**画面右下に右腕モデルを表示:**
- MobModelのプレイヤー定義から右腕パーツのみ取り出し
- カメラのchildとして配置（カメラに追従）
- 攻撃時にAttackアニメーション（腕を振り下ろす）
- 歩行時に微小な揺れ

### 4.2 三人称表示

**プレイヤーの背後にカメラを配置:**
- 全身モデルをシーンに配置、Player座標に追従
- 歩行時はWalkアニメーション
- カメラ距離: 約4ブロック後方

### 4.3 視点切り替え（F5キー）

**3段階サイクル:**
1. **一人称（デフォルト）** — 現在のFPSカメラ + 右腕表示
2. **三人称背面** — プレイヤー後方4ブロック + 全身モデル表示
3. **三人称前面** — プレイヤー前方4ブロック + 全身モデル表示（カメラ反転）

**切り替え時の処理:**
- 一人称: 腕モデル表示、全身モデル非表示
- 三人称: 腕モデル非表示、全身モデル表示
- カメラ位置・向きの再計算

**ファイル:** `src/player/ViewMode.ts`

---

## 5. TowerAI変更

### ターゲット優先度変更

**現在:** プレイヤーのみ攻撃
**変更後:**
1. 射程内のミニオン（最も近い）を優先攻撃
2. ミニオンが射程内にいなければプレイヤーを攻撃

**TowerAI.update()シグネチャ変更:**
```typescript
// 旧
update(dt, targetX, targetY, targetZ, targetAlive): FireCommand | null

// 新
update(dt, playerPos, playerAlive, minions: Minion[]): FireCommand | null
```

### ProjectileManager変更

**現在:** プレイヤー座標を固定追尾
**変更後:** ターゲットエンティティの座標を追尾

```typescript
// ターゲットインターフェース（既存のEntity/Playerの直接プロパティアクセスに合わせる）
interface ProjectileTarget {
  x: number;
  y: number;
  z: number;
  isAlive: boolean;
}
```

Entity（Minionの基底クラス）は既に`x`, `y`, `z`, `isAlive`を直接プロパティとして持つため、そのまま`ProjectileTarget`を満たす。

**注意:** Playerクラスは`isAlive`を持たない（`PlayerState`に分離されている）。プレイヤーをProjectileTargetとして扱う場合は、Game.tsでアダプターオブジェクトを構成する:
```typescript
{ x: player.x, y: player.y + PLAYER_HEIGHT / 2, z: player.z, isAlive: playerState.isAlive }
```

**各Projectileはターゲット参照を保持:**
生成時にProjectileTargetの参照を受け取り、update()で自動的にターゲット座標を追尾する。これにより、プレイヤー向けとミニオン向けの弾が個別のターゲットを追尾可能。

ミニオンへの命中判定も追加（既存のプレイヤー判定と同じ球体判定）。

---

## 6. バランス調整

| 変更対象 | 旧値 | 新値 | ファイル |
|---------|------|------|---------|
| PLAYER_MAX_HP | 100 | 500 | PlayerState.ts |
| TOWER_DAMAGE | 25 | 50 | TowerAI.ts |
| DEBUG_DAMAGE | 50 | 100 | Game.ts |

---

## 7. ファイル構成

### 新規作成

| ファイル | 責務 |
|---------|------|
| `src/model/SkinParser.ts` | スキンPNG → UV座標マップ |
| `src/model/MobModel.ts` | BoxGeometry組み立て → THREE.Group |
| `src/model/Animator.ts` | 歩行・待機・攻撃アニメーション |
| `src/model/ModelDefinitions.ts` | プレイヤー・羊のパーツ定義 |
| `src/entity/Minion.ts` | ミニオンエンティティ |
| `src/entity/MinionAI.ts` | ミニオンの戦闘AI・移動ロジック |
| `src/entity/MinionWaveManager.ts` | ウェーブスポーン管理 |
| `src/physics/Knockback.ts` | ノックバック物理 |
| `src/player/ViewMode.ts` | 一人称/三人称切り替え管理 |
| テストファイル各種 | 上記それぞれに対応 |

### 変更

| ファイル | 変更内容 |
|---------|---------|
| `src/player/PlayerState.ts` | PLAYER_MAX_HP: 100 → 500 |
| `src/entity/TowerAI.ts` | TOWER_DAMAGE: 25 → 50、ターゲット優先度変更 |
| `src/entity/ProjectileManager.ts` | ターゲットをエンティティベースに変更 |
| `src/entity/Projectile.ts` | ターゲットインターフェース対応 |
| `src/engine/Game.ts` | ミニオン更新ループ追加、視点切り替え、ノックバック統合 |
| `src/player/Player.ts` | ノックバック速度の追加 |
| `src/ui/HUD.ts` | ミニオンHP表示は今回スコープ外（将来追加） |

---

## 8. テクスチャ

| ファイル | 用途 |
|---------|------|
| `public/textures/mobs/player_default.png` | プレイヤースキン（64x64、Minecraft準拠） |
| `public/textures/mobs/minion_blue.png` | 青チーム羊スキン（64x64） |
| `public/textures/mobs/minion_red.png` | 赤チーム羊スキン（64x64） |

テクスチャはユーザーが別途作成中。現在のファイルをそのまま使用し、差し替え可能な設計とする。

---

## 9. 定数一覧

```typescript
// ミニオンスタッツ
MINION_HP = 150
MINION_DAMAGE = 10
MINION_ATTACK_INTERVAL = 1.0
MINION_ATTACK_RANGE = 2.0
MINION_MOVE_SPEED = 3.5

// ウェーブ
WAVE_INTERVAL = 30.0
WAVE_SIZE = 3
BLUE_SPAWN_Z = 10
RED_SPAWN_Z = 200
SPAWN_X = 9.0

// レーン
LANE_CENTER_X = 9.0

// ノックバック
KNOCKBACK_HORIZONTAL = 3.0
KNOCKBACK_VERTICAL = 2.0
KNOCKBACK_FRICTION = 10.0

// バランス調整
PLAYER_MAX_HP = 500
TOWER_DAMAGE = 50
DEBUG_DAMAGE = 100

// プレイヤーモデル
THIRD_PERSON_DISTANCE = 4.0
```
