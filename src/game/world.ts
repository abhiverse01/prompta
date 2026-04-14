import * as THREE from 'three';
import { Noise } from './noise';
import { sampleHeight, WATER_LEVEL } from './terrain';

export class World {
  constructor(scene: THREE.Scene) {
    const rng = new Noise(123);
    this.spawnTrees(scene, 600, rng);
    this.spawnRocks(scene, 300, rng);
    this.spawnBuildings(scene, rng);
  }

  private spawnTrees(scene: THREE.Scene, maxCount: number, rng: Noise): void {
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 3, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5d3a1a', roughness: 0.9 });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, maxCount);
    trunkMesh.castShadow = true;

    const leafGeo = new THREE.ConeGeometry(1.8, 4, 8);
    const leafMat = new THREE.MeshStandardMaterial({ color: '#1a7a1a', roughness: 0.85 });
    const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, maxCount);
    leafMesh.castShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0;
    const half = 900;
    // Use a separate attempt counter that ALWAYS increments to prevent infinite loops.
    // The old code used `placed` as the counter, causing an infinite loop when a
    // noise position didn't match terrain criteria (placed never incremented).
    let attempt = 0;
    const maxAttempts = maxCount * 20;

    while (placed < maxCount && attempt < maxAttempts) {
      attempt++;
      const x = (rng.noise2D(attempt * 0.73, attempt * 0.37) * 0.5 + 0.5) * half * 2 - half;
      const z = (rng.noise2D(attempt * 0.41, attempt * 0.89) * 0.5 + 0.5) * half * 2 - half;
      const h = sampleHeight(x, z);

      if (h > 8 && h < 30 && h > WATER_LEVEL + 1) {
        const scale = 0.7 + rng.noise2D(x * 0.1, z * 0.1) * 0.3 + 0.3;

        dummy.position.set(x, h + 1.5 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(0, rng.noise2D(x, z) * Math.PI, 0);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(placed, dummy.matrix);

        dummy.position.set(x, h + 4.5 * scale, z);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(placed, dummy.matrix);

        placed++;
      }
    }

    trunkMesh.count = placed;
    leafMesh.count = placed;
    trunkMesh.instanceMatrix.needsUpdate = true;
    leafMesh.instanceMatrix.needsUpdate = true;
    scene.add(trunkMesh);
    scene.add(leafMesh);
  }

  private spawnRocks(scene: THREE.Scene, maxCount: number, rng: Noise): void {
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: '#7a7a72',
      roughness: 0.95,
      flatShading: true,
    });
    const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, maxCount);
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0;
    const half = 900;
    let attempt = 0;
    const maxAttempts = maxCount * 20;

    while (placed < maxCount && attempt < maxAttempts) {
      attempt++;
      const x = (rng.noise2D(attempt * 0.53 + 100, attempt * 0.17) * 0.5 + 0.5) * half * 2 - half;
      const z = (rng.noise2D(attempt * 0.71 + 200, attempt * 0.43) * 0.5 + 0.5) * half * 2 - half;
      const h = sampleHeight(x, z);

      if (h > 15) {
        const scale = 0.3 + Math.abs(rng.noise2D(x * 0.05, z * 0.05)) * 1.5;
        dummy.position.set(x, h + scale * 0.3, z);
        dummy.scale.set(scale, scale * 0.7, scale);
        dummy.rotation.set(
          rng.noise2D(x, z) * 0.5,
          rng.noise2D(z, x) * Math.PI,
          0
        );
        dummy.updateMatrix();
        rockMesh.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
    }

    rockMesh.count = placed;
    rockMesh.instanceMatrix.needsUpdate = true;
    scene.add(rockMesh);
  }

  private spawnBuildings(scene: THREE.Scene, rng: Noise): void {
    const buildingMat = new THREE.MeshStandardMaterial({
      color: '#c4a882',
      roughness: 0.85,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: '#8b3a3a',
      roughness: 0.7,
    });

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 60 + i * 40;
      const bx = Math.cos(angle) * dist;
      const bz = Math.sin(angle) * dist;
      const h = sampleHeight(bx, bz);

      if (h > 6 && h < 25) {
        const group = new THREE.Group();

        const w = 5 + rng.noise2D(i * 10, 0) * 3 + 2;
        const bh = 4 + rng.noise2D(0, i * 10) * 2 + 1;
        const d = 4 + rng.noise2D(i * 5, i * 5) * 2 + 1;
        const wallGeo = new THREE.BoxGeometry(w, bh, d);
        const wall = new THREE.Mesh(wallGeo, buildingMat);
        wall.position.y = bh / 2;
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);

        const roofGeo = new THREE.ConeGeometry(Math.max(w, d) * 0.75, 3, 4);
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = bh + 1.5;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);

        // Door
        const doorGeo = new THREE.PlaneGeometry(1.2, 2.2);
        const doorMat = new THREE.MeshStandardMaterial({ color: '#3d2510' });
        const door = new THREE.Mesh(doorGeo, doorMat);
        door.position.set(0, 1.1, d / 2 + 0.01);
        group.add(door);

        group.position.set(bx, h, bz);
        group.rotation.y = rng.noise2D(bx, bz) * Math.PI;
        scene.add(group);
      }
    }
  }
}
