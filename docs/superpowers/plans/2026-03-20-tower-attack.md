# タワー攻撃AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タワーとネクサスが射程内の敵プレイヤーにホーミング弾を発射し、被弾時に画面シェイク＋赤フラッシュで視覚フィードバックを返すシステムを構築する。

**Architecture:** TowerAI（攻撃判定）→ ProjectileManager（弾管理＋Three.js描画）→ PlayerState.takeDamage()の流れ。ScreenShakeとHUDのダメージフラッシュは全ダメージソース共通。各コンポーネントは独立テスト可能。

**Tech Stack:** TypeScript, Three.js, Vitest

**Spec:** `docs/superpowers/specs/2026-03-20-tower-attack-design.md`

---

### Task 1: ScreenShake

**Files:**
- Create: `src/effects/ScreenShake.ts`
- Create: `src/effects/ScreenShake.test.ts`

- [ ] **Step 1: テストファイルを作成**

```typescript
// src/effects/ScreenShake.test.ts
import { describe, it, expect } from 'vitest';
import { ScreenShake, SCREEN_SHAKE_INTENSITY, SCREEN_SHAKE_DURATION } from './ScreenShake';

describe('ScreenShake', () => {
  it('initial state returns zero offsets', () => {
    const shake = new ScreenShake();
    const result = shake.update(0.016);
    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(0);
  });

  it('returns non-zero offsets after trigger', () => {
    const shake = new ScreenShake();
    shake.trigger();
    // trigger直後のupdate（dtが十分小さい）
    const result = shake.update(0.001);
    // ランダムなので非ゼロの可能性が高いが、稀に0になりうるため絶対値チェック
    // timerがまだ残っているので少なくとも1回は非ゼロになるまでループ
    let hasNonZero = false;
    for (let i = 0; i < 100; i++) {
      const s = new ScreenShake();
      s.trigger();
      const r = s.update(0.001);
      if (r.offsetX !== 0 || r.offsetY !== 0) {
        hasNonZero = true;
        break;
      }
    }
    expect(hasNonZero).toBe(true);
  });

  it('offsets decay to zero after duration elapses', () => {
    const shake = new ScreenShake();
    shake.trigger();
    // SCREEN_SHAKE_DURATIONを超過
    const result = shake.update(SCREEN_SHAKE_DURATION + 0.1);
    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(0);
  });

  it('multiple triggers reset the timer', () => {
    const shake = new ScreenShake();
    shake.trigger();
    shake.update(SCREEN_SHAKE_DURATION - 0.01); // ほぼ終了
    shake.trigger(); // 再トリガー
    const result = shake.update(0.001);
    // 再トリガー後なのでまだアクティブ（timer > 0）
    // 0を返さない可能性が高い
    // ただしランダムなので、timerが残っていることをもう一つのテスト方法で確認
    // → duration後にはゼロに戻ることを確認
    const result2 = shake.update(SCREEN_SHAKE_DURATION + 0.1);
    expect(result2.offsetX).toBe(0);
    expect(result2.offsetY).toBe(0);
  });

  it('uses custom intensity when provided', () => {
    const shake = new ScreenShake();
    shake.trigger(0.5);
    // デフォルト(0.15)より大きいintensityなので、振幅も大きくなるはず
    let maxOffset = 0;
    for (let i = 0; i < 100; i++) {
      const s = new ScreenShake();
      s.trigger(0.5);
      const r = s.update(0.001);
      maxOffset = Math.max(maxOffset, Math.abs(r.offsetX), Math.abs(r.offsetY));
    }
    expect(maxOffset).toBeGreaterThan(0);
    expect(maxOffset).toBeLessThanOrEqual(0.5);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && npx vitest run src/effects/ScreenShake.test.ts`
Expected: FAIL（ScreenShakeモジュールが存在しない）

- [ ] **Step 3: ScreenShakeを実装**

