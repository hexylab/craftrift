import { CHUNK_SIZE } from './Chunk';
import { BlockType, isSolid, getBlockUVs, ATLAS_SIZE } from './Block';

export interface ChunkGeometryData {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

type GetBlockFn = (wx: number, wy: number, wz: number) => BlockType;

const FACES = [
  {
    dir: [1, 0, 0],
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
    normal: [1, 0, 0],
    uvFace: 'side' as const,
  },
  {
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
    normal: [-1, 0, 0],
    uvFace: 'side' as const,
  },
  {
    dir: [0, 1, 0],
    corners: [
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
    ],
    normal: [0, 1, 0],
    uvFace: 'top' as const,
  },
  {
    dir: [0, -1, 0],
    corners: [
      [0, 0, 1],
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
    ],
    normal: [0, -1, 0],
    uvFace: 'bottom' as const,
  },
  {
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    normal: [0, 0, 1],
    uvFace: 'side' as const,
  },
  {
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    normal: [0, 0, -1],
    uvFace: 'side' as const,
  },
];

export function buildChunkGeometryData(
  chunkX: number,
  chunkY: number,
  chunkZ: number,
  getBlock: GetBlockFn,
): ChunkGeometryData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const tileSize = 1 / ATLAS_SIZE;

  const originX = chunkX * CHUNK_SIZE;
  const originY = chunkY * CHUNK_SIZE;
  const originZ = chunkZ * CHUNK_SIZE;

  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = originX + lx;
        const wy = originY + ly;
        const wz = originZ + lz;
        const block = getBlock(wx, wy, wz);
        if (!isSolid(block)) continue;

        const blockUVs = getBlockUVs(block);

        for (const face of FACES) {
          const nx = wx + face.dir[0];
          const ny = wy + face.dir[1];
          const nz = wz + face.dir[2];

          if (isSolid(getBlock(nx, ny, nz))) continue;

          const texIdx = blockUVs[face.uvFace];
          const u0 = texIdx * tileSize;
          const v0 = 0;
          const u1 = u0 + tileSize;
          const v1 = 1;

          const vertexStart = positions.length / 3;

          for (const corner of face.corners) {
            positions.push(wx + corner[0], wy + corner[1], wz + corner[2]);
            normals.push(face.normal[0], face.normal[1], face.normal[2]);
          }

          uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);

          indices.push(
            vertexStart,
            vertexStart + 1,
            vertexStart + 2,
            vertexStart,
            vertexStart + 2,
            vertexStart + 3,
          );
        }
      }
    }
  }

  return { positions, normals, uvs, indices };
}
