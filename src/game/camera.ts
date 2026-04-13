import * as THREE from 'three';
import { Player } from './player';

const MIN_DIST = 4;
const MAX_DIST = 22;
const PITCH_MIN = -1.2;
const PITCH_MAX = 1.2;
const SENSITIVITY = 0.003;
const ZOOM_SPEED = 2;
const LERP_SPEED = 10;

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  public yaw = 0;
  public pitch = 0.3;
  public distance = 10;

  private targetPos = new THREE.Vector3();
  private currentPos = new THREE.Vector3();

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.5,
      2000
    );
    this.camera.position.set(0, 15, -15);
  }

  bindPointer(canvas: HTMLCanvasElement): () => void {
    const onClick = () => canvas.requestPointerLock();
    canvas.addEventListener('click', onClick);

    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      this.yaw   -= e.movementX * SENSITIVITY;
      this.pitch -= e.movementY * SENSITIVITY;
      this.pitch  = THREE.MathUtils.clamp(this.pitch, PITCH_MIN, PITCH_MAX);
    };
    document.addEventListener('mousemove', onMove);

    const onWheel = (e: WheelEvent) => {
      this.distance += e.deltaY * 0.01 * ZOOM_SPEED;
      this.distance  = THREE.MathUtils.clamp(this.distance, MIN_DIST, MAX_DIST);
    };
    canvas.addEventListener('wheel', onWheel, { passive: true });

    const onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
    };
  }

  update(dt: number, player: Player): void {
    // Calculate desired camera position
    const offset = new THREE.Vector3(0, 0, -this.distance);
    offset.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    this.targetPos.copy(player.position).add(offset);
    this.targetPos.y = Math.max(this.targetPos.y, player.position.y + 1.5);

    // Smooth follow
    const t = 1 - Math.exp(-LERP_SPEED * dt);
    this.currentPos.lerp(this.targetPos, t);
    this.camera.position.copy(this.currentPos);

    // Look at player head
    const lookTarget = new THREE.Vector3().copy(player.position);
    lookTarget.y += 1.5;
    this.camera.lookAt(lookTarget);
  }
}
