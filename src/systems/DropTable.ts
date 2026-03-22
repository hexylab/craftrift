import { MaterialType } from './types';
import { DROP } from '../config/GameBalance';

interface Probabilities {
  wood: number;
  stone: number;
  iron: number;
  diamond: number;
}

const TABLE = DROP.PROBABILITY_TABLE;

export class DropTable {
  getProbabilities(elapsedSeconds: number): Probabilities {
    if (elapsedSeconds <= TABLE[0].time) {
      return { wood: TABLE[0].wood, stone: TABLE[0].stone, iron: TABLE[0].iron, diamond: TABLE[0].diamond };
    }

    const last = TABLE[TABLE.length - 1];
    if (elapsedSeconds >= last.time) {
      return { wood: last.wood, stone: last.stone, iron: last.iron, diamond: last.diamond };
    }

    // 線形補間: 隣接する2つのテーブルエントリ間を補間
    for (let i = 0; i < TABLE.length - 1; i++) {
      const a = TABLE[i];
      const b = TABLE[i + 1];
      if (elapsedSeconds >= a.time && elapsedSeconds <= b.time) {
        const t = (elapsedSeconds - a.time) / (b.time - a.time);
        return {
          wood: a.wood + (b.wood - a.wood) * t,
          stone: a.stone + (b.stone - a.stone) * t,
          iron: a.iron + (b.iron - a.iron) * t,
          diamond: a.diamond + (b.diamond - a.diamond) * t,
        };
      }
    }

    return { wood: last.wood, stone: last.stone, iron: last.iron, diamond: last.diamond };
  }

  rollMaterial(elapsedSeconds: number): MaterialType {
    const p = this.getProbabilities(elapsedSeconds);
    const r = Math.random();
    if (r < p.wood) return 'wood';
    if (r < p.wood + p.stone) return 'stone';
    if (r < p.wood + p.stone + p.iron) return 'iron';
    return 'diamond';
  }
}
