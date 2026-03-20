// @vitest-environment jsdom
// src/engine/InputManager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { InputManager } from './InputManager';

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

function fireKeydown(code: string, repeat = false): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { code, repeat }));
}

function fireKeyup(code: string): void {
  document.dispatchEvent(new KeyboardEvent('keyup', { code }));
}

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    document.body.replaceChildren();
    input = new InputManager(createCanvas());
  });

  describe('consumeKeyPress', () => {
    it('returns true once after keydown', () => {
      fireKeydown('KeyK');
      expect(input.consumeKeyPress('KeyK')).toBe(true);
    });

    it('returns false after consumed', () => {
      fireKeydown('KeyK');
      input.consumeKeyPress('KeyK');
      expect(input.consumeKeyPress('KeyK')).toBe(false);
    });

    it('returns false when key not pressed', () => {
      expect(input.consumeKeyPress('KeyK')).toBe(false);
    });

    it('ignores key repeat events', () => {
      fireKeydown('KeyK');
      input.consumeKeyPress('KeyK');
      fireKeydown('KeyK', true); // repeat
      expect(input.consumeKeyPress('KeyK')).toBe(false);
    });

    it('works again after keyup + keydown', () => {
      fireKeydown('KeyK');
      input.consumeKeyPress('KeyK');
      fireKeyup('KeyK');
      fireKeydown('KeyK');
      expect(input.consumeKeyPress('KeyK')).toBe(true);
    });
  });
});
