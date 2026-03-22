# 素材＆ドロップシステム設計書

Issue: #24
Date: 2026-03-22
Status: Draft

## 概要

ミニオンキルで Minecraft素材（木・石・鉄・ダイヤ）をドロップするシステム。ラストヒットで多く、味方ミニオンキル時は近接で少量取得。最小限のインベントリ（素材ストック）も含む。

## 型定義

### 新規ファイル: `src/systems/types.ts`

```typescript
import { Team } from '../entity/Entity';

export type MaterialType = 'wood' | 'stone' | 'iron' | 'diamond';

export type DamageSource = 'player' | 'tower' | 'blue-minion' | 'red-minion';

export interface KillEvent {
  killedMinion: { x: number; z: number; team: Team };
  killedBy: DamageSource;
  waveNumber: number;
}

export interface MaterialDrop {
  type: MaterialType;
  amount: number;
}
```

- `DamageSource` は文字列リテラルユニオン型（将来オブジェクト型に拡張可能）
- `MaterialType` も同様にシンプルな文字列リテラル
- `KillEvent` は `consumePlayerDamage()` パターンに倣いキューで消費される

## 既存クラスの変更

### Entity.ts

`takeDamage` のシグネチャにオプショナル `source` 引数を追加:

```typescript
takeDamage(amount: number, source?: DamageSource): void
```

- `source` はオプショナルで後方互換を維持
- Entity基底クラスでは `source` を使用しない（Minionサブクラスで利用）

### Minion.ts

- `lastDamagedBy: DamageSource | undefined` フィールドを追加
- `waveNumber: number` フィールドを追加（コンストラクタ引数）
- `takeDamage` をオーバーライドし、`source` があれば `lastDamagedBy` に記録

### MinionWaveManager.ts

- `pendingKillEvents: KillEvent[]` 配列を追加
- 死亡ミニオン除去ループで、死亡した各ミニオンに対して `KillEvent` を生成
- `consumeKillEvents(): KillEvent[]` メソッドを追加（`consumePlayerDamage()` パターン）
- `spawnSingleMinion` で `waveNumber` をMinionに渡す
- ミニオン同士の攻撃時に `DamageSource` を渡す（`'blue-minion'` / `'red-minion'`）

### Game.ts

- `gameElapsedTime: number = 0` フィールドを追加、毎フレーム `dt` を加算
- `DropSystem` と `Inventory` のインスタンスを保持
- プレイヤーのミニオン攻撃時に `takeDamage(amount, 'player')` でソースを渡す
- タワーのプロジェクタイルヒット時に `takeDamage(amount, 'tower')` でソースを渡す
- メインループでミニオン更新後に `consumeKillEvents()` → `DropSystem.processKillEvents()` を呼び出す
- HUDの素材表示を更新

### HUD.ts

- `showMaterialDrop(drops: MaterialDrop[])` メソッドを追加
- 既存の `showProtected()` パターンを応用（フィードバック表示 → タイマーで非表示）
- `material-drop-notification` HTML要素を使用

### index.html

- `material-drop-notification` div要素を追加（画面中央やや下）
- `material-inventory` div要素を追加（画面左下、常時表示）

## 新規クラス

### `src/systems/DropTable.ts`

経過時間から確率テーブルを算出するステートレスクラス。

- `getProbabilities(elapsedSeconds: number)` — `GameBalance.DROP.PROBABILITY_TABLE` 間を**線形補間**して4素材の確率を返す
- `rollMaterial(elapsedSeconds: number): MaterialType` — 累積確率で1つの素材を抽選
- 1200秒以降は最後のテーブル値で固定（外挿しない）
- 内部状態を持たない純粋な計算クラス

### `src/systems/Inventory.ts`

最小限の素材ストッククラス（Issue #25で本格実装される予定の先行実装）。

- `materials: Map<MaterialType, number>` — 各素材の所持数
- `add(type: MaterialType, amount: number): void` — 加算
- `get(type: MaterialType): number` — 取得
- `getAll(): Record<MaterialType, number>` — 全素材の所持数を返す

### `src/systems/DropSystem.ts`

キルイベントを処理してドロップ判定とインベントリ加算を行うクラス。

