import * as THREE from 'three';
import { Terrain } from './terrain';
import { Water } from './water';
import { Atmosphere } from './atmosphere';
import { Player } from './player';
import { CameraController } from './camera';
import { World } from './world';
import { MultiplayerManager, RemotePlayer } from './multiplayer';
import { HUD } from './hud';

export interface CharacterData {
  id: number;
  name: string;
  color: string;
  accent: string;
}

export class GameEngine {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private clock = new THREE.Clock();

  private terrain!: Terrain;
  private water!: Water;
  private atmosphere!: Atmosphere;
  private player!: Player;
  private camera!: CameraController;
  private world!: World;
  private mp!: MultiplayerManager;
  private hud!: HUD;

  private dirLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;

  private remoteMeshes = new Map<string, THREE.Group>();
  /** Target positions for smooth remote player interpolation */
  private remoteTargets = new Map<string, { x: number; y: number; z: number; rot: number }>();
  private disposeFns: (() => void)[] = [];
  private positionTimer = 0;
  private alive = true;
  private joined = false;

  constructor(
    canvas: HTMLCanvasElement,
    character: CharacterData,
    playerName: string,
    hudContainer: HTMLElement
  ) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x60a5fa, 200, 900);

    // Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
    this.dirLight.position.set(100, 150, 50);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 400;
    this.dirLight.shadow.camera.left = -80;
    this.dirLight.shadow.camera.right = 80;
    this.dirLight.shadow.camera.top = 80;
    this.dirLight.shadow.camera.bottom = -80;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target); // target must be in scene for updateMatrixWorld

    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.3);
    this.scene.add(this.hemiLight);

    // World systems
    this.terrain = new Terrain();
    this.scene.add(this.terrain.mesh);

    this.water = new Water();
    this.scene.add(this.water.mesh);

    this.atmosphere = new Atmosphere();
    this.scene.add(this.atmosphere.skyMesh);

    this.player = new Player(character.color, character.accent);
    this.scene.add(this.player.group);

    this.camera = new CameraController();
    // Initialize camera to match player spawn position (prevents camera underground)
    this.camera.initPosition(this.player.position);
    this.disposeFns.push(this.camera.bindPointer(canvas));

    this.disposeFns.push(this.player.bindInput(canvas));

    this.world = new World(this.scene);

    // HUD
    this.hud = new HUD(hudContainer);

    // Multiplayer
    this.mp = new MultiplayerManager();
    this.mp.connect();
    this.setupMultiplayerHandlers();
    this.disposeFns.push(() => this.mp.disconnect());

    // Join after connection
    setTimeout(() => {
      if (!this.alive) return;
      this.mp.join(
        playerName,
        character.id,
        character.color,
        this.player.position.x,
        this.player.position.y,
        this.player.position.z
      );
      this.joined = true;
    }, 500);

    // Chat binding — links chat visibility to player.inputBlocked
    this.disposeFns.push(this.hud.bindChat(this.mp, this.player));

    // Resize
    const onResize = () => this.renderer.setSize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);
    this.disposeFns.push(() => window.removeEventListener('resize', onResize));

    this.loop();
  }

  private setupMultiplayerHandlers(): void {
    this.mp.on('worldState', (players: RemotePlayer[]) => {
      players.forEach(p => this.createRemotePlayer(p));
      this.hud.setPlayerCount(players.length + 1);
    });

    this.mp.on('playerJoined', (p: RemotePlayer) => {
      this.createRemotePlayer(p);
    });

    this.mp.on('playerMoved', (data: Partial<RemotePlayer>) => {
      const id = data.id!;
      // Store target for interpolation
      if (typeof data.x === 'number' && typeof data.z === 'number') {
        this.remoteTargets.set(id, {
          x: data.x,
          y: typeof data.y === 'number' ? data.y : 0,
          z: data.z,
          rot: typeof data.rotation === 'number' ? data.rotation : 0,
        });
      }
      const rp = this.mp.remotePlayers.get(id);
      if (rp) {
        rp.x = data.x ?? rp.x;
        rp.y = data.y ?? rp.y;
        rp.z = data.z ?? rp.z;
        rp.rotation = data.rotation ?? rp.rotation;
        rp.animation = data.animation ?? rp.animation;
      }
    });

    this.mp.on('playerLeft', (data: { id: string }) => {
      const mesh = this.remoteMeshes.get(data.id);
      if (mesh) {
        this.scene.remove(mesh);
        this.disposeMeshGroup(mesh);
        this.remoteMeshes.delete(data.id);
      }
      this.remoteTargets.delete(data.id);
      this.mp.remotePlayers.delete(data.id);
    });

    this.mp.on('chatMessage', (msg) => {
      this.hud.addMessage(msg);
    });

    this.mp.on('serverInfo', (info) => {
      this.hud.addServerMessage(info.message);
      this.hud.setPlayerCount(info.count);
    });
  }

  private disposeMeshGroup(group: THREE.Group): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        } else if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        }
      }
    });
  }

  private createRemotePlayer(p: RemotePlayer): void {
    if (this.remoteMeshes.has(p.id)) return;
    this.mp.remotePlayers.set(p.id, p);

    const group = new THREE.Group();
    const charColor = p.color || '#ff4444';

    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.4, 10);
    const bodyMat = new THREE.MeshStandardMaterial({ color: charColor, roughness: 0.6 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);

    const beltGeo = new THREE.TorusGeometry(0.42, 0.06, 6, 16);
    const beltMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.5, roughness: 0.5 });
    const belt = new THREE.Mesh(beltGeo, beltMat);
    belt.position.y = 0.35;
    belt.rotation.x = Math.PI / 2;
    group.add(belt);

    const headGeo = new THREE.SphereGeometry(0.28, 10, 10);
    const headMat = new THREE.MeshStandardMaterial({ color: '#f5d0a9', roughness: 0.8 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.65;
    head.castShadow = true;
    group.add(head);

    group.position.set(p.x, p.y, p.z);
    group.rotation.y = p.rotation;
    this.scene.add(group);
    this.remoteMeshes.set(p.id, group);
    this.remoteTargets.set(p.id, { x: p.x, y: p.y, z: p.z, rot: p.rotation });
    p.mesh = group;
  }

  private loop = (): void => {
    if (!this.alive) return;
    requestAnimationFrame(this.loop);

    const dt = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.elapsedTime;

    // Player
    this.player.update(dt, this.camera.yaw);

    // Camera
    this.camera.update(dt, this.player);

    // Shadow camera follows player
    this.dirLight.position.set(
      this.player.position.x + this.atmosphere.sunDirection.x * 100,
      this.player.position.y + Math.max(this.atmosphere.sunDirection.y * 150, 30),
      this.player.position.z + this.atmosphere.sunDirection.z * 100
    );
    this.dirLight.target.position.copy(this.player.position);

    // Atmosphere + lighting
    this.atmosphere.update(dt);
    this.dirLight.intensity = this.atmosphere.sunIntensity;
    this.ambientLight.intensity = this.atmosphere.ambientIntensity;
    (this.scene.fog as THREE.Fog).color.copy(this.atmosphere.fogColor);

    // Terrain + water
    this.terrain.update(this.atmosphere.sunDirection, this.atmosphere.fogColor);
    this.water.update(elapsed, this.atmosphere.fogColor);

    // Smooth remote player interpolation (prevents jittery movement)
    const lerpFactor = 1 - Math.exp(-12 * dt);
    this.remoteMeshes.forEach((mesh, id) => {
      const target = this.remoteTargets.get(id);
      if (target) {
        mesh.position.x += (target.x - mesh.position.x) * lerpFactor;
        mesh.position.y += (target.y - mesh.position.y) * lerpFactor;
        mesh.position.z += (target.z - mesh.position.z) * lerpFactor;
        mesh.rotation.y += (target.rot - mesh.rotation.y) * lerpFactor;
      }
    });

    // Multiplayer sync ~20 Hz
    this.positionTimer += dt;
    if (this.positionTimer >= 0.05) {
      this.positionTimer = 0;
      this.mp.sendPosition(
        this.player.position.x,
        this.player.position.y,
        this.player.position.z,
        this.player.rotation,
        this.player.animation
      );
    }

    // HUD
    this.hud.updatePosition(this.player.position.x, this.player.position.z);
    this.hud.drawMinimap(this.mp.remotePlayers, this.camera.yaw);
    this.hud.drawNameTags(this.camera.camera, this.mp.remotePlayers);

    // Render
    this.renderer.render(this.scene, this.camera.camera);
  };

  dispose(): void {
    this.alive = false;
    this.disposeFns.forEach(fn => fn());
    this.disposeFns = [];

    this.remoteMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      this.disposeMeshGroup(mesh);
    });
    this.remoteMeshes.clear();
    this.remoteTargets.clear();

    this.terrain.mesh.geometry.dispose();
    (this.terrain.mesh.material as THREE.ShaderMaterial).dispose();

    this.water.mesh.geometry.dispose();
    (this.water.mesh.material as THREE.ShaderMaterial).dispose();

    this.atmosphere.skyMesh.geometry.dispose();
    (this.atmosphere.skyMesh.material as THREE.ShaderMaterial).dispose();

    this.disposeMeshGroup(this.player.group);
    this.scene.remove(this.player.group);

    this.renderer.dispose();
  }
}
