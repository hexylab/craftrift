import * as THREE from 'three';
import { ModelDefinition, PartDefinition } from './ModelDefinitions';
import { computeFaceUVs } from './SkinParser';

/**
 * BoxGeometryの各面にMinecraftスキンのUVを適用する。
 * Three.js BoxGeometryの面順序: +x(right), -x(left), +y(top), -y(bottom), +z(front), -z(back)
 */
function applyFaceUVs(geometry: THREE.BoxGeometry, part: PartDefinition, texW: number, texH: number): void {
  const uvs = computeFaceUVs(
    part.skinRegion.originX, part.skinRegion.originY,
    part.skinRegion.w, part.skinRegion.h, part.skinRegion.d,
    texW, texH,
  );

  const uvAttr = geometry.getAttribute('uv') as THREE.BufferAttribute;
  const arr = uvAttr.array as Float32Array;

  const faceOrder = [uvs.right, uvs.left, uvs.top, uvs.bottom, uvs.front, uvs.back];

  for (let face = 0; face < 6; face++) {
    const faceUV = faceOrder[face];
    const base = face * 8;
    arr[base + 0] = faceUV.u;              arr[base + 1] = 1 - faceUV.v;
    arr[base + 2] = faceUV.u + faceUV.w;   arr[base + 3] = 1 - faceUV.v;
    arr[base + 4] = faceUV.u;              arr[base + 5] = 1 - (faceUV.v + faceUV.h);
    arr[base + 6] = faceUV.u + faceUV.w;   arr[base + 7] = 1 - (faceUV.v + faceUV.h);
  }
  uvAttr.needsUpdate = true;
}

/**
 * ModelDefinitionからTHREE.Groupを構築する。
 * 各パーツはピボットグループ内にメッシュを持ち、ピボット中心の回転を可能にする。
 */
export function buildModel(def: ModelDefinition, texture: THREE.Texture): THREE.Group {
  const root = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({
    map: texture,
    side: THREE.DoubleSide, // Minecraft風モデルでは回転した腕/脚の内側面も見えるため両面レンダリング
  });

  for (const part of def.parts) {
    const [w, h, d] = part.size;
    const scale = def.pixelScale;

    const geometry = new THREE.BoxGeometry(w * scale, h * scale, d * scale);
    applyFaceUVs(geometry, part, def.textureWidth, def.textureHeight);

    const mesh = new THREE.Mesh(geometry, material);

    const pivotGroup = new THREE.Group();
    pivotGroup.name = part.name;
    pivotGroup.position.set(
      part.pivot[0] * scale,
      part.pivot[1] * scale,
      part.pivot[2] * scale,
    );
    // anchor='bottom': パーツがピボットから上に伸びる(頭/体) → +h/2
    // anchor='top'(デフォルト): パーツがピボットから下に垂れる(腕/脚) → -h/2
    const anchor = part.anchor ?? 'top';
    const meshOffsetY = anchor === 'bottom' ? h * scale / 2 : -h * scale / 2;
    mesh.position.set(0, meshOffsetY, 0);

    pivotGroup.add(mesh);
    root.add(pivotGroup);
  }

  return root;
}
