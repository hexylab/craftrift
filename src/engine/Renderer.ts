// src/engine/Renderer.ts
import * as THREE from 'three';
import { FPSCamera } from '../player/Camera';

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly fpsCamera: FPSCamera;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(1, 2, 1);
    this.scene.add(directional);

    this.fpsCamera = new FPSCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.fpsCamera.resize(window.innerWidth / window.innerHeight);
    });
  }

  render(): void {
    this.renderer.render(this.scene, this.fpsCamera.camera);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }
}
