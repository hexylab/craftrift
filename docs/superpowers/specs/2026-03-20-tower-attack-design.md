# タワー攻撃AI 設計仕様

## 概要

タワーとネクサスに攻撃AIを追加する。射程内の敵チームプレイヤーに対してホーミングプロジェクタイル（弾速控えめで回避余地あり）を発射し、PlayerState.takeDamage()でダメージを与える。被弾時は画面シェイク＋赤フラッシュ、射程内ではHUD警告を表示する。

## 定数

| 定数 | 値 | 説明 |
|------|-----|------|
| `TOWER_ATTACK_RANGE` | 15.0 | タワー中心からの攻撃射程（ブロック） |
| `TOWER_ATTACK_INTERVAL` | 2.0 | 攻撃間隔（秒） |
| `TOWER_DAMAGE` | 25 | 弾1発のダメージ（HP100に対し4発で死亡） |
| `PROJECTILE_SPEED` | 8.0 | 弾速（blocks/s）。プレイヤー移動速度4.3の約1.9倍 |
| `PROJECTILE_RADIUS` | 0.2 | 弾の当たり判定半径（直径0.4ブロック） |
| `PROJECTILE_MAX_LIFETIME` | 5.0 | 弾の最大生存時間（秒）。無限追尾防止 |
| `SCREEN_SHAKE_INTENSITY` | 0.15 | シェイクの最大振幅（ブロック） |
| `SCREEN_SHAKE_DURATION` | 0.2 | シェイクの持続時間（秒） |
| `DAMAGE_FLASH_DURATION` | 0.15 | 赤フラッシュの持続時間（秒） |

## ファイル構成

### 新規作成

#### `src/entity/TowerAI.ts`

タワー1基分の攻撃AIロジック。射程判定、攻撃間隔管理、発射判定を担当。

```typescript
export const TOWER_ATTACK_RANGE = 15.0;
export const TOWER_ATTACK_INTERVAL = 2.0;
export const TOWER_DAMAGE = 25;

export interface FireCommand {
  originX: number;
  originY: number;
  originZ: number;
  damage: number;
}

export class TowerAI {
  private attackTimer: number = 0;

  constructor(readonly structure: Structure) {}

  update(dt: number, targetX: number, targetY: number, targetZ: number, targetAlive: boolean): FireCommand | null;

  getCenterX(): number;  // structure.x + structure.width / 2
  getCenterY(): number;  // structure.y + structure.height / 2
  getCenterZ(): number;  // structure.z + structure.depth / 2

  isInRange(targetX: number, targetY: number, targetZ: number): boolean;
}
```

**`update(dt, targetX, targetY, targetZ, targetAlive)`:**
1. `!structure.isAlive` → return null（破壊済みタワーは攻撃しない）
2. `!targetAlive` → return null（死亡中のプレイヤーは攻撃しない）
3. タワー中心とターゲット間の距離を計算
4. 射程外 → `attackTimer = 0`, return null（射程に入り直すとクールダウンから再開）
5. 射程内 → `attackTimer += dt`
6. `attackTimer >= TOWER_ATTACK_INTERVAL` → `attackTimer -= TOWER_ATTACK_INTERVAL`, return FireCommand
7. それ以外 → return null

**タワー中心の計算:**
- `getCenterX()`: `structure.x + structure.width / 2`
- `getCenterY()`: `structure.y + structure.height / 2`
- `getCenterZ()`: `structure.z + structure.depth / 2`

**isInRange():** タワー中心からターゲットまでのユークリッド距離が`TOWER_ATTACK_RANGE`以下。

#### `src/entity/TowerAI.test.ts`

テスト項目:
- 初期状態: attackTimerは0
- 射程内でattackInterval経過後にFireCommandを返す
- 射程外ではnullを返す
- 破壊されたタワーはnullを返す
- ターゲットが死亡中はnullを返す
- 射程外に出るとタイマーリセットされる
- getCenterX/Y/Zが正しい値を返す
- isInRangeが正しく判定する
- 射程ぴったり（境界値）のテスト

#### `src/entity/Projectile.ts`

弾1発分のデータと更新ロジック。ホーミング移動と衝突判定。

```typescript
export const PROJECTILE_SPEED = 8.0;
export const PROJECTILE_RADIUS = 0.2;
export const PROJECTILE_MAX_LIFETIME = 5.0;

export class Projectile {
  x: number;
  y: number;
  z: number;
  readonly damage: number;
  readonly team: Team;
  private lifetime: number = 0;
  alive: boolean = true;

  constructor(x: number, y: number, z: number, damage: number, team: Team);

  update(dt: number, targetX: number, targetY: number, targetZ: number): boolean;
  // trueを返したらヒット

  isExpired(): boolean;
}
```

**`update(dt, targetX, targetY, targetZ)`:**
1. `lifetime += dt`
2. `lifetime >= PROJECTILE_MAX_LIFETIME` → `alive = false`, return false
3. ターゲットへの方向ベクトルを計算し正規化
4. `x += dirX * PROJECTILE_SPEED * dt` 等で移動
5. ターゲットとの距離が`PROJECTILE_RADIUS + PLAYER_HALF_WIDTH`以下 → `alive = false`, return true（ヒット）
   - 判定はプレイヤーの中心（x, y + PLAYER_HEIGHT/2, z）との球-球近似で十分
