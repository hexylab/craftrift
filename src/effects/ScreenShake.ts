import { SCREEN_SHAKE_INTENSITY, SCREEN_SHAKE_DURATION } from '../config/GameBalance';

export { SCREEN_SHAKE_INTENSITY, SCREEN_SHAKE_DURATION };

export class ScreenShake {
  private timer: number = 0;
  private _intensity: number = 0;

  trigger(intensity?: number): void {
    this.timer = SCREEN_SHAKE_DURATION;
    this._intensity = intensity ?? SCREEN_SHAKE_INTENSITY;
  }

  update(dt: number): { offsetX: number; offsetY: number } {
    if (this.timer <= 0) {
      return { offsetX: 0, offsetY: 0 };
    }
    this.timer = Math.max(0, this.timer - dt);
    if (this.timer === 0) {
      return { offsetX: 0, offsetY: 0 };
    }
    const decay = this.timer / SCREEN_SHAKE_DURATION;
    const offsetX = (Math.random() * 2 - 1) * this._intensity * decay;
    const offsetY = (Math.random() * 2 - 1) * this._intensity * decay;
    return { offsetX, offsetY };
  }
}
