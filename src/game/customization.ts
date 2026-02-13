// ══════════════════════════════════════════════════════════════════
// CUSTOMIZATION SYSTEM - Full Game Customization
// ══════════════════════════════════════════════════════════════════

import { BlockType } from './constants';

export interface CustomBlockProperties {
  hardness: number; // How long to break (0 = instant, 100 = very hard)
  lightLevel: number; // 0-15, how much light it emits
  transparent: boolean; // Can see through
  liquid: boolean; // Behaves like water/lava
  climbable: boolean; // Can climb like ladder
  solid: boolean; // Can collide with
  flammable: boolean; // Can catch fire
  gravity: boolean; // Falls like sand/gravel
  slipperiness: number; // 0-1, like ice
  color: string; // Hex color
  texture: string | null; // Custom texture URL
  sounds: {
    break: string | null;
    place: string | null;
    step: string | null;
  };
}

export interface CustomCraftingRecipe {
  id: string;
  name: string;
  pattern: string[]; // 3x3 grid, 'X' = ingredient, '-' = empty
  ingredients: Record<string, BlockType>;
  result: BlockType;
  resultCount: number;
  category: string;
}

export interface CustomMobBehavior {
  mobType: string;
  health: number;
  speed: number;
  jumpHeight: number;
  aggressive: boolean;
  drops: Array<{ item: BlockType; chance: number; count: number }>;
  ai: {
    wanderRadius: number;
    attackRange: number;
    fleeOnLowHealth: boolean;
    targetPlayers: boolean;
    targetAnimals: boolean;
  };
}

export interface WorldGenConfig {
  seed: string;
  biomes: {
    size: number; // 1-10, larger = bigger biomes
    variety: number; // 0-1, how varied
  };
  terrain: {
    heightScale: number; // 0-2, mountain height
    smoothness: number; // 0-1, terrain smoothness
    oceanLevel: number; // Sea level
  };
  ores: Record<BlockType, {
    minHeight: number;
    maxHeight: number;
    veinSize: number;
    frequency: number; // 0-1
  }>;
  structures: {
    villages: { enabled: boolean; frequency: number };
    dungeons: { enabled: boolean; frequency: number };
    caves: { enabled: boolean; frequency: number; size: number };
    trees: { enabled: boolean; density: number };
  };
}

export interface TexturePack {
  name: string;
  author: string;
  version: string;
  textures: Record<string, string>; // blockName -> URL
  guiTextures: Record<string, string>;
  sounds: Record<string, string>;
}

export interface ShaderEffect {
  name: string;
  enabled: boolean;
  vertexShader?: string;
  fragmentShader?: string;
  uniforms?: Record<string, any>;
}

export interface KeyBinding {
  action: string;
  primary: string; // Primary key
  secondary: string | null; // Alternative key
  description: string;
}

// ══════════════════════════════════════════════════════════════════
// CUSTOMIZATION MANAGER
// ══════════════════════════════════════════════════════════════════

export class CustomizationManager {
  private blockProperties = new Map<BlockType, CustomBlockProperties>();
  private customRecipes: CustomCraftingRecipe[] = [];
  private mobBehaviors = new Map<string, CustomMobBehavior>();
  private worldGenConfig: WorldGenConfig | null = null;
  private texturePack: TexturePack | null = null;
  private shaderEffects: ShaderEffect[] = [];
  private keyBindings = new Map<string, KeyBinding>();
  private modScripts: string[] = [];

  constructor() {
    this.loadDefaults();
  }

  // ══════════════════════════════════════════════════════════════════
  // BLOCK CUSTOMIZATION
  // ══════════════════════════════════════════════════════════════════

  setBlockProperties(blockType: BlockType, properties: Partial<CustomBlockProperties>) {
    const existing = this.blockProperties.get(blockType) || this.getDefaultBlockProperties(blockType);
    this.blockProperties.set(blockType, { ...existing, ...properties });
    console.log(`[Customization] Updated properties for block ${blockType}`);
  }

  getBlockProperties(blockType: BlockType): CustomBlockProperties {
    return this.blockProperties.get(blockType) || this.getDefaultBlockProperties(blockType);
  }

  private getDefaultBlockProperties(blockType: BlockType): CustomBlockProperties {
    // Default properties for each block type
    const defaults: CustomBlockProperties = {
      hardness: 50,
      lightLevel: 0,
      transparent: false,
      liquid: false,
      climbable: false,
      solid: true,
      flammable: false,
      gravity: false,
      slipperiness: 0.6,
      color: '#888888',
      texture: null,
      sounds: { break: null, place: null, step: null }
    };

    // Special cases
    if (blockType === BlockType.GLASS) {
      defaults.transparent = true;
      defaults.hardness = 10;
    } else if (blockType === BlockType.WATER) {
      defaults.liquid = true;
      defaults.transparent = true;
      defaults.solid = false;
    } else if (blockType === BlockType.GLOWSTONE) {
      defaults.lightLevel = 15;
    } else if (blockType === BlockType.SAND || blockType === BlockType.GRAVEL) {
      defaults.gravity = true;
    } else if (blockType === BlockType.ICE) {
      defaults.slipperiness = 0.98;
    } else if (blockType === BlockType.BEDROCK) {
      defaults.hardness = 1000;
    } else if (blockType === BlockType.WOOD || blockType === BlockType.PLANKS) {
      defaults.flammable = true;
    }

    return defaults;
  }

