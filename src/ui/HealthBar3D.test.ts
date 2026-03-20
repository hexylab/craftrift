// src/ui/HealthBar3D.test.ts
import { describe, it, expect } from 'vitest';
import { createHealthBar, updateHealthBar } from './HealthBar3D';

describe('HealthBar3D', () => {
  it('creates a sprite positioned above model', () => {
    const sprite = createHealthBar(1.5);
    expect(sprite).toBeDefined();
    expect(sprite.position.y).toBeGreaterThan(1.5);
  });

  it('is invisible at full HP', () => {
    const sprite = createHealthBar(1.5);
    updateHealthBar(sprite, 150, 150);
    expect(sprite.visible).toBe(false);
  });

  it('becomes visible when damaged', () => {
    const sprite = createHealthBar(1.5);
    updateHealthBar(sprite, 100, 150);
    expect(sprite.visible).toBe(true);
  });

  it('is invisible when dead (hp=0)', () => {
    const sprite = createHealthBar(1.5);
    updateHealthBar(sprite, 100, 150); // まず表示させる
    updateHealthBar(sprite, 0, 150);   // 死亡で非表示
    expect(sprite.visible).toBe(false);
  });

  it('sprite is initially invisible', () => {
    const sprite = createHealthBar(1.5);
    expect(sprite.visible).toBe(false);
  });

  it('position.y is modelHeight + 0.3', () => {
    const sprite = createHealthBar(2.0);
    expect(sprite.position.y).toBeCloseTo(2.3);
  });

  it('scale is set to thin bar dimensions', () => {
    const sprite = createHealthBar(1.5);
    expect(sprite.scale.x).toBe(1.0);
    expect(sprite.scale.y).toBe(0.15);
    expect(sprite.scale.z).toBe(1);
  });

  it('texture data is updated when HP changes', () => {
    const sprite = createHealthBar(1.5);
    updateHealthBar(sprite, 75, 150); // 50% HP → 緑
    const texture = sprite.userData['healthBarTexture'];
    expect(texture).toBeDefined();
    // 先頭ピクセルは塗られているはず (fillWidth > 0)
    const data = texture.image.data as Uint8Array;
    // 緑チャンネル: ratio=0.5 → ratio > 0.5 は false なので黄色 (fg=0xbb)
    // ratio=0.5 は > 0.5 ではないので 黄: r=0xdd, g=0xbb, b=0x22
    expect(data[0]).toBe(0xdd); // r
    expect(data[1]).toBe(0xbb); // g
    expect(data[2]).toBe(0x22); // b
  });

  it('uses green color above 50% HP', () => {
    const sprite = createHealthBar(1.5);
    updateHealthBar(sprite, 100, 150); // 66.7% → 緑
    const texture = sprite.userData['healthBarTexture'];
    const data = texture.image.data as Uint8Array;
    expect(data[0]).toBe(0x44); // r
    expect(data[1]).toBe(0xbb); // g
    expect(data[2]).toBe(0x44); // b
  });

  it('uses red color at 25% HP or below', () => {
    const sprite = createHealthBar(1.5);
    updateHealthBar(sprite, 30, 150); // 20% → 赤
    const texture = sprite.userData['healthBarTexture'];
    const data = texture.image.data as Uint8Array;
    expect(data[0]).toBe(0xdd); // r
    expect(data[1]).toBe(0x33); // g
    expect(data[2]).toBe(0x33); // b
  });
});
