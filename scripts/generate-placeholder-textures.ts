import { PNG } from 'pngjs';
import * as fs from 'fs';

// ---- helpers ----------------------------------------------------------------

function fillRect(
  png: PNG,
  x: number, y: number,
  w: number, h: number,
  r: number, g: number, b: number,
): void {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const idx = (png.width * py + px) * 4;
      png.data[idx]     = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
}

function hex(color: string): [number, number, number] {
  const v = parseInt(color.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

// ---- color scheme types -----------------------------------------------------

interface FaceColors {
  top:    string;
  bottom: string;
  left:   string;
  right:  string;
  front:  string;
  back:   string;
}

interface SheepColors {
  head: FaceColors;
  body: FaceColors;
  legs: FaceColors;
}

// ---- cube net painter -------------------------------------------------------

/**
 * Paint the 6 faces of a Minecraft-style cube net onto the PNG.
 *
 * Minecraft cube net layout (origin at skinRegion.originX/Y):
 *
 *   Head  (w=6, h=6, d=8):
 *     top:    (8 ,0) 6×8    bottom: (14,0) 6×8
 *     left:   (0 ,8) 8×6   front:  (8 ,8) 6×6
 *     right:  (14,8) 8×6   back:   (22,8) 6×6
 *
 *   Body  (origin=28,8; w=8, h=16, d=6):
 *     top:    (34,8 ) 8×6   bottom: (42,8 ) 8×6
 *     left:   (28,14) 6×16  front:  (34,14) 8×16
 *     right:  (42,14) 6×16  back:   (48,14) 8×16
 *
 *   Legs  (origin=0,16; w=4, h=12, d=4):
 *     top:    (4 ,16) 4×4   bottom: (8 ,16) 4×4
 *     left:   (0 ,20) 4×12  front:  (4 ,20) 4×12
 *     right:  (8 ,20) 4×12  back:   (12,20) 4×12
 *
 * General formula (ox=originX, oy=originY, w=width, h=height, d=depth):
 *   top:    ox+d,      oy,       w, d
 *   bottom: ox+d+w,   oy,       w, d
 *   left:   ox,        oy+d,     d, h
 *   front:  ox+d,      oy+d,     w, h
 *   right:  ox+d+w,   oy+d,     d, h
 *   back:   ox+d+w+d, oy+d,     w, h
 */
function paintCubeNet(
  png: PNG,
  ox: number, oy: number,
  w: number, h: number, d: number,
  colors: FaceColors,
): void {
  const [tr, tg, tb]   = hex(colors.top);
  const [bor, bog, bob] = hex(colors.bottom);
  const [lr, lg, lb]   = hex(colors.left);
  const [fr, fg, fb]   = hex(colors.front);
  const [rr, rg, rb]   = hex(colors.right);
  const [bar, bag, bab] = hex(colors.back);

  // top
  fillRect(png, ox + d,         oy,      w, d, tr,  tg,  tb);
  // bottom
  fillRect(png, ox + d + w,     oy,      w, d, bor, bog, bob);
  // left
  fillRect(png, ox,              oy + d,  d, h, lr,  lg,  lb);
  // front
  fillRect(png, ox + d,          oy + d,  w, h, fr,  fg,  fb);
  // right
  fillRect(png, ox + d + w,      oy + d,  d, h, rr,  rg,  rb);
  // back
  fillRect(png, ox + d + w + d,  oy + d,  w, h, bar, bag, bab);
}

// ---- generator --------------------------------------------------------------

function generateSheepTexture(filename: string, colors: SheepColors): void {
  const png = new PNG({ width: 64, height: 32 });

  // Background — dark grey for unused area
  fillRect(png, 0, 0, 64, 32, 0x33, 0x33, 0x33);

  // Head: originX=0, originY=0, w=6, h=6, d=8
  paintCubeNet(png, 0, 0, 6, 6, 8, colors.head);

  // Body: originX=28, originY=8, w=8, h=16, d=6
  paintCubeNet(png, 28, 8, 8, 16, 6, colors.body);

  // Legs: originX=0, originY=16, w=4, h=12, d=4
  paintCubeNet(png, 0, 16, 4, 12, 4, colors.legs);

  const buffer = PNG.sync.write(png);
  fs.mkdirSync('public/textures/mobs', { recursive: true });
  fs.writeFileSync(filename, buffer);
  console.log(`Generated: ${filename}`);
}

// ---- color definitions ------------------------------------------------------

const GREEN_LEGS: FaceColors = {
  front:  '#44cc44',
  top:    '#88ff88',
  left:   '#66ff66',
  right:  '#66ff66',
  back:   '#aaffaa',
  bottom: '#22ff22',
};

const BLUE_COLORS: SheepColors = {
  head: {
    front:  '#cc4444',
    top:    '#ff8888',
    left:   '#ff6666',
    right:  '#ff6666',
    back:   '#ffaaaa',
    bottom: '#ff2222',
  },
  body: {
    front:  '#4444cc',
    top:    '#8888ff',
    left:   '#6666ff',
    right:  '#6666ff',
    back:   '#aaaaff',
    bottom: '#2222ff',
  },
  legs: GREEN_LEGS,
};

const RED_COLORS: SheepColors = {
  head: {
    front:  '#888888',
    top:    '#aaaaaa',
    left:   '#999999',
    right:  '#999999',
    back:   '#bbbbbb',
    bottom: '#666666',
  },
  body: {
    front:  '#cc4444',
    top:    '#ff8888',
    left:   '#ff6666',
    right:  '#ff6666',
    back:   '#ffaaaa',
    bottom: '#ff2222',
  },
  legs: GREEN_LEGS,
};

// ---- main -------------------------------------------------------------------

generateSheepTexture('public/textures/mobs/minion_blue.png', BLUE_COLORS);
generateSheepTexture('public/textures/mobs/minion_red.png',  RED_COLORS);
