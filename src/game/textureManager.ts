import * as THREE from 'three';
import { BlockType } from './constants';

// ── Face directions matching the renderer ──
export type FaceDir = 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west';

// ── Per-face texture definition ──
interface BlockTextureDef {
  top: string;
  bottom: string;
  north: string;
  south: string;
  east: string;
  west: string;
}

// ── Helpers to define textures concisely ──
function allFaces(f: string): BlockTextureDef {
  return { top: f, bottom: f, north: f, south: f, east: f, west: f };
}
function topSideBottom(t: string, s: string, b: string): BlockTextureDef {
  return { top: t, bottom: b, north: s, south: s, east: s, west: s };
}
function withFront(t: string, side: string, b: string, front: string): BlockTextureDef {
  return { top: t, bottom: b, north: front, south: side, east: side, west: side };
}

// ── Complete per-face texture definitions for every block ──
const BLOCK_TEXTURES: Partial<Record<BlockType, BlockTextureDef>> = {
  // Terrain
  [BlockType.GRASS]:       topSideBottom('grass_block_top.png', 'grass_block_side.png', 'dirt.png'),
  [BlockType.DIRT]:        allFaces('dirt.png'),
  [BlockType.STONE]:       allFaces('stone.png'),
  [BlockType.BEDROCK]:     allFaces('bedrock.png'),
  [BlockType.SAND]:        allFaces('sand.png'),
  [BlockType.GRAVEL]:      allFaces('gravel.png'),
  [BlockType.CLAY]:        allFaces('clay.png'),
  [BlockType.SNOW]:        allFaces('snow.png'),

  // Logs - All wood types
  [BlockType.WOOD]:        topSideBottom('oak_log_top.png', 'oak_log.png', 'oak_log_top.png'),
  [BlockType.LOG_BIRCH]:   topSideBottom('birch_log_top.png', 'birch_log.png', 'birch_log_top.png'),
  [BlockType.LOG_SPRUCE]:  topSideBottom('spruce_log_top.png', 'spruce_log.png', 'spruce_log_top.png'),
  [BlockType.LOG_JUNGLE]:  topSideBottom('jungle_log_top.png', 'jungle_log.png', 'jungle_log_top.png'),
  [BlockType.LOG_ACACIA]:  topSideBottom('acacia_log_top.png', 'acacia_log.png', 'acacia_log_top.png'),
  [BlockType.LOG_DARK_OAK]:topSideBottom('dark_oak_log_top.png', 'dark_oak_log.png', 'dark_oak_log_top.png'),
  [BlockType.LOG_CHERRY]:  topSideBottom('cherry_log_top.png', 'cherry_log.png', 'cherry_log_top.png'),

  // Planks - All wood types
  [BlockType.PLANKS]:        allFaces('oak_planks.png'),
  [BlockType.PLANKS_SPRUCE]: allFaces('spruce_planks.png'),
  [BlockType.PLANKS_BIRCH]:  allFaces('birch_planks.png'),
  [BlockType.PLANKS_JUNGLE]: allFaces('jungle_planks.png'),
  [BlockType.PLANKS_ACACIA]: allFaces('acacia_planks.png'),
  [BlockType.PLANKS_DARK_OAK]: allFaces('dark_oak_planks.png'),
  [BlockType.PLANKS_CHERRY]: allFaces('cherry_planks.png'),
  [BlockType.COBBLESTONE]: allFaces('cobblestone.png'),
  [BlockType.MOSSY_COBBLE]:allFaces('mossy_cobblestone.png'),
  [BlockType.BRICK]:       allFaces('bricks.png'),
  [BlockType.GLASS]:       allFaces('glass.png'),
  [BlockType.ICE]:         allFaces('ice.png'),
  [BlockType.OBSIDIAN]:    allFaces('obsidian.png'),
  [BlockType.BOOKSHELF]:   topSideBottom('oak_planks.png', 'bookshelf.png', 'oak_planks.png'),

  // Ores / Mineral Blocks
  [BlockType.IRON_BLOCK]:    allFaces('iron_block.png'),
  [BlockType.GOLD_BLOCK]:    allFaces('gold_block.png'),
  [BlockType.DIAMOND_BLOCK]: allFaces('diamond_block.png'),
  [BlockType.REDSTONE_BLOCK]:allFaces('redstone_block.png'),
  [BlockType.LAPIS_BLOCK]:   allFaces('lapis_block.png'),
  [BlockType.GLOWSTONE]:     allFaces('glowstone.png'),

  // Functional blocks
  [BlockType.CRAFTING_TABLE]: withFront('crafting_table_top.png', 'crafting_table_side.png', 'oak_planks.png', 'crafting_table_front.png'),
  [BlockType.FURNACE]:        withFront('furnace_top.png', 'furnace_side.png', 'furnace_top.png', 'furnace_front.png'),
  [BlockType.TNT]:            topSideBottom('tnt_top.png', 'tnt_side.png', 'tnt_bottom.png'),
  [BlockType.NOTE_BLOCK]:     allFaces('note_block.png'),
  [BlockType.COMMAND_BLOCK]:  allFaces('command_block.png'),

  // Piston
  [BlockType.PISTON]:  topSideBottom('piston_top.png', 'piston_side.png', 'piston_bottom.png'),

  // Wool
  [BlockType.WOOL_WHITE]:  allFaces('white_wool.png'),
  [BlockType.WOOL_RED]:    allFaces('red_wool.png'),
  [BlockType.WOOL_BLUE]:   allFaces('blue_wool.png'),
  [BlockType.WOOL_GREEN]:  allFaces('green_wool.png'),
  [BlockType.WOOL_YELLOW]: allFaces('yellow_wool.png'),

  // Redstone
  [BlockType.REDSTONE_LAMP]: allFaces('redstone_lamp.png'),
  [BlockType.OBSERVER]:      withFront('furnace_top.png', 'stone.png', 'furnace_top.png', 'dropper_front.png'),

  // Leaves - All wood types
  [BlockType.LEAVES]:         allFaces('oak_leaves.png'),
  [BlockType.LEAVES_BIRCH]:   allFaces('birch_leaves.png'),
  [BlockType.LEAVES_SPRUCE]:  allFaces('spruce_leaves.png'),
  [BlockType.LEAVES_JUNGLE]:  allFaces('jungle_leaves.png'),
  [BlockType.LEAVES_ACACIA]:  allFaces('acacia_leaves.png'),
  [BlockType.LEAVES_DARK_OAK]:allFaces('dark_oak_leaves.png'),
  [BlockType.LEAVES_CHERRY]:  allFaces('cherry_leaves.png'),

  // Cactus
  [BlockType.CACTUS]: topSideBottom('cactus_top.png', 'cactus_side.png', 'cactus_bottom.png'),
  [BlockType.DOOR_OAK]: topSideBottom('oak_door_top.png', 'oak_door_top.png', 'oak_door_bottom.png'),
  [BlockType.FENCE_OAK]: allFaces('oak_planks.png'),
  [BlockType.BUTTON]: allFaces('stone.png'),

  // Portal
  [BlockType.PORTAL]:       allFaces('nether_portal.png'),
  [BlockType.PORTAL_FRAME]: topSideBottom('end_portal_frame_top.png', 'end_portal_frame_side.png', 'end_stone.png'),

  // Stone variants with top/bottom/side
  [BlockType.SANDSTONE]:     topSideBottom('sandstone_top.png', 'sandstone.png', 'sandstone_bottom.png'),
  [BlockType.RED_SANDSTONE]: topSideBottom('red_sandstone_top.png', 'red_sandstone.png', 'red_sandstone_bottom.png'),
  [BlockType.QUARTZ_BLOCK]:  topSideBottom('quartz_block_top.png', 'quartz_block_side.png', 'quartz_block_bottom.png'),
  [BlockType.QUARTZ_PILLAR]: topSideBottom('quartz_pillar_top.png', 'quartz_pillar.png', 'quartz_pillar_top.png'),

  // Organic blocks with top/side
  [BlockType.MELON]:     topSideBottom('melon_top.png', 'melon_side.png', 'melon_top.png'),
  [BlockType.PUMPKIN]:   topSideBottom('pumpkin_top.png', 'pumpkin_side.png', 'pumpkin_top.png'),
  [BlockType.HAY_BLOCK]: topSideBottom('hay_block_top.png', 'hay_block_side.png', 'hay_block_top.png'),
  [BlockType.BONE_BLOCK]:topSideBottom('bone_block_top.png', 'bone_block_side.png', 'bone_block_top.png'),

  // Terrain variants
  [BlockType.MYCELIUM]:       topSideBottom('mycelium_top.png', 'mycelium_side.png', 'dirt.png'),
  [BlockType.PODZOL]:         topSideBottom('podzol_top.png', 'podzol_side.png', 'dirt.png'),
  [BlockType.BASALT]:         topSideBottom('basalt_top.png', 'basalt_side.png', 'basalt_top.png'),
  [BlockType.POLISHED_BASALT]:topSideBottom('polished_basalt_top.png', 'polished_basalt_side.png', 'polished_basalt_top.png'),
  [BlockType.DEEPSLATE]:      topSideBottom('deepslate_top.png', 'deepslate.png', 'deepslate_top.png'),
  [BlockType.ANCIENT_DEBRIS]: topSideBottom('ancient_debris_top.png', 'ancient_debris_side.png', 'ancient_debris_top.png'),

  // Functional blocks with special faces
  [BlockType.LODESTONE]:       topSideBottom('lodestone_top.png', 'lodestone_side.png', 'lodestone_top.png'),
  [BlockType.TARGET]:          topSideBottom('target_top.png', 'target_side.png', 'target_top.png'),
  [BlockType.JUKEBOX]:         topSideBottom('jukebox_top.png', 'jukebox_side.png', 'jukebox_side.png'),
  [BlockType.ENCHANTING_TABLE]:topSideBottom('enchanting_table_top.png', 'enchanting_table_side.png', 'enchanting_table_bottom.png'),
  [BlockType.ANVIL]:           topSideBottom('anvil_top.png', 'anvil.png', 'anvil.png'),
  [BlockType.HOPPER]:          topSideBottom('hopper_top.png', 'hopper_outside.png', 'hopper_outside.png'),
  [BlockType.CAULDRON]:        topSideBottom('cauldron_top.png', 'cauldron_side.png', 'cauldron_bottom.png'),
  [BlockType.CAKE]:            topSideBottom('cake_top.png', 'cake_side.png', 'cake_bottom.png'),
};

