// @vitest-environment jsdom
// src/ui/HUD.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HUD } from './HUD';
import { Structure } from '../entity/Structure';
import { BlockType } from '../world/Block';

function setupDOM(): void {
  const targetInfo = document.createElement('div');
  targetInfo.id = 'target-info';
  targetInfo.style.display = 'none';

  const targetName = document.createElement('div');
  targetName.id = 'target-name';
  targetInfo.appendChild(targetName);

  const hpBarContainer = document.createElement('div');
  hpBarContainer.id = 'hp-bar-container';
  const hpBarFill = document.createElement('div');
  hpBarFill.id = 'hp-bar-fill';
  hpBarContainer.appendChild(hpBarFill);
  targetInfo.appendChild(hpBarContainer);

  const hpText = document.createElement('div');
  hpText.id = 'hp-text';
  targetInfo.appendChild(hpText);

  const feedback = document.createElement('div');
  feedback.id = 'combat-feedback';
  feedback.style.display = 'none';

  const victory = document.createElement('div');
  victory.id = 'victory-screen';
  victory.style.display = 'none';

  const playerHpBarFill = document.createElement('div');
  playerHpBarFill.id = 'player-hp-bar-fill';
  playerHpBarFill.style.width = '100%';

  const playerHpText = document.createElement('div');
  playerHpText.id = 'player-hp-text';

  const deathOverlay = document.createElement('div');
  deathOverlay.id = 'death-overlay';
  deathOverlay.style.display = 'none';

  const respawnTimer = document.createElement('div');
  respawnTimer.id = 'respawn-timer';
  deathOverlay.appendChild(respawnTimer);

  const towerWarning = document.createElement('div');
  towerWarning.id = 'tower-warning';
  towerWarning.style.display = 'none';

  const damageFlash = document.createElement('div');
  damageFlash.id = 'damage-flash';
  damageFlash.style.display = 'none';

  document.body.append(
    targetInfo,
    feedback,
    victory,
    playerHpBarFill,
    playerHpText,
    deathOverlay,
    towerWarning,
    damageFlash,
  );
}

function createStructure(hp: number, maxHp: number): Structure {
  const s = new Structure(
    'red-t2',
    'red',
    8,
    4,
    168,
    'tower',
    maxHp,
    3,
    6,
    3,
    BlockType.RED_TOWER,
    null,
  );
  if (hp < maxHp) s.takeDamage(maxHp - hp);
  return s;
}