- コンストラクタ引数: `DropTable`, `Inventory`
- `processKillEvents(events: KillEvent[], playerX: number, playerZ: number, elapsedSeconds: number): MaterialDrop[]`
  - 各イベントに対して:
    - **ラストヒット** (`killedBy === 'player'`): `DROP.LAST_HIT_MIN` 〜 `DROP.LAST_HIT_MAX` 個ドロップ
    - **近接ドロップ** (`killedBy !== 'player'` かつプレイヤーが `DROP.PROXIMITY_RADIUS` 以内 かつ敵ミニオンの死亡): `DROP.PROXIMITY_MIN` 〜 `DROP.PROXIMITY_MAX` 個ドロップ
    - 味方ミニオン（blueチーム）の死亡はドロップ対象外
  - ウェーブボーナス: `baseAmount + floor(waveNumber * MINION_SCALING.DROP_BONUS_PER_WAVE)`
  - `DropTable.rollMaterial()` で各アイテムの素材タイプを決定
  - `Inventory.add()` で即時加算
  - ドロップ結果 `MaterialDrop[]` を返す（HUD通知用）

## ドロップフローの全体像

```
プレイヤー攻撃 → Minion.takeDamage(amount, 'player')
                    → lastDamagedBy = 'player'
                    → hp === 0 → isAlive = false

MinionWaveManager.update() → 死亡ミニオン検出
                           → KillEvent生成（lastDamagedBy, waveNumber, 位置）
                           → pendingKillEventsに追加

Game.update() → consumeKillEvents()
              → DropSystem.processKillEvents()
                → ラストヒット判定 or 近接判定
                → DropTable.rollMaterial() × N回
                → Inventory.add()
                → MaterialDrop[] を返す
              → HUD.showMaterialDrop(drops)
              → HUD.updateInventory(inventory.getAll())
```

## HUD設計

### 素材取得通知（一時表示）

- 画面中央やや下に「木 ×3 獲得」のようなテキストを表示
- 2秒後に自動非表示
- 複数素材の場合は改行で連結（例: 「木 ×2 / 石 ×1 獲得」）
- 色はMinecraft風に素材に応じて変更:
  - 木: `#c4a05e`
  - 石: `#aaaaaa`
  - 鉄: `#e8e8e8`
  - ダイヤ: `#5ce8d6`

### 素材インベントリ表示（常時表示）

- 画面左下に小さく常時表示
- 所持数が0でない素材のみ表示
- フォーマット: `木:3 石:1 鉄:0 ダイヤ:0`（全素材を常に表示する方が視認性が良い）

## DamageSource記録の対象箇所

| 箇所 | ソース | ファイル |
|------|--------|----------|
| プレイヤーがミニオンを攻撃 | `'player'` | Game.ts L464 |
| ミニオン同士の攻撃 | `'blue-minion'` / `'red-minion'` | MinionWaveManager.ts L141 |
| タワーのプロジェクタイルがミニオンにヒット | `'tower'` | Game.ts L284 |

## テスト計画

### ユニットテスト

1. **DropTable.test.ts**
   - `getProbabilities(0)` が初期確率テーブルと一致
   - `getProbabilities(1200)` が最終テーブルと一致
   - `getProbabilities(150)` が0秒と300秒の中間値（線形補間）
   - `getProbabilities(2000)` が1200秒と同じ（外挿なし）
   - `rollMaterial()` が有効な `MaterialType` を返す

2. **DropSystem.test.ts**
   - ラストヒット時にLAST_HIT_MIN〜LAST_HIT_MAX個のドロップ
   - 近接判定: 範囲内でドロップ、範囲外でドロップなし
   - 味方ミニオン死亡ではドロップなし
   - ウェーブボーナスが正しく適用される
   - ドロップ結果がインベントリに加算される

3. **Inventory.test.ts**
   - add/get/getAllの基本動作

## 影響範囲

- **新規ファイル**: `src/systems/types.ts`, `src/systems/DropTable.ts`, `src/systems/DropSystem.ts`, `src/systems/Inventory.ts`
- **テスト**: `src/systems/DropTable.test.ts`, `src/systems/DropSystem.test.ts`, `src/systems/Inventory.test.ts`
- **変更ファイル**: `Entity.ts`, `Minion.ts`, `MinionWaveManager.ts`, `Game.ts`, `HUD.ts`, `index.html`
- **参照のみ**: `GameBalance.ts`（既にDROP定数が定義済み、変更不要）
