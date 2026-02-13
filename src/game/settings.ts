// Einstellungen-System
export interface GameSettings {
  renderDistance: number;
  fov: number;
  clouds: boolean;
  showHand: boolean;
  shadows: boolean;
  particles: boolean;
  fancyGraphics: boolean;
  masterVolume: number;
  musicVolume: number;
  soundVolume: number;
  mouseSensitivity: number;
  invertMouse: boolean;
  joystickSize: number;
  joystickSideOffset: number;
  joystickBottomOffset: number;
  buttonSize: number;
  hotbarScale: number;
  hotbarSideOffset: number;
  hotbarBottomOffset: number;
  resourcePack: ResourcePackSettings;
}

export interface ResourcePackSettings {
  enabled: boolean;
  textures: Record<string, string>;
  name: string;
}

export const DEFAULT_SETTINGS: GameSettings = {
  renderDistance: 8,
  fov: 75,
  clouds: true,
  showHand: true,
  shadows: true,
  particles: true,
  fancyGraphics: true,
  masterVolume: 100,
  musicVolume: 50,
  soundVolume: 100,
  mouseSensitivity: 50,
  invertMouse: false,
  joystickSize: 1.0,
  joystickSideOffset: 0,
  joystickBottomOffset: 0,
  buttonSize: 1.0,
  hotbarScale: 1.0,
  hotbarSideOffset: 0,
  hotbarBottomOffset: 0,
  resourcePack: {
    enabled: false,
    textures: {},
    name: 'Default'
  }
};

// Simple settings manager
class SettingsManager {
  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  private listeners: ((settings: GameSettings) => void)[] = [];

  constructor() {
    this.loadSettings();
  }

  getSettings(): GameSettings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<GameSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    this.notifyListeners();
  }

  addListener(callback: (settings: GameSettings) => void) {
    this.listeners.push(callback);
  }

  removeListener(callback: (settings: GameSettings) => void) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  private notifyListeners() {
    this.listeners.forEach(cb => cb(this.getSettings()));
  }

  private saveSettings() {
    try {
      localStorage.setItem('minicraft_settings', JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  private loadSettings() {
    try {
      const raw = localStorage.getItem('minicraft_settings');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      this.settings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        resourcePack: {
          ...DEFAULT_SETTINGS.resourcePack,
          ...(parsed?.resourcePack || {}),
        },
      };
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }
}

export const settingsManager = new SettingsManager();
