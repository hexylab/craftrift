# プレイヤーHP/死亡/リスポーン 設計仕様

## 概要

プレイヤーにHP、死亡、リスポーンの仕組みを追加する。現時点ではダメージソースはデバッグキーのみだが、将来のタワーAI・ミニオン・チャンピオンシステムのダメージ受け口として機能する基盤を構築する。

## 定数

| 定数 | 値 | 説明 |
|------|-----|------|
| `PLAYER_MAX_HP` | 100 | プレイヤー最大HP |
| `RESPAWN_TIME` | 5.0 | リスポーン待ち時間（秒） |
| `INVINCIBLE_TIME` | 3.0 | リスポーン後の無敵時間（秒） |
| `DEBUG_DAMAGE` | 50 | デバッグキー（K）で受けるダメージ |

## ファイル構成

### 新規作成

#### `src/player/PlayerState.ts`

プレイヤーのHP・死亡・リスポーン・無敵状態を管理する。Player（物理）とは分離し、Game.tsで連携する。

**なぜPlayerクラスに直接追加しないか:** Playerは物理エンジン（移動・衝突・重力）に集中している。HP/死亡/リスポーンは別の責務であり、将来のインベントリドロップ等の拡張を考慮すると分離が望ましい。

**なぜEntityを継承しないか:** Entityはposition（x, y, z）をバンドルしており、Playerも独自のposition管理を持つ。PlayerStateがEntityを継承するとpositionが二重管理になる。HP/isAliveのロジックは単純なので重複コストは低い。将来的にプレイヤーがタワーAI等の攻撃対象になる場合、Entity互換のインターフェースを追加することで対応可能。

```typescript
export const PLAYER_MAX_HP = 100;
export const RESPAWN_TIME = 5.0;
export const INVINCIBLE_TIME = 3.0;

export class PlayerState {
  hp: number = PLAYER_MAX_HP;
  readonly maxHp: number = PLAYER_MAX_HP;
  isAlive: boolean = true;
  respawnTimer: number = 0;
  invincibleTimer: number = 0;
  private onDeathCallback: (() => void) | null = null;

  onDeath(callback: () => void): void;
  takeDamage(amount: number): void;
  update(dt: number): boolean;  // リスポーンが発生したらtrueを返す
  respawn(): void;
  isInvincible(): boolean;
}
```

**`takeDamage(amount)`:**
1. `!isAlive` → return（死亡中は無視）
2. `isInvincible()` → return（無敵中は無視）
3. `amount <= 0` → return
4. `hp = Math.max(0, hp - amount)`
5. `hp === 0` → `isAlive = false`, `respawnTimer = RESPAWN_TIME`, `onDeathCallback?.()`

**`update(dt)`:**
1. 死亡中: `respawnTimer -= dt`。`respawnTimer <= 0` → `respawn()`, return true
2. 無敵中: `invincibleTimer -= dt`。`invincibleTimer <= 0` → `invincibleTimer = 0`
3. return false

**`respawn()`:**
1. `hp = maxHp`
2. `isAlive = true`
3. `respawnTimer = 0`
4. `invincibleTimer = INVINCIBLE_TIME`

**`isInvincible()`:** `invincibleTimer > 0`

#### `src/player/PlayerState.test.ts`

テスト項目:
- 初期状態: hp=100, isAlive=true, invincibleTimer=0
- takeDamage: HPが減少する
- takeDamage: HP 0で死亡（isAlive=false）
- takeDamage: 死亡中は無視される
- takeDamage: 無敵中は無視される
- takeDamage: amount <= 0は無視される
- takeDamage: HPは0未満にならない（オーバーキル: takeDamage(150)でHP=0）
- onDeathコールバック: 死亡時に呼ばれる
- update: 死亡中にrespawnTimerがカウントダウンされる
- update: respawnTimer到達でrespawnが呼ばれtrue返却
- update: 無敵タイマーがカウントダウンされる
- respawn: HP全回復、isAlive=true、無敵タイマー設定

### 変更ファイル

#### `src/ui/HUD.ts`

