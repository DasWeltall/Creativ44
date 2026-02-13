import * as THREE from 'three';
import { BlockType } from './constants';

// Jolicraft Texture Pack Loader
export class TexturePack {
  private textures: Map<string, THREE.Texture> = new Map();
  private textureLoader = new THREE.TextureLoader();
  private basePath = `${(import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')}assets/block/`;
  private loaded = false;

  // Block type to texture name mapping
  private blockTextureMap: Record<number, { top?: string; side?: string; bottom?: string }> = {
    [BlockType.GRASS]: { top: 'grass_block_top1', side: 'grass_block_side', bottom: 'dirt' },
    [BlockType.DIRT]: { top: 'dirt', side: 'dirt', bottom: 'dirt' },
    [BlockType.STONE]: { top: 'stone', side: 'stone', bottom: 'stone' },
    [BlockType.BEDROCK]: { top: 'bedrock', side: 'bedrock', bottom: 'bedrock' },
    [BlockType.WOOD]: { top: 'oak_log_top', side: 'oak_log', bottom: 'oak_log_top' },
    [BlockType.LOG_BIRCH]: { top: 'birch_log_top', side: 'birch_log', bottom: 'birch_log_top' },
    [BlockType.LEAVES]: { top: 'oak_leaves', side: 'oak_leaves', bottom: 'oak_leaves' },
    [BlockType.LEAVES_BIRCH]: { top: 'birch_leaves', side: 'birch_leaves', bottom: 'birch_leaves' },
    [BlockType.SAND]: { top: 'sand', side: 'sand', bottom: 'sand' },
    [BlockType.COBBLESTONE]: { top: 'cobblestone', side: 'cobblestone', bottom: 'cobblestone' },
    [BlockType.PLANKS]: { top: 'oak_planks', side: 'oak_planks', bottom: 'oak_planks' },
    [BlockType.GLASS]: { top: 'glass', side: 'glass', bottom: 'glass' },
    [BlockType.BRICK]: { top: 'bricks', side: 'bricks', bottom: 'bricks' },
    [BlockType.REDSTONE_BLOCK]: { top: 'redstone_block', side: 'redstone_block', bottom: 'redstone_block' },
    [BlockType.REDSTONE_LAMP]: { top: 'redstone_lamp', side: 'redstone_lamp', bottom: 'redstone_lamp' },
    [BlockType.IRON_BLOCK]: { top: 'iron_block', side: 'iron_block', bottom: 'iron_block' },
    [BlockType.GOLD_BLOCK]: { top: 'gold_block', side: 'gold_block', bottom: 'gold_block' },
    [BlockType.DIAMOND_BLOCK]: { top: 'diamond_block', side: 'diamond_block', bottom: 'diamond_block' },
    [BlockType.CRAFTING_TABLE]: { top: 'crafting_table_top', side: 'crafting_table_front', bottom: 'oak_planks' },
    [BlockType.FURNACE]: { top: 'furnace_top', side: 'furnace_front', bottom: 'furnace_top' },
    [BlockType.TORCH]: { top: 'torch', side: 'torch', bottom: 'torch' },
    [BlockType.WOOL_WHITE]: { top: 'white_wool', side: 'white_wool', bottom: 'white_wool' },
    [BlockType.WOOL_RED]: { top: 'red_wool', side: 'red_wool', bottom: 'red_wool' },
    [BlockType.WOOL_BLUE]: { top: 'blue_wool', side: 'blue_wool', bottom: 'blue_wool' },
    [BlockType.WOOL_GREEN]: { top: 'green_wool', side: 'green_wool', bottom: 'green_wool' },
    [BlockType.WOOL_YELLOW]: { top: 'yellow_wool', side: 'yellow_wool', bottom: 'yellow_wool' },
    [BlockType.SNOW]: { top: 'snow', side: 'snow', bottom: 'snow' },
    [BlockType.ICE]: { top: 'ice', side: 'ice', bottom: 'ice' },
    [BlockType.OBSIDIAN]: { top: 'obsidian', side: 'obsidian', bottom: 'obsidian' },
    [BlockType.GLOWSTONE]: { top: 'glowstone', side: 'glowstone', bottom: 'glowstone' },
    [BlockType.BOOKSHELF]: { top: 'bookshelf_top', side: 'bookshelf', bottom: 'oak_planks' },
    [BlockType.MOSSY_COBBLE]: { top: 'mossy_cobblestone', side: 'mossy_cobblestone', bottom: 'mossy_cobblestone' },
    [BlockType.TNT]: { top: 'tnt_top', side: 'tnt_side', bottom: 'tnt_bottom' },
    [BlockType.GRAVEL]: { top: 'gravel', side: 'gravel', bottom: 'gravel' },
    [BlockType.CLAY]: { top: 'clay', side: 'clay', bottom: 'clay' },
  };

  async loadTextures(): Promise<void> {
    if (this.loaded) return;

    const textureNames = new Set<string>();
    
    // Collect all unique texture names
    Object.values(this.blockTextureMap).forEach(faces => {
      if (faces.top) textureNames.add(faces.top);
      if (faces.side) textureNames.add(faces.side);
      if (faces.bottom) textureNames.add(faces.bottom);
    });

    // Load each texture
    const loadPromises = Array.from(textureNames).map(name => 
      this.loadTexture(name)
    );

    await Promise.all(loadPromises);
    this.loaded = true;
    console.log(`Loaded ${this.textures.size} textures from Jolicraft pack`);
  }

  private loadTexture(name: string): Promise<void> {
    return new Promise((resolve) => {
      const path = `${this.basePath}${name}.png`;
      
      this.textureLoader.load(
        path,
        (texture) => {
          texture.magFilter = THREE.NearestFilter;
          texture.minFilter = THREE.NearestFilter;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          this.textures.set(name, texture);
          resolve();
        },
        undefined,
        () => {
          // If texture not found, continue without it
          console.warn(`Texture not found: ${path}`);
          resolve();
        }
      );
    });
  }

  getBlockTextures(blockType: BlockType): { top?: THREE.Texture; side?: THREE.Texture; bottom?: THREE.Texture } | null {
    const mapping = this.blockTextureMap[blockType];
    if (!mapping) return null;

    return {
      top: mapping.top ? this.textures.get(mapping.top) : undefined,
      side: mapping.side ? this.textures.get(mapping.side) : undefined,
      bottom: mapping.bottom ? this.textures.get(mapping.bottom) : undefined,
    };
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

// Create singleton instance
export const texturePack = new TexturePack();