// ── Decorative block textures (cross-plane rendered) ──
const DECORATIVE_TEXTURES: Partial<Record<BlockType, string>> = {
  [BlockType.FLOWER_RED]:     'poppy.png',
  [BlockType.FLOWER_YELLOW]:  'dandelion.png',
  [BlockType.TALL_GRASS]:     'short_grass.png',
  [BlockType.FERN]:           'fern.png',
  [BlockType.MUSHROOM_RED]:   'red_mushroom.png',
  [BlockType.MUSHROOM_BROWN]: 'brown_mushroom.png',
  [BlockType.SUGAR_CANE]:     'sugar_cane.png',
  [BlockType.SUNFLOWER]:      'sunflower_front.png',
  [BlockType.ROSE_BUSH]:      'rose_bush_top.png',
  [BlockType.LILAC]:          'lilac_top.png',
  [BlockType.LILY_PAD]:       'lily_pad.png',
  [BlockType.TORCH]:          'torch.png',
  [BlockType.REDSTONE_TORCH]: 'redstone_torch.png',
  [BlockType.LEVER]:          'lever.png',
  [BlockType.REDSTONE_DUST]:  'redstone_dust_dot.png',
  [BlockType.REDSTONE_REPEATER]: 'repeater.png',
  [BlockType.COMPARATOR]:     'comparator.png',
};

