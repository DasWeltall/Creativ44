import { ChunkData } from './worldgen';
import { BlockType } from './constants';

export interface WorldData {
  id: string;
  name: string;
  seed: number;
  worldType: 'normal' | 'flat';
  snapshot: string;
  chunks: Map<string, ChunkData>;
  playerSpawn: { x: number; y: number; z: number };
  portals: PortalData[];
  blockEdits: Record<string, number>;
  createdAt: number;
  lastPlayed: number;
}

export interface PortalData {
  id: string;
  fromWorld: string;
  toWorld: string;
  fromPos: { x: number; y: number; z: number };
  toPos: { x: number; y: number; z: number };
  name: string;
  color: string;
  isActive: boolean;
}

export class WorldManager {
  private worlds: Map<string, WorldData> = new Map();
  private currentWorldId: string = '';
  
  constructor() {
    this.loadWorldsFromStorage();
  }

  // Create a new world
  createWorld(name: string, options?: { seed?: number; worldType?: 'normal' | 'flat' }): WorldData {
    const id = 'world_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const seed = Number.isFinite(options?.seed) ? Math.floor(options!.seed as number) : Math.floor(Math.random() * 2147483647);
    const world: WorldData = {
      id,
      name: name || `World ${this.worlds.size + 1}`,
      seed,
      worldType: options?.worldType || 'normal',
      snapshot: this.generateSnapshot(seed, options?.worldType || 'normal', name || `World ${this.worlds.size + 1}`),
      chunks: new Map(),
      playerSpawn: { x: 8, y: 50, z: 8 },
      portals: [],
      blockEdits: {},
      createdAt: Date.now(),
      lastPlayed: Date.now(),
    };
    
    this.worlds.set(id, world);
    this.saveWorldsToStorage();
    return world;
  }

  // Get a world by ID
  getWorld(id: string): WorldData | undefined {
    return this.worlds.get(id);
  }

  // Get current world
  getCurrentWorld(): WorldData | undefined {
    return this.worlds.get(this.currentWorldId);
  }

  // Set current world
  setCurrentWorld(id: string): boolean {
    if (this.worlds.has(id)) {
      this.currentWorldId = id;
      const world = this.worlds.get(id)!;
      world.lastPlayed = Date.now();
      this.saveWorldsToStorage();
      return true;
    }
    return false;
  }

  // Get all worlds
  getAllWorlds(): WorldData[] {
    return Array.from(this.worlds.values()).sort((a, b) => b.lastPlayed - a.lastPlayed);
  }

  // Delete a world
  deleteWorld(id: string): boolean {
    if (this.worlds.has(id)) {
      this.worlds.delete(id);
      if (this.currentWorldId === id) {
        this.currentWorldId = '';
      }
      this.saveWorldsToStorage();
      return true;
    }
    return false;
  }

  // Rename a world
  renameWorld(id: string, newName: string): boolean {
    const world = this.worlds.get(id);
    if (world) {
      world.name = newName;
      this.saveWorldsToStorage();
      return true;
    }
    return false;
  }

  // Create a portal between two worlds
  createPortal(
    fromWorldId: string,
    toWorldId: string,
    fromPos: { x: number; y: number; z: number },
    toPos?: { x: number; y: number; z: number },
    name?: string,
    color?: string
  ): PortalData | null {
    const fromWorld = this.worlds.get(fromWorldId);
    const toWorld = this.worlds.get(toWorldId);
    
    if (!fromWorld || !toWorld) return null;

    // If no destination position, use spawn point
    if (!toPos) {
      toPos = { ...toWorld.playerSpawn };
    }

    const portal: PortalData = {
      id: 'portal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      fromWorld: fromWorldId,
      toWorld: toWorldId,
      fromPos: { ...fromPos },
      toPos: { ...toPos },
      name: name || `Portal to ${toWorld.name}`,
      color: color || '#9b59b6',
      isActive: true,
    };

    fromWorld.portals.push(portal);
    
    // Create return portal automatically
    const returnPortal: PortalData = {
      id: 'portal_return_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      fromWorld: toWorldId,
      toWorld: fromWorldId,
      fromPos: { ...toPos },
      toPos: { ...fromPos },
      name: `Portal to ${fromWorld.name}`,
      color: color || '#9b59b6',
      isActive: true,
    };
    toWorld.portals.push(returnPortal);

    this.saveWorldsToStorage();
    return portal;
  }

  // Get portal at position
  getPortalAt(worldId: string, x: number, y: number, z: number): PortalData | null {
    const world = this.worlds.get(worldId);
    if (!world) return null;

    return world.portals.find(p => 
      p.isActive &&
      Math.abs(p.fromPos.x - x) < 2 &&
      Math.abs(p.fromPos.y - y) < 3 &&
      Math.abs(p.fromPos.z - z) < 2
    ) || null;
  }

  // Remove a portal
  removePortal(worldId: string, portalId: string): boolean {
    const world = this.worlds.get(worldId);
    if (!world) return false;

    const index = world.portals.findIndex(p => p.id === portalId);
    if (index !== -1) {
      world.portals.splice(index, 1);
      this.saveWorldsToStorage();
      return true;
    }
    return false;
  }

