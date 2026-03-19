import { describe, it, expect } from 'vitest';
import { Entity } from './Entity';

describe('Entity', () => {
  it('initializes with full HP', () => {
    const e = new Entity('test', 'blue', 0, 0, 0, 100);
    expect(e.hp).toBe(100);
    expect(e.maxHp).toBe(100);
    expect(e.isAlive).toBe(true);
  });

  it('takeDamage reduces HP', () => {
    const e = new Entity('test', 'red', 0, 0, 0, 100);
    e.takeDamage(30);
    expect(e.hp).toBe(70);
    expect(e.isAlive).toBe(true);
  });

  it('dies when HP reaches 0', () => {
    const e = new Entity('test', 'red', 0, 0, 0, 100);
    e.takeDamage(100);
    expect(e.hp).toBe(0);
    expect(e.isAlive).toBe(false);
  });

  it('HP does not go below 0', () => {
    const e = new Entity('test', 'red', 0, 0, 0, 50);
    e.takeDamage(999);
    expect(e.hp).toBe(0);
    expect(e.isAlive).toBe(false);
  });

  it('ignores damage when already dead', () => {
    const e = new Entity('test', 'red', 0, 0, 0, 100);
    e.takeDamage(100);
    e.takeDamage(50);
    expect(e.hp).toBe(0);
  });

  it('ignores zero or negative damage', () => {
    const e = new Entity('test', 'red', 0, 0, 0, 100);
    e.takeDamage(0);
    expect(e.hp).toBe(100);
    e.takeDamage(-10);
    expect(e.hp).toBe(100);
  });
});
