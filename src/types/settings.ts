export interface Settings {
  video: VideoSettings;
  audio: AudioSettings;
  controls: ControlSettings;
  resourcePack: ResourcePack;
}

export interface VideoSettings {
  renderDistance: number;
  fov: number;
  clouds: boolean;
  showHand: boolean;
  shadows: boolean;
  particles: boolean;
  vsync: boolean;
  fullscreen: boolean;
}

export interface AudioSettings {
  master: number;
  music: number;
  sound: number;
  ambient: number;
}

export interface ControlSettings {
  mouseSensitivity: number;
  invertMouse: boolean;
  touchscreenMode: boolean;
  joystickSize: number;
  buttonSize: number;
  autoJump: boolean;
  keyboardControls: boolean;
}

export interface ResourcePack {
  name: string;
  customTextures: Record<string, string>;
  enabled: boolean;
}

export interface WorldSave {
  name: string;
  date: string;
  size: number;
  preview?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  video: {
    renderDistance: 8,
    fov: 75,
    clouds: true,
    showHand: true,
    shadows: true,
    particles: true,
    vsync: true,
    fullscreen: false,
  },
  audio: {
    master: 100,
    music: 50,
    sound: 100,
    ambient: 80,
  },
  controls: {
    mouseSensitivity: 50,
    invertMouse: false,
    touchscreenMode: true,
    joystickSize: 1.0,
    buttonSize: 1.0,
    autoJump: false,
    keyboardControls: true,
  },
  resourcePack: {
    name: 'Default',
    customTextures: {},
    enabled: false,
  },
};