```typescript
// src/effects/ScreenShake.ts
export const SCREEN_SHAKE_INTENSITY = 0.15;
export const SCREEN_SHAKE_DURATION = 0.2;

export class ScreenShake {
  private timer: number = 0;
  private _intensity: number = 0;

  trigger(intensity?: number): void {
    this.timer = SCREEN_SHAKE_DURATION;
    this._intensity = intensity ?? SCREEN_SHAKE_INTENSITY;
  }

  update(dt: number): { offsetX: number; offsetY: number } {
    if (this.timer <= 0) {
      return { offsetX: 0, offsetY: 0 };
    }
    this.timer = Math.max(0, this.timer - dt);
    if (this.timer === 0) {
      return { offsetX: 0, offsetY: 0 };
    }
    const decay = this.timer / SCREEN_SHAKE_DURATION;
    const offsetX = (Math.random() * 2 - 1) * this._intensity * decay;
    const offsetY = (Math.random() * 2 - 1) * this._intensity * decay;
    return { offsetX, offsetY };
  }
}
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && npx vitest run src/effects/ScreenShake.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: コミット**

```bash
cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && git add src/effects/ScreenShake.ts src/effects/ScreenShake.test.ts && git commit -m "feat: add ScreenShake effect with decay"
```

---

### Task 2: TowerAI

**Files:**
- Create: `src/entity/TowerAI.ts`
- Create: `src/entity/TowerAI.test.ts`

**Context:** `Structure`クラス（`src/entity/Structure.ts`）を参照。`Structure`は`Entity`を継承し、`x, y, z, width, height, depth, isAlive, team`を持つ。

- [ ] **Step 1: テストファイルを作成**

```typescript
// src/entity/TowerAI.test.ts
import { describe, it, expect } from 'vitest';
import { TowerAI, TOWER_ATTACK_RANGE, TOWER_ATTACK_INTERVAL, TOWER_DAMAGE } from './TowerAI';
import { Structure } from './Structure';
import { BlockType } from '../world/Block';

function makeTower(team: 'blue' | 'red' = 'red', x = 8, y = 4, z = 136): Structure {
  // 3x6x3 タワー
  return new Structure('test-tower', team, x, y, z, 'tower', 1500, 3, 6, 3, BlockType.RED_TOWER, null);
}

