// src/player/PlayerState.test.ts
import { describe, it, expect } from 'vitest';
import { PlayerState, PLAYER_MAX_HP } from './PlayerState';

describe('PlayerState', () => {
  it('initial state: hp=100, isAlive=true, not invincible', () => {
    const ps = new PlayerState();
    expect(ps.hp).toBe(100);
    expect(ps.maxHp).toBe(100);
    expect(ps.isAlive).toBe(true);
    expect(ps.isInvincible()).toBe(false);
    expect(ps.respawnTimer).toBe(0);
  });

  describe('takeDamage', () => {
    it('reduces HP', () => {
      const ps = new PlayerState();
      ps.takeDamage(30);
      expect(ps.hp).toBe(70);
      expect(ps.isAlive).toBe(true);
    });

    it('kills when HP reaches 0', () => {
      const ps = new PlayerState();
      ps.takeDamage(100);
      expect(ps.hp).toBe(0);
      expect(ps.isAlive).toBe(false);
    });

    it('HP does not go below 0 on overkill', () => {
      const ps = new PlayerState();
      ps.takeDamage(150);
      expect(ps.hp).toBe(0);
      expect(ps.isAlive).toBe(false);
    });

    it('ignored when already dead', () => {
      const ps = new PlayerState();
      ps.takeDamage(100);
      ps.takeDamage(50);
      expect(ps.hp).toBe(0);
    });

    it('ignored when invincible', () => {
      const ps = new PlayerState();
      ps.respawn(); // sets invincible
      ps.takeDamage(50);
      expect(ps.hp).toBe(PLAYER_MAX_HP);
    });

    it('ignored when amount <= 0', () => {
      const ps = new PlayerState();
      ps.takeDamage(0);
      ps.takeDamage(-10);
      expect(ps.hp).toBe(100);
    });
  });

  describe('death and respawn', () => {
    it('sets respawnTimer on death', () => {
      const ps = new PlayerState();
      ps.takeDamage(100);
      expect(ps.respawnTimer).toBe(5.0);
    });

    it('update counts down respawnTimer while dead', () => {
      const ps = new PlayerState();
      ps.takeDamage(100);
      const respawned = ps.update(2.0);
      expect(ps.respawnTimer).toBe(3.0);
      expect(respawned).toBe(false);
    });

    it('update triggers respawn when timer expires', () => {
      const ps = new PlayerState();
      ps.takeDamage(100);
      ps.update(3.0);
      const respawned = ps.update(2.5);
      expect(respawned).toBe(true);
      expect(ps.isAlive).toBe(true);
      expect(ps.hp).toBe(100);
    });

    it('respawn sets invincible timer', () => {
      const ps = new PlayerState();
      ps.takeDamage(100);
      ps.update(5.5);
      expect(ps.isInvincible()).toBe(true);
      expect(ps.invincibleTimer).toBe(3.0);
    });

    it('invincible timer counts down', () => {
      const ps = new PlayerState();
      ps.respawn();
      ps.update(1.0);
      expect(ps.invincibleTimer).toBe(2.0);
      expect(ps.isInvincible()).toBe(true);
      ps.update(2.5);
      expect(ps.invincibleTimer).toBe(0);
      expect(ps.isInvincible()).toBe(false);
    });

    it('onDeath callback is called on death', () => {
      const ps = new PlayerState();
      let called = false;
      ps.onDeath(() => { called = true; });
      ps.takeDamage(100);
      expect(called).toBe(true);
    });

    it('onDeath callback is not called on non-lethal damage', () => {
      const ps = new PlayerState();
      let called = false;
      ps.onDeath(() => { called = true; });
      ps.takeDamage(50);
      expect(called).toBe(false);
    });
  });
});