既存のHUDクラスに以下を追加:

```typescript
// 新しいDOM要素参照（constructorで取得）
private playerHpBarFillEl: HTMLElement | null;
private playerHpTextEl: HTMLElement | null;
private deathOverlayEl: HTMLElement | null;
private respawnTimerEl: HTMLElement | null;

// 新メソッド
updatePlayerHp(hp: number, maxHp: number, isInvincible: boolean): void;
showDeathScreen(remainingTime: number): void;
hideDeathScreen(): void;
```

**`updatePlayerHp(hp, maxHp, isInvincible)`:**
1. HPバーの幅を`(hp/maxHp * 100)%`に設定
2. 色: 既存のターゲットHPバーと同じルール（緑>50%, 黄25-50%, 赤<25%）
3. テキスト: `` `${hp} / ${maxHp}` ``
4. 無敵中: バーの色を白(#ffffff)に変更して視覚的フィードバック

**`showDeathScreen(remainingTime)`:**
1. 暗転オーバーレイを表示（display: flex）
2. カウントダウンテキスト更新: `Math.ceil(remainingTime)`秒

**`hideDeathScreen()`:**
1. 暗転オーバーレイを非表示（display: none）

#### `src/ui/HUD.test.ts`

追加テスト項目:
- updatePlayerHp: HPバー幅が正しく設定される
- updatePlayerHp: 無敵中は色が白になる
- showDeathScreen: オーバーレイが表示される
- showDeathScreen: カウントダウンが正しい
- hideDeathScreen: オーバーレイが非表示になる

**注意:** 既存の`setupDOM()`関数に`player-hp-bar-fill`, `player-hp-text`, `death-overlay`, `respawn-timer`要素を追加する必要がある。HUDのnullチェックパターンにより、DOM要素が存在しないとメソッドが無操作になるため。

#### `index.html`

新しいDOM要素を追加:

```html
<!-- プレイヤーHPバー: 画面下部中央 -->
<div id="player-hp" style="
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  font-family: monospace;
  color: white;
  pointer-events: none;
  z-index: 10;
">
  <div id="player-hp-bar-container" style="
    width: 200px;
    height: 10px;
    background: rgba(0,0,0,0.6);
    border-radius: 5px;
    overflow: hidden;
  ">
    <div id="player-hp-bar-fill" style="
      height: 100%;
      width: 100%;
      background-color: #44bb44;
      transition: width 0.1s;
    "></div>
  </div>
  <div id="player-hp-text" style="font-size: 12px; margin-top: 2px; opacity: 0.8;">100 / 100</div>
</div>

<!-- 死亡オーバーレイ -->
<div id="death-overlay" style="
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  color: white;
  font-family: monospace;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  z-index: 50;
">
  <h2 style="font-size: 2.5rem; color: #dd3333;">DEAD</h2>
  <p id="respawn-timer" style="font-size: 1.5rem; margin-top: 1rem;">リスポーンまで: 5秒</p>
</div>
```

#### `src/engine/Game.ts`

**import追加:**
```typescript
import { PlayerState } from '../player/PlayerState';
```

**フィールド追加:**
```typescript
private playerState!: PlayerState;
```

**init()変更:**
- `PlayerState`を作成
- `onDeath`コールバックを設定（将来のインベントリドロップ拡張ポイント）

**update(dt, time)変更:**

ゲームループ内のフローを以下に変更:

```
1. instructionsEl表示制御
2. pointer lock チェック → return if not locked
3. gameOver チェック → return if game over
4. playerState.update(dt)
   - リスポーン発生 → プレイヤー位置をSPAWN_POSITIONにリセット, velocityY=0, onGround=false, hideDeathScreen()
5. 死亡チェック（!playerState.isAlive）
   - 死亡中: showDeathScreen(respawnTimer), consumeLeftClick, consumeRightClick → return
6. カメラ回転（既存）
7. ジャンプ・物理（既存）
8. WASD移動（既存）
9. カメラ位置更新（既存）
10. レイキャスト・戦闘（既存）
11. デバッグキーKチェック → playerState.takeDamage(DEBUG_DAMAGE)
12. プレイヤーHP HUD更新: hud.updatePlayerHp(...)
```

**死亡時の操作制御:**
- 死亡中は移動・ジャンプ・視点回転・攻撃・ブロック操作がすべて無効
- 左クリック・右クリックはconsumeして捨てる（リスポーン後に残らないように）

**デバッグキー:**
- Kキー: `playerState.takeDamage(50)` — 2回押せば死亡を確認可能
- `consumeKeyPress`を使用し、1回の押下で1回だけダメージが発生することを保証する

#### `src/engine/InputManager.ts`

**追加:**
```typescript
private pressedKeys = new Set<string>();

// keydownイベントハンドラに追加:
// e.repeat === falseの場合のみpressedKeysに追加（キーリピート防止）
if (!e.repeat) {
  this.pressedKeys.add(e.code);
}

consumeKeyPress(code: string): boolean;
```

`consumeKeyPress`は`consumeLeftClick`と同じパターンで、キーの押下をフレーム単位で消費する。これによりKキーの1回押し=1回ダメージが保証される。

**`consumeKeyPress(code)`:**
1. `pressedKeys.has(code)` → `pressedKeys.delete(code)`, return true
2. それ以外 → return false

**キーリピート対策:** `keydown`イベントの`e.repeat`プロパティをチェックし、リピートイベントでは`pressedKeys`に追加しない。これにより、キーを押しっぱなしにしても1フレーム分のダメージしか発生しない。

#### `src/engine/InputManager.test.ts`（既存テストに追加）

- consumeKeyPress: キー押下を1回だけ消費する
- consumeKeyPress: 消費後は次の押下までfalse

## ゲームフロー図

```
[通常プレイ] → ダメージ受ける → HP減少
  ↓ HP=0
[死亡] → 操作不可、暗転+カウントダウン表示
  ↓ 5秒経過
[リスポーン] → SPAWN_POSITION移動、velocityY=0リセット、HP全回復、3秒無敵
  ↓
[通常プレイ（無敵中）] → HPバー白色、ダメージ無効
  ↓ 3秒経過
[通常プレイ]
```

## z-indexレイヤリング

| 要素 | z-index | 備考 |
|------|---------|------|
| crosshair | 10 | 常時表示 |
| player-hp | 10 | 常時表示、死亡オーバーレイの背面に隠れる（意図的） |
| target-info | 10 | 構造物照準時のみ表示 |
| combat-feedback | 10 | 一時表示 |
| instructions | 20 | ポインターロック前のみ表示 |
| death-overlay | 50 | 死亡中のみ表示。HP=0の状態を暗転で覆うため、HPバーが見える必要はない |
| victory-screen | 100 | ゲーム終了時。死亡オーバーレイより上に表示される |

**gameOver中の死亡:** `gameOver`チェック（ステップ3）は`playerState.update`（ステップ4）より前にあるため、gameOver後は死亡タイマーが進行しない。現時点ではプレイヤーへのダメージソースがデバッグキーのみなので実質問題にならないが、将来タワーAI等でgameOverと同時に死亡する可能性がある場合は、gameOver判定をupdate後に移動するか、gameOver時に死亡オーバーレイを強制非表示にする対応が必要。

## 拡張ポイント

1. **`onDeath`コールバック**: 将来のインベントリドロップ処理のフック。Game.tsのinit()で設定。現時点では空。
2. **`RESPAWN_TIME`定数**: 将来スケーリング（死亡回数やゲーム時間ベース）に変更可能。
3. **`INVINCIBLE_TIME`定数**: 調整可能。
4. **`takeDamage`メソッド**: 将来、ダメージタイプ（物理/魔法）やアーマーシステムを追加する際のエントリポイント。

## テスト方針

- PlayerState: 純粋なロジックテスト（DOM不要）
- HUD拡張: jsdom環境でのDOMテスト（既存パターン踏襲）
- InputManager拡張: キーイベントシミュレーションテスト
- Game.ts統合: 手動プレイテスト（Kキーで死亡→リスポーン確認）
