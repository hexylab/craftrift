// src/player/Camera.ts
import * as THREE from 'three';

const SENSITIVITY = 0.002; // rad/pixel
const PITCH_LIMIT = Math.PI / 2 - 0.01; // ~89 degrees

export class FPSCamera {
  readonly camera: THREE.PerspectiveCamera;
  private yaw = 0;
  private pitch = 0;

  constructor(fov: number, aspect: number, near: number, far: number) {
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  }

  rotate(deltaX: number, deltaY: number): void {
    this.yaw -= deltaX * SENSITIVITY;
    this.pitch -= deltaY * SENSITIVITY;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  setPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
  }

  getForward(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    dir.y = 0;
    dir.normalize();
    return dir;
  }

  getRight(): THREE.Vector3 {
    const dir = new THREE.Vector3(1, 0, 0);
    dir.applyQuaternion(this.camera.quaternion);
    dir.y = 0;
    dir.normalize();
    return dir;
  }

  getDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
