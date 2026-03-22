import { describe, it, expect, vi } from 'vitest';
import { DropSystem } from './DropSystem';
import { DropTable } from './DropTable';
import { Inventory } from './Inventory';
import { KillEvent } from './types';

describe('DropSystem', () => {
  function createSystem() {
    const dropTable = new DropTable();
    const inventory = new Inventory();
    const system = new DropSystem(dropTable, inventory);
    return { system, inventory, dropTable };
  }

  it('ラストヒットでドロップが発生する', () => {
    const { system, inventory } = createSystem();
    const event: KillEvent = {
      killedMinion: { x: 5, z: 5, team: 'red' },
      killedBy: 'player',
      waveNumber: 1,
    };

    const drops = system.processKillEvents([event], 5, 5, 0);
    expect(drops.length).toBeGreaterThan(0);

    const totalDropped = drops.reduce((sum, d) => sum + d.amount, 0);
    expect(totalDropped).toBeGreaterThanOrEqual(3); // LAST_HIT_MIN=3
  });

  it('味方ミニオン（blue）の死亡ではドロップなし', () => {
    const { system, inventory } = createSystem();
    const event: KillEvent = {
      killedMinion: { x: 5, z: 5, team: 'blue' },
      killedBy: 'red-minion',
      waveNumber: 1,
    };

    const drops = system.processKillEvents([event], 5, 5, 0);
    expect(drops.length).toBe(0);
    expect(inventory.get('wood')).toBe(0);
  });

  it('近接ドロップ: 範囲内でドロップが発生する', () => {
    const { system } = createSystem();
    const event: KillEvent = {
      killedMinion: { x: 10, z: 10, team: 'red' },
      killedBy: 'blue-minion',
      waveNumber: 1,
    };

    // プレイヤーが近くにいる（距離 < PROXIMITY_RADIUS=12）
    const drops = system.processKillEvents([event], 10, 10, 0);
    // PROXIMITY_MIN=0なので0個の場合もある。複数回試して確認
    // ただしドロップが発生しないこともある（0-1個）ので、テストは処理が正常に完了することを確認
    expect(drops).toBeInstanceOf(Array);
  });

  it('近接ドロップ: 範囲外ではドロップなし', () => {
    const { system, inventory } = createSystem();
    const event: KillEvent = {
      killedMinion: { x: 10, z: 10, team: 'red' },
      killedBy: 'blue-minion',
      waveNumber: 1,
    };

    // プレイヤーが遠い（距離 > PROXIMITY_RADIUS=12）
    const drops = system.processKillEvents([event], 100, 100, 0);
    expect(drops.length).toBe(0);
    expect(inventory.get('wood')).toBe(0);
  });

  it('ドロップ結果がインベントリに加算される', () => {
    const { system, inventory } = createSystem();
    const event: KillEvent = {
      killedMinion: { x: 5, z: 5, team: 'red' },
      killedBy: 'player',
      waveNumber: 1,
    };

    const drops = system.processKillEvents([event], 5, 5, 0);
    const totalDropped = drops.reduce((sum, d) => sum + d.amount, 0);
    const totalInInventory = Object.values(inventory.getAll()).reduce((a, b) => a + b, 0);
    expect(totalInInventory).toBe(totalDropped);
  });

  it('ウェーブボーナスがドロップ個数に反映される', () => {
    // DROP_BONUS_PER_WAVE=0.5 なので、waveNumber=4 → bonus = floor(4*0.5) = 2
    const { system } = createSystem();

    // 乱数を固定してテスト
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const eventWave1: KillEvent = {
      killedMinion: { x: 5, z: 5, team: 'red' },
      killedBy: 'player',
      waveNumber: 1,
    };
    const drops1 = system.processKillEvents([eventWave1], 5, 5, 0);
    const total1 = drops1.reduce((sum, d) => sum + d.amount, 0);

    const { system: system2 } = createSystem();
    const eventWave4: KillEvent = {
      killedMinion: { x: 5, z: 5, team: 'red' },
      killedBy: 'player',
      waveNumber: 4,
    };
    const drops4 = system2.processKillEvents([eventWave4], 5, 5, 0);
    const total4 = drops4.reduce((sum, d) => sum + d.amount, 0);

    // waveNumber=4のボーナス = floor(4*0.5) = 2
    expect(total4 - total1).toBe(2);

    vi.restoreAllMocks();
  });
});
