import { describe, it, expect } from 'vitest';
import { SHEEP_MODEL, PLAYER_MODEL } from './ModelDefinitions';

describe('SHEEP_MODEL Minecraft compliance', () => {
  it('head has wool dimensions (ModelSheep1: 6,6,6 + 0.6 inflation = 7.2)', () => {
    const head = SHEEP_MODEL.parts.find((p) => p.name === 'head')!;
    expect(head.size).toEqual([7.2, 7.2, 7.2]);
    // UV座標はModelSheep2のスキンレイアウト準拠
    expect(head.skinRegion).toMatchObject({ originX: 0, originY: 0, w: 6, h: 6, d: 8 });
  });

  it('body has wool dimensions (ModelSheep1: 8,16,6 + 1.75 inflation = 11.5,19.5,9.5)', () => {
    const body = SHEEP_MODEL.parts.find((p) => p.name === 'body')!;
    expect(body.size).toEqual([11.5, 19.5, 9.5]);
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

  // MC座標変換の検証: pivot = (mcX, 24-mcY, -mcZ)
  it('head pivot converts from MC rotationPoint(0,6,-8)', () => {
    const head = SHEEP_MODEL.parts.find((p) => p.name === 'head')!;
    // threeX=0, threeY=24-6=18, threeZ=-(-8)=8
    expect(head.pivot).toEqual([0, 18, 8]);
  });

  it('body pivot converts from MC rotationPoint(0,5,2) with PI/2 rotation', () => {
    const body = SHEEP_MODEL.parts.find((p) => p.name === 'body')!;
    // threeX=0, threeY=24-5=19, threeZ=-(2)=-2
    expect(body.pivot).toEqual([0, 19, -2]);
    expect(body.initialRotation).toBeDefined();
    expect(body.initialRotation![0]).toBeCloseTo(-Math.PI / 2);
  });

  it('leg pivots convert from MC rotationPoints correctly', () => {
    const rfLeg = SHEEP_MODEL.parts.find((p) => p.name === 'rightFrontLeg')!;
    const lfLeg = SHEEP_MODEL.parts.find((p) => p.name === 'leftFrontLeg')!;
    const rbLeg = SHEEP_MODEL.parts.find((p) => p.name === 'rightBackLeg')!;
    const lbLeg = SHEEP_MODEL.parts.find((p) => p.name === 'leftBackLeg')!;

    // rightFront: MC(-3,12,-5) → (-3, 12, 5)
    expect(rfLeg.pivot).toEqual([-3, 12, 5]);
    // leftFront: MC(3,12,-5) → (3, 12, 5)
    expect(lfLeg.pivot).toEqual([3, 12, 5]);
    // rightBack: MC(-3,12,7) → (-3, 12, -7)
    expect(rbLeg.pivot).toEqual([-3, 12, -7]);
    // leftBack: MC(3,12,7) → (3, 12, -7)
    expect(lbLeg.pivot).toEqual([3, 12, -7]);
  });

  it('head offset converts from MC addBox(-3,-4,-4, 6,6,6, 0.6)', () => {
    const head = SHEEP_MODEL.parts.find((p) => p.name === 'head')!;
    // MC center = (0, -1, -1), Three.js offset = (0, 1, 1)
    expect(head.offset).toEqual([0, 1, 1]);
  });

  it('body offset converts from MC addBox(-4,-10,-7, 8,16,6) with -PI/2 X rotation', () => {
    const body = SHEEP_MODEL.parts.find((p) => p.name === 'body')!;
    // mcBoxCenter=(0,-2,-4), worldOffset=(0,2,4), localInverse(-PI/2 X): (0,-4,2)
    // visual adjustment: +3 back (localY+3), -4 down (localZ-4) from (0,-4,2)
    expect(body.offset).toEqual([0, -1, -2]);
  });

  it('leg offsets convert from MC addBox(-2,0,-2, 4,6,4, 0.5)', () => {
    const leg = SHEEP_MODEL.parts.find((p) => p.name === 'rightFrontLeg')!;
    // MC center = (0, 3, 0), Three.js offset = (0, -3, 0)
    expect(leg.offset).toEqual([0, -3, 0]);
  });

  it('all parts have offset defined', () => {
    for (const part of SHEEP_MODEL.parts) {
      expect(part.offset).toBeDefined();
      expect(part.offset).toHaveLength(3);
    }
  });
});

describe('PLAYER_MODEL offset migration', () => {
  it('head pivot and offset', () => {
    const head = PLAYER_MODEL.parts.find((p) => p.name === 'head')!;
    expect(head.pivot).toEqual([0, 24, 0]);
    expect(head.offset).toEqual([0, 4, 0]);
  });

  it('body pivot and offset', () => {
    const body = PLAYER_MODEL.parts.find((p) => p.name === 'body')!;
    expect(body.pivot).toEqual([0, 12, 0]);
    expect(body.offset).toEqual([0, 6, 0]);
  });

  it('limbs use offset=[0,-6,0] (was anchor=top/default, h=12)', () => {
    for (const name of ['rightArm', 'leftArm', 'rightLeg', 'leftLeg']) {
      const part = PLAYER_MODEL.parts.find((p) => p.name === name)!;
      expect(part.offset).toEqual([0, -6, 0]);
    }
  });

  it('all parts have offset defined', () => {
    for (const part of PLAYER_MODEL.parts) {
      expect(part.offset).toBeDefined();
      expect(part.offset).toHaveLength(3);
    }
  });
});
