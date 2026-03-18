import { writeFileSync, mkdirSync } from 'fs';
import { PNG } from 'pngjs';

mkdirSync('public/textures', { recursive: true });

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function createPng(
  width: number, height: number,
  fill: (x: number, y: number) => [number, number, number],
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y);
      const idx = (y * width + x) * 4;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function withNoise(
  bg: [number, number, number],
  alt: [number, number, number],
  x: number, y: number,
): [number, number, number] {
  return ((x * 7 + y * 13) % 5 === 0) ? alt : bg;
}

const textures: Record<string, (x: number, y: number) => [number, number, number]> = {
  grass_top: (x, y) => withNoise(hexToRgb('#4a8c2a'), hexToRgb('#3d7a22'), x, y),
  grass_side: (x, y) => y < 3
    ? withNoise(hexToRgb('#4a8c2a'), hexToRgb('#3d7a22'), x, y)
    : withNoise(hexToRgb('#8B6914'), hexToRgb('#7a5c10'), x, y),
  dirt: (x, y) => withNoise(hexToRgb('#8B6914'), hexToRgb('#7a5c10'), x, y),
  stone: (x, y) => withNoise(hexToRgb('#888888'), hexToRgb('#777777'), x, y),
  bedrock: (x, y) => withNoise(hexToRgb('#333333'), hexToRgb('#222222'), x, y),
};

for (const [name, fill] of Object.entries(textures)) {
  const buf = createPng(16, 16, fill);
  writeFileSync(`public/textures/${name}.png`, buf);
  console.log(`Generated: public/textures/${name}.png`);
}
