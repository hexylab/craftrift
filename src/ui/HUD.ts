// src/ui/HUD.ts
import { Structure } from '../entity/Structure';
import { AttackResult } from '../entity/CombatSystem';

export const DAMAGE_FLASH_DURATION = 0.15;

export class HUD {
  private targetInfoEl: HTMLElement | null;
  private targetNameEl: HTMLElement | null;
  private hpBarFillEl: HTMLElement | null;
  private hpTextEl: HTMLElement | null;
  private feedbackEl: HTMLElement | null;
  private victoryEl: HTMLElement | null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private playerHpBarFillEl: HTMLElement | null;
  private playerHpTextEl: HTMLElement | null;
  private deathOverlayEl: HTMLElement | null;
  private respawnTimerEl: HTMLElement | null;
  private towerWarningEl: HTMLElement | null;
  private damageFlashEl: HTMLElement | null;
  private damageFlashTimer: number = 0;

  constructor() {
    this.targetInfoEl = document.getElementById('target-info');
    this.targetNameEl = document.getElementById('target-name');
    this.hpBarFillEl = document.getElementById('hp-bar-fill');
    this.hpTextEl = document.getElementById('hp-text');
    this.feedbackEl = document.getElementById('combat-feedback');
    this.victoryEl = document.getElementById('victory-screen');
    this.playerHpBarFillEl = document.getElementById('player-hp-bar-fill');
    this.playerHpTextEl = document.getElementById('player-hp-text');
    this.deathOverlayEl = document.getElementById('death-overlay');
    this.respawnTimerEl = document.getElementById('respawn-timer');
    this.towerWarningEl = document.getElementById('tower-warning');
    this.damageFlashEl = document.getElementById('damage-flash');
  }

  showTarget(structure: Structure): void {
    if (!this.targetInfoEl) return;
    this.targetInfoEl.style.display = 'block';

    const name = structure.structureType === 'tower' ? 'Tower' : 'Nexus';
    const teamLabel = structure.team === 'red' ? 'Red' : 'Blue';
    if (this.targetNameEl) {
      this.targetNameEl.textContent = `${name} (${teamLabel})`;
    }

    const ratio = structure.hp / structure.maxHp;
    if (this.hpBarFillEl) {
      this.hpBarFillEl.style.width = `${Math.round(ratio * 100)}%`;
      if (ratio > 0.5) {
        this.hpBarFillEl.style.backgroundColor = '#44bb44';
      } else if (ratio > 0.25) {
        this.hpBarFillEl.style.backgroundColor = '#ddbb22';
      } else {
        this.hpBarFillEl.style.backgroundColor = '#dd3333';
      }
    }

    if (this.hpTextEl) {
      this.hpTextEl.textContent = `${structure.hp} / ${structure.maxHp}`;
    }
  }

  hideTarget(): void {
    if (this.targetInfoEl) {
      this.targetInfoEl.style.display = 'none';
    }
  }

  showDamage(_result: AttackResult): void {
    // HP update is reflected via showTarget; future expansion
  }

  showProtected(): void {
    if (!this.feedbackEl) return;
    this.feedbackEl.textContent = 'このタワーは保護されています';
    this.feedbackEl.style.display = 'block';
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => {
      if (this.feedbackEl) this.feedbackEl.style.display = 'none';
    }, 1500);
  }

  showVictory(): void {
    if (this.victoryEl) {
      this.victoryEl.style.display = 'flex';
    }
  }

  updatePlayerHp(hp: number, maxHp: number, isInvincible: boolean): void {
    const ratio = hp / maxHp;
    if (this.playerHpBarFillEl) {
      this.playerHpBarFillEl.style.width = `${Math.round(ratio * 100)}%`;
      if (isInvincible) {
        this.playerHpBarFillEl.style.backgroundColor = '#ffffff';
      } else if (ratio > 0.5) {
        this.playerHpBarFillEl.style.backgroundColor = '#44bb44';
      } else if (ratio > 0.25) {
        this.playerHpBarFillEl.style.backgroundColor = '#ddbb22';
      } else {
        this.playerHpBarFillEl.style.backgroundColor = '#dd3333';
      }
    }
    if (this.playerHpTextEl) {
      this.playerHpTextEl.textContent = `${hp} / ${maxHp}`;
    }
  }

  showDeathScreen(remainingTime: number): void {
    if (this.deathOverlayEl) {
      this.deathOverlayEl.style.display = 'flex';
    }
    if (this.respawnTimerEl) {
      this.respawnTimerEl.textContent = `リスポーンまで: ${Math.ceil(remainingTime)}秒`;
    }
  }

  hideDeathScreen(): void {
    if (this.deathOverlayEl) {
      this.deathOverlayEl.style.display = 'none';
    }
  }

  showTowerWarning(): void {
    if (this.towerWarningEl) {
      this.towerWarningEl.style.display = 'block';
    }
  }

  hideTowerWarning(): void {
    if (this.towerWarningEl) {
      this.towerWarningEl.style.display = 'none';
    }
  }

  triggerDamageFlash(): void {
    if (this.damageFlashEl) {
      this.damageFlashEl.style.display = 'block';
      this.damageFlashEl.style.opacity = '0.3';
    }
    this.damageFlashTimer = DAMAGE_FLASH_DURATION;
  }

  updateDamageFlash(dt: number): void {
    if (this.damageFlashTimer <= 0) return;
    this.damageFlashTimer -= dt;
    if (this.damageFlashTimer <= 0) {
      this.damageFlashTimer = 0;
      if (this.damageFlashEl) {
        this.damageFlashEl.style.display = 'none';
      }
      return;
    }
    if (this.damageFlashEl) {
      const opacity = (this.damageFlashTimer / DAMAGE_FLASH_DURATION) * 0.3;
      this.damageFlashEl.style.opacity = String(opacity);
    }
  }
}
