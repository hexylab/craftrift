// src/main.ts
import { Game } from './engine/Game';

const game = new Game();
game.init().catch((err) => {
  console.error('Failed to initialize CraftRift:', err);
});