describe('HUD', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    setupDOM();
  });

  it('showTarget displays target info', () => {
    const hud = new HUD();
    const s = createStructure(1500, 1500);
    hud.showTarget(s);
    expect(document.getElementById('target-info')!.style.display).toBe('block');
    expect(document.getElementById('target-name')!.textContent).toContain('Tower');
    expect(document.getElementById('hp-text')!.textContent).toContain('1500');
  });

  it('HP bar width reflects HP percentage', () => {
    const hud = new HUD();
    const s = createStructure(750, 1500);
    hud.showTarget(s);
    expect(document.getElementById('hp-bar-fill')!.style.width).toBe('50%');
  });

  it('HP bar color changes based on HP ratio', () => {
    const hud = new HUD();

    const high = createStructure(1000, 1500);
    hud.showTarget(high);
    const greenColor = document.getElementById('hp-bar-fill')!.style.backgroundColor;

    const mid = createStructure(500, 1500);
    hud.showTarget(mid);
    const yellowColor = document.getElementById('hp-bar-fill')!.style.backgroundColor;

    const low = createStructure(200, 1500);
    hud.showTarget(low);
    const redColor = document.getElementById('hp-bar-fill')!.style.backgroundColor;

    expect(greenColor).not.toBe(yellowColor);
    expect(yellowColor).not.toBe(redColor);
    expect(greenColor).not.toBe(redColor);
  });

  it('hideTarget hides target info', () => {
    const hud = new HUD();
    const s = createStructure(1500, 1500);
    hud.showTarget(s);
    hud.hideTarget();
    expect(document.getElementById('target-info')!.style.display).toBe('none');
  });

  it('showVictory displays victory screen', () => {
    const hud = new HUD();
    hud.showVictory();
    expect(document.getElementById('victory-screen')!.style.display).toBe('flex');
  });

  it('showProtected displays feedback message', () => {
    vi.useFakeTimers();
    const hud = new HUD();
    hud.showProtected();
    expect(document.getElementById('combat-feedback')!.style.display).toBe('block');
    expect(document.getElementById('combat-feedback')!.textContent).toContain('保護');
    vi.advanceTimersByTime(1500);
    expect(document.getElementById('combat-feedback')!.style.display).toBe('none');
    vi.useRealTimers();
  });

  describe('player HP', () => {
    it('updatePlayerHp sets bar width', () => {
      const hud = new HUD();
      hud.updatePlayerHp(50, 100, false);
      expect(document.getElementById('player-hp-bar-fill')!.style.width).toBe('50%');
    });

    it('updatePlayerHp shows white color when invincible', () => {
      const hud = new HUD();
      hud.updatePlayerHp(100, 100, true);
      const bg = document.getElementById('player-hp-bar-fill')!.style.backgroundColor;
      expect(bg === '#ffffff' || bg === 'rgb(255, 255, 255)').toBe(true);
    });

    it('updatePlayerHp updates text', () => {
      const hud = new HUD();
      hud.updatePlayerHp(75, 100, false);
      expect(document.getElementById('player-hp-text')!.textContent).toBe('75 / 100');
    });

    it('updatePlayerHp color changes by HP ratio', () => {
      const hud = new HUD();
      const fill = document.getElementById('player-hp-bar-fill')!;

      hud.updatePlayerHp(80, 100, false);
      const greenColor = fill.style.backgroundColor;

      hud.updatePlayerHp(40, 100, false);
      const yellowColor = fill.style.backgroundColor;

      hud.updatePlayerHp(10, 100, false);
      const redColor = fill.style.backgroundColor;

      expect(greenColor).not.toBe(yellowColor);
      expect(yellowColor).not.toBe(redColor);
      expect(greenColor).not.toBe(redColor);
    });
  });

  describe('death screen', () => {
    it('showDeathScreen displays overlay', () => {
      const hud = new HUD();
      hud.showDeathScreen(4.2);
      expect(document.getElementById('death-overlay')!.style.display).toBe('flex');
    });

    it('showDeathScreen shows ceiling of remaining time', () => {
      const hud = new HUD();
      hud.showDeathScreen(3.1);
      expect(document.getElementById('respawn-timer')!.textContent).toContain('4');
    });

    it('hideDeathScreen hides overlay', () => {
      const hud = new HUD();
      hud.showDeathScreen(5);
      hud.hideDeathScreen();
      expect(document.getElementById('death-overlay')!.style.display).toBe('none');
    });
  });

  describe('tower warning', () => {
    it('showTowerWarning displays warning', () => {
      const hud = new HUD();
      hud.showTowerWarning();
      expect(document.getElementById('tower-warning')!.style.display).toBe('block');
    });

    it('hideTowerWarning hides warning', () => {
      const hud = new HUD();
      hud.showTowerWarning();
      hud.hideTowerWarning();
      expect(document.getElementById('tower-warning')!.style.display).toBe('none');
    });
  });

  describe('damage flash', () => {
    it('triggerDamageFlash shows flash', () => {
      const hud = new HUD();
      hud.triggerDamageFlash();
      const el = document.getElementById('damage-flash')!;
      expect(el.style.display).toBe('block');
      expect(el.style.opacity).toBe('0.3');
    });

    it('updateDamageFlash fades out over time', () => {
      const hud = new HUD();
      hud.triggerDamageFlash();
      hud.updateDamageFlash(0.075);
      const el = document.getElementById('damage-flash')!;
      const opacity = parseFloat(el.style.opacity);
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(0.3);
    });

    it('updateDamageFlash hides after duration', () => {
      const hud = new HUD();
      hud.triggerDamageFlash();
      hud.updateDamageFlash(0.2);
      const el = document.getElementById('damage-flash')!;
      expect(el.style.display).toBe('none');
    });
  });
});
