import { Team } from '../entity/Entity';

export type MaterialType = 'wood' | 'stone' | 'iron' | 'diamond';

export type DamageSource = 'player' | 'tower' | 'blue-minion' | 'red-minion';

export interface KillEvent {
  killedMinion: { x: number; z: number; team: Team };
  killedBy: DamageSource;
  waveNumber: number;
}

export interface MaterialDrop {
  type: MaterialType;
  amount: number;
}
