import { World } from '../world/World';

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.6;
const MOVE_SPEED = 4.3;
const HALF_WIDTH = PLAYER_WIDTH / 2;

export class Player {
  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number, private world: World) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  move(dx: number, dz: number, dt: number): void {
    const dist = MOVE_SPEED * dt;

    if (dz !== 0) {
      this.z = this.moveAxis('z', dz * dist);
    }

    if (dx !== 0) {
      this.x = this.moveAxis('x', dx * dist);
    }
  }

  private moveAxis(axis: 'x' | 'z', delta: number): number {
    const STEP = PLAYER_WIDTH / 2;
    let remaining = Math.abs(delta);
    const sign = delta > 0 ? 1 : -1;
    let pos = axis === 'x' ? this.x : this.z;

    while (remaining > 0) {
      const step = Math.min(remaining, STEP);
      const next = pos + sign * step;
      const testX = axis === 'x' ? next : this.x;
      const testZ = axis === 'z' ? next : this.z;
      if (this.collides(testX, this.y, testZ)) {
        break;
      }
      pos = next;
      remaining -= step;
    }

    return pos;
  }

  private collides(px: number, py: number, pz: number): boolean {
    const minX = Math.floor(px - HALF_WIDTH);
    const maxX = Math.floor(px + HALF_WIDTH);
    const minY = Math.floor(py);
    const maxY = Math.floor(py + PLAYER_HEIGHT);
    const minZ = Math.floor(pz - HALF_WIDTH);
    const maxZ = Math.floor(pz + HALF_WIDTH);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (this.world.isSolidBlock(bx, by, bz)) {
            if (
              px + HALF_WIDTH > bx &&
              px - HALF_WIDTH < bx + 1 &&
              py + PLAYER_HEIGHT > by &&
              py < by + 1 &&
              pz + HALF_WIDTH > bz &&
              pz - HALF_WIDTH < bz + 1
            ) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  get eyeX(): number { return this.x; }
  get eyeY(): number { return this.y + PLAYER_EYE_HEIGHT; }
  get eyeZ(): number { return this.z; }
}
