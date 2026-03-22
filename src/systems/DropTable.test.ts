import { describe, it, expect } from 'vitest';
import { DropTable } from './DropTable';

describe('DropTable', () => {
  const table = new DropTable();

  it('0秒で初期確率テーブルを返す', () => {
    const p = table.getProbabilities(0);
    expect(p.wood).toBeCloseTo(0.9);
    expect(p.stone).toBeCloseTo(0.08);
    expect(p.iron).toBeCloseTo(0.02);
    expect(p.diamond).toBeCloseTo(0.0);
  });

  it('1200秒で最終テーブルを返す', () => {
    const p = table.getProbabilities(1200);
    expect(p.wood).toBeCloseTo(0.25);
    expect(p.stone).toBeCloseTo(0.28);
    expect(p.iron).toBeCloseTo(0.3);
    expect(p.diamond).toBeCloseTo(0.17);
  });

  it('150秒で0秒と300秒の中間値（線形補間）を返す', () => {
    const p = table.getProbabilities(150);
    // 中間値: wood = (0.9 + 0.7) / 2 = 0.8
    expect(p.wood).toBeCloseTo(0.8);
    // stone = (0.08 + 0.2) / 2 = 0.14
    expect(p.stone).toBeCloseTo(0.14);
  });

  it('1200秒以降は外挿せず最終値で固定', () => {
    const p = table.getProbabilities(2000);
    expect(p.wood).toBeCloseTo(0.25);
    expect(p.diamond).toBeCloseTo(0.17);
  });

  it('rollMaterial()が有効なMaterialTypeを返す', () => {
    const validTypes = ['wood', 'stone', 'iron', 'diamond'];
    for (let i = 0; i < 20; i++) {
      const result = table.rollMaterial(0);
      expect(validTypes).toContain(result);
    }
  });

  it('確率の合計が約1.0になる', () => {
    for (const time of [0, 150, 300, 600, 900, 1200]) {
      const p = table.getProbabilities(time);
      const sum = p.wood + p.stone + p.iron + p.diamond;
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });
});
