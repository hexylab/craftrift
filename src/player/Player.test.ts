import { describe, it, expect } from 'vitest';
import { Player, PLAYER_WIDTH, PLAYER_HEIGHT } from './Player';
import { World } from '../world/World';
import { BlockType } from '../world/Block';

describe('Player', () => {
  it('initializes at given position', () => {
    const world = new World();
    const player = new Player(5, 10, 5, world);
    expect(player.x).toBe(5);
    expect(player.y).toBe(10);
    expect(player.z).toBe(5);
  });

  it('moves forward when no obstacles', () => {
    const world = new World();
    const player = new Player(5, 10, 5, world);
    player.move(0, -1, 1.0);
    expect(player.z).toBeLessThan(5);
  });

  it('does not move into solid blocks', () => {
    const world = new World();
    for (let y = 9; y <= 12; y++) {
      for (let x = 3; x <= 7; x++) {
        world.setBlock(x, y, 4, BlockType.STONE);
      }
    }
    const player = new Player(5, 10, 5.5, world);
    player.move(0, -1, 10.0);
    expect(player.z).toBeGreaterThanOrEqual(4 + 1 + PLAYER_WIDTH / 2);
  });

  it('Y position stays fixed', () => {
    const world = new World();
    const player = new Player(5, 10, 5, world);
    const initialY = player.y;
    player.move(0, -1, 1.0);
    expect(player.y).toBe(initialY);
  });

  it('slides along wall on diagonal movement', () => {
    const world = new World();
    for (let y = 9; y <= 12; y++) {
      for (let x = 3; x <= 7; x++) {
        world.setBlock(x, y, 4, BlockType.STONE);
      }
    }
    const player = new Player(5, 10, 5.5, world);
    player.move(1, -1, 1.0);
    expect(player.x).toBeGreaterThan(5);
    expect(player.z).toBeGreaterThanOrEqual(4 + 1 + PLAYER_WIDTH / 2);
  });

  it('PLAYER_WIDTH and PLAYER_HEIGHT match spec', () => {
    expect(PLAYER_WIDTH).toBeCloseTo(0.6);
    expect(PLAYER_HEIGHT).toBeCloseTo(1.8);
  });
});
