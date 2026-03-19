# ARAMゲームシステム Phase 3: HP/ダメージ基盤 + 構造物

## 概要

ARAMゲームシステムの第一弾として、HP/ダメージの基盤とタワー・ネクサスの構造物を実装する。プレイヤーはBlue側として、Red側の構造物（T2 → T1 → ネクサス）を順番に破壊し、ネクサス破壊で勝利する。

## スコープ

### 含む
- エンティティシステム（Entity基底クラス、Structureクラス）
- 構造物（タワー×4、ネクサス×2）のマップ配置
- マップサイズ拡張（15×10×84 → 19×10×210）
- 攻撃システム（左クリック + クールダウン0.5秒）
- 構造物の順序制約（T2 → T1 → ネクサス）
- HP表示HUD（HTML/CSSオーバーレイ）
- 勝利条件（ネクサス破壊で勝利画面）

### 含まない
- プレイヤーHP / 死亡 / リスポーン
- タワーの攻撃AI / プロジェクタイル
- ミニオン / チャンピオン / スキル
- マルチプレイヤー

## 1. エンティティシステム

### Entity（基底クラス）

```typescript
// src/entity/Entity.ts
export type Team = 'blue' | 'red';

export class Entity {
  readonly id: string;
  readonly team: Team;
  x: number;
  y: number;
  z: number;
  hp: number;
  readonly maxHp: number;
  isAlive = true;

  constructor(id: string, team: Team, x: number, y: number, z: number, maxHp: number) {
    this.id = id;
    this.team = team;
    this.x = x;
    this.y = y;
    this.z = z;
    this.hp = maxHp;
    this.maxHp = maxHp;
  }

  takeDamage(amount: number): void {
    if (!this.isAlive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.isAlive = false;
    }
  }
}
```

- `id`はユニーク識別子（例: `"blue-t1"`, `"red-nexus"`）
- `x, y, z`は構造物の基準座標（左下手前の角）
- `hp`は現在HP、`maxHp`は最大HP
- `takeDamage`はHP=0で`isAlive = false`に設定

### Structure（構造物）

```typescript
// src/entity/Structure.ts
export type StructureType = 'tower' | 'nexus';

export class Structure extends Entity {
  readonly structureType: StructureType;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly blockType: BlockType;
  protectedBy: Structure | null;

  isProtected(): boolean {
    return this.protectedBy !== null && this.protectedBy.isAlive;
  }

  takeDamage(amount: number): void {
    if (this.isProtected()) return;
    super.takeDamage(amount);
  }
}
```

- `width, height, depth`はボクセル構造のサイズ（ブロック単位）
- `blockType`は構造物に使うブロック種類
- `protectedBy`チェーンで順序制約を表現
  - `Nexus.protectedBy = T1`
  - `T1.protectedBy = T2`
  - `T2.protectedBy = null`（最前線、いつでも攻撃可能）
- `isProtected()`がtrueなら`takeDamage()`はダメージを無視する

### 構造物のボクセルブロック管理

Structureインスタンス生成時に、World上に対応するブロックを配置する。

```typescript
// Structure内のメソッド
placeBlocks(world: World): void {
  for (let dx = 0; dx < this.width; dx++) {
    for (let dy = 0; dy < this.height; dy++) {
      for (let dz = 0; dz < this.depth; dz++) {
        world.setBlock(this.x + dx, this.y + dy, this.z + dz, this.blockType);
      }
    }
  }
}

removeBlocks(world: World): void {
  for (let dx = 0; dx < this.width; dx++) {
    for (let dy = 0; dy < this.height; dy++) {
      for (let dz = 0; dz < this.depth; dz++) {
        world.setBlock(this.x + dx, this.y + dy, this.z + dz, BlockType.AIR);
      }
    }
  }
}
```

- `placeBlocks`はマップ生成時に呼び出す
- `removeBlocks`は構造物破壊時（`isAlive = false`）に呼び出す

## 2. マップ拡張

### サイズ変更

