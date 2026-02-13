export interface RuntimeMod {
  id: string;
  name: string;
  description?: string;
  code: string;
  enabled: boolean;
}

interface ModPackFile {
  format: 'creativ44-modpack-v1';
  name: string;
  mods: RuntimeMod[];
  sandboxMode?: boolean;
}

const STORAGE_KEY = 'creativ44_mods';

class ModManager {
  private mods: RuntimeMod[] = [];
  private sandboxMode = true;

  constructor() {
    this.load();
  }

  list(): RuntimeMod[] {
    return [...this.mods];
  }

  isSandboxMode(): boolean {
    return this.sandboxMode;
  }

  setSandboxMode(enabled: boolean) {
    this.sandboxMode = enabled;
    this.save();
  }

  add(mod: Omit<RuntimeMod, 'id'>): RuntimeMod {
    const created: RuntimeMod = {
      id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...mod,
    };
    this.mods.push(created);
    this.save();
    return created;
  }

  remove(id: string): boolean {
    const idx = this.mods.findIndex(m => m.id === id);
    if (idx < 0) return false;
    this.mods.splice(idx, 1);
    this.save();
    return true;
  }

  toggle(id: string, enabled: boolean): boolean {
    const mod = this.mods.find(m => m.id === id);
    if (!mod) return false;
    mod.enabled = enabled;
    this.save();
    return true;
  }

  updateCode(id: string, code: string): boolean {
    const mod = this.mods.find(m => m.id === id);
    if (!mod) return false;
    mod.code = code;
    this.save();
    return true;
  }

  importJson(json: string): { success: boolean; message: string; imported: number } {
    try {
      const parsed = JSON.parse(json) as ModPackFile;
      if (parsed.format !== 'creativ44-modpack-v1' || !Array.isArray(parsed.mods)) {
        return { success: false, message: 'Invalid modpack format', imported: 0 };
      }

      let imported = 0;
      if (typeof parsed.sandboxMode === 'boolean') this.sandboxMode = parsed.sandboxMode;
      for (const mod of parsed.mods) {
        if (!mod?.name || !mod?.code) continue;
        this.add({
          name: mod.name,
          description: mod.description || '',
          code: mod.code,
          enabled: mod.enabled !== false,
        });
        imported++;
      }
      return { success: true, message: `Imported ${imported} mods`, imported };
    } catch {
      return { success: false, message: 'Invalid JSON file', imported: 0 };
    }
  }

  exportJson(): string {
    const payload: ModPackFile = {
      format: 'creativ44-modpack-v1',
      name: 'Creativ44 Modpack',
      mods: this.mods,
      sandboxMode: this.sandboxMode,
    };
    return JSON.stringify(payload, null, 2);
  }

  private save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mods: this.mods,
      sandboxMode: this.sandboxMode,
    }));
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RuntimeMod[] | { mods?: RuntimeMod[]; sandboxMode?: boolean };
      if (Array.isArray(parsed)) {
        this.mods = parsed.filter(m => typeof m?.name === 'string' && typeof m?.code === 'string')
          .map(m => ({ ...m, enabled: m.enabled !== false }));
        this.sandboxMode = true;
        return;
      }
      const mods = Array.isArray(parsed?.mods) ? parsed.mods : [];
      this.mods = mods.filter(m => typeof m?.name === 'string' && typeof m?.code === 'string')
        .map(m => ({ ...m, enabled: m.enabled !== false }));
      this.sandboxMode = parsed?.sandboxMode !== false;
    } catch {
      this.mods = [];
      this.sandboxMode = true;
    }
  }
}

export const modManager = new ModManager();
