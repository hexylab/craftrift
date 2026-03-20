import * as THREE from 'three';
import { World } from '../world/World';
import { BlockType, isSolid, isDestructible } from '../world/Block';
import { PLAYER_WIDTH, PLAYER_HEIGHT } from './Player';

export interface RaycastHit {
  blockX: number;
  blockY: number;
  blockZ: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  distance: number;
}

export function castRay(
  world: World,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
): RaycastHit | null {
  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);

  const stepX = dx >= 0 ? 1 : -1;
  const stepY = dy >= 0 ? 1 : -1;
  const stepZ = dz >= 0 ? 1 : -1;

  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;

  let tMaxX = dx !== 0 ? (dx > 0 ? x + 1 - ox : ox - x) / Math.abs(dx) : Infinity;
  let tMaxY = dy !== 0 ? (dy > 0 ? y + 1 - oy : oy - y) / Math.abs(dy) : Infinity;
  let tMaxZ = dz !== 0 ? (dz > 0 ? z + 1 - oz : oz - z) / Math.abs(dz) : Infinity;

  let normalX = 0,
    normalY = 0,
    normalZ = 0;
  let t = 0;

  for (let i = 0; i < maxDist * 3; i++) {
    if (isSolid(world.getBlock(x, y, z))) {
      return { blockX: x, blockY: y, blockZ: z, normalX, normalY, normalZ, distance: t };
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        t = tMaxX;
        if (t > maxDist) return null;
        x += stepX;
        tMaxX += tDeltaX;
        normalX = -stepX;
        normalY = 0;
        normalZ = 0;
      } else {
        t = tMaxZ;
        if (t > maxDist) return null;
        z += stepZ;
        tMaxZ += tDeltaZ;
        normalX = 0;
        normalY = 0;
        normalZ = -stepZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        t = tMaxY;
        if (t > maxDist) return null;
        y += stepY;
        tMaxY += tDeltaY;
        normalX = 0;
        normalY = -stepY;
        normalZ = 0;
      } else {
        t = tMaxZ;
        if (t > maxDist) return null;
        z += stepZ;
        tMaxZ += tDeltaZ;
        normalX = 0;
        normalY = 0;
        normalZ = -stepZ;
      }
    }
  }
  return null;
}

export class BlockInteraction {
  private highlightMesh: THREE.LineSegments;

  constructor(
    private world: World,
    scene: THREE.Scene,
  ) {
    const geo = new THREE.BoxGeometry(1.001, 1.001, 1.001);
    const edges = new THREE.EdgesGeometry(geo);
    this.highlightMesh = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }),
    );
    this.highlightMesh.visible = false;
    scene.add(this.highlightMesh);
  }

  update(
    eyeX: number,
    eyeY: number,
    eyeZ: number,
    dirX: number,
    dirY: number,
    dirZ: number,
  ): RaycastHit | null {
    const hit = castRay(this.world, eyeX, eyeY, eyeZ, dirX, dirY, dirZ, 5);
    if (hit && isDestructible(this.world.getBlock(hit.blockX, hit.blockY, hit.blockZ))) {
      this.highlightMesh.visible = true;
      this.highlightMesh.position.set(hit.blockX + 0.5, hit.blockY + 0.5, hit.blockZ + 0.5);
    } else {
      this.highlightMesh.visible = false;
    }
    return hit;
  }

  breakBlock(hit: RaycastHit): boolean {
    const type = this.world.getBlock(hit.blockX, hit.blockY, hit.blockZ);
    if (!isDestructible(type)) return false;
    this.world.setBlock(hit.blockX, hit.blockY, hit.blockZ, BlockType.AIR);
    return true;
  }

  placeBlock(hit: RaycastHit, playerX: number, playerY: number, playerZ: number): boolean {
    const px = hit.blockX + hit.normalX;
    const py = hit.blockY + hit.normalY;
    const pz = hit.blockZ + hit.normalZ;
    if (isSolid(this.world.getBlock(px, py, pz))) return false;
    const HALF_W = PLAYER_WIDTH / 2;
    const P_HEIGHT = PLAYER_HEIGHT;
    if (
      px + 1 > playerX - HALF_W &&
      px < playerX + HALF_W &&
      py + 1 > playerY &&
      py < playerY + P_HEIGHT &&
      pz + 1 > playerZ - HALF_W &&
      pz < playerZ + HALF_W
    ) {
      return false;
    }
    this.world.setBlock(px, py, pz, BlockType.STONE);
    return true;
  }
}