// ── Color fallbacks for blocks without textures ──
const BLOCK_COLORS: Record<number, string> = {
  [BlockType.GRASS]: '#5cb832',
  [BlockType.DIRT]: '#8b6914',
  [BlockType.STONE]: '#888888',
  [BlockType.BEDROCK]: '#333333',
  [BlockType.WOOD]: '#9a7a4a',
  [BlockType.LOG_BIRCH]: '#ccbb99',
  [BlockType.LEAVES]: '#35922e',
  [BlockType.LEAVES_BIRCH]: '#5aaa40',
  [BlockType.SAND]: '#f0e0a0',
  [BlockType.COBBLESTONE]: '#6a6a6a',
  [BlockType.PLANKS]: '#b8945a',
  [BlockType.GLASS]: '#c8e8ff',
  [BlockType.BRICK]: '#9b4a2a',
  [BlockType.REDSTONE_BLOCK]: '#bb0000',
  [BlockType.REDSTONE_LAMP]: '#cc8833',
  [BlockType.IRON_BLOCK]: '#dddddd',
  [BlockType.GOLD_BLOCK]: '#ffdd44',
  [BlockType.DIAMOND_BLOCK]: '#55eeff',
  [BlockType.CRAFTING_TABLE]: '#aa8844',
  [BlockType.FURNACE]: '#666666',
  [BlockType.TORCH]: '#ffaa33',
  [BlockType.WOOL_WHITE]: '#f0f0f0',
  [BlockType.WOOL_RED]: '#dd3333',
  [BlockType.WOOL_BLUE]: '#3355dd',
  [BlockType.WOOL_GREEN]: '#33bb33',
  [BlockType.WOOL_YELLOW]: '#eedd33',
  [BlockType.SNOW]: '#ffffff',
  [BlockType.ICE]: '#bbddff',
  [BlockType.OBSIDIAN]: '#1a1028',
  [BlockType.GLOWSTONE]: '#ffee88',
  [BlockType.BOOKSHELF]: '#b8945a',
  [BlockType.MOSSY_COBBLE]: '#5a7a5a',
  [BlockType.TNT]: '#ee4433',
  [BlockType.GRAVEL]: '#777777',
  [BlockType.CLAY]: '#9999aa',
  [BlockType.COMMAND_BLOCK]: '#cc8844',
  [BlockType.PORTAL]: '#9b59b6',
  [BlockType.PORTAL_FRAME]: '#2c3e50',
  [BlockType.WATER]: '#2266bb',
  [BlockType.REDSTONE_DUST]: '#cc0000',
  [BlockType.REDSTONE_TORCH]: '#ff4400',
  [BlockType.FLOWER_RED]: '#ff3333',
  [BlockType.FLOWER_YELLOW]: '#ffdd33',
  [BlockType.TALL_GRASS]: '#3d9e2a',
  [BlockType.FERN]: '#2d8826',
  [BlockType.MUSHROOM_RED]: '#cc2222',
  [BlockType.MUSHROOM_BROWN]: '#8b6b4a',
  [BlockType.SUGAR_CANE]: '#88cc55',
  [BlockType.CACTUS]: '#2d8a2d',
  [BlockType.SUNFLOWER]: '#ffcc00',
  [BlockType.ROSE_BUSH]: '#cc2255',
  [BlockType.LILAC]: '#cc88dd',
  [BlockType.LILY_PAD]: '#228822',
  [BlockType.NOTE_BLOCK]: '#7b5533',
  [BlockType.LAPIS_BLOCK]: '#2244cc',
  [BlockType.PISTON]: '#bbaa77',
  [BlockType.LEVER]: '#777766',
  [BlockType.BUTTON]: '#aaaaaa',
  [BlockType.OBSERVER]: '#5a5a5a',
  [BlockType.COMPARATOR]: '#885555',
  [BlockType.REDSTONE_REPEATER]: '#884444',
  [BlockType.DOOR_OAK]: '#9a7a4a',
  [BlockType.FENCE_OAK]: '#b8945a',
  [BlockType.STICK]: '#8b5a2b',
  [BlockType.LEAVES_BIRCH]: '#5aaa40',
};

