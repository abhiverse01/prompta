import * as THREE from 'three';
import { skyVertexShader, skyFragmentShader } from './shaders';

/** Full day-night cycle duration in seconds */
const CYCLE_DURATION = 300; // 5 minutes

export class Atmosphere {
  public skyMesh: THREE.Mesh;
  public sunDirection = new THREE.Vector3();
  public fogColor = new THREE.Color(0.6, 0.82, 1.0);
  public ambientIntensity = 0.4;
  public sunIntensity = 1.2;
  private material: THREE.ShaderMaterial;
  private elapsed = 0;

  constructor() {
    const geo = new THREE.SphereGeometry(950, 32, 32);
    this.material = new THREE.ShaderMaterial({
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      uniforms: {
        uSunDir:     { value: new THREE.Vector3() },
        uDayProgress:{ value: 0.5 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.skyMesh = new THREE.Mesh(geo, this.material);
  }

  update(dt: number): void {
    this.elapsed += dt;
    // dayProgress: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
    const t = (this.elapsed % CYCLE_DURATION) / CYCLE_DURATION;

    // Sun orbit: rises at 0.25, peaks at 0.5, sets at 0.75
    const angle = (t - 0.25) * Math.PI * 2;
    this.sunDirection.set(
      Math.cos(angle),
      Math.sin(angle),
      0.3
    ).normalize();

    // Fog color follows sky horizon colour
    this.fogColor.setRGB(
      0.3 + 0.5 * Math.max(0, this.sunDirection.y),
      0.4 + 0.4 * Math.max(0, this.sunDirection.y),
      0.55 + 0.45 * Math.max(0, this.sunDirection.y)
    );

    // Lighting intensity based on sun elevation
    const sunY = Math.max(0, this.sunDirection.y);
    this.sunIntensity = 0.2 + sunY * 1.3;
    this.ambientIntensity = 0.15 + sunY * 0.45;

    // Update sky shader
    this.material.uniforms.uSunDir.value.copy(this.sunDirection);
    this.material.uniforms.uDayProgress.value = t;
  }
}
