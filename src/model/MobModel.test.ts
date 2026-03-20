import { describe, it, expect } from 'vitest';
import { buildModel } from './MobModel';
import { PLAYER_MODEL, SHEEP_MODEL } from './ModelDefinitions';
import * as THREE from 'three';

describe('buildModel', () => {
  // テスト用の最小限のテクスチャを生成
  function createTestTexture(): THREE.Texture {
    const texture = new THREE.Texture();
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }

  it('creates Group with 6 parts for player model', () => {
    const group = buildModel(PLAYER_MODEL, createTestTexture());
    expect(group.children.length).toBe(6);
  });

  it('creates Group with 6 parts for sheep model', () => {
    const group = buildModel(SHEEP_MODEL, createTestTexture());
    expect(group.children.length).toBe(6);
  });

  it('names parts correctly for player model', () => {
    const group = buildModel(PLAYER_MODEL, createTestTexture());
    const names = group.children.map(c => c.name);
    expect(names).toContain('head');
    expect(names).toContain('body');
    expect(names).toContain('rightArm');
    expect(names).toContain('leftArm');
    expect(names).toContain('rightLeg');
    expect(names).toContain('leftLeg');
  });

  it('sets pivot positions with correct scale', () => {
    const group = buildModel(PLAYER_MODEL, createTestTexture());
    const head = group.children.find(c => c.name === 'head')!;
    const scale = PLAYER_MODEL.pixelScale;
    expect(head.position.x).toBeCloseTo(0 * scale);
    expect(head.position.y).toBeCloseTo(24 * scale);
    expect(head.position.z).toBeCloseTo(0 * scale);
  });

  it('sets mesh offset from pivot using offset property', () => {
    const group = buildModel(PLAYER_MODEL, createTestTexture());
    const scale = PLAYER_MODEL.pixelScale;

    // head: offset=[0, 4, 0] → mesh.position.y = 4 * scale
    const headPivot = group.children.find(c => c.name === 'head')! as THREE.Group;
    const headMesh = headPivot.children[0] as THREE.Mesh;
    expect(headMesh.position.y).toBeCloseTo(4 * scale);

    // rightArm: offset=[0, -6, 0] → mesh.position.y = -6 * scale
    const armPivot = group.children.find(c => c.name === 'rightArm')! as THREE.Group;
    const armMesh = armPivot.children[0] as THREE.Mesh;
    expect(armMesh.position.y).toBeCloseTo(-6 * scale);
  });

  it('applies initialRotation to sheep body pivot group', () => {
    const group = buildModel(SHEEP_MODEL, createTestTexture());
    const body = group.children.find(c => c.name === 'body')! as THREE.Group;
    expect(body.rotation.x).toBeCloseTo(-Math.PI / 2);
    expect(body.rotation.y).toBeCloseTo(0);
    expect(body.rotation.z).toBeCloseTo(0);
  });

  it('does not apply rotation to parts without initialRotation', () => {
    const group = buildModel(SHEEP_MODEL, createTestTexture());
    const head = group.children.find(c => c.name === 'head')! as THREE.Group;
    expect(head.rotation.x).toBeCloseTo(0);
    expect(head.rotation.y).toBeCloseTo(0);
    expect(head.rotation.z).toBeCloseTo(0);
  });
});