  // Update portal configuration
  updatePortal(worldId: string, portalId: string, updates: Partial<PortalData>): boolean {
    const world = this.worlds.get(worldId);
    if (!world) return false;

    const portal = world.portals.find(p => p.id === portalId);
    if (portal) {
      Object.assign(portal, updates);
      this.saveWorldsToStorage();
      return true;
    }
    return false;
  }

  // Save worlds to localStorage
  private saveWorldsToStorage() {
    try {
      const data = {
        worlds: Array.from(this.worlds.entries()).map(([id, world]) => [id, this.serializeWorld(world)]),
        currentWorldId: this.currentWorldId,
      };
      localStorage.setItem('minicraft_worlds', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save worlds:', e);
    }
  }

  // Load worlds from localStorage
  private loadWorldsFromStorage() {
    try {
      const data = localStorage.getItem('minicraft_worlds');
      if (data) {
        const parsed = JSON.parse(data);
        this.currentWorldId = parsed.currentWorldId || '';
        
        if (parsed.worlds) {
          parsed.worlds.forEach(([id, worldData]: [string, any]) => {
            this.worlds.set(id, this.deserializeWorld(worldData));
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load worlds:', e);
    }
  }

  // Serialize world for storage
  private serializeWorld(world: WorldData): any {
    return {
      id: world.id,
      name: world.name,
      seed: world.seed,
      worldType: world.worldType,
      snapshot: world.snapshot,
      playerSpawn: world.playerSpawn,
      portals: world.portals,
      blockEdits: world.blockEdits,
      createdAt: world.createdAt,
      lastPlayed: world.lastPlayed,
      // Don't serialize chunks - they will be regenerated
    };
  }

  // Deserialize world from storage
  private deserializeWorld(data: any): WorldData {
    const seed = typeof data.seed === 'number' ? data.seed : Math.floor(Math.random() * 2147483647);
    const worldType = data.worldType === 'flat' ? 'flat' : 'normal';
    const name = data.name || 'World';
    return {
      id: data.id,
      name,
      seed,
      worldType,
      snapshot: typeof data.snapshot === 'string' ? data.snapshot : this.generateSnapshot(seed, worldType, name),
      chunks: new Map(),
      playerSpawn: data.playerSpawn || { x: 8, y: 50, z: 8 },
      portals: data.portals || [],
      blockEdits: (data.blockEdits && typeof data.blockEdits === 'object') ? data.blockEdits : {},
      createdAt: data.createdAt || Date.now(),
      lastPlayed: data.lastPlayed || Date.now(),
    };
  }

  setBlockEdit(worldId: string, x: number, y: number, z: number, type: BlockType | number) {
    const world = this.worlds.get(worldId);
    if (!world) return;
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    world.blockEdits[key] = Number(type);
    world.lastPlayed = Date.now();
    this.saveWorldsToStorage();
  }

  getBlockEdits(worldId: string): Array<{ x: number; y: number; z: number; type: number }> {
    const world = this.worlds.get(worldId);
    if (!world) return [];
    const out: Array<{ x: number; y: number; z: number; type: number }> = [];
    for (const [key, value] of Object.entries(world.blockEdits || {})) {
      const [xs, ys, zs] = key.split(',');
      const x = Number(xs), y = Number(ys), z = Number(zs);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        out.push({ x, y, z, type: Number(value) });
      }
    }
    return out;
  }

  // Create default world if none exists
  ensureDefaultWorld(): WorldData {
    if (this.worlds.size === 0) {
      return this.createWorld('Overworld');
    }
    return this.getAllWorlds()[0];
  }

  // Export world data
  exportWorld(worldId: string): string | null {
    const world = this.worlds.get(worldId);
    if (!world) return null;
    return JSON.stringify(this.serializeWorld(world), null, 2);
  }

  // Import world data
  importWorld(jsonData: string): WorldData | null {
    try {
      const data = JSON.parse(jsonData);
      const world = this.deserializeWorld(data);
      world.id = 'world_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      world.createdAt = Date.now();
      world.lastPlayed = Date.now();
      this.worlds.set(world.id, world);
      this.saveWorldsToStorage();
      return world;
    } catch (e) {
      console.error('Failed to import world:', e);
      return null;
    }
  }

  private generateSnapshot(seed: number, worldType: 'normal' | 'flat', name: string): string {
    const size = 192;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const rand = (x: number, y: number) => {
      const n = Math.sin((x * 127.1 + y * 311.7 + seed * 0.001) * 0.008) * 43758.5453123;
      return n - Math.floor(n);
    };

    ctx.fillStyle = worldType === 'flat' ? '#7ec8ff' : '#5bb3ff';
    ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 4) {
      const hNoise = worldType === 'flat'
        ? 0.52
        : 0.35 + rand(x, seed % 97) * 0.45;
      const y = Math.floor(size * hNoise);
      ctx.fillStyle = '#5fa347';
      ctx.fillRect(x, y, 4, size - y);
      ctx.fillStyle = '#8b6a37';
      ctx.fillRect(x, y + 12, 4, size - y - 12);
      if (rand(x, y) > 0.84) {
        ctx.fillStyle = '#2f6b2d';
        ctx.fillRect(x, y - 10, 4, 10);
      }
    }

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, size - 28, size, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(name.slice(0, 18), 10, size - 10);
    return canvas.toDataURL('image/png');
  }
}

// Singleton instance
export const worldManager = new WorldManager();
