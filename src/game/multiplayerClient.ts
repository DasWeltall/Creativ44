import { MultiplayerAnimalState, MultiplayerBlockEvent, MultiplayerPlayerState } from './renderer';

export interface MultiplayerWorldInfo {
  seed: number;
  worldType: 'normal' | 'flat';
}

export interface MultiplayerSession {
  roomCode: string;
  playerId: string;
  isHost: boolean;
  world: MultiplayerWorldInfo;
}

export interface MultiplayerEnvironmentState {
  timeOfDay: number;
  weather: 'clear' | 'rain' | 'snow' | 'storm';
}

interface PullResponse {
  players: MultiplayerPlayerState[];
  events: Array<MultiplayerBlockEvent & { seq: number; authorId: string }>;
  animals: MultiplayerAnimalState[];
  latestSeq: number;
  world: MultiplayerWorldInfo;
  environment?: MultiplayerEnvironmentState;
}

class MultiplayerClient {
  private endpoints = [
    '/.netlify/functions/multiplayer',
    '/netlify/functions/multiplayer',
  ];
  private roomEndpoint = new Map<string, string>();

  private roomKey(roomCode: string, playerId: string) {
    return `${roomCode.toUpperCase()}::${playerId}`;
  }

  async createRoom(name: string, world: MultiplayerWorldInfo): Promise<MultiplayerSession> {
    const { data: res, endpoint } = await this.postJson('create', { name, world });
    this.roomEndpoint.set(this.roomKey(res.roomCode, res.playerId), endpoint);
    return {
      roomCode: res.roomCode,
      playerId: res.playerId,
      isHost: true,
      world: res.world,
    };
  }

  async joinRoom(roomCode: string, name: string): Promise<MultiplayerSession> {
    const { data: res, endpoint } = await this.postJson('join', { roomCode: roomCode.toUpperCase(), name });
    this.roomEndpoint.set(this.roomKey(res.roomCode, res.playerId), endpoint);
    return {
      roomCode: res.roomCode,
      playerId: res.playerId,
      isHost: false,
      world: res.world,
    };
  }

  async leaveRoom(roomCode: string, playerId: string): Promise<void> {
    const key = this.roomKey(roomCode, playerId);
    const pinned = this.roomEndpoint.get(key);
    await this.postJson('leave', { roomCode, playerId }, pinned);
    this.roomEndpoint.delete(key);
  }

  async pushState(payload: {
    roomCode: string;
    playerId: string;
    player: MultiplayerPlayerState;
    events?: MultiplayerBlockEvent[];
    animals?: MultiplayerAnimalState[];
    environment?: MultiplayerEnvironmentState;
  }): Promise<void> {
    const key = this.roomKey(payload.roomCode, payload.playerId);
    const pinned = this.roomEndpoint.get(key);
    const { endpoint } = await this.postJson('push', payload, pinned);
    this.roomEndpoint.set(key, endpoint);
  }

  async pullState(roomCode: string, playerId: string, sinceSeq: number): Promise<PullResponse> {
    const key = this.roomKey(roomCode, playerId);
    const pinned = this.roomEndpoint.get(key);
    const errors: string[] = [];
    const ordered = pinned ? [pinned, ...this.endpoints.filter(e => e !== pinned)] : [...this.endpoints];
    for (const endpoint of ordered) {
      try {
        const url = `${endpoint}?action=pull&roomCode=${encodeURIComponent(roomCode)}&playerId=${encodeURIComponent(playerId)}&sinceSeq=${encodeURIComponent(String(sinceSeq))}`;
        const r = await fetch(url, { method: 'GET' });
        const j = await this.readJsonResponse(r, 'pull');
        if (!r.ok || !j.ok) throw new Error(j.error || `pull failed (${r.status})`);
        this.roomEndpoint.set(key, endpoint);
        return {
          players: Array.isArray(j.players) ? j.players : [],
          events: Array.isArray(j.events) ? j.events : [],
          animals: Array.isArray(j.animals) ? j.animals : [],
          latestSeq: Number(j.latestSeq || sinceSeq),
          world: j.world,
          environment: j.environment,
        };
      } catch (e) {
        errors.push(`${endpoint}: ${String((e as Error)?.message || e)}`);
      }
    }
    throw new Error(errors.join(' | ') || 'pull failed');
  }

  private async postJson(action: string, payload: Record<string, unknown>, pinnedEndpoint?: string): Promise<{ data: any; endpoint: string }> {
    const errors: string[] = [];
    const ordered = pinnedEndpoint
      ? [pinnedEndpoint, ...this.endpoints.filter(e => e !== pinnedEndpoint)]
      : [...this.endpoints];
    for (const endpoint of ordered) {
      try {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...payload }),
        });
        const j = await this.readJsonResponse(r, action);
        if (!r.ok || !j.ok) throw new Error(j.error || `${action} failed (${r.status})`);
        return { data: j, endpoint };
      } catch (e) {
        errors.push(`${endpoint}: ${String((e as Error)?.message || e)}`);
      }
    }
    throw new Error(errors.join(' | ') || `${action} failed`);
  }

  private async readJsonResponse(response: Response, action: string): Promise<any> {
    const text = await response.text();
    if (!text.trim()) {
      throw new Error(`Empty response from multiplayer server (${action}). Run with "netlify dev" and open http://localhost:8888`);
    }
    try {
      return JSON.parse(text);
    } catch {
      const preview = text.slice(0, 120).replace(/\s+/g, ' ');
      if (preview.toLowerCase().includes('<!doctype') || preview.toLowerCase().includes('<html')) {
        throw new Error(`Multiplayer endpoint not reachable (${action}). Start via "netlify dev" locally or deploy on Netlify.`);
      }
      throw new Error(`Invalid server response (${action}): ${preview || 'empty response'}`);
    }
  }
}

export const multiplayerClient = new MultiplayerClient();
