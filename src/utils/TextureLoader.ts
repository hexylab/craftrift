// src/utils/TextureLoader.ts
import * as THREE from 'three';
import { TEXTURE_NAMES, ATLAS_SIZE } from '../world/Block';

const TEXTURE_SIZE = 16;

export class TextureAtlas {
  readonly texture: THREE.CanvasTexture;
  readonly atlasColumns: number;
  readonly tileUV: number;

  private constructor(canvas: HTMLCanvasElement) {
    this.atlasColumns = ATLAS_SIZE;
    this.tileUV = 1 / this.atlasColumns;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  getUV(textureIndex: number): { u: number; v: number; size: number } {
    return {
      u: (textureIndex % this.atlasColumns) * this.tileUV,
      v: 0,
      size: this.tileUV,
    };
  }

  static async load(): Promise<TextureAtlas> {
    const images = await Promise.all(
      TEXTURE_NAMES.map(
        (name) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = `/textures/${name}.png`;
          }),
      ),
    );

    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE * ATLAS_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d')!;

    images.forEach((img, i) => {
      ctx.drawImage(img, i * TEXTURE_SIZE, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    });

    return new TextureAtlas(canvas);
  }
}
