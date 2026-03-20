// src/engine/InputManager.ts
export class InputManager {
  private keys = new Set<string>();
  private mouseMovementX = 0;
  private mouseMovementY = 0;
  private mouseLeftClick = false;
  private mouseRightClick = false;
  private pressedKeys = new Set<string>();
  private _isPointerLocked = false;

  constructor(private canvas: HTMLCanvasElement) {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'F5') e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat) {
        this.pressedKeys.add(e.code);
      }
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    document.addEventListener('mousemove', (e) => {
      if (this._isPointerLocked) {
        this.mouseMovementX += e.movementX;
        this.mouseMovementY += e.movementY;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this._isPointerLocked) {
        canvas.requestPointerLock();
        return;
      }
      if (e.button === 0) this.mouseLeftClick = true;
      if (e.button === 2) this.mouseRightClick = true;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this._isPointerLocked = document.pointerLockElement === canvas;
    });
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  getMouseMovement(): { x: number; y: number } {
    const m = { x: this.mouseMovementX, y: this.mouseMovementY };
    this.mouseMovementX = 0;
    this.mouseMovementY = 0;
    return m;
  }

  consumeLeftClick(): boolean {
    const v = this.mouseLeftClick;
    this.mouseLeftClick = false;
    return v;
  }

  consumeRightClick(): boolean {
    const v = this.mouseRightClick;
    this.mouseRightClick = false;
    return v;
  }

  consumeKeyPress(code: string): boolean {
    if (this.pressedKeys.has(code)) {
      this.pressedKeys.delete(code);
      return true;
    }
    return false;
  }

  get isPointerLocked(): boolean {
    return this._isPointerLocked;
  }
}
