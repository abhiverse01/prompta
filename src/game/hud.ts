import * as THREE from 'three';
import { MultiplayerManager, RemotePlayer } from './multiplayer';
import { Player } from './player';

export class HUD {
  private container: HTMLElement;
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;
  private chatLog: HTMLDivElement;
  private chatInput: HTMLInputElement;
  private playerCountEl: HTMLElement;
  private coordsEl: HTMLElement;
  private nameTagContainer: HTMLElement;
  private chatVisible = false;

  private px = 0;
  private pz = 0;
  private tagPool: HTMLDivElement[] = [];

  /** Cached minimap gradient — reused every frame instead of re-created */
  private minimapGradient: CanvasGradient | null = null;
  private minimapGradientKey = '';

  constructor(container: HTMLElement) {
    this.container = container;
    container.innerHTML = `
      <div id="hud-crosshair" style="
        position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
        pointer-events:none;z-index:20;
      "><svg width="24" height="24" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="2" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
        <line x1="12" y1="4" x2="12" y2="9" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
        <line x1="12" y1="15" x2="12" y2="20" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
        <line x1="4" y1="12" x2="9" y2="12" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
        <line x1="15" y1="12" x2="20" y2="12" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
      </svg></div>

      <div id="hud-bars" style="position:fixed;top:20px;left:20px;z-index:20;pointer-events:none;">
        <div style="font-size:12px;color:#ccc;margin-bottom:4px;font-family:monospace;">HP</div>
        <div style="width:200px;height:14px;background:rgba(0,0,0,0.5);border-radius:7px;overflow:hidden;border:1px solid rgba(255,255,255,0.15);">
          <div id="hp-bar" style="width:100%;height:100%;background:linear-gradient(90deg,#22c55e,#4ade80);border-radius:7px;transition:width 0.3s;"></div>
        </div>
        <div style="font-size:12px;color:#ccc;margin-top:8px;margin-bottom:4px;font-family:monospace;">STAMINA</div>
        <div style="width:200px;height:10px;background:rgba(0,0,0,0.5);border-radius:5px;overflow:hidden;border:1px solid rgba(255,255,255,0.15);">
          <div id="stamina-bar" style="width:100%;height:100%;background:linear-gradient(90deg,#f59e0b,#fbbf24);border-radius:5px;transition:width 0.3s;"></div>
        </div>
      </div>

      <div id="hud-count" style="position:fixed;top:20px;right:20px;z-index:20;pointer-events:none;
        background:rgba(0,0,0,0.45);padding:6px 14px;border-radius:8px;
        font-family:monospace;font-size:13px;color:#ddd;border:1px solid rgba(255,255,255,0.1);">
        <span id="online-count">1</span> online
      </div>

      <div id="hud-coords" style="position:fixed;top:54px;right:20px;z-index:20;pointer-events:none;
        font-family:monospace;font-size:11px;color:rgba(255,255,255,0.5);">X: 0   Z: 0</div>

      <div style="position:fixed;bottom:20px;right:20px;z-index:20;pointer-events:none;">
        <canvas id="hud-minimap" width="160" height="160" style="
          width:160px;height:160px;border-radius:50%;
          border:2px solid rgba(255,255,255,0.2);
          box-shadow:0 0 16px rgba(0,0,0,0.5);
        "></canvas>
      </div>

      <div id="hud-chat" style="position:fixed;bottom:20px;left:20px;z-index:20;width:340px;pointer-events:auto;">
        <div id="chat-log" style="
          max-height:180px;overflow-y:auto;padding:8px;
          background:rgba(0,0,0,0.35);border-radius:8px 8px 0 0;
          font-family:monospace;font-size:12px;color:#ddd;
          scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.2) transparent;
        "></div>
        <input id="chat-input" type="text" maxlength="200" placeholder="Press T to chat..."
          style="
            display:none;width:100%;padding:8px 10px;
            background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.15);
            border-top:none;border-radius:0 0 8px 8px;
            color:#eee;font-family:monospace;font-size:13px;outline:none;
            box-sizing:border-box;
          "/>
      </div>

      <div style="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:20;
        pointer-events:none;font-family:monospace;font-size:11px;color:rgba(255,255,255,0.3);">
        WASD move &middot; Shift sprint &middot; Space jump &middot; T chat &middot; Click to capture mouse
      </div>

      <div id="name-tags" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:15;overflow:hidden;"></div>
    `;

    const minimapEl = container.querySelector('#hud-minimap');
    if (!minimapEl) throw new Error('HUD: minimap canvas not found');
    this.minimapCanvas = minimapEl as HTMLCanvasElement;
    const ctx = this.minimapCanvas.getContext('2d');
    if (!ctx) throw new Error('HUD: cannot get 2d context');
    this.minimapCtx = ctx;

    const chatLogEl = container.querySelector('#chat-log');
    if (!chatLogEl) throw new Error('HUD: chat-log not found');
    this.chatLog = chatLogEl as HTMLDivElement;

    const chatInputEl = container.querySelector('#chat-input');
    if (!chatInputEl) throw new Error('HUD: chat-input not found');
    this.chatInput = chatInputEl as HTMLInputElement;

    const countEl = container.querySelector('#online-count');
    if (!countEl) throw new Error('HUD: online-count not found');
    this.playerCountEl = countEl as HTMLElement;

    const coordsEl = container.querySelector('#hud-coords');
    if (!coordsEl) throw new Error('HUD: coords not found');
    this.coordsEl = coordsEl as HTMLElement;

    const nameTagEl = container.querySelector('#name-tags');
    if (!nameTagEl) throw new Error('HUD: name-tags not found');
    this.nameTagContainer = nameTagEl as HTMLElement;
  }