6. return false

**ヒット判定の簡略化:** プレイヤーの当たり判定は球近似（中心 = プレイヤー位置 + 高さ/2、半径 = `PLAYER_HEIGHT / 2`）。AABBとの正確な判定は不要で、球-球判定でゲームプレイ上十分。

#### `src/entity/Projectile.test.ts`

テスト項目:
- 初期状態: alive=true, lifetime=0
- ホーミング移動: ターゲットに向かって移動する
- ヒット判定: ターゲットに十分近づくとtrueを返しalive=false
- 最大生存時間: lifetime超過でalive=false
- ターゲットが離れても追尾を続ける

#### `src/entity/ProjectileManager.ts`

全弾の一元管理。Three.js Meshの生成・更新・削除を担当。

```typescript
export class ProjectileManager {
  private projectiles: Projectile[] = [];
  private meshes: Map<Projectile, THREE.Mesh> = new Map();

  constructor(private scene: THREE.Scene);

  spawn(command: FireCommand, team: Team): void;
  update(dt: number, targetX: number, targetY: number, targetZ: number): HitResult[];
  dispose(): void;
}
```

**`spawn(command, team)`:**
1. 新しいProjectileを作成
2. SphereGeometry(PROJECTILE_RADIUS, 8, 8)でMeshを作成
3. マテリアル: チーム色（red → 赤系 #ff4444, blue → 青系 #4444ff）、emissive付きで光る
4. Meshをsceneに追加、mapに登録

**`update(dt, targetX, targetY, targetZ)`:**
1. 各弾のupdate()を呼ぶ
2. ヒットした弾の情報をHitResult[]として返す
3. alive=falseの弾: Meshをsceneから削除、geometryをdispose、mapから削除
4. Mesh位置を弾位置と同期

**`HitResult`:** `{ damage: number, team: Team }`

**`dispose()`:** 全弾のMeshを削除。ゲーム終了時用。

#### `src/entity/ProjectileManager.test.ts`

テスト項目:
- spawn: 弾が生成される
- update: 弾が移動する
- update: ヒット時にHitResultを返す
- update: 期限切れの弾が削除される

注意: Three.jsのMesh生成はモック化する。ロジックテストに集中。

#### `src/effects/ScreenShake.ts`

ダメージ時の画面シェイクエフェクト。全ダメージソース共通。

```typescript
export const SCREEN_SHAKE_INTENSITY = 0.15;
export const SCREEN_SHAKE_DURATION = 0.2;

export class ScreenShake {
  private timer: number = 0;
  private intensity: number = 0;

  trigger(intensity?: number): void;
  update(dt: number): { offsetX: number; offsetY: number };
}
```

**`trigger(intensity?)`:**
1. `timer = SCREEN_SHAKE_DURATION`
2. `intensity = intensity ?? SCREEN_SHAKE_INTENSITY`

**`update(dt)`:**
1. `timer <= 0` → return `{ offsetX: 0, offsetY: 0 }`
2. `timer -= dt`
3. 減衰率: `timer / SCREEN_SHAKE_DURATION`
4. `offsetX = (Math.random() * 2 - 1) * intensity * 減衰率`
5. `offsetY = (Math.random() * 2 - 1) * intensity * 減衰率`
6. return `{ offsetX, offsetY }`

#### `src/effects/ScreenShake.test.ts`

テスト項目:
- 初期状態: オフセットは0
- trigger後: オフセットが非ゼロになる
- 時間経過で減衰し、最終的に0に戻る
- 複数回triggerで上書きされる

### 変更ファイル

#### `src/ui/HUD.ts`

追加するDOM要素参照:
```typescript
private towerWarningEl: HTMLElement | null;
private damageFlashEl: HTMLElement | null;
private damageFlashTimer: number = 0;
```

追加メソッド:
```typescript
showTowerWarning(): void;   // 「タワーに狙われています」表示
hideTowerWarning(): void;   // 警告非表示
triggerDamageFlash(): void;  // 赤フラッシュ発動
updateDamageFlash(dt: number): void;  // フラッシュのフェードアウト更新
```

**`showTowerWarning()`:** `towerWarningEl.style.display = 'block'`
**`hideTowerWarning()`:** `towerWarningEl.style.display = 'none'`
**`triggerDamageFlash()`:** `damageFlashEl.style.display = 'block'`, `damageFlashEl.style.opacity = '0.3'`, `damageFlashTimer = DAMAGE_FLASH_DURATION`
**`updateDamageFlash(dt)`:**
1. `damageFlashTimer <= 0` → return
2. `damageFlashTimer -= dt`
3. `opacity = (damageFlashTimer / DAMAGE_FLASH_DURATION) * 0.3`
4. `damageFlashTimer <= 0` → `display = 'none'`

#### `src/ui/HUD.test.ts`

追加テスト:
- showTowerWarning: 警告が表示される
- hideTowerWarning: 警告が非表示になる
- triggerDamageFlash: フラッシュが表示される
- updateDamageFlash: 時間経過でフェードアウトする

