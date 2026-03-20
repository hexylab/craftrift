import * as THREE from 'three';

export const FLASH_DURATION = 0.3; // seconds

export interface DamageFlashState {
  timer: number;
  active: boolean;
}

export function createDamageFlash(): DamageFlashState {
  return { timer: 0, active: false };
}

export function triggerFlash(state: DamageFlashState): void {
  state.timer = FLASH_DURATION;
  state.active = true;
}

export function updateFlash(state: DamageFlashState, dt: number): void {
  if (!state.active) return;
  state.timer -= dt;
  if (state.timer <= 0) {
    state.timer = 0;
    state.active = false;
  }
}

export function applyFlashToMesh(mesh: THREE.Group, state: DamageFlashState): void {
  const color = state.active ? 0xff0000 : 0x000000;
  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const material = child.material;
      if (material instanceof THREE.MeshLambertMaterial) {
        material.emissive.setHex(color);
      }
    }
  });
}
