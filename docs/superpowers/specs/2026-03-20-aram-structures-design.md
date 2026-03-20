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
    if (!this.isAlive || amount <= 0) return;
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
- `takeDamage`は`amount <= 0`を無視し、HP=0で`isAlive = false`に設定

### Structure（構造物）

```typescript
// src/entity/Structure.ts
import { Entity, Team } from './Entity';
import { BlockType } from '../world/Block';
import { World } from '../world/World';

export type StructureType = 'tower' | 'nexus';

export class Structure extends Entity {
  readonly structureType: StructureType;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly blockType: BlockType;
  protectedBy: Structure | null;

  constructor(
    id: string,
    team: Team,
    x: number,
    y: number,
    z: number,
    structureType: StructureType,
    maxHp: number,
    width: number,
    height: number,
    depth: number,
    blockType: BlockType,
    protectedBy: Structure | null,
  ) {
    super(id, team, x, y, z, maxHp);
    this.structureType = structureType;
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.blockType = blockType;
    this.protectedBy = protectedBy;
  }

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

- `placeBlocks`はマップ生成時に呼び出す（`generateARAMMap`内で呼び、その後`rebuildAllChunks`が全チャンクを再構築する）
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

### カメラ far クリッピング更新

マップ長が210に拡張されるため、Renderer.tsのFPSCamera farパラメータを200 → 250に更新する。

### 構造物配置

レーン中央 z=104.5 を基準に左右対称に配置。

```
Blue側:
  Nexus:  x=7, y=4, z=7    (5×4×5, HP=3000, NEXUS_BLOCK)  → z=7〜11
  T2:     x=8, y=4, z=39   (3×6×3, HP=1500, TOWER_BLOCK)  → z=39〜41
  T1:     x=8, y=4, z=71   (3×6×3, HP=1500, TOWER_BLOCK)  → z=71〜73

Red側:
  T1:     x=8, y=4, z=136  (3×6×3, HP=1500, TOWER_BLOCK)  → z=136〜138
  T2:     x=8, y=4, z=168  (3×6×3, HP=1500, TOWER_BLOCK)  → z=168〜170
  Nexus:  x=7, y=4, z=198  (5×4×5, HP=3000, NEXUS_BLOCK)  → z=198〜202
```

対称性の検証:
- Nexus: (7+202)/2 = 104.5 ✓
- T2: (39+170)/2 = 104.5 ✓
- T1: (71+138)/2 = 104.5 ✓

- y=4はGRASS_Y(=3)の1つ上（地面の上に建つ）
- タワー: 3×6×3ブロック（幅3、高さ6、奥行3）
- ネクサス: 5×4×5ブロック（幅5、高さ4、奥行5）

### 構造物定数

構造物のHP定数はMapData.tsで定義する（構造物生成と同じファイル）。

```typescript
export const TOWER_HP = 1500;
export const NEXUS_HP = 3000;
```

### 構造物生成関数

`generateARAMMap`のシグネチャを拡張し、構造物リストも返す:

```typescript
export interface MapResult {
  structures: Structure[];
}

export function generateARAMMap(world: World): MapResult {
  // 1. 地面・壁のブロック配置（既存ロジック拡張）
  // 2. 構造物インスタンスを生成
  // 3. protectedByチェーンを設定
  // 4. 各構造物のplaceBlocks(world)を呼び出し
  // 5. structuresリストを返す
  return { structures };
}
```

Game.init()での呼び出し:
```typescript
const { structures } = generateARAMMap(this.world);
this.structures = structures;
// この後にrebuildAllChunks()が呼ばれるため、構造物ブロックも正しくメッシュ化される
```

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
  x: 9.0,  // レーン中央 (2+16)/2 = 9.0
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

新しいテクスチャ画像は追加しない。既存テクスチャを流用する。`BLOCK_UVS`レコードに以下を追加:

```typescript
const BLOCK_UVS: Record<BlockType, BlockUVs> = {
  // ...既存エントリ...
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
};
```

`ATLAS_SIZE`は`TEXTURE_NAMES.length`（=5）のまま変更なし（新テクスチャ画像は追加しないため）。

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
- BlockInteractionのハイライト表示: `isDestructible`でないブロックにはハイライトを表示しない（BlockInteraction.update内でhitブロックのisDestructibleをチェック）

## 4. 攻撃システム

### CombatSystem

```typescript
// src/entity/CombatSystem.ts
export const ATTACK_DAMAGE = 50;
export const ATTACK_RANGE = 5.0;
export const ATTACK_COOLDOWN = 0.5;

export type AttackFailReason = 'cooldown' | 'no_target' | 'protected';

export interface AttackResult {
  hit: true;
  target: Structure;
  damage: number;
  destroyed: boolean;
}

export interface AttackFailed {
  hit: false;
  reason: AttackFailReason;
  target: Structure | null;  // 'protected'の場合はターゲットが入る
}

export class CombatSystem {
  private lastAttackTime = 0;

