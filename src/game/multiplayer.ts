import { io, Socket } from 'socket.io-client';

export interface RemotePlayer {
  id: string;
  name: string;
  characterType: number;
  color: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  animation: string;
  mesh?: import('three').Group;
}

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  time: number;
}

type Callback<T> = (data: T) => void;

export class MultiplayerManager {
  public socket: Socket | null = null;
  public myId: string | null = null;
  public remotePlayers = new Map<string, RemotePlayer>();
  public messages: ChatMessage[] = [];
  public playerCount = 0;
  public connected = false;

  private callbacks = {
    worldState:   [] as Callback<RemotePlayer[]>[],
    playerJoined: [] as Callback<RemotePlayer>[],
    playerMoved:  [] as Callback<Partial<RemotePlayer>>[],
    playerLeft:   [] as Callback<{ id: string }>[],
    chatMessage:  [] as Callback<ChatMessage>[],
    serverInfo:   [] as Callback<{ message: string; count: number }>[],
  };

  connect(): void {
    this.socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('[Multiplayer] Connected:', this.socket!.id);
      this.connected = true;
    });

    this.socket.on('player:id', (id: string) => {
      this.myId = id;
      console.log('[Multiplayer] Assigned ID:', id);
    });

    this.socket.on('world:state', (players: RemotePlayer[]) => {
      this.callbacks.worldState.forEach(cb => cb(players));
    });

    this.socket.on('player:joined', (p: RemotePlayer) => {
      this.callbacks.playerJoined.forEach(cb => cb(p));
    });

    this.socket.on('player:moved', (data: Partial<RemotePlayer>) => {
      this.callbacks.playerMoved.forEach(cb => cb(data));
    });

    this.socket.on('player:left', (data: { id: string }) => {
      this.callbacks.playerLeft.forEach(cb => cb(data));
    });

    this.socket.on('chat:message', (msg: ChatMessage) => {
      this.messages.push(msg);
      if (this.messages.length > 50) this.messages.shift();
      this.callbacks.chatMessage.forEach(cb => cb(msg));
    });

    this.socket.on('server:info', (info: { message: string; count: number }) => {
      this.playerCount = info.count;
      this.callbacks.serverInfo.forEach(cb => cb(info));
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Multiplayer] Disconnected:', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Multiplayer] Connection error:', err.message);
      this.connected = false;
    });
  }

  join(name: string, characterType: number, color: string, x: number, y: number, z: number): void {
    if (this.socket?.connected) {
      this.socket.emit('player:join', { name, characterType, color, x, y, z });
    }
  }

  sendPosition(x: number, y: number, z: number, rotation: number, animation: string): void {
    if (this.socket?.connected) {
      this.socket.emit('player:move', { x, y, z, rotation, animation });
    }
  }

  sendChat(text: string): void {
    if (this.socket?.connected) {
      this.socket.emit('chat:message', { text });
    }
  }

  on<K extends keyof typeof this.callbacks>(
    event: K,
    cb: Callback<(typeof this.callbacks)[K][number] extends Callback<infer T> ? T : never>
  ): void {
    (this.callbacks[event] as Callback<unknown>[]).push(cb as Callback<unknown>);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }
}
