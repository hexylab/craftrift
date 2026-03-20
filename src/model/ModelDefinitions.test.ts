import { describe, it, expect } from 'vitest';
import { SHEEP_MODEL, PLAYER_MODEL } from './ModelDefinitions';

describe('SHEEP_MODEL Minecraft compliance', () => {
  it('head has correct dimensions (ModelSheep2.java: 6,6,8)', () => {
    const head = SHEEP_MODEL.parts.find(p => p.name === 'head')!;
    expect(head.size).toEqual([6, 6, 8]);
    expect(head.skinRegion).toMatchObject({ originX: 0, originY: 0, w: 6, h: 6, d: 8 });
  });

  it('body has correct dimensions (ModelSheep2.java: 8,16,6)', () => {
    const body = SHEEP_MODEL.parts.find(p => p.name === 'body')!;
    expect(body.size).toEqual([8, 16, 6]);
    expect(body.skinRegion).toMatchObject({ originX: 28, originY: 8, w: 8, h: 16, d: 6 });
  });

  it('has forwardAngle defined', () => {
    expect(typeof SHEEP_MODEL.forwardAngle).toBe('number');
    expect(typeof PLAYER_MODEL.forwardAngle).toBe('number');
  });

  it('uses 64x32 texture dimensions', () => {
    expect(SHEEP_MODEL.textureWidth).toBe(64);
    expect(SHEEP_MODEL.textureHeight).toBe(32);
  });
});
