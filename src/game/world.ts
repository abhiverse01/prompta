import * as THREE from 'three';
import { noise, Noise } from './noise';
import { sampleHeight, WATER_LEVEL } from './terrain';

interface WorldObject {
  mesh: THREE.InstancedMesh;
  count: number;
}

export class World {
  private objects: WorldObject[] = [];

  constructor(scene: THREE.Scene) {
    const rng = new Noise(123);
    const treeCount = 600;
    const rockCount = 300;

    this.spawnTrees(scene, treeCount, rng);
    this.spawnRocks(scene, rockCount, rng);
    this.spawnBuildings(scene, rng);
  }

  private spawnTrees(scene: THREE.Scene, count: number, rng: Noise): void {
    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 3, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5d3a1a', roughness: 0.9 });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    trunkMesh.castShadow = true;

    // Foliage
    const leafGeo = new THREE.ConeGeometry(1.8, 4, 8);
    const leafMat = new THREE.MeshStandardMaterial({ color: '#1a7a1a', roughness: 0.85 });
    const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, count);
    leafMesh.castShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0;
    const half = 900;

    while (placed < count) {
      const x = (rng.noise2D(placed * 0.73, placed * 0.37) * 0.5 + 0.5) * half * 2 - half;
      const z = (rng.noise2D(placed * 0.41, placed * 0.89) * 0.5 + 0.5) * half * 2 - half;
      const h = sampleHeight(x, z);

      // Only place on grass (height between 8 and 30)
      if (h > 8 && h < 30 && h > WATER_LEVEL + 1) {
        const scale = 0.7 + rng.noise2D(x * 0.1, z * 0.1) * 0.3 + 0.3;

        // Trunk
        dummy.position.set(x, h + 1.5 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(0, rng.noise2D(x, z) * Math.PI, 0);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(placed, dummy.matrix);

        // Leaves
        dummy.position.set(x, h + 4.5 * scale, z);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(placed, dummy.matrix);

        placed++;
      }
    }

    trunkMesh.instanceMatrix.needsUpdate = true;
    leafMesh.instanceMatrix.needsUpdate = true;
    scene.add(trunkMesh);
    scene.add(leafMesh);
    this.objects.push({ mesh: trunkMesh, count }, { mesh: leafMesh, count });
  }

  private spawnRocks(scene: THREE.Scene, count: number, rng: Noise): void {
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: '#7a7a72',
      roughness: 0.95,
      flatShading: true,
    });
    const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, count);
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0;
    const half = 900;

    while (placed < count) {
      const x = (rng.noise2D(placed * 0.53 + 100, placed * 0.17) * 0.5 + 0.5) * half * 2 - half;
      const z = (rng.noise2D(placed * 0.71 + 200, placed * 0.43) * 0.5 + 0.5) * half * 2 - half;
      const h = sampleHeight(x, z);

      // Rocks on higher ground
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

    rockMesh.instanceMatrix.needsUpdate = true;
    scene.add(rockMesh);
    this.objects.push({ mesh: rockMesh, count });
  }

  private spawnBuildings(scene: THREE.Scene, rng: Noise): void {
    const buildingCount = 8;
    const buildingMat = new THREE.MeshStandardMaterial({
      color: '#c4a882',
      roughness: 0.85,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: '#8b3a3a',
      roughness: 0.7,
    });

    for (let i = 0; i < buildingCount; i++) {
      const angle = (i / buildingCount) * Math.PI * 2;
      const dist = 60 + i * 40;
      const bx = Math.cos(angle) * dist;
      const bz = Math.sin(angle) * dist;
      const h = sampleHeight(bx, bz);

      if (h > 6 && h < 25) {
        const group = new THREE.Group();

        // Walls
        const w = 5 + rng.noise2D(i * 10, 0) * 3 + 2;
        const bh = 4 + rng.noise2D(0, i * 10) * 2 + 1;
        const d = 4 + rng.noise2D(i * 5, i * 5) * 2 + 1;
        const wallGeo = new THREE.BoxGeometry(w, bh, d);
        const wall = new THREE.Mesh(wallGeo, buildingMat);
        wall.position.y = bh / 2;
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);

        // Roof (pyramid)
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