| パラメータ | 変更前 | 変更後 |
|-----------|--------|--------|
| MAP_WIDTH | 15 | 19 |
| MAP_HEIGHT | 10 | 10（変更なし） |
| MAP_LENGTH | 84 | 210 |
| レーン有効幅 | x=2〜12 (10) | x=2〜16 (14) |
| レーン有効長 | z=2〜81 (79) | z=2〜207 (205) |

### 壁の定数更新

```typescript
const MAP_WIDTH = 19;
const MAP_LENGTH = 210;

const LANE_X_START = 2;
const LANE_X_END = 16;
const LANE_Z_START = 2;
const LANE_Z_END = 207;
```

- 壁の構造（外壁=BEDROCK、内壁=STONE）は既存パターンを維持
- 地面（BEDROCK+DIRT+GRASS）も同じパターンで拡張

### 構造物配置

レーン中央 z=105 を基準に左右対称に配置。

```
Blue側:
  Nexus:  x=7, y=4, z=8    (5×4×5, HP=3000, NEXUS_BLOCK)
  T2:     x=8, y=4, z=40   (3×6×3, HP=1500, TOWER_BLOCK)
  T1:     x=8, y=4, z=72   (3×6×3, HP=1500, TOWER_BLOCK)

Red側:
  T1:     x=8, y=4, z=135  (3×6×3, HP=1500, TOWER_BLOCK)
  T2:     x=8, y=4, z=167  (3×6×3, HP=1500, TOWER_BLOCK)
  Nexus:  x=7, y=4, z=197  (5×4×5, HP=3000, NEXUS_BLOCK)
```

- y=4はGRASS_Y(=3)の1つ上（地面の上に建つ）
- タワー: 3×6×3ブロック（幅3、高さ6、奥行3）
- ネクサス: 5×4×5ブロック（幅5、高さ4、奥行5）

### 順序制約チェーン

```
Blue側（プレイヤーチーム、今回は攻撃対象外）:
  blue-nexus.protectedBy = blue-t1
  blue-t1.protectedBy = blue-t2
  blue-t2.protectedBy = null

Red側（プレイヤーが攻撃する対象）:
  red-nexus.protectedBy = red-t1
  red-t1.protectedBy = red-t2
  red-t2.protectedBy = null
```

プレイヤーはred-t2 → red-t1 → red-nexusの順で攻撃可能。

### SPAWN_POSITION更新

```typescript
export const SPAWN_POSITION = {
  x: 9.5,
  y: GRASS_Y + 2,  // 落下して着地
  z: LANE_Z_START + 2,
};
```

## 3. ブロック種類追加

### BlockType列挙型

```typescript
export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  BEDROCK = 4,
  TOWER_BLOCK = 5,
  NEXUS_BLOCK = 6,
}
```

### テクスチャマッピング

新しいテクスチャ画像は追加しない。既存テクスチャを流用する。

```typescript
[BlockType.TOWER_BLOCK]: {
  top: TEXTURE_INDEX.stone,
  side: TEXTURE_INDEX.stone,
  bottom: TEXTURE_INDEX.stone,
},
[BlockType.NEXUS_BLOCK]: {
  top: TEXTURE_INDEX.bedrock,
  side: TEXTURE_INDEX.bedrock,
  bottom: TEXTURE_INDEX.bedrock,
},
```

### isSolid / isDestructible

```typescript
export function isSolid(type: BlockType): boolean {
  return type !== BlockType.AIR;
}

export function isDestructible(type: BlockType): boolean {
  return type !== BlockType.AIR
    && type !== BlockType.BEDROCK
    && type !== BlockType.TOWER_BLOCK
    && type !== BlockType.NEXUS_BLOCK;
}
```

- TOWER_BLOCK, NEXUS_BLOCKは`isSolid = true`（衝突あり）
- `isDestructible = false`（通常のブロック破壊では壊せない、CombatSystemからのみ除去）

## 4. 攻撃システム

### CombatSystem

