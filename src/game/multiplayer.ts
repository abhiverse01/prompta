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
  mesh?: import('three').Group; // filled at runtime
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

    this.socket.on('disconnect', () => {
      console.log('[Multiplayer] Disconnected');
      this.connected = false;
    });
  }

  join(name: string, characterType: number, color: string, x: number, y: number, z: number): void {
    this.socket?.emit('player:join', { name, characterType, color, x, y, z });
  }

  sendPosition(x: number, y: number, z: number, rotation: number, animation: string): void {
    this.socket?.emit('player:move', { x, y, z, rotation, animation });
  }

  sendChat(text: string): void {
    this.socket?.emit('chat:message', { text });
  }

  on<K extends keyof typeof this.callbacks>(
    event: K,
    cb: Callback<(typeof this.callbacks)[K][number] extends Callback<infer T> ? T : never>
  ): void {
    (this.callbacks[event] as Callback<unknown>[]).push(cb as Callback<unknown>);
  }

  disconnect(): void {
    this.socket?.disconnect();
  }
}
