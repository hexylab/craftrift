import { Entity, Team } from './Entity';
import { BlockType } from '../world/Block';
import { World } from '../world/World';

export type StructureType = 'tower' | 'nexus';

export class Structure extends Entity {
  readonly structureType: StructureType;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly blockType: BlockType;
  protectedBy: Structure | null;

  constructor(
    id: string,
    team: Team,
    x: number,
    y: number,
    z: number,
    structureType: StructureType,
    maxHp: number,
    width: number,
    height: number,
    depth: number,
    blockType: BlockType,
    protectedBy: Structure | null,
  ) {
    super(id, team, x, y, z, maxHp);
    this.structureType = structureType;
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.blockType = blockType;
    this.protectedBy = protectedBy;
  }

  isProtected(): boolean {
    return this.protectedBy !== null && this.protectedBy.isAlive;
  }

  takeDamage(amount: number): void {
    if (this.isProtected()) return;
    super.takeDamage(amount);
  }

  placeBlocks(world: World): void {
    for (let dx = 0; dx < this.width; dx++) {
      for (let dy = 0; dy < this.height; dy++) {
        for (let dz = 0; dz < this.depth; dz++) {
          world.setBlock(this.x + dx, this.y + dy, this.z + dz, this.blockType);
        }
      }
    }
  }

  removeBlocks(world: World): void {
    for (let dx = 0; dx < this.width; dx++) {
      for (let dy = 0; dy < this.height; dy++) {
        for (let dz = 0; dz < this.depth; dz++) {
          world.setBlock(this.x + dx, this.y + dy, this.z + dz, BlockType.AIR);
        }
      }
    }
  }
}