  // ══════════════════════════════════════════════════════════════════
  // CRAFTING CUSTOMIZATION
  // ══════════════════════════════════════════════════════════════════

  addCustomRecipe(recipe: CustomCraftingRecipe) {
    this.customRecipes.push(recipe);
    console.log(`[Customization] Added custom recipe: ${recipe.name}`);
  }

  removeCustomRecipe(id: string) {
    const index = this.customRecipes.findIndex(r => r.id === id);
    if (index >= 0) {
      this.customRecipes.splice(index, 1);
      console.log(`[Customization] Removed recipe: ${id}`);
    }
  }

  getCustomRecipes(): CustomCraftingRecipe[] {
    return this.customRecipes;
  }

  // ══════════════════════════════════════════════════════════════════
  // MOB BEHAVIOR CUSTOMIZATION
  // ══════════════════════════════════════════════════════════════════

  setMobBehavior(mobType: string, behavior: CustomMobBehavior) {
    this.mobBehaviors.set(mobType, behavior);
    console.log(`[Customization] Updated behavior for ${mobType}`);
  }

  getMobBehavior(mobType: string): CustomMobBehavior | null {
    return this.mobBehaviors.get(mobType) || null;
  }

  // ══════════════════════════════════════════════════════════════════
  // WORLD GENERATION CUSTOMIZATION
  // ══════════════════════════════════════════════════════════════════

  setWorldGenConfig(config: WorldGenConfig) {
    this.worldGenConfig = config;
    console.log(`[Customization] Updated world generation config`);
  }

  getWorldGenConfig(): WorldGenConfig | null {
    return this.worldGenConfig;
  }

  // ══════════════════════════════════════════════════════════════════
  // TEXTURE PACK SYSTEM
  // ══════════════════════════════════════════════════════════════════

  async loadTexturePack(packUrl: string): Promise<boolean> {
    try {
      const response = await fetch(packUrl);
      const pack: TexturePack = await response.json();
      this.texturePack = pack;
      console.log(`[Customization] Loaded texture pack: ${pack.name} by ${pack.author}`);
      return true;
    } catch (error) {
      console.error(`[Customization] Failed to load texture pack:`, error);
      return false;
    }
  }

  getTexturePack(): TexturePack | null {
    return this.texturePack;
  }

  clearTexturePack() {
    this.texturePack = null;
    console.log(`[Customization] Cleared texture pack`);
  }

  // ══════════════════════════════════════════════════════════════════
  // SHADER EFFECTS
  // ══════════════════════════════════════════════════════════════════

  addShaderEffect(effect: ShaderEffect) {
    this.shaderEffects.push(effect);
    console.log(`[Customization] Added shader effect: ${effect.name}`);
  }

  removeShaderEffect(name: string) {
    const index = this.shaderEffects.findIndex(e => e.name === name);
    if (index >= 0) {
      this.shaderEffects.splice(index, 1);
      console.log(`[Customization] Removed shader effect: ${name}`);
    }
  }

  toggleShaderEffect(name: string, enabled: boolean) {
    const effect = this.shaderEffects.find(e => e.name === name);
    if (effect) {
      effect.enabled = enabled;
      console.log(`[Customization] ${enabled ? 'Enabled' : 'Disabled'} shader: ${name}`);
    }
  }

  getShaderEffects(): ShaderEffect[] {
    return this.shaderEffects.filter(e => e.enabled);
  }

  // ══════════════════════════════════════════════════════════════════
  // KEY BINDINGS
  // ══════════════════════════════════════════════════════════════════

  setKeyBinding(action: string, primary: string, secondary: string | null = null) {
    const existing = this.keyBindings.get(action);
    if (existing) {
      existing.primary = primary;
      existing.secondary = secondary;
    } else {
      this.keyBindings.set(action, {
        action,
        primary,
        secondary,
        description: action
      });
    }
    console.log(`[Customization] Updated keybinding for ${action}: ${primary}`);
  }

  getKeyBinding(action: string): KeyBinding | null {
    return this.keyBindings.get(action) || null;
  }

  getAllKeyBindings(): Map<string, KeyBinding> {
    return this.keyBindings;
  }

  // ══════════════════════════════════════════════════════════════════
  // MOD API (Custom JavaScript execution)
  // ══════════════════════════════════════════════════════════════════

