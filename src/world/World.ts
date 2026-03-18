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
    chunk.setBlock(
      this.toLocalCoord(wx),
      this.toLocalCoord(wy),
      this.toLocalCoord(wz),
      type,
    );
  }

  isSolidBlock(wx: number, wy: number, wz: number): boolean {
    return isSolid(this.getBlock(wx, wy, wz));
  }

  getAllChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }
}
