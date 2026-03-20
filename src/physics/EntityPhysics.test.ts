import { describe, it, expect } from 'vitest';
import {
  EntityBody,
  GRAVITY,
  JUMP_VELOCITY,
  TERMINAL_VELOCITY,
  applyGravity,
  moveWithCollision,
  tryJump,
  applyEntityKnockback,
} from './EntityPhysics';
import { KnockbackState } from './Knockback';

// テスト用 WorldLike: すべて空気
const emptyWorld = { getBlock: () => 0 };

// 指定座標のブロックのみ固体なWorldLikeを生成
function worldWithBlocks(blocks: Array<{ x: number; y: number; z: number }>) {
  return {
    getBlock(bx: number, by: number, bz: number): number {
      for (const b of blocks) {
        if (b.x === bx && b.y === by && b.z === bz) return 1; // STONE相当
      }
      return 0; // AIR
    },
  };
}

// 地面ブロック（y=5, x=3..7, z=3..7）を持つワールドを生成
function makeGroundWorld() {
  const blocks: Array<{ x: number; y: number; z: number }> = [];
  for (let x = 3; x <= 7; x++) {
    for (let z = 3; z <= 7; z++) {
      blocks.push({ x, y: 5, z });
    }
  }
  return worldWithBlocks(blocks);
}

function makeBody(overrides: Partial<EntityBody> = {}): EntityBody {
  return {
    x: 5,
    y: 10,
    z: 5,
    width: 0.6,
    height: 1.8,
    velocityY: 0,
    onGround: false,
    ...overrides,
  };
}

// ============================
// applyGravity
// ============================
describe('applyGravity', () => {
  it('重力によってvelocityYが減少する', () => {
    const body = makeBody();
    applyGravity(body, 1 / 60, emptyWorld);
    expect(body.velocityY).toBeLessThan(0);
  });

  it('空中ではonGroundがfalseのまま', () => {
    const body = makeBody({ y: 10 });
    applyGravity(body, 1 / 60, emptyWorld);
    expect(body.onGround).toBe(false);
  });

  it('地面ブロック上に着地するとonGroundがtrueになる', () => {
    const world = makeGroundWorld();
    // y=7（ブロック上面 y=6 から1ブロック上）から落下
    const body = makeBody({ y: 7 });
    for (let i = 0; i < 120; i++) {
      applyGravity(body, 1 / 60, world);
    }
    expect(body.onGround).toBe(true);
    expect(body.velocityY).toBe(0);
    // ブロック上面(y=6)付近
    expect(body.y).toBeGreaterThanOrEqual(6);
    expect(body.y).toBeLessThan(6.1);
  });

  it('着地後に追加フレームを実行してもY座標が変化しない', () => {
    const world = makeGroundWorld();
    const body = makeBody({ y: 7 });
    for (let i = 0; i < 120; i++) {
      applyGravity(body, 1 / 60, world);
    }
    const yAfterLanding = body.y;
    for (let i = 0; i < 60; i++) {
      applyGravity(body, 1 / 60, world);
    }
    expect(body.y).toBeCloseTo(yAfterLanding, 5);
  });

  it('終端速度 -TERMINAL_VELOCITY を超えない', () => {
    const body = makeBody({ y: 1000 });
    for (let i = 0; i < 600; i++) {
      applyGravity(body, 1 / 60, emptyWorld);
    }
    expect(body.velocityY).toBeGreaterThanOrEqual(-TERMINAL_VELOCITY);
  });

  it('大きなdt（1秒）でもブロックをすり抜けない', () => {
    const blocks: Array<{ x: number; y: number; z: number }> = [];
    for (let x = 4; x <= 6; x++) {
      for (let z = 4; z <= 6; z++) {
        blocks.push({ x, y: 0, z });
      }
    }
    const world = worldWithBlocks(blocks);
    const body = makeBody({ y: 5, x: 5, z: 5 });
    applyGravity(body, 1.0, world);
    // ブロック上面(y=1)を突き抜けていない
    expect(body.y).toBeGreaterThanOrEqual(1);
  });

  it('天井衝突でvelocityYが0にリセットされる', () => {
    // 地面 y=5（上面 y=6）、天井 y=8（下面 y=8）
    const blocks: Array<{ x: number; y: number; z: number }> = [];
    for (let x = 4; x <= 6; x++) {
      for (let z = 4; z <= 6; z++) {
        blocks.push({ x, y: 5, z });
        blocks.push({ x, y: 8, z });
      }
    }
    const world = worldWithBlocks(blocks);
    const body = makeBody({ y: 6.1, x: 5, z: 5 });
    // 着地させる
    for (let i = 0; i < 120; i++) {
      applyGravity(body, 1 / 60, world);
    }
    expect(body.onGround).toBe(true);
    // ジャンプ相当のvelocityYを設定
    body.velocityY = JUMP_VELOCITY;
    body.onGround = false;
    // 天井に当たるまでフレームを進める
    for (let i = 0; i < 30; i++) {
      applyGravity(body, 1 / 60, world);
    }
    // 天井を超えていない: body.y + height <= 8
    expect(body.y + body.height).toBeLessThanOrEqual(8);
    // velocityYは0以下（衝突でリセット → その後重力で負に）
    expect(body.velocityY).toBeLessThanOrEqual(0);
  });
});

