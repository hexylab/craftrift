export type ViewModeType = 'first-person' | 'third-person-back' | 'third-person-front';
export const THIRD_PERSON_DISTANCE = 4.0;

const MODE_CYCLE: ViewModeType[] = ['first-person', 'third-person-back', 'third-person-front'];

export class ViewMode {
  private modeIndex = 0;

  get current(): ViewModeType { return MODE_CYCLE[this.modeIndex]; }
  get isFirstPerson(): boolean { return this.current === 'first-person'; }

  toggle(): void { this.modeIndex = (this.modeIndex + 1) % MODE_CYCLE.length; }

  getCameraOffset(forwardX: number, forwardY: number, forwardZ: number): { x: number; y: number; z: number } {
    if (this.current === 'first-person') return { x: 0, y: 0, z: 0 };
    const sign = this.current === 'third-person-back' ? -1 : 1;
    return {
      x: forwardX * sign * THIRD_PERSON_DISTANCE,
      y: 1.0,
      z: forwardZ * sign * THIRD_PERSON_DISTANCE,
    };
  }
}
