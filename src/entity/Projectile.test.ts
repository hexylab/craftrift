import { describe, it, expect } from 'vitest';
import { Projectile, PROJECTILE_SPEED, PROJECTILE_RADIUS, PROJECTILE_MAX_LIFETIME, PLAYER_HIT_RADIUS, PROJECTILE_TURN_RATE } from './Projectile';

describe('Projectile', () => {
  it('initial state: alive=true, at origin position', () => {
    const p = new Projectile(0, 5, 0, 25, 'red', 10, 5, 0);
    expect(p.alive).toBe(true);
    expect(p.x).toBe(0);
    expect(p.y).toBe(5);
    expect(p.z).toBe(0);
  });

  it('moves toward initial target direction', () => {
    const p = new Projectile(0, 0, 0, 25, 'red', 80, 0, 0);
    // ターゲットが同じ方向にいるので旋回不要、まっすぐ進む
    p.update(1.0, 80, 0, 0);
    expect(p.x).toBeCloseTo(PROJECTILE_SPEED, 1);
    expect(p.y).toBeCloseTo(0, 1);
    expect(p.z).toBeCloseTo(0, 1);
  });

  it('hits target when close enough', () => {
    const hitDist = PROJECTILE_RADIUS + PLAYER_HIT_RADIUS;
    const p = new Projectile(0, 0, 0, 25, 'red', hitDist * 0.5, 0, 0);
    const hit = p.update(0.001, hitDist * 0.5, 0, 0);
    expect(hit).toBe(true);
    expect(p.alive).toBe(false);
  });

  it('expires after max lifetime', () => {
    const p = new Projectile(0, 0, 0, 25, 'red', 1000, 0, 0);
    const hit = p.update(PROJECTILE_MAX_LIFETIME + 0.1, 1000, 0, 0);
    expect(hit).toBe(false);
    expect(p.alive).toBe(false);
  });

  it('gradually turns toward moved target (limited homing)', () => {
    // 弾はz+方向に発射、ターゲットはx+方向に移動
    const p = new Projectile(0, 0, 0, 25, 'red', 0, 0, 100);
    // 1フレーム進む（z方向へ）
    p.update(0.5, 0, 0, 100);
    const z1 = p.z;
    expect(z1).toBeGreaterThan(0);

    // ターゲットがx+方向に移動 → 弾は徐々にx方向へ曲がる
    p.update(0.5, 100, 0, p.z);
    expect(p.x).toBeGreaterThan(0); // x方向に曲がり始める
    // 旋回制限があるため、完全にはx方向を向かない
    expect(p.z).toBeGreaterThan(z1); // z方向にもまだ進んでいる
  });

  it('does not crash when at same position as target (zero distance)', () => {
    const p = new Projectile(5, 5, 5, 25, 'red', 10, 5, 5);
    const hit = p.update(0.016, 5, 5, 5);
    expect(hit).toBe(true);
    expect(p.alive).toBe(false);
  });

  it('cannot turn faster than PROJECTILE_TURN_RATE', () => {
    // 弾はz+方向に発射、ターゲットは真横(x+)
    const p = new Projectile(0, 0, 0, 25, 'red', 0, 0, 100);
    // 1フレーム(16ms)で旋回可能な最大角度
    const maxAnglePerFrame = PROJECTILE_TURN_RATE * 0.016;
    p.update(0.016, 100, 0, 0); // ターゲットは90度横

    // 弾の進行方向: z方向からわずかにx方向へ曲がったはず
    // x移動量はspeed * dt * sin(maxAngle) 程度
    // 完全ホーミングならx = speed * dt ≈ 0.128 だが、旋回制限で小さくなる
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(PROJECTILE_SPEED * 0.016 * 0.5); // 半分未満（90度旋回は不可能）
  });
});
