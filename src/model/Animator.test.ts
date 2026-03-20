import { describe, it, expect } from 'vitest';
import { WalkAnimator, WALK_AMPLITUDE, AttackAnimator } from './Animator';

describe('WalkAnimator', () => {
  it('does not move limbs when not walking', () => {
    const animator = new WalkAnimator();
    const result = animator.update(0.1, false, 0);
    expect(Math.abs(result.rightArm)).toBeLessThan(0.01);
    expect(Math.abs(result.leftArm)).toBeLessThan(0.01);
    expect(Math.abs(result.rightLeg)).toBeLessThan(0.01);
    expect(Math.abs(result.leftLeg)).toBeLessThan(0.01);
  });

  it('swings limbs when walking', () => {
    const animator = new WalkAnimator();
    animator.update(0.5, true, 3.5);
    const result = animator.update(0.1, true, 3.5);
    const maxAngle = WALK_AMPLITUDE;
    expect(Math.abs(result.rightArm)).toBeLessThanOrEqual(maxAngle + 0.01);
    expect(Math.abs(result.rightLeg)).toBeLessThanOrEqual(maxAngle + 0.01);
  });

  it('right arm and right leg swing in opposite directions', () => {
    const animator = new WalkAnimator();
    animator.update(0.25, true, 3.5);
    const result = animator.update(0.01, true, 3.5);
    if (Math.abs(result.rightArm) > 0.01) {
      expect(Math.sign(result.rightArm)).toBe(-Math.sign(result.rightLeg));
    }
  });
});

describe('AttackAnimator', () => {
  it('returns 0 when not playing', () => {
    const animator = new AttackAnimator();
    expect(animator.update(0.1)).toBe(0);
    expect(animator.isPlaying).toBe(false);
  });

  it('returns negative angle during attack', () => {
    const animator = new AttackAnimator();
    animator.play();
    expect(animator.isPlaying).toBe(true);
    const angle = animator.update(0.15);
    expect(angle).toBeLessThan(0);
  });

  it('completes attack after duration', () => {
    const animator = new AttackAnimator();
    animator.play();
    animator.update(0.3);
    const angle = animator.update(0.01);
    expect(angle).toBe(0);
    expect(animator.isPlaying).toBe(false);
  });
});
