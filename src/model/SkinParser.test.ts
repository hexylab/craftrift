import { describe, it, expect } from 'vitest';
import { computeFaceUVs } from './SkinParser';

describe('computeFaceUVs', () => {
  const TEX_W = 64;
  const TEX_H = 64;

  it('computes head face UVs (8x8x8 at origin 0,0)', () => {
    const uvs = computeFaceUVs(0, 0, 8, 8, 8, TEX_W, TEX_H);
    expect(uvs.top).toEqual({ u: 8/64, v: 0/64, w: 8/64, h: 8/64 });
    expect(uvs.front).toEqual({ u: 8/64, v: 8/64, w: 8/64, h: 8/64 });
    expect(uvs.right).toEqual({ u: 16/64, v: 8/64, w: 8/64, h: 8/64 });
    expect(uvs.left).toEqual({ u: 0/64, v: 8/64, w: 8/64, h: 8/64 });
    expect(uvs.back).toEqual({ u: 24/64, v: 8/64, w: 8/64, h: 8/64 });
    expect(uvs.bottom).toEqual({ u: 16/64, v: 0/64, w: 8/64, h: 8/64 });
  });

  it('computes body face UVs (8x12x4 at origin 16,16)', () => {
    const uvs = computeFaceUVs(16, 16, 8, 12, 4, TEX_W, TEX_H);
    expect(uvs.top).toEqual({ u: 20/64, v: 16/64, w: 8/64, h: 4/64 });
    expect(uvs.front).toEqual({ u: 20/64, v: 20/64, w: 8/64, h: 12/64 });
  });

  it('computes right arm face UVs (4x12x4 at origin 40,16)', () => {
    const uvs = computeFaceUVs(40, 16, 4, 12, 4, TEX_W, TEX_H);
    expect(uvs.front).toEqual({ u: 44/64, v: 20/64, w: 4/64, h: 12/64 });
  });
});
