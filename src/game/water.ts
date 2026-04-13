import * as THREE from 'three';
import { waterVertexShader, waterFragmentShader } from './shaders';
import { TERRAIN_SIZE, WATER_LEVEL } from './terrain';

export class Water {
  public mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 1, 1);
    geo.rotateX(-Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: {
        uTime:    { value: 0 },
        uFogNear: { value: 200 },
        uFogFar:  { value: 900 },
        uFogColor:{ value: new THREE.Color(0.6, 0.82, 1.0) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = WATER_LEVEL;
  }

  update(time: number, fogColor: THREE.Color): void {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uFogColor.value.copy(fogColor);
  }
}
