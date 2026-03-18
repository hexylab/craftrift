import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer();
if (!renderer.capabilities.isWebGL2) {
  const errorDiv = document.getElementById('error');
  if (errorDiv) {
    errorDiv.style.display = 'flex';
  }
  throw new Error('WebGL2 not supported');
}

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 6, 0);

renderer.render(scene, camera);
console.log('CraftRift initialized');
