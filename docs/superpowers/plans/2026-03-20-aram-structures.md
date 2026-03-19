# ARAM構造物・HP/ダメージシステム 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タワーとネクサスの構造物をマップに配置し、攻撃してHPを減らし、ネクサス破壊で勝利するARAMの基本フローを実装する。

**Architecture:** Entity基底クラスの上にStructureを構築し、ボクセルブロックとエンティティを二重管理する。CombatSystemがレイキャスト→AABB交差判定で攻撃対象を特定し、HUDがHTML/CSSオーバーレイでHP表示と勝利画面を担当する。

**Tech Stack:** TypeScript, Three.js, Vitest (TDD)

**Spec:** `docs/superpowers/specs/2026-03-20-aram-structures-design.md`

---

## ファイル構成

### 新規ファイル
| ファイル | 責務 |
|---------|------|
| `src/entity/Entity.ts` | Entity基底クラス（id, team, hp, takeDamage） |
| `src/entity/Entity.test.ts` | Entityテスト |
| `src/entity/Structure.ts` | Structure（protectedBy, placeBlocks/removeBlocks） |
| `src/entity/Structure.test.ts` | Structureテスト |
| `src/entity/CombatSystem.ts` | tryAttack, findTarget（レイ→AABB交差判定） |
| `src/entity/CombatSystem.test.ts` | CombatSystemテスト |
| `src/ui/HUD.ts` | HPバー、フィードバック、勝利画面のDOM操作 |
| `src/ui/HUD.test.ts` | HUDテスト |

### 変更ファイル
| ファイル | 変更内容 |
|---------|---------|
| `src/world/Block.ts` | TOWER_BLOCK/NEXUS_BLOCK追加、BLOCK_UVS追加、isDestructible更新 |
| `src/world/MapData.ts` | マップサイズ19x210に拡張、構造物生成・配置、MapResult返却 |
| `src/engine/Renderer.ts` | カメラfar: 200→250 |
| `src/player/BlockInteraction.ts` | isDestructibleでないブロックのハイライト非表示 |
| `src/engine/Game.ts` | CombatSystem/HUD統合、gameOverフラグ、攻撃フロー |
| `index.html` | HUD用DOM要素追加 |

---

### Task 1: BlockType拡張（TOWER_BLOCK, NEXUS_BLOCK）

**Files:**
- Modify: `src/world/Block.ts`
- Modify: `src/world/Block.test.ts`

- [ ] **Step 1: テスト追加**

`src/world/Block.test.ts` に以下のテストを追加:

```typescript
it('TOWER_BLOCK and NEXUS_BLOCK are solid', () => {
  expect(isSolid(BlockType.TOWER_BLOCK)).toBe(true);
  expect(isSolid(BlockType.NEXUS_BLOCK)).toBe(true);
});

it('TOWER_BLOCK and NEXUS_BLOCK are not destructible', () => {
  expect(isDestructible(BlockType.TOWER_BLOCK)).toBe(false);
  expect(isDestructible(BlockType.NEXUS_BLOCK)).toBe(false);
});

it('TOWER_BLOCK uses stone texture for all faces', () => {
  const uvs = getBlockUVs(BlockType.TOWER_BLOCK);
  expect(uvs.top).toBe(uvs.side);
  expect(uvs.top).toBe(uvs.bottom);
});

it('NEXUS_BLOCK uses bedrock texture for all faces', () => {
  const uvs = getBlockUVs(BlockType.NEXUS_BLOCK);
  expect(uvs.top).toBe(uvs.side);
  expect(uvs.top).toBe(uvs.bottom);
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/world/Block.test.ts`
Expected: FAIL（TOWER_BLOCK, NEXUS_BLOCKが未定義）

- [ ] **Step 3: Block.tsを修正**

`src/world/Block.ts` のBlockType enumに追加:
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

isDestructibleを更新:
```typescript
export function isDestructible(type: BlockType): boolean {
  return type !== BlockType.AIR
    && type !== BlockType.BEDROCK
    && type !== BlockType.TOWER_BLOCK
    && type !== BlockType.NEXUS_BLOCK;
}
```

BLOCK_UVSに追加:
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

- [ ] **Step 4: テスト成功を確認**

Run: `npx vitest run src/world/Block.test.ts`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add src/world/Block.ts src/world/Block.test.ts
git commit -m "feat: add TOWER_BLOCK and NEXUS_BLOCK types"
```

---

### Task 2: Entity基底クラス

**Files:**
- Create: `src/entity/Entity.ts`
- Create: `src/entity/Entity.test.ts`

- [ ] **Step 1: テスト作成**

```typescript
// src/entity/Entity.test.ts
import { describe, it, expect } from 'vitest';
import { Entity } from './Entity';