// ── Atlas configuration ──
const ATLAS_CELL = 16;   // pixels per cell
const ATLAS_COLS = 16;   // columns in atlas

class TextureManager {
  private atlas: THREE.CanvasTexture | null = null;
  // Map from texture filename → atlas slot {col, row}
  private slotMap = new Map<string, { col: number; row: number }>();
  private atlasRows = 0;
  private atlasReady = false;
  private customFileTextures = new Map<string, string>();

  // ── Build the texture atlas ──
  async preloadDefaultTextures(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    // 1. Collect all unique texture filenames
    const uniqueFiles = new Set<string>();
    for (const def of Object.values(BLOCK_TEXTURES)) {
      if (def) {
        uniqueFiles.add(def.top);
        uniqueFiles.add(def.bottom);
        uniqueFiles.add(def.north);
        uniqueFiles.add(def.south);
        uniqueFiles.add(def.east);
        uniqueFiles.add(def.west);
      }
    }
    for (const file of Object.values(DECORATIVE_TEXTURES)) {
      if (file) uniqueFiles.add(file);
    }

    const fileList = Array.from(uniqueFiles);
    this.atlasRows = Math.ceil(fileList.length / ATLAS_COLS);

    // 2. Assign atlas slots
    fileList.forEach((file, i) => {
      this.slotMap.set(file, { col: i % ATLAS_COLS, row: Math.floor(i / ATLAS_COLS) });
    });

    // 3. Create atlas canvas
    const cw = ATLAS_COLS * ATLAS_CELL;
    const ch = this.atlasRows * ATLAS_CELL;
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    // 4. Procedurally draw all textures into atlas (16x16 each)
    let loaded = 0;
    const total = fileList.length;
    console.log(`[TextureManager] Building procedural atlas with ${total} textures...`);

    for (const file of fileList) {
      const slot = this.slotMap.get(file)!;
      const dx = slot.col * ATLAS_CELL;
      const dy = slot.row * ATLAS_CELL;
      const custom = this.customFileTextures.get(file);
      if (custom) {
        const img = await this.loadImage(custom, 1500);
        if (img) this.drawCustomTextureOpaque(ctx, dx, dy, file, img);
        else this.drawProceduralTexture(ctx, dx, dy, file);
      } else {
        this.drawProceduralTexture(ctx, dx, dy, file);
      }

      loaded++;
      if (onProgress) onProgress(loaded, total);
      if (loaded % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }

    // 5. Create THREE texture from canvas
    this.atlas = new THREE.CanvasTexture(canvas);
    this.atlas.magFilter = THREE.NearestFilter;
    this.atlas.minFilter = THREE.NearestFilter;
    this.atlas.wrapS = THREE.ClampToEdgeWrapping;
    this.atlas.wrapT = THREE.ClampToEdgeWrapping;
    this.atlas.colorSpace = THREE.SRGBColorSpace;
    this.atlas.needsUpdate = true;
    this.atlasReady = true;
    console.log(`[TextureManager] Procedural atlas built: ${cw}x${ch}`);
  }

  private drawProceduralTexture(ctx: CanvasRenderingContext2D, dx: number, dy: number, file: string) {
    const name = file.toLowerCase();
    const p = this.getFallbackPalette(name);
    let seed = file.length * 97 + 13;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const pixel = (x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(dx + x, dy + y, 1, 1);
    };
    const speckle = (count: number, colors: string[]) => {
      for (let i = 0; i < count; i++) {
        const px = Math.floor(rand() * ATLAS_CELL);
        const py = Math.floor(rand() * ATLAS_CELL);
        pixel(px, py, colors[Math.floor(rand() * colors.length)]);
      }
    };
    const edgeShade = () => {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(dx, dy, ATLAS_CELL, 1);
      ctx.fillRect(dx, dy, 1, ATLAS_CELL);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(dx, dy + ATLAS_CELL - 1, ATLAS_CELL, 1);
      ctx.fillRect(dx + ATLAS_CELL - 1, dy, 1, ATLAS_CELL);
    };

    ctx.fillStyle = p.base;
    ctx.fillRect(dx, dy, ATLAS_CELL, ATLAS_CELL);
    if (name.includes('grass_block_top')) {
      speckle(90, [p.base, p.accent, p.shadow, '#6fba4a']);
    } else if (name.includes('grass_block_side')) {
      ctx.fillStyle = '#6fba4a';
      ctx.fillRect(dx, dy, ATLAS_CELL, 4);
      ctx.fillStyle = '#5fa03f';
      ctx.fillRect(dx, dy + 4, ATLAS_CELL, 1);
      speckle(70, ['#8a6a36', p.base, p.accent, p.shadow]);
    } else if (name.includes('log_top') || name.includes('wood_top')) {
      const cx = dx + 8;
      const cy = dy + 8;
      ctx.strokeStyle = p.shadow;
      for (let r = 2; r <= 7; r += 2) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      speckle(25, [p.accent, p.shadow]);
    } else if (name.includes('log') || name.includes('planks') || name.includes('wood') || name.includes('bookshelf')) {
      for (let y = 1; y < ATLAS_CELL; y += 3) {
        ctx.fillStyle = y % 2 === 0 ? p.shadow : p.accent;
        ctx.fillRect(dx, dy + y, ATLAS_CELL, 1);
      }
      speckle(32, [p.base, p.shadow, p.accent]);
    } else if (name.includes('brick')) {
      for (let y = 0; y < ATLAS_CELL; y += 4) {
        for (let x = 0; x < ATLAS_CELL; x += 8) {
          const off = (Math.floor(y / 4) % 2) * 4;
          ctx.fillStyle = p.accent;
          ctx.fillRect(dx + x + off, dy + y, 4, 3);
        }
      }
      ctx.fillStyle = p.shadow;
      for (let y = 3; y < ATLAS_CELL; y += 4) ctx.fillRect(dx, dy + y, ATLAS_CELL, 1);
      for (let x = 4; x < ATLAS_CELL; x += 8) ctx.fillRect(dx + x, dy, 1, ATLAS_CELL);
    } else if (name.includes('stone') || name.includes('deepslate') || name.includes('bedrock') || name.includes('cobble') || name.includes('obsidian') || name.includes('ore')) {
      speckle(105, [p.base, p.accent, p.shadow]);
    } else if (name.includes('iron_block') || name.includes('gold_block') || name.includes('diamond_block') || name.includes('lapis_block') || name.includes('redstone_block')) {
      for (let y = 0; y < ATLAS_CELL; y += 4) {
        ctx.fillStyle = y % 8 === 0 ? p.accent : p.base;
        ctx.fillRect(dx, dy + y, ATLAS_CELL, 2);
      }
      speckle(26, [p.accent, '#ffffff33', p.shadow]);
    } else if (name.includes('sand') || name.includes('gravel') || name.includes('clay') || name.includes('snow')) {
      speckle(85, [p.base, p.accent, p.shadow]);
    } else if (name.includes('leaves') || name.includes('fern') || name.includes('grass') || name.includes('sugar_cane') || name.includes('cactus')) {
      speckle(88, [p.base, p.accent, p.shadow, '#6dc451']);
    } else if (name.includes('glass') || name.includes('ice')) {
      ctx.fillStyle = p.base;
      ctx.fillRect(dx, dy, ATLAS_CELL, ATLAS_CELL);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.strokeRect(dx + 0.5, dy + 0.5, ATLAS_CELL - 1, ATLAS_CELL - 1);
      for (let i = 2; i < 14; i += 4) pixel(i, 2 + (i % 3), 'rgba(255,255,255,0.7)');
    } else if (name.includes('wool')) {
      for (let y = 0; y < ATLAS_CELL; y++) {
        for (let x = 0; x < ATLAS_CELL; x++) {
          const checker = (x + y) % 2 === 0 ? p.base : p.accent;
          pixel(x, y, checker);
        }
      }
      speckle(22, [p.shadow]);
    } else if (name.includes('water') || name.includes('portal')) {
      for (let y = 0; y < ATLAS_CELL; y++) {
        const bright = y % 3 === 0 ? p.accent : p.base;
        ctx.fillStyle = bright;
        ctx.fillRect(dx, dy + y, ATLAS_CELL, 1);
      }
      speckle(20, [p.shadow, p.accent]);
    } else if (name.includes('furnace') || name.includes('crafting_table') || name.includes('command_block') || name.includes('note_block') || name.includes('target') || name.includes('jukebox') || name.includes('piston') || name.includes('anvil') || name.includes('cauldron') || name.includes('hopper')) {
      for (let y = 0; y < ATLAS_CELL; y += 4) {
        ctx.fillStyle = y % 8 === 0 ? p.shadow : p.accent;
        ctx.fillRect(dx + 1, dy + y, ATLAS_CELL - 2, 1);
      }
      for (let x = 0; x < ATLAS_CELL; x += 4) {
        ctx.fillStyle = x % 8 === 0 ? p.shadow : p.base;
        ctx.fillRect(dx + x, dy + 1, 1, ATLAS_CELL - 2);
      }
      speckle(24, [p.base, p.shadow, p.accent]);
    } else {
      speckle(80, [p.base, p.accent, p.shadow]);
    }
    edgeShade();
  }

  private drawCustomTextureOpaque(
    ctx: CanvasRenderingContext2D,
    dx: number,
    dy: number,
    file: string,
    img: HTMLImageElement
  ) {
    const p = this.getFallbackPalette(file.toLowerCase());
    ctx.fillStyle = p.base;
    ctx.fillRect(dx, dy, ATLAS_CELL, ATLAS_CELL);
    ctx.drawImage(img, dx, dy, ATLAS_CELL, ATLAS_CELL);
  }

  private getFallbackPalette(file: string): { base: string; accent: string; shadow: string } {
    const name = file.toLowerCase();
    if (name.includes('grass_block_top')) return { base: '#5fb63f', accent: '#7ccc59', shadow: '#3f8a2b' };
    if (name.includes('grass_block_side')) return { base: '#7a5f28', accent: '#927639', shadow: '#5d471b' };
    if (name.includes('dirt') || name.includes('podzol') || name.includes('mycelium')) return { base: '#7b5d2d', accent: '#937142', shadow: '#5e441f' };
    if (name.includes('stone') || name.includes('deepslate') || name.includes('cobble') || name.includes('andesite') || name.includes('diorite') || name.includes('granite')) {
      return { base: '#7f7f7f', accent: '#999999', shadow: '#606060' };
    }
    if (name.includes('sand')) return { base: '#e2cf8c', accent: '#efe0a8', shadow: '#c9b574' };
    if (name.includes('water')) return { base: '#2a70d2', accent: '#4a8fe6', shadow: '#1f54a0' };
    if (name.includes('grass') || name.includes('fern') || name.includes('leaves') || name.includes('cactus')) return { base: '#4ea93d', accent: '#70c857', shadow: '#32762a' };
    if (name.includes('log') || name.includes('planks') || name.includes('wood')) return { base: '#8b6c3e', accent: '#a38252', shadow: '#674d2a' };
    if (name.includes('glass') || name.includes('ice')) return { base: '#99cbe4', accent: '#c0e5f7', shadow: '#6ea0bd' };
    if (name.includes('iron_block')) return { base: '#c7c9cc', accent: '#e5e7eb', shadow: '#8e9299' };
    if (name.includes('gold_block')) return { base: '#d8b43e', accent: '#f2d66e', shadow: '#94741e' };
    if (name.includes('diamond_block')) return { base: '#47bfd0', accent: '#7ce7f4', shadow: '#248391' };
    if (name.includes('lapis_block')) return { base: '#2f5dc9', accent: '#5e83dd', shadow: '#1d3d8b' };
    if (name.includes('redstone_block')) return { base: '#b7372b', accent: '#e25f4d', shadow: '#7b2018' };
    if (name.includes('flower') || name.includes('poppy') || name.includes('rose') || name.includes('mushroom')) return { base: '#b73a3a', accent: '#db6666', shadow: '#7c1f1f' };
    if (name.includes('torch') || name.includes('redstone')) return { base: '#9f5c2e', accent: '#f0af57', shadow: '#5f3113' };
    if (name.includes('wool')) return { base: '#b0b0b0', accent: '#cfcfcf', shadow: '#8a8a8a' };
    if (name.includes('lava') || name.includes('magma')) return { base: '#cf5a18', accent: '#f28f2d', shadow: '#8b340c' };
    return { base: '#7b4f9e', accent: '#9963bf', shadow: '#5e3b78' };
  }

  // ── Get UV coordinates for a block face ──
  // Returns [u0, v0, u1, v1] for the atlas region
  getBlockFaceUVs(blockType: BlockType, face: FaceDir): [number, number, number, number] | null {
    const def = BLOCK_TEXTURES[blockType];
    if (!def || !this.atlasReady) return null;

    const file = def[face];
    const slot = this.slotMap.get(file);
    if (!slot) return null;

    const cw = ATLAS_COLS;
    const ch = this.atlasRows;
    const u0 = slot.col / cw;
    const v0 = slot.row / ch;
    const u1 = (slot.col + 1) / cw;
    const v1 = (slot.row + 1) / ch;
    return [u0, v0, u1, v1];
  }

  // ── Get UV coordinates for a decorative block ──
  getDecorativeUVs(blockType: BlockType): [number, number, number, number] | null {
    const file = DECORATIVE_TEXTURES[blockType];
    if (!file || !this.atlasReady) return null;

    const slot = this.slotMap.get(file);
    if (!slot) return null;

    const cw = ATLAS_COLS;
    const ch = this.atlasRows;
    return [slot.col / cw, slot.row / ch, (slot.col + 1) / cw, (slot.row + 1) / ch];
  }

  // ── Check if atlas has textures for a block ──
  hasBlockTexture(blockType: BlockType): boolean {
    return !!BLOCK_TEXTURES[blockType] && this.atlasReady;
  }
  isBlockCustomized(blockType: BlockType): boolean {
    const def = BLOCK_TEXTURES[blockType];
    if (!def) return false;
    return !!(
      this.customFileTextures.has(def.top) ||
      this.customFileTextures.has(def.bottom) ||
      this.customFileTextures.has(def.north) ||
      this.customFileTextures.has(def.south) ||
      this.customFileTextures.has(def.east) ||
      this.customFileTextures.has(def.west)
    );
  }
  hasDecorativeTexture(blockType: BlockType): boolean {
    return !!DECORATIVE_TEXTURES[blockType] && this.atlasReady;
  }

  // ── Get the atlas THREE.Texture ──
  getAtlasTexture(): THREE.CanvasTexture | null {
    return this.atlas;
  }

  isReady(): boolean {
    return this.atlasReady;
  }

  // ── Color fallback ──
  getColor(blockType: BlockType): string {
    return BLOCK_COLORS[blockType] || '#ff00ff';
  }

  // ── Legacy API for compatibility ──
  getTexture(_blockType: BlockType): THREE.Texture | null {
    return null; // Not used anymore; atlas approach replaces this
  }
  isUsingTextures(): boolean { return this.atlasReady; }
  getLoadedCount(): number { return this.slotMap.size; }

  getBlockTextureDef(blockType: BlockType): BlockTextureDef | null {
    return BLOCK_TEXTURES[blockType] || null;
  }

  async setCustomFaceTexture(blockType: BlockType, face: FaceDir, dataUrl: string): Promise<boolean> {
    const def = BLOCK_TEXTURES[blockType];
    if (!def) return false;
    this.customFileTextures.set(def[face], dataUrl);
    await this.reloadDefaultTextures();
    return true;
  }

  clearCustomTextures() {
    this.customFileTextures.clear();
  }

  async clearBlockCustomTexture(blockType: BlockType): Promise<boolean> {
    const def = BLOCK_TEXTURES[blockType];
    if (!def) return false;
    this.customFileTextures.delete(def.top);
    this.customFileTextures.delete(def.bottom);
    this.customFileTextures.delete(def.north);
    this.customFileTextures.delete(def.south);
    this.customFileTextures.delete(def.east);
    this.customFileTextures.delete(def.west);
    await this.reloadDefaultTextures();
    return true;
  }

  async clearBlockCustomTextureBatch(blockTypes: BlockType[]): Promise<void> {
    let changed = false;
    for (const blockType of blockTypes) {
      const def = BLOCK_TEXTURES[blockType];
      if (!def) continue;
      changed = this.customFileTextures.delete(def.top) || changed;
      changed = this.customFileTextures.delete(def.bottom) || changed;
      changed = this.customFileTextures.delete(def.north) || changed;
      changed = this.customFileTextures.delete(def.south) || changed;
      changed = this.customFileTextures.delete(def.east) || changed;
      changed = this.customFileTextures.delete(def.west) || changed;
    }
    if (changed) await this.reloadDefaultTextures();
  }

  async loadCustomTexture(blockType: BlockType, url: string): Promise<boolean> {
    const def = BLOCK_TEXTURES[blockType];
    if (!def) return false;
    this.customFileTextures.set(def.top, url);
    this.customFileTextures.set(def.bottom, url);
    this.customFileTextures.set(def.north, url);
    this.customFileTextures.set(def.south, url);
    this.customFileTextures.set(def.east, url);
    this.customFileTextures.set(def.west, url);
    await this.reloadDefaultTextures();
    return true;
  }
  async reloadDefaultTextures(clearCustom = false): Promise<void> {
    if (clearCustom) this.clearCustomTextures();
    this.atlas = null;
    this.slotMap.clear();
    this.atlasReady = false;
    await this.preloadDefaultTextures();
  }

  // ── Internal helpers ──
  private async findWorkingPath(): Promise<string> {
    const base = import.meta.env.BASE_URL || '/';
    const fromBase = `${base.replace(/\/?$/, '/')}assets/block/`;
    const candidates = Array.from(new Set([fromBase, '/assets/block/', './assets/block/', 'assets/block/']));
    for (const p of candidates) {
      const probe = await this.loadImage(`${p}stone.png`, 1500);
      if (probe) return p;
    }
    console.warn('[TextureManager] Could not auto-detect asset path, using default:', fromBase);
    return fromBase;
  }

  private getPathCandidates(primaryPath: string): string[] {
    const base = import.meta.env.BASE_URL || '/';
    const fromBase = `${base.replace(/\/?$/, '/')}assets/block/`;
    return Array.from(new Set([primaryPath, fromBase, '/assets/block/', './assets/block/', 'assets/block/']));
  }

  private async loadImageFromCandidates(file: string, paths: string[], timeoutMs: number): Promise<HTMLImageElement | null> {
    for (const p of paths) {
      const img = await this.loadImage(`${p}${file}`, timeoutMs);
      if (img) return img;
    }
    return null;
  }

  private loadImage(url: string, timeoutMs: number): Promise<HTMLImageElement | null> {
    return new Promise(resolve => {
      const img = new Image();
      let done = false;
      const timer = window.setTimeout(() => finish(null), timeoutMs);
      const finish = (result: HTMLImageElement | null) => {
        if (!done) {
          done = true;
          window.clearTimeout(timer);
          resolve(result);
        }
      };
      img.onload = () => finish(img);
      img.onerror = () => finish(null);
      img.src = url;
    });
  }
}

export const textureManager = new TextureManager();
export { BLOCK_COLORS, BLOCK_TEXTURES, DECORATIVE_TEXTURES };