  tryAttack(
    target: Structure | null,
    time: number,
  ): AttackResult | AttackFailed {
    if (time - this.lastAttackTime < ATTACK_COOLDOWN) {
      return { hit: false, reason: 'cooldown', target: null };
    }
    if (!target) {
      return { hit: false, reason: 'no_target', target: null };
    }
    if (target.isProtected()) {
      return { hit: false, reason: 'protected', target };
    }

    this.lastAttackTime = time;
    const prevAlive = target.isAlive;
    target.takeDamage(ATTACK_DAMAGE);

    return {
      hit: true,
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
    // Blue側の構造物はスキップ
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
6. `findTarget`はHUDのターゲット表示にも使用するため、publicメソッドとする

注意: `findTarget`はRed側のみを返すため、Blue側構造物はHUDにターゲット表示されない。これは意図的な仕様で、シングルプレイヤーでは味方構造物のHP確認は不要。

### Game.update内での攻撃フロー

`Game.update`のシグネチャを`update(dt: number, time: number)`に変更する。`time`はミリ秒（`performance.now()`由来）で、秒に変換して使用する。

```typescript
private loop(time: number): void {
  const dt = Math.min((time - this.lastTime) / 1000, 0.05);
  this.lastTime = time;
  this.update(dt, time);
  this.renderer.render();
  requestAnimationFrame((t) => this.loop(t));
}

private update(dt: number, time: number): void {
  if (this.instructionsEl) {
    this.instructionsEl.style.display = this.input.isPointerLocked ? 'none' : 'block';
  }
  if (!this.input.isPointerLocked) return;

  // ゲーム終了後は全操作を停止（移動・攻撃・ブロック操作すべて）
  if (this.gameOver) return;

  // カメラ回転
  const mouse = this.input.getMouseMovement();
  this.renderer.fpsCamera.rotate(mouse.x, mouse.y);

  // ジャンプ・物理
  if (this.input.isKeyDown('Space')) { this.player.jump(); }
  this.player.updatePhysics(dt);

  // WASD移動
  const forward = this.renderer.fpsCamera.getForward();
  const right = this.renderer.fpsCamera.getRight();
  let moveX = 0, moveZ = 0;
  if (this.input.isKeyDown('KeyW')) { moveX += forward.x; moveZ += forward.z; }
  if (this.input.isKeyDown('KeyS')) { moveX -= forward.x; moveZ -= forward.z; }
  if (this.input.isKeyDown('KeyA')) { moveX -= right.x; moveZ -= right.z; }
  if (this.input.isKeyDown('KeyD')) { moveX += right.x; moveZ += right.z; }
  if (moveX !== 0 || moveZ !== 0) {
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    this.player.move(moveX / len, moveZ / len, dt);
  }

  // カメラ位置更新
  this.renderer.fpsCamera.setPosition(
    this.player.eyeX, this.player.eyeY, this.player.eyeZ,
  );

  const dir = this.renderer.fpsCamera.getDirection();

  // findTargetは1フレームに1回だけ呼び、結果をHUD表示と攻撃処理で共有
  const targetStructure = this.combatSystem.findTarget(
    this.player.eyeX, this.player.eyeY, this.player.eyeZ,
    dir.x, dir.y, dir.z,
    this.structures,
  );

  const hit = this.blockInteraction.update(
    this.player.eyeX, this.player.eyeY, this.player.eyeZ,
    dir.x, dir.y, dir.z,
  );

  // 左クリック処理: 構造物攻撃 → ブロック破壊のフォールスルー
  const leftClick = this.input.consumeLeftClick();
  if (leftClick) {
    const result = this.combatSystem.tryAttack(targetStructure, time / 1000);

    if (result.hit) {
      this.hud.showDamage(result);
      if (result.destroyed) {
        result.target.removeBlocks(this.world);
        this.rebuildDirtyChunks();
        this.checkVictory();
      }
    } else if (result.reason === 'protected') {
      this.hud.showProtected();
    } else if (result.reason === 'no_target' && hit) {
      // 構造物に当たらなかった場合は通常のブロック破壊
      if (this.blockInteraction.breakBlock(hit)) {
        this.rebuildDirtyChunks();
      }
    }
    // reason === 'cooldown' の場合は何もしない
  }

  // 右クリック処理（変更なし）
  if (this.input.consumeRightClick()) {
    if (hit) {
      if (this.blockInteraction.placeBlock(hit, this.player.x, this.player.y, this.player.z)) {
        this.rebuildDirtyChunks();
      }
    }
  }

  // HUDターゲット表示更新（毎フレーム、findTarget結果を再利用）
  if (targetStructure) {
    this.hud.showTarget(targetStructure);
  } else {
    this.hud.hideTarget();
  }
}
```

設計ポイント:
- `findTarget`は1フレームに1回だけ呼ばれ、結果を攻撃判定とHUD表示で共有する
- `tryAttack`はターゲットを外部から受け取り、`findTarget`を内部で呼ばない。攻撃結果は`hit: true/false`の判別型で、失敗理由（`cooldown`/`no_target`/`protected`）を含む
- `consumeLeftClick()`と`consumeRightClick()`はそれぞれ必ず1回だけ呼ばれ、clickイベントが未消費のまま次フレームに残ることはない
- `gameOver`チェックはポインターロックチェック直後に配置し、勝利後は移動・攻撃・ブロック操作すべてを停止する
- `checkVictory`で`hideTarget()`も呼び、勝利画面表示時にターゲット情報が残らないようにする

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
  private targetInfoEl: HTMLElement | null;
  private targetNameEl: HTMLElement | null;
  private hpBarFillEl: HTMLElement | null;
  private hpTextEl: HTMLElement | null;
  private feedbackEl: HTMLElement | null;
  private victoryEl: HTMLElement | null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.targetInfoEl = document.getElementById('target-info');
    this.targetNameEl = document.getElementById('target-name');
    this.hpBarFillEl = document.getElementById('hp-bar-fill');
    this.hpTextEl = document.getElementById('hp-text');
    this.feedbackEl = document.getElementById('combat-feedback');
    this.victoryEl = document.getElementById('victory-screen');
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
    // feedbackTimerで管理し、連続呼び出し時はタイマーリセット
  }

  showVictory(): void {
    // 勝利画面を表示
  }
}
```

### 更新タイミング

HUDターゲット表示は`Game.update()`の最後で毎フレーム更新される（セクション4の攻撃フロー参照）。

## 6. 勝利判定

```typescript
// Gameクラスのフィールド
private gameOver = false;

// Game内
private checkVictory(): void {
  const redNexus = this.structures.find(s => s.id === 'red-nexus');
  if (redNexus && !redNexus.isAlive) {
    this.gameOver = true;
    this.hud.hideTarget();
    this.hud.showVictory();
    document.exitPointerLock();
  }
}
```

- `gameOver`フラグで勝利後の全操作（移動・攻撃・ブロック操作）を無効化する
- `update()`内で`gameOver`チェックはポインターロックチェック直後に配置（セクション4参照）
- ポインターロック解除は`document.exitPointerLock()`を直接呼ぶ（InputManagerへのメソッド追加は不要）
- 勝利後にキャンバスをクリックしても`update()`内の`gameOver`チェックで操作が無効化されるため問題ない
- `hideTarget()`を呼び、勝利画面表示時にターゲット情報が残らないようにする

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
| `src/world/Block.ts` | TOWER_BLOCK, NEXUS_BLOCK追加、BLOCK_UVS追加、isDestructible更新 |
| `src/world/MapData.ts` | マップサイズ拡張、構造物配置関数（MapResult返却） |
| `src/engine/Game.ts` | CombatSystem/HUD統合、gameOverフラグ、update(dt, time)シグネチャ変更、攻撃フロー |
| `src/engine/Renderer.ts` | FPSCamera far値を200→250に更新 |
| `src/player/BlockInteraction.ts` | isDestructibleでないブロックへのハイライト非表示 |
| `index.html` | HUD用DOM要素追加 |

## 8. テスト戦略

### Entity.test.ts
- `takeDamage`でHP減少を確認
- HP=0で`isAlive = false`
- `isAlive = false`の状態で`takeDamage`呼んでも何も起きない
- `amount <= 0`の場合HPが変化しない

### Structure.test.ts
- コンストラクタで全プロパティが正しく設定される
- `isProtected()`が`protectedBy`の生存に連動
- `protectedBy`が破壊されたら`isProtected()`がfalseになる
- `takeDamage`がprotected時に無視される
- `placeBlocks`でWorldにブロックが配置される
- `removeBlocks`でWorldのブロックがAIRになる
- チェーン: T2破壊 → T1が攻撃可能 → T1破壊 → Nexusが攻撃可能

### CombatSystem.test.ts
- クールダウン中の攻撃が`{ hit: false, reason: 'cooldown' }`を返す
- クールダウン経過後の攻撃が`{ hit: true }`を返す
- ターゲットがnullの場合`{ hit: false, reason: 'no_target' }`を返す
- protectedな構造物への攻撃が`{ hit: false, reason: 'protected', target }`を返す
- 破壊時に`destroyed = true`が返る
- 射程外の構造物にfindTargetが当たらない
- 射程内の最も近い構造物がfindTargetのターゲットになる
- Blue側の構造物がfindTargetのターゲットにならない

### HUD.test.ts
- `showTarget`でDOM要素が更新される
- HPバーの幅がHP割合に一致する
- HPバーの色がHP割合で変化する
- `hideTarget`で非表示になる
- `showVictory`で勝利画面が表示される

### MapData変更のテスト
- 既存のMapData.test.tsを更新
- マップサイズ定数の検証
- 構造物配置座標の対称性検証
- 構造物ブロックが正しいBlockTypeで配置されている

## 9. 定数まとめ

| 定数 | 値 | 場所 |
|-----|-----|------|
| MAP_WIDTH | 19 | MapData.ts |
| MAP_LENGTH | 210 | MapData.ts |
| TOWER_HP | 1500 | MapData.ts |
| NEXUS_HP | 3000 | MapData.ts |
| ATTACK_DAMAGE | 50 | CombatSystem.ts |
| ATTACK_RANGE | 5.0 | CombatSystem.ts |
| ATTACK_COOLDOWN | 0.5 | CombatSystem.ts |
| CAMERA_FAR | 250 | Renderer.ts |