#### `index.html`

新しいDOM要素:

```html
<!-- タワー警告: 画面上部中央 -->
<div id="tower-warning" style="
  display: none;
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  font-family: monospace;
  font-size: 14px;
  color: #ff6666;
  background: rgba(0,0,0,0.5);
  padding: 4px 12px;
  border-radius: 4px;
  pointer-events: none;
  z-index: 10;
">タワーに狙われています</div>

<!-- 被弾フラッシュ: 全画面 -->
<div id="damage-flash" style="
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(255, 0, 0, 0.3);
  pointer-events: none;
  z-index: 40;
"></div>
```

**z-indexレイヤリング更新:**

| 要素 | z-index | 備考 |
|------|---------|------|
| crosshair | 10 | 常時表示 |
| player-hp | 10 | 常時表示 |
| target-info | 10 | 構造物照準時のみ |
| tower-warning | 10 | 射程内のみ |
| combat-feedback | 10 | 一時表示 |
| instructions | 20 | ポインターロック前 |
| damage-flash | 40 | 被弾時。死亡オーバーレイの下 |
| death-overlay | 50 | 死亡中 |
| victory-screen | 100 | ゲーム終了 |

#### `src/engine/Game.ts`

**import追加:**
```typescript
import { TowerAI } from '../entity/TowerAI';
import { ProjectileManager } from '../entity/ProjectileManager';
import { ScreenShake } from '../effects/ScreenShake';
```

**フィールド追加:**
```typescript
private towerAIs!: TowerAI[];
private projectileManager!: ProjectileManager;
private screenShake!: ScreenShake;
```

**init()変更:**
- 各構造物（タワー＋ネクサス）に対してTowerAIを作成
- ProjectileManagerをscene参照付きで作成
- ScreenShakeを作成

**update(dt, time)変更:**

ゲームループ内のフローを以下に変更:

```
1. instructionsEl表示制御
2. pointer lock チェック → return if not locked
3. gameOver チェック → return if game over
4. playerState.update(dt)（既存）
   - リスポーン発生 → 位置リセット, hideDeathScreen()
5. 死亡チェック（既存）
   - 死亡中: showDeathScreen, consume入力 → return
6. カメラ回転（既存）
7. ジャンプ・物理（既存）
8. WASD移動（既存）
9. カメラ位置更新（既存）
10. === 新規: タワーAI更新 ===
    - 各towerAI.update(dt, playerX, playerY, playerZ, playerState.isAlive)
    - FireCommand返却 → projectileManager.spawn()
11. === 新規: プロジェクタイル更新 ===
    - projectileManager.update(dt, playerX, playerY+PLAYER_HEIGHT/2, playerZ)
    - HitResult[] → 各ヒットに対して:
      - playerState.takeDamage(hit.damage)
      - screenShake.trigger()
      - hud.triggerDamageFlash()
12. === 新規: 画面シェイク適用 ===
    - screenShake.update(dt) → カメラにオフセット追加
13. === 新規: タワー警告HUD ===
    - いずれかの敵TowerAIのisInRange() → showTowerWarning / hideTowerWarning
14. === 新規: ダメージフラッシュ更新 ===
    - hud.updateDamageFlash(dt)
15. レイキャスト・戦闘（既存）
16. ブロック操作（既存）
17. ターゲット情報表示（既存）
18. === 変更: デバッグKキー ===
    - takeDamage + screenShake.trigger() + hud.triggerDamageFlash()
19. プレイヤーHP HUD更新（既存）
```

**画面シェイクの適用方法:**
- カメラの実位置(eyeX, eyeY, eyeZ)にシェイクオフセットを加えた位置をFPSCameraにセット
- 次フレームのカメラ位置更新（ステップ9）で実位置に戻るため、オフセットは1フレーム限り自然にリセットされる
- ステップ12でシェイクのオフセットをカメラに追加適用する

**タワー警告の判定:**
- 敵チームのTowerAI配列をフィルタし、いずれか1つでもisInRange()がtrueなら警告表示
- 現時点ではプレイヤーはblue → redチームのTowerAIのみチェック

## 拡張ポイント

1. **ターゲット選択**: 現在は「最も近い敵」（プレイヤー1人）。将来ミニオン追加時に優先度ロジック（ミニオン優先等）に差し替え可能
2. **ProjectileManager.update()のターゲット引数**: 現在はプレイヤー位置のみ。将来は複数ターゲットに対応させ、弾ごとにターゲットIDを持たせる
3. **チーム判定**: 現在はred TowerAIのみがプレイヤーを攻撃。将来の敵チャンピオン追加時にblue TowerAIも機能する

## テスト方針

- TowerAI: 純粋ロジックテスト（DOM・Three.js不要）
- Projectile: 純粋ロジックテスト（移動・衝突判定）
- ProjectileManager: Three.jsモック化してロジックテスト
- ScreenShake: 純粋ロジックテスト
- HUD拡張: jsdom環境でのDOMテスト（既存パターン踏襲）
- 統合: 手動プレイテスト（タワー射程に入って弾が飛んでくることを確認）
