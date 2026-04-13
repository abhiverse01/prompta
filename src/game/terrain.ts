import * as THREE from 'three';
import { noise } from './noise';
import { terrainVertexShader, terrainFragmentShader } from './shaders';

export const TERRAIN_SIZE = 2000;
export const TERRAIN_SEGMENTS = 200;
export const MAX_HEIGHT = 80;
export const WATER_LEVEL = 5;

export function sampleHeight(x: number, z: number): number {
  return (noise.fbm(x * 0.0008, z * 0.0008, 6) + 0.5) * MAX_HEIGHT;
}

export class Terrain {
  public mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    const geo = new THREE.PlaneGeometry(
      TERRAIN_SIZE,
      TERRAIN_SIZE,
      TERRAIN_SEGMENTS,
      TERRAIN_SEGMENTS
    );
    geo.rotateX(-Math.PI / 2);

    // Displace vertices on the CPU so we also know heights for collision
    const pos = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] = sampleHeight(pos[i], pos[i + 2]);
    }
    geo.computeVertexNormals();

    this.material = new THREE.ShaderMaterial({
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader,
      uniforms: {
        uSunDir:   { value: new THREE.Vector3(0, 1, 0) },
        uFogNear:  { value: 200 },
        uFogFar:   { value: 900 },
        uFogColor: { value: new THREE.Color(0.6, 0.82, 1.0) },
      },
      side: THREE.FrontSide,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.receiveShadow = true;
  }

  update(sunDir: THREE.Vector3, fogColor: THREE.Color): void {
    this.material.uniforms.uSunDir.value.copy(sunDir);
    this.material.uniforms.uFogColor.value.copy(fogColor);
  }
}
