import { describe, it, expect } from 'vitest';
import { Inventory } from './Inventory';

describe('Inventory', () => {
  it('初期状態ですべての素材が0', () => {
    const inv = new Inventory();
    expect(inv.get('wood')).toBe(0);
    expect(inv.get('stone')).toBe(0);
    expect(inv.get('iron')).toBe(0);
    expect(inv.get('diamond')).toBe(0);
  });

  it('add()で素材を加算できる', () => {
    const inv = new Inventory();
    inv.add('wood', 3);
    expect(inv.get('wood')).toBe(3);
    inv.add('wood', 2);
    expect(inv.get('wood')).toBe(5);
  });

  it('getAll()で全素材の所持数を取得できる', () => {
    const inv = new Inventory();
    inv.add('wood', 3);
    inv.add('iron', 1);
    expect(inv.getAll()).toEqual({
      wood: 3,
      stone: 0,
      iron: 1,
      diamond: 0,
    });
  });
});
