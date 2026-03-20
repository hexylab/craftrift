// src/ui/HealthBar3D.ts
import * as THREE from 'three';

const BAR_WIDTH = 64;
const BAR_HEIGHT = 8;

/**
 * DataTexture を使って HP バーを描画するユーティリティ。
 * Canvas を使わないので Node.js テスト環境でも動作する。
 */
function createBarTexture(): THREE.DataTexture {
  const data = new Uint8Array(BAR_WIDTH * BAR_HEIGHT * 4);
  const texture = new THREE.DataTexture(data, BAR_WIDTH, BAR_HEIGHT);
  texture.needsUpdate = true;
  return texture;
}

function writePixel(data: Uint8Array, x: number, y: number, r: number, g: number, b: number, a = 255): void {
  const idx = (y * BAR_WIDTH + x) * 4;
  data[idx]     = r;
  data[idx + 1] = g;
  data[idx + 2] = b;
  data[idx + 3] = a;
}

function redrawBar(texture: THREE.DataTexture, ratio: number): void {
  const data = texture.image.data as Uint8Array;
  const fillWidth = Math.round(ratio * BAR_WIDTH);

  // 色の決定: 緑 → 黄 → 赤
  let fr: number, fg: number, fb: number;
  if (ratio > 0.5) {
    fr = 0x44; fg = 0xbb; fb = 0x44;   // 緑
  } else if (ratio > 0.25) {
    fr = 0xdd; fg = 0xbb; fb = 0x22;   // 黄
  } else {
    fr = 0xdd; fg = 0x33; fb = 0x33;   // 赤
  }

  for (let y = 0; y < BAR_HEIGHT; y++) {
    for (let x = 0; x < BAR_WIDTH; x++) {
      if (x < fillWidth) {
        writePixel(data, x, y, fr, fg, fb);
      } else {
        // 黒背景
        writePixel(data, x, y, 0, 0, 0);
      }
    }
  }

  texture.needsUpdate = true;
}

/**
 * ミニオンの頭上に浮かぶ 3D HP バー Sprite を生成して返す。
 * @param modelHeight モデルの高さ (sprite.position.y = modelHeight + 0.3 に設定)
 */
export function createHealthBar(modelHeight: number): THREE.Sprite {
  const texture = createBarTexture();

  const material = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    transparent: true,
  });

  const sprite = new THREE.Sprite(material);
  sprite.position.y = modelHeight + 0.3;
  sprite.scale.set(1.0, 0.15, 1);
  sprite.visible = false;

  // 後から updateHealthBar で参照できるようにテクスチャを保持
  sprite.userData['healthBarTexture'] = texture;

  return sprite;
}

/**
 * HP バーの表示を更新する。
 * @param sprite createHealthBar で生成した Sprite
 * @param hp 現在 HP
 * @param maxHp 最大 HP
 */
export function updateHealthBar(sprite: THREE.Sprite, hp: number, maxHp: number): void {
  if (hp >= maxHp || hp <= 0) {
    sprite.visible = false;
    return;
  }

  sprite.visible = true;

  const texture = sprite.userData['healthBarTexture'] as THREE.DataTexture;
  if (!texture) return;

  const ratio = hp / maxHp;
  redrawBar(texture, ratio);
}
