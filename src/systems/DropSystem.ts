import { KillEvent, MaterialDrop, MaterialType } from './types';
import { DropTable } from './DropTable';
import { Inventory } from './Inventory';
import { DROP, MINION_SCALING } from '../config/GameBalance';

export class DropSystem {
  constructor(
    private dropTable: DropTable,
    private inventory: Inventory,
  ) {}

  processKillEvents(
    events: KillEvent[],
    playerX: number,
    playerZ: number,
    elapsedSeconds: number,
  ): MaterialDrop[] {
    const allDrops: MaterialDrop[] = [];

    for (const event of events) {
      // 味方ミニオン（blue）の死亡はドロップ対象外
      if (event.killedMinion.team === 'blue') continue;

      let baseAmount: number;

      if (event.killedBy === 'player') {
        // ラストヒット: プレイヤーがとどめ
        baseAmount =
          DROP.LAST_HIT_MIN +
          Math.floor(Math.random() * (DROP.LAST_HIT_MAX - DROP.LAST_HIT_MIN + 1));
      } else {
        // 近接ドロップ: プレイヤーが範囲内にいるか判定
        const dx = playerX - event.killedMinion.x;
        const dz = playerZ - event.killedMinion.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > DROP.PROXIMITY_RADIUS) continue;

        baseAmount =
          DROP.PROXIMITY_MIN +
          Math.floor(Math.random() * (DROP.PROXIMITY_MAX - DROP.PROXIMITY_MIN + 1));
      }

      // ウェーブボーナス
      const bonusAmount = Math.floor(event.waveNumber * MINION_SCALING.DROP_BONUS_PER_WAVE);
      const totalAmount = baseAmount + bonusAmount;

      if (totalAmount <= 0) continue;

      // 素材タイプを個別に抽選し、同種をまとめる
      const counts = new Map<MaterialType, number>();
      for (let i = 0; i < totalAmount; i++) {
        const mat = this.dropTable.rollMaterial(elapsedSeconds);
        counts.set(mat, (counts.get(mat) ?? 0) + 1);
      }

      for (const [type, amount] of counts) {
        this.inventory.add(type, amount);
        allDrops.push({ type, amount });
      }
    }

    return allDrops;
  }
}
