import { describe, it, expect } from 'vitest';
import { Projectile, PROJECTILE_SPEED, PROJECTILE_RADIUS, PROJECTILE_MAX_LIFETIME, PLAYER_HIT_RADIUS, PROJECTILE_TURN_RATE } from './Projectile';

describe('Projectile', () => {
  it('initial state: alive=true, at origin position', () => {
    const p = new Projectile(0, 5, 0, 25, 'red', { x: 10, y: 5, z: 0, isAlive: true });
    expect(p.alive).toBe(true);
    expect(p.x).toBe(0);
    expect(p.y).toBe(5);
    expect(p.z).toBe(0);
  });

  it('moves toward initial target direction', () => {
    const target = { x: 80, y: 0, z: 0, isAlive: true };
    const p = new Projectile(0, 0, 0, 25, 'red', target);
    // ターゲットが同じ方向にいるので旋回不要、まっすぐ進む
    p.update(1.0);
    expect(p.x).toBeCloseTo(PROJECTILE_SPEED, 1);
    expect(p.y).toBeCloseTo(0, 1);
    expect(p.z).toBeCloseTo(0, 1);
  });

  it('hits target when close enough', () => {
    const hitDist = PROJECTILE_RADIUS + PLAYER_HIT_RADIUS;
    const target = { x: hitDist * 0.5, y: 0, z: 0, isAlive: true };
    const p = new Projectile(0, 0, 0, 25, 'red', target);
    const hit = p.update(0.001);
    expect(hit).toBe(true);
    expect(p.alive).toBe(false);
  });

  it('expires after max lifetime', () => {
    const target = { x: 1000, y: 0, z: 0, isAlive: true };
    const p = new Projectile(0, 0, 0, 25, 'red', target);
    const hit = p.update(PROJECTILE_MAX_LIFETIME + 0.1);
    expect(hit).toBe(false);
    expect(p.alive).toBe(false);
  });

  it('gradually turns toward moved target (limited homing)', () => {
    // 弾はz+方向に発射、ターゲットはx+方向に移動
    const target = { x: 0, y: 0, z: 100, isAlive: true };
    const p = new Projectile(0, 0, 0, 25, 'red', target);
    // 1フレーム進む（z方向へ）
    p.update(0.5);
    const z1 = p.z;
    expect(z1).toBeGreaterThan(0);

    // ターゲットがx+方向に移動 → 弾は徐々にx方向へ曲がる
    target.x = 100;
    target.z = p.z;
    p.update(0.5);
    expect(p.x).toBeGreaterThan(0); // x方向に曲がり始める
    // 旋回制限があるため、完全にはx方向を向かない
    expect(p.z).toBeGreaterThan(z1); // z方向にもまだ進んでいる
  });

  it('does not crash when at same position as target (zero distance)', () => {
    // 弾とターゲットが同じ位置にある場合はヒット判定になる
    const target = { x: 5, y: 5, z: 5, isAlive: true };
    const p = new Projectile(5, 5, 5, 25, 'red', target);
    const hit = p.update(0.016);
    expect(hit).toBe(true);
    expect(p.alive).toBe(false);
  });

  it('cannot turn faster than PROJECTILE_TURN_RATE', () => {
    // 弾はz+方向に発射、ターゲットは真横(x+)
    const target = { x: 0, y: 0, z: 100, isAlive: true };
    const p = new Projectile(0, 0, 0, 25, 'red', target);
    // 1フレーム(16ms)で旋回可能な最大角度
    const maxAnglePerFrame = PROJECTILE_TURN_RATE * 0.016;
    target.x = 100;
    target.z = 0;
    p.update(0.016); // ターゲットは90度横

    // 弾の進行方向: z方向からわずかにx方向へ曲がったはず
    // x移動量はspeed * dt * sin(maxAngle) 程度
    // 完全ホーミングならx = speed * dt ≈ 0.128 だが、旋回制限で小さくなる
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(PROJECTILE_SPEED * 0.016 * 0.5); // 半分未満（90度旋回は不可能）
  });

  it('projectile dies when target dies', () => {
    const target = { x: 100, y: 0, z: 0, isAlive: true };
    const p = new Projectile(0, 0, 0, 25, 'red', target);
    // ターゲットが生きている間は弾も生きている
    const hit1 = p.update(0.1);
    expect(hit1).toBe(false);
    expect(p.alive).toBe(true);

    // ターゲットが死亡したら弾も消滅する
    target.isAlive = false;
    const hit2 = p.update(0.1);
    expect(hit2).toBe(false);
    expect(p.alive).toBe(false);
  });
});