  /** Bind chat toggle — links chat state to player.inputBlocked to prevent key leaks */
  bindChat(mp: MultiplayerManager, player: Player): () => void {
    const onKeyDown = (e: KeyboardEvent) => {
      // Open chat with T
      if (e.code === 'KeyT' && !this.chatVisible) {
        e.preventDefault();
        e.stopPropagation(); // prevent game from seeing T
        this.chatVisible = true;
        player.inputBlocked = true;
        player.clearInput(); // release any held movement keys
        this.chatInput.style.display = 'block';
        this.chatInput.focus();
        return;
      }

      // Close chat with Escape — stopPropagation so pointer lock doesn't also release
      if (e.code === 'Escape' && this.chatVisible) {
        e.preventDefault();
        e.stopPropagation();
        this.closeChat();
        player.inputBlocked = false;
        return;
      }
    };
    const onSubmit = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && this.chatVisible) {
        e.stopPropagation(); // prevent game from seeing Enter
        const text = this.chatInput.value.trim();
        if (text) {
          mp.sendChat(text);
          this.chatInput.value = '';
        }
        this.closeChat();
        player.inputBlocked = false;
      }
      // Block all other keys from reaching the game while chat is open
      if (this.chatVisible) {
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown, true); // capture phase to intercept before game
    this.chatInput.addEventListener('keydown', onSubmit);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      this.chatInput.removeEventListener('keydown', onSubmit);
    };
  }

  private closeChat(): void {
    this.chatVisible = false;
    this.chatInput.style.display = 'none';
    this.chatInput.blur();
  }

  addMessage(msg: { name: string; text: string; time: number }): void {
    const el = document.createElement('div');
    el.style.marginBottom = '3px';

    const timeSpan = document.createElement('span');
    timeSpan.style.color = 'rgba(255,255,255,0.35)';
    timeSpan.textContent = new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const nameB = document.createElement('b');
    nameB.style.color = '#fbbf24';
    nameB.textContent = msg.name;

    el.appendChild(timeSpan);
    el.appendChild(document.createTextNode(' '));
    el.appendChild(nameB);
    el.appendChild(document.createTextNode(`: ${msg.text}`));
    this.chatLog.appendChild(el);
    this.chatLog.scrollTop = this.chatLog.scrollHeight;

    while (this.chatLog.children.length > 30) {
      this.chatLog.removeChild(this.chatLog.firstChild!);
    }
  }

  addServerMessage(text: string): void {
    const el = document.createElement('div');
    el.style.cssText = 'margin-bottom:3px;color:#86efac;font-style:italic;';
    el.textContent = text;
    this.chatLog.appendChild(el);
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  setPlayerCount(n: number): void {
    this.playerCountEl.textContent = String(n);
  }

  updatePosition(x: number, z: number): void {
    this.px = x;
    this.pz = z;
    this.coordsEl.textContent = `X: ${Math.round(x)}   Z: ${Math.round(z)}`;
  }

  drawMinimap(
    remotePlayers: Map<string, RemotePlayer>,
    cameraYaw: number
  ): void {
    if (!this.minimapCtx) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Background circle
    ctx.fillStyle = 'rgba(10,20,10,0.7)';
    ctx.beginPath();
    ctx.arc(cx, cy, cx, 0, Math.PI * 2);
    ctx.fill();

    // Reuse gradient if canvas size hasn't changed
    const gKey = `${w}_${h}`;
    if (!this.minimapGradient || this.minimapGradientKey !== gKey) {
      this.minimapGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
      this.minimapGradient.addColorStop(0, 'rgba(30,80,30,0.3)');
      this.minimapGradient.addColorStop(0.5, 'rgba(40,70,30,0.2)');
      this.minimapGradient.addColorStop(1, 'rgba(20,40,50,0.3)');
      this.minimapGradientKey = gKey;
    }
    ctx.fillStyle = this.minimapGradient;
    ctx.fill();

    // Precompute cos/sin once
    const cosY = Math.cos(-cameraYaw);
    const sinY = Math.sin(-cameraYaw);
    const scale = 0.2;

    // North indicator
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-cameraYaw);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(0, -cx + 8);
    ctx.lineTo(-4, -cx + 18);
    ctx.lineTo(4, -cx + 18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Remote players
    remotePlayers.forEach((p) => {
      const dx = (p.x - this.px) * scale;
      const dz = -(p.z - this.pz) * scale;
      const rx = cx + dx * cosY - dz * sinY;
      const ry = cy + dx * sinY + dz * cosY;
      if (Math.hypot(rx - cx, ry - cy) < cx - 4) {
        ctx.fillStyle = p.color || '#fff';
        ctx.beginPath();
        ctx.arc(rx, ry, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Self
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Direction arrow
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-cameraYaw);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-3, 2);
    ctx.lineTo(3, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Reusable vector for name tag projection */
  private _namePos = new THREE.Vector3();

  drawNameTags(
    camera: THREE.PerspectiveCamera,
    remotePlayers: Map<string, RemotePlayer>
  ): void {
    const container = this.nameTagContainer;
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const tag of this.tagPool) {
      tag.style.display = 'none';
    }

    let poolIdx = 0;
    const pos = this._namePos;

    remotePlayers.forEach((p) => {
      if (!p.mesh) return;
      pos.set(p.x, p.y + 3.5, p.z);
      pos.project(camera);

      if (pos.z > 1) return;

      const sx = (pos.x * 0.5 + 0.5) * w;
      const sy = (-pos.y * 0.5 + 0.5) * h;

      if (sx < -100 || sx > w + 100 || sy < -50 || sy > h + 50) return;

      let tag: HTMLDivElement;
      if (poolIdx < this.tagPool.length) {
        tag = this.tagPool[poolIdx];
      } else {
        tag = document.createElement('div');
        tag.style.cssText = 'position:absolute;left:0;top:0;transform:translate(-50%,-100%);font-family:monospace;font-size:11px;color:#fff;text-shadow:0 0 4px rgba(0,0,0,0.8),0 1px 2px rgba(0,0,0,0.9);white-space:nowrap;pointer-events:none;';
        container.appendChild(tag);
        this.tagPool.push(tag);
      }

      tag.textContent = p.name;
      tag.style.left = `${sx}px`;
      tag.style.top = `${sy}px`;
      tag.style.display = '';
      poolIdx++;
    });
  }
}
