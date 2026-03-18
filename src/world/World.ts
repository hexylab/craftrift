import { Chunk, CHUNK_SIZE } from './Chunk';
import { BlockType, isSolid } from './Block';

export class World {
  private chunks = new Map<string, Chunk>();

  private key(cx: number, cy: number, cz: number): string {
    return `${cx},${cy},${cz}`;
  }

  private toChunkCoord(v: number): number {
    return Math.floor(v / CHUNK_SIZE);
  }

  private toLocalCoord(v: number): number {
    return ((v % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  }

  getChunk(cx: number, cy: number, cz: number): Chunk | undefined {
    return this.chunks.get(this.key(cx, cy, cz));
  }

  getOrCreateChunk(cx: number, cy: number, cz: number): Chunk {
    const k = this.key(cx, cy, cz);
    let chunk = this.chunks.get(k);
    if (!chunk) {
      chunk = new Chunk(cx, cy, cz);
      this.chunks.set(k, chunk);
    }
    return chunk;
  }

  getBlock(wx: number, wy: number, wz: number): BlockType {
    const cx = this.toChunkCoord(wx);
    const cy = this.toChunkCoord(wy);
    const cz = this.toChunkCoord(wz);
    const chunk = this.getChunk(cx, cy, cz);
    if (!chunk) return BlockType.AIR;
    return chunk.getBlock(
      this.toLocalCoord(wx),
      this.toLocalCoord(wy),
      this.toLocalCoord(wz),
    );
  }

  setBlock(wx: number, wy: number, wz: number, type: BlockType): void {
    const cx = this.toChunkCoord(wx);
    const cy = this.toChunkCoord(wy);
    const cz = this.toChunkCoord(wz);
    const chunk = this.getOrCreateChunk(cx, cy, cz);
    const lx = this.toLocalCoord(wx);
    const ly = this.toLocalCoord(wy);
    const lz = this.toLocalCoord(wz);
    chunk.setBlock(lx, ly, lz, type);

    // Mark adjacent chunks dirty if at chunk boundary
    if (lx === 0) this.markDirty(cx - 1, cy, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cy, cz);
    if (ly === 0) this.markDirty(cx, cy - 1, cz);
    if (ly === CHUNK_SIZE - 1) this.markDirty(cx, cy + 1, cz);
    if (lz === 0) this.markDirty(cx, cy, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cy, cz + 1);
  }

  private markDirty(cx: number, cy: number, cz: number): void {
    const chunk = this.getChunk(cx, cy, cz);
    if (chunk) chunk.dirty = true;
  }

  isSolidBlock(wx: number, wy: number, wz: number): boolean {
    return isSolid(this.getBlock(wx, wy, wz));
  }

  getAllChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }
}