  addModScript(script: string) {
    this.modScripts.push(script);
    console.log(`[Customization] Added mod script (${script.length} characters)`);
  }

  executeModScripts(context: any) {
    for (const script of this.modScripts) {
      try {
        // Execute script with controlled context
        const func = new Function('game', script);
        func(context);
      } catch (error) {
        console.error(`[Customization] Mod script error:`, error);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // SAVE/LOAD SYSTEM
  // ══════════════════════════════════════════════════════════════════

  exportConfig(): string {
    const config = {
      blockProperties: Array.from(this.blockProperties.entries()),
      customRecipes: this.customRecipes,
      mobBehaviors: Array.from(this.mobBehaviors.entries()),
      worldGenConfig: this.worldGenConfig,
      texturePack: this.texturePack,
      shaderEffects: this.shaderEffects,
      keyBindings: Array.from(this.keyBindings.entries()),
      modScripts: this.modScripts
    };
    return JSON.stringify(config, null, 2);
  }

  importConfig(jsonString: string): boolean {
    try {
      const config = JSON.parse(jsonString);

      if (config.blockProperties) {
        this.blockProperties = new Map(config.blockProperties);
      }
      if (config.customRecipes) {
        this.customRecipes = config.customRecipes;
      }
      if (config.mobBehaviors) {
        this.mobBehaviors = new Map(config.mobBehaviors);
      }
      if (config.worldGenConfig) {
        this.worldGenConfig = config.worldGenConfig;
      }
      if (config.texturePack) {
        this.texturePack = config.texturePack;
      }
      if (config.shaderEffects) {
        this.shaderEffects = config.shaderEffects;
      }
      if (config.keyBindings) {
        this.keyBindings = new Map(config.keyBindings);
      }
      if (config.modScripts) {
        this.modScripts = config.modScripts;
      }

      console.log(`[Customization] Imported configuration`);
      return true;
    } catch (error) {
      console.error(`[Customization] Failed to import config:`, error);
      return false;
    }
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem('customization_config', this.exportConfig());
      console.log(`[Customization] Saved to localStorage`);
    } catch (error) {
      console.error(`[Customization] Failed to save:`, error);
    }
  }

  loadFromLocalStorage(): boolean {
    try {
      const saved = localStorage.getItem('customization_config');
      if (saved) {
        return this.importConfig(saved);
      }
      return false;
    } catch (error) {
      console.error(`[Customization] Failed to load:`, error);
      return false;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // DEFAULTS
  // ══════════════════════════════════════════════════════════════════

  private loadDefaults() {
    // Default key bindings
    this.setKeyBinding('forward', 'w', 'ArrowUp');
    this.setKeyBinding('backward', 's', 'ArrowDown');
    this.setKeyBinding('left', 'a', 'ArrowLeft');
    this.setKeyBinding('right', 'd', 'ArrowRight');
    this.setKeyBinding('jump', ' ', null);
    this.setKeyBinding('sneak', 'Shift', null);
    this.setKeyBinding('inventory', 'e', null);
    this.setKeyBinding('crafting', 'c', null);
    this.setKeyBinding('drop', 'q', null);
    this.setKeyBinding('chat', 't', null);
    this.setKeyBinding('command', '/', null);

    // Load saved config
    this.loadFromLocalStorage();
  }

  // ══════════════════════════════════════════════════════════════════
  // PRESET CONFIGURATIONS
  // ══════════════════════════════════════════════════════════════════

  loadPreset(presetName: string) {
    switch (presetName) {
      case 'vanilla':
        this.blockProperties.clear();
        this.customRecipes = [];
        console.log('[Customization] Loaded Vanilla preset');
        break;

      case 'hardcore':
        // Make everything harder
        for (const blockType of Object.values(BlockType)) {
          if (typeof blockType === 'number') {
            const props = this.getBlockProperties(blockType);
            props.hardness *= 2;
            this.setBlockProperties(blockType, props);
          }
        }
        console.log('[Customization] Loaded Hardcore preset');
        break;

      case 'creative_plus':
        // Make everything easier and more fun
        for (const blockType of Object.values(BlockType)) {
          if (typeof blockType === 'number') {
            const props = this.getBlockProperties(blockType);
            props.hardness = 1; // Instant break
            this.setBlockProperties(blockType, props);
          }
        }
        console.log('[Customization] Loaded Creative+ preset');
        break;

      case 'physics_chaos':
        // Everything has gravity and explodes!
        for (const blockType of Object.values(BlockType)) {
          if (typeof blockType === 'number') {
            const props = this.getBlockProperties(blockType);
            props.gravity = true;
            this.setBlockProperties(blockType, props);
          }
        }
        console.log('[Customization] Loaded Physics Chaos preset');
        break;
    }
  }
}

// Singleton instance
export const customizationManager = new CustomizationManager();