```typescript
// src/entity/CombatSystem.ts
export const ATTACK_DAMAGE = 50;
export const ATTACK_RANGE = 5.0;
export const ATTACK_COOLDOWN = 0.5;

export interface AttackResult {
  target: Structure;
  damage: number;
  destroyed: boolean;
}

export class CombatSystem {
  private lastAttackTime = 0;

  tryAttack(
    eyeX: number, eyeY: number, eyeZ: number,
    dirX: number, dirY: number, dirZ: number,
    structures: Structure[],
    time: number,
  ): AttackResult | null {
    if (time - this.lastAttackTime < ATTACK_COOLDOWN) return null;

    const target = this.findTarget(eyeX, eyeY, eyeZ, dirX, dirY, dirZ, structures);
    if (!target) return null;
    if (target.isProtected()) return null;

    this.lastAttackTime = time;
    const prevAlive = target.isAlive;
    target.takeDamage(ATTACK_DAMAGE);

    return {
      target,
      damage: ATTACK_DAMAGE,
      destroyed: prevAlive && !target.isAlive,
    };
  }

  findTarget(
    eyeX: number, eyeY: number, eyeZ: number,
    dirX: number, dirY: number, dirZ: number,
    structures: Structure[],
  ): Structure | null {
    // 視線レイと各構造物のAABBの交差判定
    // 射程ATTACK_RANGE以内で最も近い構造物を返す
    // 対象は敵チーム（red）かつisAliveのみ
  }
}
```

### レイキャスト → AABB交差判定

`findTarget`は以下のアルゴリズムで実装する:

1. 各構造物のAABBを計算: `(x, y, z)` 〜 `(x+width, y+height, z+depth)`
2. レイ（eyePos + t * dir）とAABBのスラブ法（slab method）で交差判定
3. t > 0 かつ t <= ATTACK_RANGE の範囲で最小のtを持つ構造物を返す
4. `isAlive === false`の構造物はスキップ
5. Blue側の構造物もスキップ（シングルプレイヤーでは敵=Redのみ）

### Game.update内での攻撃フロー

```typescript
// 既存のBlockInteraction処理を修正
if (this.input.consumeLeftClick()) {
  // まず構造物への攻撃を試みる
  const attackResult = this.combatSystem.tryAttack(
    this.player.eyeX, this.player.eyeY, this.player.eyeZ,
    dir.x, dir.y, dir.z,
    this.structures,
    time / 1000,
  );

  if (attackResult) {
    this.hud.showDamage(attackResult);
    if (attackResult.destroyed) {
      attackResult.target.removeBlocks(this.world);
      this.rebuildDirtyChunks();
      this.checkVictory();
    }
  } else if (hit) {
    // 構造物に当たらなかった場合は通常のブロック破壊
    if (this.blockInteraction.breakBlock(hit)) {
      this.rebuildDirtyChunks();
    }
  }
}
```

## 5. HUD

### HTML構造

```html
<div id="hud">
  <div id="crosshair">+</div>
  <div id="target-info" style="display:none;">
    <div id="target-name"></div>
    <div id="hp-bar-container">
      <div id="hp-bar-fill"></div>
    </div>
    <div id="hp-text"></div>
  </div>
  <div id="combat-feedback" style="display:none;"></div>
  <div id="victory-screen" style="display:none;">
    <h1>VICTORY</h1>
    <p>敵ネクサスを破壊した！</p>
  </div>
</div>
```

### HUDクラス

```typescript
// src/ui/HUD.ts
export class HUD {
  private targetInfoEl: HTMLElement;
  private targetNameEl: HTMLElement;
  private hpBarFillEl: HTMLElement;
  private hpTextEl: HTMLElement;
  private feedbackEl: HTMLElement;
  private victoryEl: HTMLElement;

  constructor() {
    // DOM要素を取得またはDOM未使用時はnullガード
  }

  showTarget(structure: Structure): void {
    // ターゲット名、HPバー、HPテキストを更新して表示
    // HPバーの色: >50%=緑、25-50%=黄、<25%=赤
  }

  hideTarget(): void {
    // ターゲット情報を非表示
  }

  showDamage(result: AttackResult): void {
    // ダメージフィードバック表示
  }

  showProtected(): void {
    // 「このタワーは保護されています」を一時表示（1.5秒後に自動非表示）
  }

  showVictory(): void {
    // 勝利画面を表示
  }
}
```

### 更新タイミング

`Game.update()`の最後で毎フレーム呼び出す:

```typescript
// 視線が構造物に当たっているかチェック
const targetStructure = this.combatSystem.findTarget(
  this.player.eyeX, this.player.eyeY, this.player.eyeZ,
  dir.x, dir.y, dir.z,
  this.structures,
);
if (targetStructure) {
  this.hud.showTarget(targetStructure);
} else {
  this.hud.hideTarget();
}
```

## 6. 勝利判定

```typescript
// Game内
private checkVictory(): void {
  const redNexus = this.structures.find(s => s.id === 'red-nexus');
  if (redNexus && !redNexus.isAlive) {
    this.hud.showVictory();
    this.input.exitPointerLock();
    // ゲームループは継続するが、isPointerLockedがfalseなのでupdateは実行されない
  }
}
```

- ネクサス破壊時にポインターロックを解除し、勝利画面を表示
- ゲームループ自体は停止せず、`isPointerLocked`がfalseになることで入力が無効化される
- 将来的にはリスタート機能を追加可能

## 7. ファイル構成

### 新規ファイル

| ファイル | 内容 |
|---------|------|
| `src/entity/Entity.ts` | Entity基底クラス |
| `src/entity/Entity.test.ts` | Entityテスト |
| `src/entity/Structure.ts` | Structureクラス、placeBlocks/removeBlocks |
| `src/entity/Structure.test.ts` | Structureテスト |
| `src/entity/CombatSystem.ts` | 攻撃判定、レイキャスト、ダメージ処理 |
| `src/entity/CombatSystem.test.ts` | CombatSystemテスト |
| `src/ui/HUD.ts` | HUD表示管理 |
| `src/ui/HUD.test.ts` | HUDテスト |

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/world/Block.ts` | TOWER_BLOCK, NEXUS_BLOCK追加、isDestructible更新 |
| `src/world/MapData.ts` | マップサイズ拡張、構造物配置関数 |
| `src/engine/Game.ts` | CombatSystem/HUD統合、勝利判定、攻撃フロー |
| `index.html` | HUD用DOM要素追加 |

## 8. テスト戦略

### Entity.test.ts
- `takeDamage`でHP減少を確認
- HP=0で`isAlive = false`
- `isAlive = false`の状態で`takeDamage`呼んでも何も起きない
- 負のダメージを渡してもHPが`maxHp`を超えない（`Math.max(0, ...)`で担保）

### Structure.test.ts
- `isProtected()`が`protectedBy`の生存に連動
- `protectedBy`が破壊されたら`isProtected()`がfalseになる
- `takeDamage`がprotected時に無視される
- `placeBlocks`でWorldにブロックが配置される
- `removeBlocks`でWorldのブロックがAIRになる
- チェーン: T2破壊 → T1が攻撃可能 → T1破壊 → Nexusが攻撃可能

### CombatSystem.test.ts
- クールダウン中の攻撃がnullを返す
- クールダウン経過後の攻撃が成功する
- 射程外の構造物に当たらない
- 射程内の最も近い構造物がターゲットになる
- protectedな構造物への攻撃がnullを返す
- 破壊時に`destroyed = true`が返る
- Blue側の構造物がターゲットにならない

### HUD.test.ts
- `showTarget`でDOM要素が更新される
- HPバーの幅がHP割合に一致する
- HPバーの色がHP割合で変化する
- `hideTarget`で非表示になる
- `showVictory`で勝利画面が表示される

### MapData変更のテスト
- 既存のMapData.test.tsを更新
- マップサイズ定数の検証
- 構造物配置座標の検証

## 9. 定数まとめ

| 定数 | 値 | 場所 |
|-----|-----|------|
| MAP_WIDTH | 19 | MapData.ts |
| MAP_LENGTH | 210 | MapData.ts |
| TOWER_HP | 1500 | Structure.ts or MapData.ts |
| NEXUS_HP | 3000 | Structure.ts or MapData.ts |
| ATTACK_DAMAGE | 50 | CombatSystem.ts |
| ATTACK_RANGE | 5.0 | CombatSystem.ts |
| ATTACK_COOLDOWN | 0.5 | CombatSystem.ts |