describe('Entity', () => {
  it('initializes with full HP', () => {
    const e = new Entity('test', 'blue', 0, 0, 0, 100);
    expect(e.hp).toBe(100);
    expect(e.maxHp).toBe(100);
    expect(e.isAlive).toBe(true);
  });

  it('takeDamage reduces HP', () => {
    const e = new Entity('test', 'red', 0, 0, 0, 100);
    e.takeDamage(30);
    expect(e.hp).toBe(70);
    expect(e.isAlive).toBe(true);
  });

  it('dies when HP reaches 0', () => {
    const e = new Entity('test', 'red', 0, 0, 0, 100);
    e.takeDamage(100);
    expect(e.hp).toBe(0);
    expect(e.isAlive).toBe(false);
  });

  it('HP does not go below 0', () => {
    const e = new Entity('test', 'red', 0, 0, 0, 50);
    e.takeDamage(999);
    expect(e.hp).toBe(0);
    expect(e.isAlive).toBe(false);
  });

  it('ignores damage when already dead', () => {
    const e = new Entity('test', 'red', 0, 0, 0, 100);
    e.takeDamage(100);
    e.takeDamage(50);
    expect(e.hp).toBe(0);
  });

  it('ignores zero or negative damage', () => {
    const e = new Entity('test', 'red', 0, 0, 0, 100);
    e.takeDamage(0);
    expect(e.hp).toBe(100);
    e.takeDamage(-10);
    expect(e.hp).toBe(100);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/entity/Entity.test.ts`
Expected: FAIL（Entity未定義）

- [ ] **Step 3: Entity.ts実装**

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

- [ ] **Step 4: テスト成功を確認**

Run: `npx vitest run src/entity/Entity.test.ts`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add src/entity/Entity.ts src/entity/Entity.test.ts
git commit -m "feat: add Entity base class with HP and damage"
```

---

### Task 3: Structureクラス

**Files:**
- Create: `src/entity/Structure.ts`
- Create: `src/entity/Structure.test.ts`

- [ ] **Step 1: テスト作成**

```typescript
// src/entity/Structure.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Structure } from './Structure';
import { World } from '../world/World';
import { BlockType } from '../world/Block';

function createTower(id: string, team: 'blue' | 'red', z: number, protectedBy: Structure | null = null): Structure {
  return new Structure(id, team, 8, 4, z, 'tower', 1500, 3, 6, 3, BlockType.TOWER_BLOCK, protectedBy);
}

function createNexus(id: string, team: 'blue' | 'red', z: number, protectedBy: Structure | null = null): Structure {
  return new Structure(id, team, 7, 4, z, 'nexus', 3000, 5, 4, 5, BlockType.NEXUS_BLOCK, protectedBy);
}

describe('Structure', () => {
  it('constructor sets all properties', () => {
    const s = createTower('red-t2', 'red', 168);
    expect(s.id).toBe('red-t2');
    expect(s.team).toBe('red');
    expect(s.structureType).toBe('tower');
    expect(s.hp).toBe(1500);
    expect(s.maxHp).toBe(1500);
    expect(s.width).toBe(3);
    expect(s.height).toBe(6);
    expect(s.depth).toBe(3);
    expect(s.blockType).toBe(BlockType.TOWER_BLOCK);
    expect(s.protectedBy).toBeNull();
  });

  it('isProtected returns false when protectedBy is null', () => {
    const s = createTower('red-t2', 'red', 168);
    expect(s.isProtected()).toBe(false);
  });

  it('isProtected returns true when protectedBy is alive', () => {
    const t2 = createTower('red-t2', 'red', 168);
    const t1 = createTower('red-t1', 'red', 136, t2);
    expect(t1.isProtected()).toBe(true);
  });

  it('isProtected returns false when protectedBy is destroyed', () => {
    const t2 = createTower('red-t2', 'red', 168);
    const t1 = createTower('red-t1', 'red', 136, t2);
    t2.takeDamage(1500);
    expect(t1.isProtected()).toBe(false);
  });

  it('takeDamage is ignored when protected', () => {
    const t2 = createTower('red-t2', 'red', 168);
    const t1 = createTower('red-t1', 'red', 136, t2);
    t1.takeDamage(500);
    expect(t1.hp).toBe(1500);
  });

  it('takeDamage works when not protected', () => {
    const s = createTower('red-t2', 'red', 168);
    s.takeDamage(500);
    expect(s.hp).toBe(1000);
  });

  it('protection chain: T2 -> T1 -> Nexus', () => {
    const t2 = createTower('red-t2', 'red', 168);
    const t1 = createTower('red-t1', 'red', 136, t2);
    const nexus = createNexus('red-nexus', 'red', 198, t1);

    // Nexusとt1はprotected
    expect(nexus.isProtected()).toBe(true);
    expect(t1.isProtected()).toBe(true);

    // t2を破壊
    t2.takeDamage(1500);
    expect(t1.isProtected()).toBe(false);
    expect(nexus.isProtected()).toBe(true); // t1がまだ生きてる

    // t1を破壊
    t1.takeDamage(1500);
    expect(nexus.isProtected()).toBe(false);
  });

  describe('placeBlocks / removeBlocks', () => {
    let world: World;

    beforeEach(() => {
      world = new World();
    });

    it('placeBlocks fills the area with blockType', () => {
      const s = createTower('test', 'red', 10);
      s.placeBlocks(world);
      // タワー: 3x6x3 at (8,4,10)
      expect(world.getBlock(8, 4, 10)).toBe(BlockType.TOWER_BLOCK);
      expect(world.getBlock(10, 9, 12)).toBe(BlockType.TOWER_BLOCK);
      // 外側はAIR
      expect(world.getBlock(7, 4, 10)).toBe(BlockType.AIR);
      expect(world.getBlock(11, 4, 10)).toBe(BlockType.AIR);
    });

    it('removeBlocks clears the area to AIR', () => {
      const s = createTower('test', 'red', 10);
      s.placeBlocks(world);
      s.removeBlocks(world);
      expect(world.getBlock(8, 4, 10)).toBe(BlockType.AIR);
      expect(world.getBlock(10, 9, 12)).toBe(BlockType.AIR);
    });
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/entity/Structure.test.ts`
Expected: FAIL（Structure未定義）

- [ ] **Step 3: Structure.ts実装**

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
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `npx vitest run src/entity/Structure.test.ts`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add src/entity/Structure.ts src/entity/Structure.test.ts
git commit -m "feat: add Structure class with protection chain and block management"
```

---

### Task 4: CombatSystem（tryAttack + findTarget）

**Files:**
- Create: `src/entity/CombatSystem.ts`
- Create: `src/entity/CombatSystem.test.ts`

- [ ] **Step 1: テスト作成**

```typescript
// src/entity/CombatSystem.test.ts
import { describe, it, expect } from 'vitest';
import { CombatSystem, ATTACK_DAMAGE, ATTACK_COOLDOWN, ATTACK_RANGE } from './CombatSystem';
import { Structure } from './Structure';
import { BlockType } from '../world/Block';

function createRedTower(z: number, protectedBy: Structure | null = null): Structure {
  return new Structure('red-t', 'red', 8, 4, z, 'tower', 1500, 3, 6, 3, BlockType.TOWER_BLOCK, protectedBy);
}

function createBlueTower(z: number): Structure {
  return new Structure('blue-t', 'blue', 8, 4, z, 'tower', 1500, 3, 6, 3, BlockType.TOWER_BLOCK, null);
}

describe('CombatSystem', () => {
  describe('tryAttack', () => {
    it('returns cooldown when attacked too soon', () => {
      const cs = new CombatSystem();
      const target = createRedTower(10);
      cs.tryAttack(target, 1.0);
      const result = cs.tryAttack(target, 1.2);
      expect(result.hit).toBe(false);
      if (!result.hit) expect(result.reason).toBe('cooldown');
    });

    it('succeeds after cooldown expires', () => {
      const cs = new CombatSystem();
      const target = createRedTower(10);
      cs.tryAttack(target, 1.0);
      const result = cs.tryAttack(target, 1.0 + ATTACK_COOLDOWN);
      expect(result.hit).toBe(true);
    });

    it('returns no_target when target is null', () => {
      const cs = new CombatSystem();
      const result = cs.tryAttack(null, 1.0);
      expect(result.hit).toBe(false);
      if (!result.hit) expect(result.reason).toBe('no_target');
    });

    it('returns protected when target is protected', () => {
      const cs = new CombatSystem();
      const t2 = createRedTower(168);
      const t1 = createRedTower(136);
      t1.protectedBy = t2;
      const result = cs.tryAttack(t1, 1.0);
      expect(result.hit).toBe(false);
      if (!result.hit) {
        expect(result.reason).toBe('protected');
        expect(result.target).toBe(t1);
      }
    });

    it('deals ATTACK_DAMAGE on hit', () => {
      const cs = new CombatSystem();
      const target = createRedTower(10);
      const result = cs.tryAttack(target, 1.0);
      expect(result.hit).toBe(true);
      if (result.hit) {
        expect(result.damage).toBe(ATTACK_DAMAGE);
        expect(target.hp).toBe(1500 - ATTACK_DAMAGE);
      }
    });

    it('returns destroyed=true when target dies', () => {
      const cs = new CombatSystem();
      const target = new Structure('t', 'red', 8, 4, 10, 'tower', ATTACK_DAMAGE, 3, 6, 3, BlockType.TOWER_BLOCK, null);
      const result = cs.tryAttack(target, 1.0);
      expect(result.hit).toBe(true);
      if (result.hit) {
        expect(result.destroyed).toBe(true);
        expect(target.isAlive).toBe(false);
      }
    });
  });

  describe('findTarget', () => {
    it('returns null when no structures in range', () => {
      const cs = new CombatSystem();
      const target = createRedTower(100);
      const result = cs.findTarget(9.5, 7, 5, 0, 0, 1, [target]);
      expect(result).toBeNull();
    });

    it('finds structure directly ahead within range', () => {
      const cs = new CombatSystem();
      // タワーはx=8~10, y=4~9, z=10~12。プレイヤーはz=9でz方向を見る
      const target = createRedTower(10);
      const result = cs.findTarget(9.5, 7, 9, 0, 0, 1, [target]);
      expect(result).toBe(target);
    });

    it('returns closest structure when multiple in range', () => {
      const cs = new CombatSystem();
      const far = createRedTower(14);
      far.protectedBy = null;
      (far as any).id = 'far';
      const near = createRedTower(10);
      (near as any).id = 'near';
      const result = cs.findTarget(9.5, 7, 9, 0, 0, 1, [far, near]);
      expect(result?.id).toBe('near');
    });

    it('skips dead structures', () => {
      const cs = new CombatSystem();
      const target = createRedTower(10);
      target.takeDamage(1500);
      const result = cs.findTarget(9.5, 7, 9, 0, 0, 1, [target]);
      expect(result).toBeNull();
    });

    it('skips blue team structures', () => {
      const cs = new CombatSystem();
      const blueTarget = createBlueTower(10);
      const result = cs.findTarget(9.5, 7, 9, 0, 0, 1, [blueTarget]);
      expect(result).toBeNull();
    });

    it('returns null when looking away from structure', () => {
      const cs = new CombatSystem();
      const target = createRedTower(10);
      const result = cs.findTarget(9.5, 7, 9, 0, 0, -1, [target]);
      expect(result).toBeNull();
    });
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/entity/CombatSystem.test.ts`
Expected: FAIL（CombatSystem未定義）

- [ ] **Step 3: CombatSystem.ts実装**

```typescript
// src/entity/CombatSystem.ts
import { Structure } from './Structure';

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
  target: Structure | null;
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
    let closest: Structure | null = null;
    let closestT = Infinity;

    for (const s of structures) {
      if (!s.isAlive || s.team === 'blue') continue;

      const t = this.rayIntersectsAABB(
        eyeX, eyeY, eyeZ,
        dirX, dirY, dirZ,
        s.x, s.y, s.z,
        s.x + s.width, s.y + s.height, s.z + s.depth,
      );

      if (t !== null && t > 0 && t <= ATTACK_RANGE && t < closestT) {
        closest = s;
        closestT = t;
      }
    }

    return closest;
  }

  private rayIntersectsAABB(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
  ): number | null {
    let tmin = -Infinity;
    let tmax = Infinity;

    if (dx !== 0) {
      const t1 = (minX - ox) / dx;
      const t2 = (maxX - ox) / dx;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    } else {
      if (ox < minX || ox > maxX) return null;
    }

    if (dy !== 0) {
      const t1 = (minY - oy) / dy;
      const t2 = (maxY - oy) / dy;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    } else {
      if (oy < minY || oy > maxY) return null;
    }

    if (dz !== 0) {
      const t1 = (minZ - oz) / dz;
      const t2 = (maxZ - oz) / dz;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    } else {
      if (oz < minZ || oz > maxZ) return null;
    }

    if (tmax < tmin) return null;
    return tmin >= 0 ? tmin : tmax >= 0 ? tmax : null;
  }
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `npx vitest run src/entity/CombatSystem.test.ts`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add src/entity/CombatSystem.ts src/entity/CombatSystem.test.ts
git commit -m "feat: add CombatSystem with ray-AABB attack and cooldown"
```

---

### Task 5: マップ拡張 + 構造物配置

**Files:**
- Modify: `src/world/MapData.ts`
- Modify: `src/world/MapData.test.ts`
- Modify: `src/engine/Renderer.ts`

- [ ] **Step 1: 既存MapDataテストを更新し、新テスト追加**

`src/world/MapData.test.ts` を全面書き換え:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { generateARAMMap, SPAWN_POSITION, TOWER_HP, NEXUS_HP } from './MapData';
import { World } from './World';
import { BlockType } from './Block';

describe('MapData', () => {
  let world: World;
  let structures: import('../entity/Structure').Structure[];

  beforeEach(() => {
    world = new World();
    const result = generateARAMMap(world);
    structures = result.structures;
  });

  it('ground is GRASS at lane center', () => {
    expect(world.getBlock(9, 3, 100)).toBe(BlockType.GRASS);
  });

  it('below grass is DIRT', () => {
    expect(world.getBlock(9, 2, 100)).toBe(BlockType.DIRT);
    expect(world.getBlock(9, 1, 100)).toBe(BlockType.DIRT);
  });

  it('bottom layer is BEDROCK', () => {
    expect(world.getBlock(9, 0, 100)).toBe(BlockType.BEDROCK);
  });

  it('outer walls are BEDROCK', () => {
    expect(world.getBlock(0, 4, 100)).toBe(BlockType.BEDROCK);
    expect(world.getBlock(18, 4, 100)).toBe(BlockType.BEDROCK);
  });

  it('inner walls are STONE', () => {
    expect(world.getBlock(1, 4, 100)).toBe(BlockType.STONE);
    expect(world.getBlock(17, 4, 100)).toBe(BlockType.STONE);
  });

  it('air above the lane', () => {
    expect(world.getBlock(9, 4, 100)).toBe(BlockType.AIR);
  });

  it('lane extends full length', () => {
    expect(world.getBlock(9, 3, 2)).not.toBe(BlockType.AIR);
    expect(world.getBlock(9, 3, 205)).not.toBe(BlockType.AIR);
  });

  it('spawn position is above ground in air', () => {
    expect(SPAWN_POSITION.y).toBeGreaterThan(3);
    expect(world.getBlock(
      Math.floor(SPAWN_POSITION.x),
      Math.floor(SPAWN_POSITION.y),
      Math.floor(SPAWN_POSITION.z),
    )).toBe(BlockType.AIR);
  });

  it('generates 6 structures', () => {
    expect(structures).toHaveLength(6);
  });

  it('structures are symmetrically placed', () => {
    const byId = new Map(structures.map(s => [s.id, s]));

    const blueNexus = byId.get('blue-nexus')!;
    const redNexus = byId.get('red-nexus')!;
    expect((blueNexus.z + redNexus.z + redNexus.depth) / 2).toBeCloseTo(104.5, 0);

    const blueT2 = byId.get('blue-t2')!;
    const redT2 = byId.get('red-t2')!;
    expect((blueT2.z + redT2.z + redT2.depth) / 2).toBeCloseTo(104.5, 0);
  });

  it('red tower blocks are TOWER_BLOCK', () => {
    const redT2 = structures.find(s => s.id === 'red-t2')!;
    expect(world.getBlock(redT2.x, redT2.y, redT2.z)).toBe(BlockType.TOWER_BLOCK);
  });

  it('red nexus blocks are NEXUS_BLOCK', () => {
    const redNexus = structures.find(s => s.id === 'red-nexus')!;
    expect(world.getBlock(redNexus.x, redNexus.y, redNexus.z)).toBe(BlockType.NEXUS_BLOCK);
  });

  it('protection chain is set correctly', () => {
    const byId = new Map(structures.map(s => [s.id, s]));
    const redT2 = byId.get('red-t2')!;
    const redT1 = byId.get('red-t1')!;
    const redNexus = byId.get('red-nexus')!;

    expect(redT2.protectedBy).toBeNull();
    expect(redT1.protectedBy).toBe(redT2);
    expect(redNexus.protectedBy).toBe(redT1);
  });

  it('tower and nexus HP constants are correct', () => {
    expect(TOWER_HP).toBe(1500);
    expect(NEXUS_HP).toBe(3000);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/world/MapData.test.ts`
Expected: FAIL

- [ ] **Step 3: MapData.tsを書き換え**

```typescript
// src/world/MapData.ts
import { World } from './World';
import { BlockType } from './Block';
import { Structure } from '../entity/Structure';

const MAP_WIDTH = 19;
const MAP_HEIGHT = 10;
const MAP_LENGTH = 210;

const LANE_X_START = 2;
const LANE_X_END = 16;
const LANE_Z_START = 2;
const LANE_Z_END = 207;

const BEDROCK_Y = 0;
const DIRT_Y_START = 1;
const DIRT_Y_END = 2;
const GRASS_Y = 3;

const WALL_TOP_Y = 8;

export const TOWER_HP = 1500;
export const NEXUS_HP = 3000;

export const SPAWN_POSITION = {
  x: 9.0,
  y: GRASS_Y + 2,
  z: LANE_Z_START + 2,
};

export interface MapResult {
  structures: Structure[];
}

export function generateARAMMap(world: World): MapResult {
  for (let z = 0; z < MAP_LENGTH; z++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const isLaneX = x >= LANE_X_START && x <= LANE_X_END;
      const isInnerWallX = x === 1 || x === MAP_WIDTH - 2;
      const isOuterWallX = x === 0 || x === MAP_WIDTH - 1;
      const isEndWallZ = z === 0 || z === 1 || z === MAP_LENGTH - 2 || z === MAP_LENGTH - 1;
      const isOuterEndZ = z === 0 || z === MAP_LENGTH - 1;

      world.setBlock(x, BEDROCK_Y, z, BlockType.BEDROCK);

      if ((isLaneX && !isEndWallZ) || isInnerWallX || isOuterWallX) {
        world.setBlock(x, DIRT_Y_START, z, BlockType.DIRT);
        world.setBlock(x, DIRT_Y_END, z, BlockType.DIRT);
        world.setBlock(x, GRASS_Y, z, BlockType.GRASS);
      }

      if (isEndWallZ) {
        for (let y = BEDROCK_Y; y <= WALL_TOP_Y; y++) {
          if (isOuterEndZ) {
            world.setBlock(x, y, z, BlockType.BEDROCK);
          } else {
            world.setBlock(x, y, z, BlockType.STONE);
          }
        }
      }

      if (isOuterWallX) {
        for (let y = BEDROCK_Y; y <= WALL_TOP_Y; y++) {
          world.setBlock(x, y, z, BlockType.BEDROCK);
        }
      } else if (isInnerWallX) {
        for (let y = GRASS_Y + 1; y <= WALL_TOP_Y; y++) {
          world.setBlock(x, y, z, BlockType.STONE);
        }
      }
    }
  }

  const structures = createStructures(world);
  return { structures };
}

function createStructures(world: World): Structure[] {
  const STRUCTURE_Y = GRASS_Y + 1;

  // Blue side
  const blueT2 = new Structure('blue-t2', 'blue', 8, STRUCTURE_Y, 39, 'tower', TOWER_HP, 3, 6, 3, BlockType.TOWER_BLOCK, null);
  const blueT1 = new Structure('blue-t1', 'blue', 8, STRUCTURE_Y, 71, 'tower', TOWER_HP, 3, 6, 3, BlockType.TOWER_BLOCK, blueT2);
  const blueNexus = new Structure('blue-nexus', 'blue', 7, STRUCTURE_Y, 7, 'nexus', NEXUS_HP, 5, 4, 5, BlockType.NEXUS_BLOCK, blueT1);

  // Red side
  const redT2 = new Structure('red-t2', 'red', 8, STRUCTURE_Y, 168, 'tower', TOWER_HP, 3, 6, 3, BlockType.TOWER_BLOCK, null);
  const redT1 = new Structure('red-t1', 'red', 8, STRUCTURE_Y, 136, 'tower', TOWER_HP, 3, 6, 3, BlockType.TOWER_BLOCK, redT2);
  const redNexus = new Structure('red-nexus', 'red', 7, STRUCTURE_Y, 198, 'nexus', NEXUS_HP, 5, 4, 5, BlockType.NEXUS_BLOCK, redT1);

  const all = [blueNexus, blueT1, blueT2, redT2, redT1, redNexus];
  for (const s of all) {
    s.placeBlocks(world);
  }
  return all;
}
```

- [ ] **Step 4: Renderer.tsのfar値を更新**

`src/engine/Renderer.ts` 25行目:
```typescript
// before
this.fpsCamera = new FPSCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
// after
this.fpsCamera = new FPSCamera(75, window.innerWidth / window.innerHeight, 0.1, 250);
```

- [ ] **Step 5: テスト成功を確認**

Run: `npx vitest run src/world/MapData.test.ts`
Expected: ALL PASS

- [ ] **Step 6: 全テスト実行**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 7: コミット**

```bash
git add src/world/MapData.ts src/world/MapData.test.ts src/engine/Renderer.ts
git commit -m "feat: expand map to 19x210 and add tower/nexus structures"
```

---

### Task 6: BlockInteractionのハイライト修正

**Files:**
- Modify: `src/player/BlockInteraction.ts`
- Modify: `src/player/BlockInteraction.test.ts`

- [ ] **Step 1: テスト追加**

`src/player/BlockInteraction.test.ts` に追加:

```typescript
it('castRay hits TOWER_BLOCK (solid)', () => {
  world.setBlock(5, 5, 5, BlockType.TOWER_BLOCK);
  const hit = castRay(world, 5.5, 5.5, 3, 0, 0, 1, 5);
  expect(hit).not.toBeNull();
  expect(hit!.blockX).toBe(5);
  expect(hit!.blockY).toBe(5);
  expect(hit!.blockZ).toBe(5);
});
```

- [ ] **Step 2: テスト成功を確認**

Run: `npx vitest run src/player/BlockInteraction.test.ts`
Expected: PASS（castRayは既にisSolidチェック済み）

- [ ] **Step 3: ハイライト表示にisDestructibleチェック追加**

`src/player/BlockInteraction.ts` のupdateメソッドを修正:

```typescript
update(
  eyeX: number, eyeY: number, eyeZ: number,
  dirX: number, dirY: number, dirZ: number,
): RaycastHit | null {
  const hit = castRay(this.world, eyeX, eyeY, eyeZ, dirX, dirY, dirZ, 5);
  if (hit && isDestructible(this.world.getBlock(hit.blockX, hit.blockY, hit.blockZ))) {
    this.highlightMesh.visible = true;
    this.highlightMesh.position.set(hit.blockX + 0.5, hit.blockY + 0.5, hit.blockZ + 0.5);
  } else {
    this.highlightMesh.visible = false;
  }
  return hit;
}
```

- [ ] **Step 4: 全テスト実行**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add src/player/BlockInteraction.ts src/player/BlockInteraction.test.ts
git commit -m "feat: hide highlight on non-destructible blocks"
```

---

### Task 7: HUD（HTML/CSS + TypeScript）

**Files:**
- Modify: `index.html`
- Create: `src/ui/HUD.ts`
- Create: `src/ui/HUD.test.ts`

- [ ] **Step 1: index.htmlにHUD要素追加**

`index.html`の`<script>`タグの前に以下を追加:

```html
  <div id="target-info" style="
    display: none;
    position: fixed;
    bottom: 60%;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    font-family: monospace;
    text-align: center;
    pointer-events: none;
    z-index: 10;
  ">
    <div id="target-name" style="font-size: 14px; margin-bottom: 4px;"></div>
    <div id="hp-bar-container" style="
      width: 200px;
      height: 8px;
      background: rgba(0,0,0,0.6);
      border-radius: 4px;
      overflow: hidden;
    ">
      <div id="hp-bar-fill" style="height: 100%; transition: width 0.1s;"></div>
    </div>
    <div id="hp-text" style="font-size: 12px; margin-top: 2px; opacity: 0.8;"></div>
  </div>
  <div id="combat-feedback" style="
    display: none;
    position: fixed;
    top: 60%;
    left: 50%;
    transform: translateX(-50%);
    color: #ff6666;
    font-family: monospace;
    font-size: 14px;
    pointer-events: none;
    z-index: 10;
  "></div>
  <div id="victory-screen" style="
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    color: white;
    font-family: monospace;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    z-index: 100;
  ">
    <h1 style="font-size: 4rem; color: #ffd700;">VICTORY</h1>
    <p style="font-size: 1.2rem; margin-top: 1rem;">敵ネクサスを破壊した！</p>
  </div>
```

- [ ] **Step 2: HUDテスト作成**

```typescript
// src/ui/HUD.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HUD } from './HUD';
import { Structure } from '../entity/Structure';
import { BlockType } from '../world/Block';

function setupDOM(): void {
  const targetInfo = document.createElement('div');
  targetInfo.id = 'target-info';
  targetInfo.style.display = 'none';

  const targetName = document.createElement('div');
  targetName.id = 'target-name';
  targetInfo.appendChild(targetName);

  const hpBarContainer = document.createElement('div');
  hpBarContainer.id = 'hp-bar-container';
  const hpBarFill = document.createElement('div');
  hpBarFill.id = 'hp-bar-fill';
  hpBarContainer.appendChild(hpBarFill);
  targetInfo.appendChild(hpBarContainer);

  const hpText = document.createElement('div');
  hpText.id = 'hp-text';
  targetInfo.appendChild(hpText);

  const feedback = document.createElement('div');
  feedback.id = 'combat-feedback';
  feedback.style.display = 'none';

  const victory = document.createElement('div');
  victory.id = 'victory-screen';
  victory.style.display = 'none';

  document.body.append(targetInfo, feedback, victory);
}

function createStructure(hp: number, maxHp: number): Structure {
  const s = new Structure('red-t2', 'red', 8, 4, 168, 'tower', maxHp, 3, 6, 3, BlockType.TOWER_BLOCK, null);
  if (hp < maxHp) s.takeDamage(maxHp - hp);
  return s;
}

describe('HUD', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    setupDOM();
  });

  it('showTarget displays target info', () => {
    const hud = new HUD();
    const s = createStructure(1500, 1500);
    hud.showTarget(s);
    expect(document.getElementById('target-info')!.style.display).toBe('block');
    expect(document.getElementById('target-name')!.textContent).toContain('Tower');
    expect(document.getElementById('hp-text')!.textContent).toContain('1500');
  });

  it('HP bar width reflects HP percentage', () => {
    const hud = new HUD();
    const s = createStructure(750, 1500);
    hud.showTarget(s);
    expect(document.getElementById('hp-bar-fill')!.style.width).toBe('50%');
  });

  it('HP bar color changes based on HP ratio', () => {
    const hud = new HUD();

    // >50%: green
    const high = createStructure(1000, 1500);
    hud.showTarget(high);
    const greenColor = document.getElementById('hp-bar-fill')!.style.backgroundColor;

    // 25-50%: yellow
    const mid = createStructure(500, 1500);
    hud.showTarget(mid);
    const yellowColor = document.getElementById('hp-bar-fill')!.style.backgroundColor;

    // <25%: red
    const low = createStructure(200, 1500);
    hud.showTarget(low);
    const redColor = document.getElementById('hp-bar-fill')!.style.backgroundColor;

    // 3つの色がすべて異なることを検証
    expect(greenColor).not.toBe(yellowColor);
    expect(yellowColor).not.toBe(redColor);
    expect(greenColor).not.toBe(redColor);
  });

  it('hideTarget hides target info', () => {
    const hud = new HUD();
    const s = createStructure(1500, 1500);
    hud.showTarget(s);
    hud.hideTarget();
    expect(document.getElementById('target-info')!.style.display).toBe('none');
  });

  it('showVictory displays victory screen', () => {
    const hud = new HUD();
    hud.showVictory();
    expect(document.getElementById('victory-screen')!.style.display).toBe('flex');
  });

  it('showProtected displays feedback message', () => {
    vi.useFakeTimers();
    const hud = new HUD();
    hud.showProtected();
    expect(document.getElementById('combat-feedback')!.style.display).toBe('block');
    expect(document.getElementById('combat-feedback')!.textContent).toContain('保護');
    vi.advanceTimersByTime(1500);
    expect(document.getElementById('combat-feedback')!.style.display).toBe('none');
    vi.useRealTimers();
  });
});
```

- [ ] **Step 3: テスト失敗を確認**

Run: `npx vitest run src/ui/HUD.test.ts`
Expected: FAIL（HUD未定義）

- [ ] **Step 4: HUD.ts実装**

```typescript
// src/ui/HUD.ts
import { Structure } from '../entity/Structure';
import { AttackResult } from '../entity/CombatSystem';

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
    if (!this.targetInfoEl) return;
    this.targetInfoEl.style.display = 'block';

    const name = structure.structureType === 'tower' ? 'Tower' : 'Nexus';
    const teamLabel = structure.team === 'red' ? 'Red' : 'Blue';
    if (this.targetNameEl) {
      this.targetNameEl.textContent = `${name} (${teamLabel})`;
    }

    const ratio = structure.hp / structure.maxHp;
    if (this.hpBarFillEl) {
      this.hpBarFillEl.style.width = `${Math.round(ratio * 100)}%`;
      if (ratio > 0.5) {
        this.hpBarFillEl.style.backgroundColor = '#44bb44';
      } else if (ratio > 0.25) {
        this.hpBarFillEl.style.backgroundColor = '#ddbb22';
      } else {
        this.hpBarFillEl.style.backgroundColor = '#dd3333';
      }
    }

    if (this.hpTextEl) {
      this.hpTextEl.textContent = `${structure.hp} / ${structure.maxHp}`;
    }
  }

  hideTarget(): void {
    if (this.targetInfoEl) {
      this.targetInfoEl.style.display = 'none';
    }
  }

  showDamage(_result: AttackResult): void {
    // HP更新はshowTargetで反映されるため、追加の表示は将来拡張
  }

  showProtected(): void {
    if (!this.feedbackEl) return;
    this.feedbackEl.textContent = 'このタワーは保護されています';
    this.feedbackEl.style.display = 'block';
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => {
      if (this.feedbackEl) this.feedbackEl.style.display = 'none';
    }, 1500);
  }

  showVictory(): void {
    if (this.victoryEl) {
      this.victoryEl.style.display = 'flex';
    }
  }
}
```

- [ ] **Step 5: テスト成功を確認**

Run: `npx vitest run src/ui/HUD.test.ts`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add index.html src/ui/HUD.ts src/ui/HUD.test.ts
git commit -m "feat: add HUD with HP bar, protected feedback, and victory screen"
```

---

### Task 8: Game.ts統合

**Files:**
- Modify: `src/engine/Game.ts`

- [ ] **Step 1: Game.tsを修正**

Game.tsにCombatSystem, HUD, structuresを統合。以下の変更を適用:

1. importを追加:
```typescript
import { CombatSystem } from '../entity/CombatSystem';
import { HUD } from '../ui/HUD';
import { Structure } from '../entity/Structure';
```

2. フィールドを追加:
```typescript
private combatSystem!: CombatSystem;
private hud!: HUD;
private structures!: Structure[];
private gameOver = false;
```

3. init()でgenerateARAMMapの戻り値を受け取り、CombatSystemとHUDを初期化:
```typescript
// before
this.world = new World();
generateARAMMap(this.world);
// after
this.world = new World();
const { structures } = generateARAMMap(this.world);
this.structures = structures;
this.combatSystem = new CombatSystem();
this.hud = new HUD();
```

4. loop()でupdate()にtimeを渡す:
```typescript
private loop(time: number): void {
  const dt = Math.min((time - this.lastTime) / 1000, 0.05);
  this.lastTime = time;
  this.update(dt, time);
  this.renderer.render();
  requestAnimationFrame((t) => this.loop(t));
}
```

5. update()を全面書き換え（specセクション4の完全なコード）:
```typescript
private update(dt: number, time: number): void {
  if (this.instructionsEl) {
    this.instructionsEl.style.display = this.input.isPointerLocked ? 'none' : 'block';
  }
  if (!this.input.isPointerLocked) return;
  if (this.gameOver) return;

  const mouse = this.input.getMouseMovement();
  this.renderer.fpsCamera.rotate(mouse.x, mouse.y);

  if (this.input.isKeyDown('Space')) {
    this.player.jump();
  }
  this.player.updatePhysics(dt);

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

  this.renderer.fpsCamera.setPosition(
    this.player.eyeX, this.player.eyeY, this.player.eyeZ,
  );

  const dir = this.renderer.fpsCamera.getDirection();

  const targetStructure = this.combatSystem.findTarget(
    this.player.eyeX, this.player.eyeY, this.player.eyeZ,
    dir.x, dir.y, dir.z,
    this.structures,
  );

  const hit = this.blockInteraction.update(
    this.player.eyeX, this.player.eyeY, this.player.eyeZ,
    dir.x, dir.y, dir.z,
  );

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
      if (this.blockInteraction.breakBlock(hit)) {
        this.rebuildDirtyChunks();
      }
    }
  }

  if (this.input.consumeRightClick()) {
    if (hit) {
      if (this.blockInteraction.placeBlock(hit, this.player.x, this.player.y, this.player.z)) {
        this.rebuildDirtyChunks();
      }
    }
  }

  if (targetStructure) {
    this.hud.showTarget(targetStructure);
  } else {
    this.hud.hideTarget();
  }
}
```

6. checkVictory()を追加:
```typescript
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

- [ ] **Step 2: TypeScriptビルド確認**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: 全テスト実行**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: コミット**

```bash
git add src/engine/Game.ts
git commit -m "feat: integrate combat system, HUD, and victory condition into game loop"
```

---

### Task 9: 手動プレイテスト + 最終確認

- [ ] **Step 1: 開発サーバー起動**

Run: `npm run dev`

- [ ] **Step 2: ブラウザでプレイテスト**

確認項目:
1. マップが広くなっている（以前より長い）
2. 石ブロックのタワーとbedrockのネクサスが見える
3. タワーに近づくとHPバーが表示される
4. タワーを左クリックするとHPが減る（50ダメージ、0.5秒クールダウン）
5. 保護されたタワーを攻撃すると「保護されています」メッセージ
6. T2 -> T1 -> Nexusの順でしか攻撃できない
7. Red Nexus破壊で「VICTORY」画面
8. 通常ブロックの破壊・設置は引き続き動作する
9. タワー/ネクサスブロックにはハイライトが出ない

- [ ] **Step 3: 全テスト + ビルド最終確認**

Run: `npx vitest run && npx tsc --noEmit`
Expected: ALL PASS, no type errors

- [ ] **Step 4: コミット（プレイテストで問題があった場合のみ）**

```bash
git add -A
git commit -m "fix: playtest adjustments"
```
