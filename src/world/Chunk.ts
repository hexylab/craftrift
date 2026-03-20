import { BlockType } from './Block';

export const CHUNK_SIZE = 16;

export class Chunk {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly worldX: number;
  readonly worldY: number;
  readonly worldZ: number;
  dirty = true;

  private blocks: Uint8Array;

  constructor(cx: number, cy: number, cz: number) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.worldX = cx * CHUNK_SIZE;
    this.worldY = cy * CHUNK_SIZE;
    this.worldZ = cz * CHUNK_SIZE;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
  }

  private index(x: number, y: number, z: number): number {
    return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
  }

  private inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < CHUNK_SIZE && y >= 0 && y < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE;
  }

  getBlock(x: number, y: number, z: number): BlockType {
    if (!this.inBounds(x, y, z)) return BlockType.AIR;
    return this.blocks[this.index(x, y, z)] as BlockType;
  }

  setBlock(x: number, y: number, z: number, type: BlockType): void {
    if (!this.inBounds(x, y, z)) return;
    this.blocks[this.index(x, y, z)] = type;
    this.dirty = true;
  }
}
