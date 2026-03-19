import { describe, it, expect } from 'vitest';
import { Player, PLAYER_WIDTH, PLAYER_HEIGHT, JUMP_VELOCITY } from './Player';
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

  describe('gravity', () => {
    it('falls when no block below', () => {
      const world = new World();
      // プレイヤーを空中に配置（足元にブロックなし）
      const player = new Player(5, 10, 5, world);
      player.updatePhysics(1 / 60);
      expect(player.y).toBeLessThan(10);
    });

    it('lands on a block and sets onGround', () => {
      const world = new World();
      // y=5 にブロックを敷く（ブロック上面 = y=6）
      for (let x = 4; x <= 6; x++) {
        for (let z = 4; z <= 6; z++) {
          world.setBlock(x, 5, z, BlockType.STONE);
        }
      }
      // プレイヤーを y=7 に配置（ブロック上面 y=6 の1ブロック上）
      const player = new Player(5, 7, 5, world);
      // 複数フレーム落下させる
      for (let i = 0; i < 120; i++) {
        player.updatePhysics(1 / 60);
      }
      expect(player.onGround).toBe(true);
      expect(player.velocityY).toBe(0);
      // ブロック上面(y=6)付近に着地しているはず
      expect(player.y).toBeGreaterThanOrEqual(6);
      expect(player.y).toBeLessThan(6.1);
    });

    it('does not fall when standing on ground', () => {
      const world = new World();
      // y=5 にブロックを敷く（ブロック上面 = y=6）
      for (let x = 4; x <= 6; x++) {
        for (let z = 4; z <= 6; z++) {
          world.setBlock(x, 5, z, BlockType.STONE);
        }
      }
      // まず着地させる
      const player = new Player(5, 7, 5, world);
      for (let i = 0; i < 120; i++) {
        player.updatePhysics(1 / 60);
      }
      const yAfterLanding = player.y;
      // さらに数フレーム実行してもY座標が変わらない
      for (let i = 0; i < 60; i++) {
        player.updatePhysics(1 / 60);
      }
      expect(player.y).toBeCloseTo(yAfterLanding, 5);
    });
  });

  describe('jump', () => {
    it('can jump when on ground', () => {
      const world = new World();
      for (let x = 4; x <= 6; x++) {
        for (let z = 4; z <= 6; z++) {
          world.setBlock(x, 5, z, BlockType.STONE);
        }
      }
      const player = new Player(5, 7, 5, world);
      // 着地させる
      for (let i = 0; i < 120; i++) {
        player.updatePhysics(1 / 60);
      }
      expect(player.onGround).toBe(true);
      player.jump();
      expect(player.velocityY).toBe(JUMP_VELOCITY);
    });

    it('cannot jump when in air', () => {
      const world = new World();
      const player = new Player(5, 10, 5, world);
      expect(player.onGround).toBe(false);
      player.jump();
      expect(player.velocityY).toBe(0);
    });

    it('reaches approximately 1.27 blocks height', () => {
      const world = new World();
      for (let x = 4; x <= 6; x++) {
        for (let z = 4; z <= 6; z++) {
          world.setBlock(x, 5, z, BlockType.STONE);
        }
      }
      const player = new Player(5, 7, 5, world);
      // 着地させる
      for (let i = 0; i < 120; i++) {
        player.updatePhysics(1 / 60);
      }
      const groundY = player.y;
      player.jump();
      // 60fpsでジャンプをシミュレーション
      let maxY = player.y;
      for (let i = 0; i < 120; i++) {
        player.updatePhysics(1 / 60);
        if (player.y > maxY) maxY = player.y;
      }
      const jumpHeight = maxY - groundY;
      // 理論値 v²/(2g) = 9²/(2*32) ≈ 1.27
      // 離散シミュレーションのため許容範囲 1.1～1.3
      expect(jumpHeight).toBeGreaterThan(1.1);
      expect(jumpHeight).toBeLessThan(1.3);
    });
  });

  describe('ceiling collision', () => {
    it('stops upward velocity when hitting ceiling', () => {
      const world = new World();
      // 地面 y=5（上面 y=6）
      for (let x = 4; x <= 6; x++) {
        for (let z = 4; z <= 6; z++) {
          world.setBlock(x, 5, z, BlockType.STONE);
        }
      }
      // 天井 y=8（下面 y=8）。着地後 y≈6.0、ジャンプ最高到達 y≈7.27。
      // 頭の位置 y + 1.8 ≈ 9.07 なので天井下面 y=8 に衝突する。
      for (let x = 4; x <= 6; x++) {
        for (let z = 4; z <= 6; z++) {
          world.setBlock(x, 8, z, BlockType.STONE);
        }
      }
      // プレイヤーを地面のすぐ上にスポーン（天井とは重ならない位置）
      const player = new Player(5, 6.1, 5, world);
      // 着地させる
      for (let i = 0; i < 120; i++) {
        player.updatePhysics(1 / 60);
      }
      expect(player.onGround).toBe(true);
      player.jump();
      // 数フレーム進めて天井に当たるはず
      for (let i = 0; i < 30; i++) {
        player.updatePhysics(1 / 60);
      }
      // velocityYは0以下（天井衝突でリセットされ、その後重力で負に）
      expect(player.velocityY).toBeLessThanOrEqual(0);
      // 天井(y=8)の下面を超えていない: プレイヤーy + PLAYER_HEIGHT <= 8
      expect(player.y + PLAYER_HEIGHT).toBeLessThanOrEqual(8);
    });
  });
});