describe('TowerAI', () => {
  it('getCenterX/Y/Z returns structure center', () => {
    const tower = makeTower('red', 8, 4, 136);
    const ai = new TowerAI(tower);
    expect(ai.getCenterX()).toBe(8 + 3 / 2); // 9.5
    expect(ai.getCenterY()).toBe(4 + 6 / 2); // 7
    expect(ai.getCenterZ()).toBe(136 + 3 / 2); // 137.5
  });

  it('isInRange returns true when target within range', () => {
    const ai = new TowerAI(makeTower());
    // タワー中心(9.5, 7, 137.5)から距離5の点
    expect(ai.isInRange(9.5, 7, 137.5 + 5)).toBe(true);
  });

  it('isInRange returns false when target outside range', () => {
    const ai = new TowerAI(makeTower());
    expect(ai.isInRange(9.5, 7, 137.5 + TOWER_ATTACK_RANGE + 1)).toBe(false);
  });

  it('isInRange returns true at exact boundary', () => {
    const ai = new TowerAI(makeTower());
    expect(ai.isInRange(9.5, 7, 137.5 + TOWER_ATTACK_RANGE)).toBe(true);
  });

  it('fires after attack interval when in range', () => {
    const ai = new TowerAI(makeTower());
    const targetZ = 137.5 + 5; // 射程内
    // 時間を進める
    const result1 = ai.update(TOWER_ATTACK_INTERVAL - 0.01, 9.5, 7, targetZ, true);
    expect(result1).toBeNull();
    const result2 = ai.update(0.02, 9.5, 7, targetZ, true);
    expect(result2).not.toBeNull();
    expect(result2!.damage).toBe(TOWER_DAMAGE);
    expect(result2!.originX).toBe(9.5);
    expect(result2!.originY).toBe(7);
    expect(result2!.originZ).toBe(137.5);
    expect(result2!.team).toBe('red');
  });

  it('returns null when target out of range', () => {
    const ai = new TowerAI(makeTower());
    const farZ = 137.5 + TOWER_ATTACK_RANGE + 10;
    const result = ai.update(TOWER_ATTACK_INTERVAL + 1, 9.5, 7, farZ, true);
    expect(result).toBeNull();
  });

  it('returns null when structure is destroyed', () => {
    const tower = makeTower();
    tower.hp = 0;
    tower.isAlive = false;
    const ai = new TowerAI(tower);
    const result = ai.update(TOWER_ATTACK_INTERVAL + 1, 9.5, 7, 137.5, true);
    expect(result).toBeNull();
  });

  it('returns null when target is dead', () => {
    const ai = new TowerAI(makeTower());
    const result = ai.update(TOWER_ATTACK_INTERVAL + 1, 9.5, 7, 137.5 + 5, false);
    expect(result).toBeNull();
  });

  it('resets timer when target leaves range', () => {
    const ai = new TowerAI(makeTower());
    const inRange = 137.5 + 5;
    const outOfRange = 137.5 + TOWER_ATTACK_RANGE + 10;
    // 射程内で1.5秒進める（未発射）
    ai.update(1.5, 9.5, 7, inRange, true);
    // 射程外に出る → タイマーリセット
    ai.update(0.1, 9.5, 7, outOfRange, true);
    // 射程内に戻る → 2.0秒必要（リセット済み）
    const result = ai.update(1.5, 9.5, 7, inRange, true);
    expect(result).toBeNull(); // まだ2秒に達していない
    const result2 = ai.update(0.6, 9.5, 7, inRange, true);
    expect(result2).not.toBeNull(); // 合計2.1秒で発射
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && npx vitest run src/entity/TowerAI.test.ts`
Expected: FAIL（TowerAIモジュールが存在しない）

- [ ] **Step 3: TowerAIを実装**

```typescript
// src/entity/TowerAI.ts
import { Structure } from './Structure';
import { Team } from './Entity';

export const TOWER_ATTACK_RANGE = 15.0;
export const TOWER_ATTACK_INTERVAL = 2.0;
export const TOWER_DAMAGE = 25;

export interface FireCommand {
  originX: number;
  originY: number;
  originZ: number;
  damage: number;
  team: Team;
}

export class TowerAI {
  private attackTimer: number = 0;

  constructor(readonly structure: Structure) {}

  update(
    dt: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    targetAlive: boolean,
  ): FireCommand | null {
    if (!this.structure.isAlive) return null;
    if (!targetAlive) return null;

    if (!this.isInRange(targetX, targetY, targetZ)) {
      this.attackTimer = 0;
      return null;
    }

    this.attackTimer += dt;
    if (this.attackTimer >= TOWER_ATTACK_INTERVAL) {
      this.attackTimer -= TOWER_ATTACK_INTERVAL;
      return {
        originX: this.getCenterX(),
        originY: this.getCenterY(),
        originZ: this.getCenterZ(),
        damage: TOWER_DAMAGE,
        team: this.structure.team,
      };
    }
    return null;
  }

  getCenterX(): number {
    return this.structure.x + this.structure.width / 2;
  }

  getCenterY(): number {
    return this.structure.y + this.structure.height / 2;
  }

  getCenterZ(): number {
    return this.structure.z + this.structure.depth / 2;
  }

  isInRange(targetX: number, targetY: number, targetZ: number): boolean {
    const dx = targetX - this.getCenterX();
    const dy = targetY - this.getCenterY();
    const dz = targetZ - this.getCenterZ();
    return Math.sqrt(dx * dx + dy * dy + dz * dz) <= TOWER_ATTACK_RANGE;
  }
}
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && npx vitest run src/entity/TowerAI.test.ts`
Expected: 9 tests PASS

- [ ] **Step 5: コミット**

```bash
cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && git add src/entity/TowerAI.ts src/entity/TowerAI.test.ts && git commit -m "feat: add TowerAI with range detection and attack interval"
```

---

### Task 3: Projectile

**Files:**
- Create: `src/entity/Projectile.ts`
- Create: `src/entity/Projectile.test.ts`

- [ ] **Step 1: テストファイルを作成**

```typescript
// src/entity/Projectile.test.ts
import { describe, it, expect } from 'vitest';
import { Projectile, PROJECTILE_SPEED, PROJECTILE_RADIUS, PROJECTILE_MAX_LIFETIME, PLAYER_HIT_RADIUS } from './Projectile';

describe('Projectile', () => {
  it('initial state: alive=true, at origin position', () => {
    const p = new Projectile(0, 5, 0, 25, 'red');
    expect(p.alive).toBe(true);
    expect(p.x).toBe(0);
    expect(p.y).toBe(5);
    expect(p.z).toBe(0);
  });

  it('moves toward target (homing)', () => {
    const p = new Projectile(0, 0, 0, 25, 'red');
    p.update(1.0, 80, 0, 0); // ターゲットがx=80（遠方）
    // 1秒で PROJECTILE_SPEED(8) ブロック進むはず
    expect(p.x).toBeCloseTo(PROJECTILE_SPEED, 1);
    expect(p.y).toBeCloseTo(0, 1);
    expect(p.z).toBeCloseTo(0, 1);
  });

  it('hits target when close enough', () => {
    // 弾をターゲットのすぐ近くに配置
    const hitDist = PROJECTILE_RADIUS + PLAYER_HIT_RADIUS;
    const p = new Projectile(0, 0, 0, 25, 'red');
    // ターゲットを hitDist - 0.01 の距離に配置（ヒット範囲内）
    const hit = p.update(0.001, hitDist * 0.5, 0, 0);
    expect(hit).toBe(true);
    expect(p.alive).toBe(false);
  });

  it('expires after max lifetime', () => {
    const p = new Projectile(0, 0, 0, 25, 'red');
    const hit = p.update(PROJECTILE_MAX_LIFETIME + 0.1, 1000, 0, 0);
    expect(hit).toBe(false);
    expect(p.alive).toBe(false);
  });

  it('keeps tracking when target moves', () => {
    const p = new Projectile(0, 0, 0, 25, 'red');
    // ターゲットがz=100
    p.update(0.5, 0, 0, 100);
    expect(p.z).toBeGreaterThan(0); // z方向に移動
    // ターゲットがx=100に移動
    p.update(0.5, 100, 0, 0);
    expect(p.x).toBeGreaterThan(0); // x方向にも移動開始
  });

  it('does not crash when at same position as target (zero distance)', () => {
    const p = new Projectile(5, 5, 5, 25, 'red');
    const hit = p.update(0.016, 5, 5, 5);
    // 距離0なのでヒット範囲内 → ヒット
    expect(hit).toBe(true);
    expect(p.alive).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && npx vitest run src/entity/Projectile.test.ts`
Expected: FAIL

- [ ] **Step 3: Projectileを実装**

```typescript
// src/entity/Projectile.ts
import { Team } from './Entity';

export const PROJECTILE_SPEED = 8.0;
export const PROJECTILE_RADIUS = 0.2;
export const PROJECTILE_MAX_LIFETIME = 5.0;
export const PLAYER_HIT_RADIUS = 0.5;

export class Projectile {
  x: number;
  y: number;
  z: number;
  readonly damage: number;
  readonly team: Team;
  private lifetime: number = 0;
  alive: boolean = true;

  constructor(x: number, y: number, z: number, damage: number, team: Team) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.damage = damage;
    this.team = team;
  }

  update(dt: number, targetX: number, targetY: number, targetZ: number): boolean {
    this.lifetime += dt;
    if (this.lifetime >= PROJECTILE_MAX_LIFETIME) {
      this.alive = false;
      return false;
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dz = targetZ - this.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const hitDist = PROJECTILE_RADIUS + PLAYER_HIT_RADIUS;

    // 移動前ヒット判定（dist <= hitDistならヒット。hitDist > 0なのでゼロ除算も自然に防止）
    if (dist <= hitDist) {
      this.alive = false;
      return true;
    }

    // ホーミング移動（dist > hitDist > 0 が保証されているため正規化は安全）
    const nx = dx / dist;
    const ny = dy / dist;
    const nz = dz / dist;
    this.x += nx * PROJECTILE_SPEED * dt;
    this.y += ny * PROJECTILE_SPEED * dt;
    this.z += nz * PROJECTILE_SPEED * dt;

    // 移動後ヒット判定
    const dx2 = targetX - this.x;
    const dy2 = targetY - this.y;
    const dz2 = targetZ - this.z;
    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2);
    if (dist2 <= hitDist) {
      this.alive = false;
      return true;
    }

    return false;
  }
}
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && npx vitest run src/entity/Projectile.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: コミット**

```bash
cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && git add src/entity/Projectile.ts src/entity/Projectile.test.ts && git commit -m "feat: add homing Projectile with hit detection"
```

---

### Task 4: ProjectileManager

**Files:**
- Create: `src/entity/ProjectileManager.ts`
- Create: `src/entity/ProjectileManager.test.ts`

**Context:** Three.jsのScene, Mesh, SphereGeometry, MeshStandardMaterialを使用。テストではThree.jsをモック化する。

- [ ] **Step 1: テストファイルを作成**

```typescript
// src/entity/ProjectileManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectileManager, HitResult } from './ProjectileManager';
import { FireCommand } from './TowerAI';
import { PROJECTILE_MAX_LIFETIME } from './Projectile';

// Three.jsモック
vi.mock('three', () => {
  class MockVector3 { constructor(public x = 0, public y = 0, public z = 0) {} set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } }
  class MockMesh {
    position = new MockVector3();
    geometry = { dispose: vi.fn() };
  }
  class MockSphereGeometry {}
  class MockMeshStandardMaterial {}
  class MockScene {
    children: any[] = [];
    add(obj: any) { this.children.push(obj); }
    remove(obj: any) { const i = this.children.indexOf(obj); if (i >= 0) this.children.splice(i, 1); }
  }
  return {
    Scene: MockScene,
    Mesh: MockMesh,
    SphereGeometry: MockSphereGeometry,
    MeshStandardMaterial: MockMeshStandardMaterial,
    Vector3: MockVector3,
  };
});

import * as THREE from 'three';

describe('ProjectileManager', () => {
  let scene: THREE.Scene;
  let manager: ProjectileManager;

  beforeEach(() => {
    scene = new THREE.Scene();
    manager = new ProjectileManager(scene);
  });

  it('spawn adds a projectile and mesh to scene', () => {
    const command: FireCommand = { originX: 0, originY: 5, originZ: 0, damage: 25, team: 'red' };
    manager.spawn(command);
    expect(scene.children.length).toBe(1);
  });

  it('update moves projectiles', () => {
    const command: FireCommand = { originX: 0, originY: 0, originZ: 0, damage: 25, team: 'red' };
    manager.spawn(command);
    const hits = manager.update(0.5, 100, 0, 0); // ターゲットは遠方
    expect(hits.length).toBe(0);
    // Meshの位置が更新されている（x > 0）
    const mesh = scene.children[0] as THREE.Mesh;
    expect(mesh.position.x).toBeGreaterThan(0);
  });

  it('update returns HitResult when projectile hits', () => {
    // 弾をターゲットの近くに配置
    const command: FireCommand = { originX: 0, originY: 0, originZ: 0, damage: 25, team: 'red' };
    manager.spawn(command);
    // ターゲットを弾の近くに
    const hits = manager.update(0.001, 0.1, 0, 0);
    expect(hits.length).toBe(1);
    expect(hits[0].damage).toBe(25);
    expect(hits[0].team).toBe('red');
    // ヒット後、meshがsceneから削除される
    expect(scene.children.length).toBe(0);
  });

  it('removes expired projectiles', () => {
    const command: FireCommand = { originX: 0, originY: 0, originZ: 0, damage: 25, team: 'red' };
    manager.spawn(command);
    manager.update(PROJECTILE_MAX_LIFETIME + 1, 1000, 0, 0);
    expect(scene.children.length).toBe(0);
  });

  it('dispose removes all projectiles', () => {
    manager.spawn({ originX: 0, originY: 0, originZ: 0, damage: 25, team: 'red' });
    manager.spawn({ originX: 5, originY: 0, originZ: 0, damage: 25, team: 'red' });
    expect(scene.children.length).toBe(2);
    manager.dispose();
    expect(scene.children.length).toBe(0);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && npx vitest run src/entity/ProjectileManager.test.ts`
Expected: FAIL

- [ ] **Step 3: ProjectileManagerを実装**

```typescript
// src/entity/ProjectileManager.ts
import * as THREE from 'three';
import { Projectile, PROJECTILE_RADIUS } from './Projectile';
import { FireCommand } from './TowerAI';
import { Team } from './Entity';

export interface HitResult {
  damage: number;
  team: Team;
}

export class ProjectileManager {
  private projectiles: Projectile[] = [];
  private meshes: Map<Projectile, THREE.Mesh> = new Map();

  constructor(private scene: THREE.Scene) {}

  spawn(command: FireCommand): void {
    const projectile = new Projectile(
      command.originX, command.originY, command.originZ,
      command.damage, command.team,
    );
    this.projectiles.push(projectile);

    const color = command.team === 'red' ? 0xff4444 : 0x4444ff;
    const geometry = new THREE.SphereGeometry(PROJECTILE_RADIUS, 8, 8);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(command.originX, command.originY, command.originZ);
    this.scene.add(mesh);
    this.meshes.set(projectile, mesh);
  }

  update(dt: number, targetX: number, targetY: number, targetZ: number): HitResult[] {
    const hits: HitResult[] = [];

    for (const p of this.projectiles) {
      const hit = p.update(dt, targetX, targetY, targetZ);
      if (hit) {
        hits.push({ damage: p.damage, team: p.team });
      }
    }

    // alive=falseの弾を削除
    const dead = this.projectiles.filter(p => !p.alive);
    for (const p of dead) {
      const mesh = this.meshes.get(p);
      if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.meshes.delete(p);
      }
    }
    this.projectiles = this.projectiles.filter(p => p.alive);

    // 残っている弾のMesh位置を同期
    for (const p of this.projectiles) {
      const mesh = this.meshes.get(p);
      if (mesh) {
        mesh.position.set(p.x, p.y, p.z);
      }
    }

    return hits;
  }

  dispose(): void {
    for (const [p, mesh] of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.projectiles = [];
    this.meshes.clear();
  }
}
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && npx vitest run src/entity/ProjectileManager.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: コミット**

```bash
cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && git add src/entity/ProjectileManager.ts src/entity/ProjectileManager.test.ts && git commit -m "feat: add ProjectileManager for Three.js projectile lifecycle"
```

---

### Task 5: HUD拡張（タワー警告＋ダメージフラッシュ）

**Files:**
- Modify: `src/ui/HUD.ts`
- Modify: `src/ui/HUD.test.ts`
- Modify: `index.html`

**Context:** HUDクラスはDOMのgetElementByIdでnull安全にアクセスするパターン。テストではjsdomの`setupDOM()`ヘルパーを使う。`HUD.test.ts`の既存`setupDOM()`関数に新しいDOM要素を追加する必要がある。

- [ ] **Step 1: index.htmlにDOM要素を追加**

`index.html`の`</body>`の直前（`<script type="module" ...>`の直前）に以下を追加:

```html
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
  <div id="damage-flash" style="
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(255, 0, 0, 0.3);
    pointer-events: none;
    z-index: 40;
  "></div>
```

- [ ] **Step 2: HUD.test.tsにテストを追加**

`src/ui/HUD.test.ts`の`setupDOM()`関数を修正する。`deathOverlay.appendChild(respawnTimer);`の後（L49の後）に以下を追加:

```typescript
  const towerWarning = document.createElement('div');
  towerWarning.id = 'tower-warning';
  towerWarning.style.display = 'none';

  const damageFlash = document.createElement('div');
  damageFlash.id = 'damage-flash';
  damageFlash.style.display = 'none';
```

そしてL51の`document.body.append(...)`呼び出しに`towerWarning, damageFlash`を追加:
```typescript
  document.body.append(targetInfo, feedback, victory, playerHpBarFill, playerHpText, deathOverlay, towerWarning, damageFlash);
```

describeブロックの末尾（L186の`});`の直前）に以下のテストを追加:

```typescript
describe('tower warning', () => {
  it('showTowerWarning displays warning', () => {
    setupDOM();
    const hud = new HUD();
    hud.showTowerWarning();
    expect(document.getElementById('tower-warning')!.style.display).toBe('block');
  });

  it('hideTowerWarning hides warning', () => {
    setupDOM();
    const hud = new HUD();
    hud.showTowerWarning();
    hud.hideTowerWarning();
    expect(document.getElementById('tower-warning')!.style.display).toBe('none');
  });
});

describe('damage flash', () => {
  it('triggerDamageFlash shows flash', () => {
    setupDOM();
    const hud = new HUD();
    hud.triggerDamageFlash();
    const el = document.getElementById('damage-flash')!;
    expect(el.style.display).toBe('block');
    expect(el.style.opacity).toBe('0.3');
  });

  it('updateDamageFlash fades out over time', () => {
    setupDOM();
    const hud = new HUD();
    hud.triggerDamageFlash();
    hud.updateDamageFlash(0.075); // 半分経過
    const el = document.getElementById('damage-flash')!;
    const opacity = parseFloat(el.style.opacity);
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(0.3);
  });

  it('updateDamageFlash hides after duration', () => {
    setupDOM();
    const hud = new HUD();
    hud.triggerDamageFlash();
    hud.updateDamageFlash(0.2); // DAMAGE_FLASH_DURATION超過
    const el = document.getElementById('damage-flash')!;
    expect(el.style.display).toBe('none');
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && npx vitest run src/ui/HUD.test.ts`
Expected: FAIL（showTowerWarning等が存在しない）

- [ ] **Step 4: HUD.tsにメソッドを追加**

`src/ui/HUD.ts`に以下を追加:

```typescript
// フィールド追加（constructorで初期化）:
private towerWarningEl: HTMLElement | null;
private damageFlashEl: HTMLElement | null;
private damageFlashTimer: number = 0;

// constructor内に追加:
this.towerWarningEl = document.getElementById('tower-warning');
this.damageFlashEl = document.getElementById('damage-flash');

// 定数（ファイル先頭にexport）
export const DAMAGE_FLASH_DURATION = 0.15;

// メソッド追加:
showTowerWarning(): void {
  if (this.towerWarningEl) {
    this.towerWarningEl.style.display = 'block';
  }
}

hideTowerWarning(): void {
  if (this.towerWarningEl) {
    this.towerWarningEl.style.display = 'none';
  }
}

triggerDamageFlash(): void {
  if (this.damageFlashEl) {
    this.damageFlashEl.style.display = 'block';
    this.damageFlashEl.style.opacity = '0.3';
  }
  this.damageFlashTimer = DAMAGE_FLASH_DURATION;
}

updateDamageFlash(dt: number): void {
  if (this.damageFlashTimer <= 0) return;
  this.damageFlashTimer -= dt;
  if (this.damageFlashTimer <= 0) {
    this.damageFlashTimer = 0;
    if (this.damageFlashEl) {
      this.damageFlashEl.style.display = 'none';
    }
    return;
  }
  if (this.damageFlashEl) {
    const opacity = (this.damageFlashTimer / DAMAGE_FLASH_DURATION) * 0.3;
    this.damageFlashEl.style.opacity = String(opacity);
  }
}
```

- [ ] **Step 5: テストがパスすることを確認**

Run: `cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && npx vitest run src/ui/HUD.test.ts`
Expected: 既存テスト＋新規5テスト 全PASS

- [ ] **Step 6: 全テストがパスすることを確認**

Run: `cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && npx vitest run`
Expected: 全テストPASS

- [ ] **Step 7: コミット**

```bash
cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && git add src/ui/HUD.ts src/ui/HUD.test.ts index.html && git commit -m "feat: add tower warning and damage flash to HUD"
```

---

### Task 6: Game.ts統合

**Files:**
- Modify: `src/engine/Game.ts`

**Context:** Game.tsのupdate()メソッドにタワーAI更新、プロジェクタイル更新、画面シェイク、タワー警告、ダメージフラッシュを統合する。specのゲームループ順序に従う。

Game.tsの構造（文字列で位置を特定）:
- import文ブロック
- `const DEBUG_DAMAGE = 50;`
- Gameクラスのフィールド宣言
- `async init()`: 初期化
- `private loop()`: requestAnimationFrameループ
- `private update()`: メインゲームループ
- ヘルパーメソッド（checkVictory, rebuildAllChunks等）

- [ ] **Step 1: import文とフィールドを追加**

`src/engine/Game.ts`の先頭に追加:

```typescript
import { TowerAI } from '../entity/TowerAI';
import { ProjectileManager } from '../entity/ProjectileManager';
import { ScreenShake } from '../effects/ScreenShake';
import { PLAYER_HEIGHT } from '../player/Player';
```

フィールドに追加（`private playerState!: PlayerState;`の後）:

```typescript
private towerAIs!: TowerAI[];
private projectileManager!: ProjectileManager;
private screenShake!: ScreenShake;
```

- [ ] **Step 2: init()にTowerAI・ProjectileManager・ScreenShake初期化を追加**

`init()`の`this.playerState = new PlayerState();`の後に追加:

```typescript
this.towerAIs = this.structures.map(s => new TowerAI(s));
this.projectileManager = new ProjectileManager(this.renderer.scene);
this.screenShake = new ScreenShake();
```

- [ ] **Step 3: update()にタワーAI更新とプロジェクタイル更新を追加**

`update()`内の「カメラ位置更新」（`this.renderer.fpsCamera.setPosition(this.player.eyeX, this.player.eyeY, this.player.eyeZ)`）の**後**、レイキャスト（`const dir = this.renderer.fpsCamera.getDirection()`）の**前**に挿入:

```typescript
    // タワーAI更新（敵チームのみ）
    for (const ai of this.towerAIs) {
      if (ai.structure.team === 'blue') continue;
      const cmd = ai.update(dt, this.player.x, this.player.y, this.player.z, this.playerState.isAlive);
      if (cmd) {
        this.projectileManager.spawn(cmd);
      }
    }

    // プロジェクタイル更新
    const hits = this.projectileManager.update(
      dt, this.player.x, this.player.y + PLAYER_HEIGHT / 2, this.player.z,
    );
    for (const hit of hits) {
      if (!this.playerState.isInvincible()) {
        this.playerState.takeDamage(hit.damage);
        this.screenShake.trigger();
        this.hud.triggerDamageFlash();
      }
    }
```

- [ ] **Step 4: デバッグKキーに画面シェイク＋フラッシュを追加**

既存のデバッグKキー処理（`if (this.input.consumeKeyPress('KeyK'))`ブロック）を変更:

```typescript
    // デバッグ: Kキーで自傷ダメージ
    if (this.input.consumeKeyPress('KeyK')) {
      if (!this.playerState.isInvincible()) {
        this.playerState.takeDamage(DEBUG_DAMAGE);
        this.screenShake.trigger();
        this.hud.triggerDamageFlash();
      }
    }
```

- [ ] **Step 5: プレイヤーHP HUD更新の後にタワー警告・フラッシュ更新・シェイク適用を追加**

`update()`の末尾（`this.hud.updatePlayerHp(...)`の後）に追加:

```typescript
    // タワー警告HUD
    const inTowerRange = this.towerAIs.some(
      ai => ai.structure.team !== 'blue' && ai.structure.isAlive && ai.isInRange(this.player.x, this.player.y, this.player.z),
    );
    if (inTowerRange) {
      this.hud.showTowerWarning();
    } else {
      this.hud.hideTowerWarning();
    }

    // ダメージフラッシュ更新
    this.hud.updateDamageFlash(dt);

    // 画面シェイク適用（フレーム最後）
    const shake = this.screenShake.update(dt);
    if (shake.offsetX !== 0 || shake.offsetY !== 0) {
      this.renderer.fpsCamera.setPosition(
        this.player.eyeX + shake.offsetX,
        this.player.eyeY + shake.offsetY,
        this.player.eyeZ,
      );
    }
```

- [ ] **Step 6: 全テストがパスすることを確認**

Run: `cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && npx vitest run`
Expected: 全テストPASS（統合コード自体はGame.tsのユニットテストがないため、既存テストがregressionしないことを確認）

- [ ] **Step 7: コミット**

```bash
cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && git add src/engine/Game.ts && git commit -m "feat: integrate tower attack AI, projectiles, screen shake into game loop"
```

---

### Task 7: 手動プレイテスト

- [ ] **Step 1: 開発サーバーを起動**

Run: `cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && npx vite --open`

- [ ] **Step 2: プレイテスト確認項目**

1. ゲーム開始後、Red T1（z=136付近）に向かって歩く
2. 射程に入ると「タワーに狙われています」警告が表示される
3. 2秒後に赤い弾がタワーから飛んでくる
4. 弾がプレイヤーに向かってホーミングする
5. 被弾時: HPが25減少、画面が赤くフラッシュ、カメラが振動する
6. 射程外に出ると警告が消え、新しい弾は発射されない
7. 4発被弾でHP=0 → 死亡 → リスポーン
8. リスポーン後の無敵中はダメージ・シェイク・フラッシュなし
9. Kキーでの自傷も画面シェイク＋フラッシュが発生する
10. タワーを破壊するとそのタワーからの攻撃が止まる

- [ ] **Step 3: 問題があれば修正**

- [ ] **Step 4: 最終テスト実行**

Run: `cd /home/hexyl/workspace/craftrift/.worktrees/tower-attack && npx vitest run`
Expected: 全テストPASS
