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

  document.body.append(targetInfo, feedback, victory);
}

function createStructure(hp: number, maxHp: number): Structure {
  const s = new Structure('red-t2', 'red', 8, 4, 168, 'tower', maxHp, 3, 6, 3, BlockType.RED_TOWER, null);
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
});
