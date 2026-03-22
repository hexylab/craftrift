import { MaterialType } from './types';

const ALL_MATERIALS: MaterialType[] = ['wood', 'stone', 'iron', 'diamond'];

export class Inventory {
  private materials = new Map<MaterialType, number>(
    ALL_MATERIALS.map((m) => [m, 0]),
  );

  add(type: MaterialType, amount: number): void {
    this.materials.set(type, (this.materials.get(type) ?? 0) + amount);
  }

  get(type: MaterialType): number {
    return this.materials.get(type) ?? 0;
  }

  getAll(): Record<MaterialType, number> {
    return {
      wood: this.get('wood'),
      stone: this.get('stone'),
      iron: this.get('iron'),
      diamond: this.get('diamond'),
    };
  }
}
