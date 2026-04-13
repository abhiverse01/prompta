import * as THREE from 'three';
import { sampleHeight, WATER_LEVEL } from './terrain';

const MOVE_SPEED = 18;
const SPRINT_MULT = 1.8;
const JUMP_VEL = 18;
const GRAVITY = -42;
const PLAYER_HEIGHT = 2.2;
const RADIUS = 0.5;

export class Player {
  public group: THREE.Group;
  public position = new THREE.Vector3(0, 30, 0);
  public velocityY = 0;
  public isGrounded = false;
  public rotation = 0; // Y-axis rotation (radians)
  public animation = 'idle';

  private bodyMesh: THREE.Mesh;
  private headMesh: THREE.Mesh;

  /* movement flags */
  private forward = false;
  private backward = false;
  private left = false;
  private right = false;
  private sprint = false;
  private jumping = false;

  constructor(color: string, accent: string) {
    this.group = new THREE.Group();

    // Body – capsule-like cylinder
    const bodyGeo = new THREE.CylinderGeometry(
      RADIUS * 0.7, RADIUS * 0.9, PLAYER_HEIGHT * 0.6, 12
    );
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.y = PLAYER_HEIGHT * 0.3;
    this.bodyMesh.castShadow = true;
    this.group.add(this.bodyMesh);

    // Accent belt
    const beltGeo = new THREE.TorusGeometry(RADIUS * 0.8, 0.08, 8, 20);
    const beltMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, metalness: 0.6 });
    const belt = new THREE.Mesh(beltGeo, beltMat);
    belt.position.y = PLAYER_HEIGHT * 0.15;
    belt.rotation.x = Math.PI / 2;
    this.group.add(belt);

    // Head
    const headGeo = new THREE.SphereGeometry(RADIUS * 0.55, 12, 12);
    const headMat = new THREE.MeshStandardMaterial({
      color: '#f5d0a9',
      roughness: 0.8,
    });
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.y = PLAYER_HEIGHT * 0.75;
    this.headMesh.castShadow = true;
    this.group.add(this.headMesh);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#222' });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, PLAYER_HEIGHT * 0.78, RADIUS * 0.5);
    this.group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.12, PLAYER_HEIGHT * 0.78, RADIUS * 0.5);
    this.group.add(rightEye);

    // Spawn on terrain
    this.position.y = sampleHeight(0, 0) + 1;
    if (this.position.y < WATER_LEVEL + 2) this.position.y = WATER_LEVEL + 2;
    this.group.position.copy(this.position);
  }

  /* ── Input bindings ────────────────────────────────────────── */
  bindInput(canvas: HTMLCanvasElement): () => void {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': this.forward  = true; break;
        case 'KeyS': this.backward = true; break;
        case 'KeyA': this.left     = true; break;
        case 'KeyD': this.right    = true; break;
        case 'ShiftLeft': case 'ShiftRight': this.sprint = true; break;
        case 'Space':
          if (this.isGrounded) { this.velocityY = JUMP_VEL; this.isGrounded = false; }
          break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': this.forward  = false; break;
        case 'KeyS': this.backward = false; break;
        case 'KeyA': this.left     = false; break;
        case 'KeyD': this.right    = false; break;
        case 'ShiftLeft': case 'ShiftRight': this.sprint = false; break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }

  /* ── Per-frame update ──────────────────────────────────────── */
  update(dt: number, cameraYaw: number): void {
    // Rotation follows camera yaw
    this.rotation = cameraYaw;

    // Movement direction relative to camera
    const dir = new THREE.Vector3();
    if (this.forward)  dir.z -= 1;
    if (this.backward) dir.z += 1;
    if (this.left)     dir.x -= 1;
    if (this.right)    dir.x += 1;
    if (dir.lengthSq() > 0) {
      dir.normalize();
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
      const speed = MOVE_SPEED * (this.sprint ? SPRINT_MULT : 1);
      this.position.x += dir.x * speed * dt;
      this.position.z += dir.z * speed * dt;
    }

    // Gravity
    this.velocityY += GRAVITY * dt;
    this.position.y += this.velocityY * dt;

    // Terrain collision
    const groundY = sampleHeight(this.position.x, this.position.z);
    if (this.position.y <= groundY + 0.1) {
      this.position.y = groundY + 0.1;
      this.velocityY = 0;
      this.isGrounded = true;
    }

    // Water floor
    if (this.position.y < WATER_LEVEL + 0.5) {
      this.position.y = WATER_LEVEL + 0.5;
      this.velocityY = 0;
      this.isGrounded = true;
    }

    // World bounds
    const BOUND = 980;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -BOUND, BOUND);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -BOUND, BOUND);

    // Animation state
    this.animation = dir.lengthSq() > 0
      ? (this.sprint ? 'sprint' : 'run')
      : 'idle';

    // Simple walk bob
    if (this.animation !== 'idle') {
      const bobSpeed = this.animation === 'sprint' ? 12 : 8;
      this.bodyMesh.position.y = PLAYER_HEIGHT * 0.3 + Math.sin(performance.now() * 0.01 * bobSpeed) * 0.12;
    } else {
      this.bodyMesh.position.y = PLAYER_HEIGHT * 0.3;
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotation;
  }
}
