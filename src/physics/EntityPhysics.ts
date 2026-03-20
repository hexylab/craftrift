import { KnockbackState, updateKnockback, hasKnockback } from './Knockback';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export interface EntityBody {
  x: number;
  y: number;
  z: number;
  width: number; // XZ断面は正方形 (width x width)
  height: number; // Y軸の高さ
  velocityY: number;
  onGround: boolean;
}

/** テスタビリティのためにWorldの最小インターフェースを定義 */
type WorldLike = { getBlock: (x: number, y: number, z: number) => unknown };

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

export const GRAVITY = 32;
export const JUMP_VELOCITY = 9.0;
export const TERMINAL_VELOCITY = 78.4;

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/**
 * 指定位置にエンティティAABBが固体ブロックと重なるか判定する。
 * AABB: [x - w/2, x + w/2] × [y, y + height] × [z - w/2, z + w/2]
 * BlockType.AIR = 0 は偽値なので `if (world.getBlock(...))` で固体判定が成立する。
 */
function collidesAt(
  body: EntityBody,
  px: number,
  py: number,
  pz: number,
  world: WorldLike,
): boolean {
  const hw = body.width / 2;
  const minX = Math.floor(px - hw);
  const maxX = Math.floor(px + hw);
  const minY = Math.floor(py);
  const maxY = Math.floor(py + body.height);
  const minZ = Math.floor(pz - hw);
  const maxZ = Math.floor(pz + hw);

  for (let bx = minX; bx <= maxX; bx++) {
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        if (world.getBlock(bx, by, bz)) {
          // AABB vs ブロックの厳密な重なり判定
          if (
            px + hw > bx &&
            px - hw < bx + 1 &&
            py + body.height > by &&
            py < by + 1 &&
            pz + hw > bz &&
            pz - hw < bz + 1
          ) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 公開API
// ---------------------------------------------------------------------------

/**
 * 重力適用 + Y方向衝突判定 + 着地判定。
 * - velocityY を GRAVITY * dt 分減らす
 * - TERMINAL_VELOCITY でクランプ
 * - ステッピング方式でY移動しながら衝突チェック
 */
export function applyGravity(body: EntityBody, dt: number, world: WorldLike): void {
  body.velocityY -= GRAVITY * dt;
  if (body.velocityY < -TERMINAL_VELOCITY) {
    body.velocityY = -TERMINAL_VELOCITY;
  }

  const delta = body.velocityY * dt;
  if (delta === 0) return;

  const STEP = body.width / 2;
  let remaining = Math.abs(delta);
  const sign = delta > 0 ? 1 : -1;
  let hitBlock = false;

  while (remaining > 0) {
    const step = Math.min(remaining, STEP);
    const nextY = body.y + sign * step;
    if (collidesAt(body, body.x, nextY, body.z, world)) {
      hitBlock = true;
      break;
    }
    body.y = nextY;
    remaining -= step;
  }

  if (hitBlock) {
    if (delta < 0) {
      // 下方向への衝突 → 着地
      body.onGround = true;
    }
    // 上方向への衝突（天井）も含めてvelocityYをリセット
    body.velocityY = 0;
  } else {
    body.onGround = false;
  }
}

/**
 * AABB衝突付きXZ水平移動（ステッピング方式）。
 * X軸・Z軸それぞれ独立に処理することで壁スライドが可能。
 */
export function moveWithCollision(
  body: EntityBody,
  dx: number,
  dz: number,
  world: WorldLike,
): void {
  const STEP = body.width / 2;

  if (dx !== 0) {
    let remaining = Math.abs(dx);
    const sign = dx > 0 ? 1 : -1;
    while (remaining > 0) {
      const step = Math.min(remaining, STEP);
      const nextX = body.x + sign * step;
      if (collidesAt(body, nextX, body.y, body.z, world)) {
        break;
      }
      body.x = nextX;
      remaining -= step;
    }
  }

  if (dz !== 0) {
    let remaining = Math.abs(dz);
    const sign = dz > 0 ? 1 : -1;
    while (remaining > 0) {
      const step = Math.min(remaining, STEP);
      const nextZ = body.z + sign * step;
      if (collidesAt(body, body.x, body.y, nextZ, world)) {
        break;
      }
      body.z = nextZ;
      remaining -= step;
    }
  }
}

/**
 * onGround時にジャンプ速度をセットする。
 * @returns ジャンプが成功した場合 true
 */
export function tryJump(body: EntityBody): boolean {
  if (body.onGround) {
    body.velocityY = JUMP_VELOCITY;
    return true;
  }
  return false;
}

/**
 * ノックバック移動を moveWithCollision 経由で適用し、その後ノックバックを減衰させる。
 * hasKnockback が false（速度が微小）の場合は移動をスキップする。
 */
export function applyEntityKnockback(
  body: EntityBody,
  kb: KnockbackState,
  dt: number,
  world: WorldLike,
): void {
  if (hasKnockback(kb)) {
    const kbDx = kb.vx * dt;
    const kbDz = kb.vz * dt;
    moveWithCollision(body, kbDx, kbDz, world);
  }
  updateKnockback(kb, dt);
}