// ============================
// moveWithCollision
// ============================
describe('moveWithCollision', () => {
  it('障害物がない場合は自由に移動できる', () => {
    const body = makeBody();
    moveWithCollision(body, 1.0, 0, emptyWorld);
    expect(body.x).toBeGreaterThan(5);
    expect(body.z).toBe(5);
  });

  it('X方向の壁を通り抜けない', () => {
    // x=7 に壁を置く
    const blocks: Array<{ x: number; y: number; z: number }> = [];
    for (let y = 9; y <= 12; y++) {
      for (let z = 4; z <= 6; z++) {
        blocks.push({ x: 7, y, z });
      }
    }
    const world = worldWithBlocks(blocks);
    const body = makeBody({ x: 5, y: 10, z: 5 });
    moveWithCollision(body, 10.0, 0, world);
    // 壁の手前で止まる: x + width/2 <= 7
    expect(body.x + body.width / 2).toBeLessThanOrEqual(7);
  });

  it('Z方向の壁を通り抜けない', () => {
    // z=4 に壁を置く（負Z方向）
    const blocks: Array<{ x: number; y: number; z: number }> = [];
    for (let y = 9; y <= 12; y++) {
      for (let x = 4; x <= 6; x++) {
        blocks.push({ x, y, z: 4 });
      }
    }
    const world = worldWithBlocks(blocks);
    const body = makeBody({ x: 5, y: 10, z: 5.5 });
    moveWithCollision(body, 0, -10.0, world);
    // 壁の手前で止まる: z - width/2 >= 5 (壁上面 z=5)
    expect(body.z - body.width / 2).toBeGreaterThanOrEqual(4 + 1);
  });

  it('対角移動でXとZが独立してスライドする', () => {
    // z=4 に壁を置く（z方向のみブロック）
    const blocks: Array<{ x: number; y: number; z: number }> = [];
    for (let y = 9; y <= 12; y++) {
      for (let x = 3; x <= 7; x++) {
        blocks.push({ x, y, z: 4 });
      }
    }
    const world = worldWithBlocks(blocks);
    const body = makeBody({ x: 5, y: 10, z: 5.5 });
    moveWithCollision(body, 1.0, -5.0, world);
    // X方向には移動できる
    expect(body.x).toBeGreaterThan(5);
    // Z方向は壁で止まる
    expect(body.z - body.width / 2).toBeGreaterThanOrEqual(5);
  });

  it('dx=0, dz=0のとき移動しない', () => {
    const body = makeBody();
    moveWithCollision(body, 0, 0, emptyWorld);
    expect(body.x).toBe(5);
    expect(body.z).toBe(5);
  });
});

// ============================
// tryJump
// ============================
describe('tryJump', () => {
  it('onGroundのときJUMP_VELOCITYをセットしてtrueを返す', () => {
    const body = makeBody({ onGround: true, velocityY: 0 });
    const result = tryJump(body);
    expect(result).toBe(true);
    expect(body.velocityY).toBe(JUMP_VELOCITY);
  });

  it('空中（onGround=false）のときはジャンプできない', () => {
    const body = makeBody({ onGround: false, velocityY: 0 });
    const result = tryJump(body);
    expect(result).toBe(false);
    expect(body.velocityY).toBe(0);
  });
});

// ============================
// applyEntityKnockback
// ============================
describe('applyEntityKnockback', () => {
  it('ノックバック速度があれば移動する', () => {
    const body = makeBody({ x: 5, z: 5 });
    const kb: KnockbackState = { vx: 5.0, vz: 0 };
    const beforeX = body.x;
    applyEntityKnockback(body, kb, 1 / 60, emptyWorld);
    expect(body.x).not.toBe(beforeX);
  });

  it('ノックバック速度が時間経過で減衰する', () => {
    const body = makeBody();
    const kb: KnockbackState = { vx: 3.0, vz: 3.0 };
    const initialVx = kb.vx;
    applyEntityKnockback(body, kb, 1 / 60, emptyWorld);
    expect(Math.abs(kb.vx)).toBeLessThan(Math.abs(initialVx));
  });

  it('ノックバック中も壁をすり抜けない', () => {
    // x=7 に壁を置く
    const blocks: Array<{ x: number; y: number; z: number }> = [];
    for (let y = 9; y <= 12; y++) {
      for (let z = 4; z <= 6; z++) {
        blocks.push({ x: 7, y, z });
      }
    }
    const world = worldWithBlocks(blocks);
    const body = makeBody({ x: 5, y: 10, z: 5 });
    const kb: KnockbackState = { vx: 100.0, vz: 0 };
    // 複数フレーム適用
    for (let i = 0; i < 60; i++) {
      applyEntityKnockback(body, kb, 1 / 60, world);
    }
    expect(body.x + body.width / 2).toBeLessThanOrEqual(7);
  });

  it('速度が小さい場合でも呼び出せる（hasKnockbackがfalseの場合）', () => {
    const body = makeBody();
    const kb: KnockbackState = { vx: 0, vz: 0 };
    const beforeX = body.x;
    applyEntityKnockback(body, kb, 1 / 60, emptyWorld);
    expect(body.x).toBe(beforeX);
  });
});

// ============================
// 定数確認
// ============================
describe('定数', () => {
  it('GRAVITY は 32', () => {
    expect(GRAVITY).toBe(32);
  });

  it('JUMP_VELOCITY は 9.0', () => {
    expect(JUMP_VELOCITY).toBe(9.0);
  });

  it('TERMINAL_VELOCITY は 78.4', () => {
    expect(TERMINAL_VELOCITY).toBe(78.4);
  });
});
