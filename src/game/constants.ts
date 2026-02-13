export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 80;
export const RENDER_DISTANCE = 8;
export const SEA_LEVEL = 30;
export const BEDROCK_LEVEL = 0;
export const PLAYER_HEIGHT = 1.7;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_EYE_HEIGHT = 1.5;
export const GRAVITY = 20;
export const JUMP_FORCE = 8;
export const PLAYER_SPEED = 5;
export const FLY_SPEED = 12;
export const WATER_LEVEL = 28;

export enum BlockType {
  AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, BEDROCK = 4,
  WOOD = 5, LEAVES = 6, SAND = 7, WATER = 8,
  FLOWER_RED = 9, FLOWER_YELLOW = 10, TALL_GRASS = 11,
  MUSHROOM_RED = 12, MUSHROOM_BROWN = 13,
  COBBLESTONE = 14, PLANKS = 15, GLASS = 16, BRICK = 17,
  REDSTONE_DUST = 18, REDSTONE_TORCH = 19, REDSTONE_BLOCK = 20,
  REDSTONE_LAMP = 21, REDSTONE_REPEATER = 22,
  LEVER = 23, BUTTON = 24, PISTON = 25, TNT = 26,
  OBSERVER = 27, COMPARATOR = 28, NOTE_BLOCK = 29,
  IRON_BLOCK = 30, GOLD_BLOCK = 31, DIAMOND_BLOCK = 32,
  CRAFTING_TABLE = 33, FURNACE = 34, TORCH = 35,
  WOOL_WHITE = 36, WOOL_RED = 37, WOOL_BLUE = 38,
  WOOL_GREEN = 39, WOOL_YELLOW = 40,
  LOG_BIRCH = 41, SNOW = 42, ICE = 43, OBSIDIAN = 44,
  GLOWSTONE = 45, BOOKSHELF = 46, MOSSY_COBBLE = 47,
  FERN = 48, SUGAR_CANE = 49, CACTUS = 50,
  SUNFLOWER = 51, ROSE_BUSH = 52, LILAC = 53, LILY_PAD = 54,
  DOOR_OAK = 55, FENCE_OAK = 56, GRAVEL = 57, CLAY = 58,
  LEAVES_BIRCH = 59, STICK = 60, LAPIS_BLOCK = 61,
  COMMAND_BLOCK = 62, PORTAL = 63, PORTAL_FRAME = 64,
  // Additional wood types
  LOG_SPRUCE = 65, LOG_JUNGLE = 66, LOG_ACACIA = 67,
  LOG_DARK_OAK = 68, LOG_CHERRY = 69,
  PLANKS_SPRUCE = 70, PLANKS_BIRCH = 71, PLANKS_JUNGLE = 72,
  PLANKS_ACACIA = 73, PLANKS_DARK_OAK = 74, PLANKS_CHERRY = 75,
  LEAVES_SPRUCE = 76, LEAVES_JUNGLE = 77, LEAVES_ACACIA = 78,
  LEAVES_DARK_OAK = 79, LEAVES_CHERRY = 80,
  // Stone variants
  SANDSTONE = 81, RED_SANDSTONE = 82,
  QUARTZ_BLOCK = 83, QUARTZ_PILLAR = 84,
  // Organic blocks with faces
  MELON = 85, PUMPKIN = 86,
  HAY_BLOCK = 87, BONE_BLOCK = 88,
  // Terrain variants
  MYCELIUM = 89, PODZOL = 90,
  BASALT = 91, POLISHED_BASALT = 92,
  DEEPSLATE = 93, ANCIENT_DEBRIS = 94,
  // More functional blocks
  LODESTONE = 95, TARGET = 96,
  JUKEBOX = 97, ENCHANTING_TABLE = 98,
  ANVIL = 99, HOPPER = 100,
  CAULDRON = 101, CAKE = 102,
}

// Tools
export enum ToolType {
  NONE = 0, SWORD = 1, AXE = 2, PICKAXE = 3, SHOVEL = 4,
}

export const TOOL_NAMES: Record<number, string> = {
  [ToolType.NONE]: 'Hand',
  [ToolType.SWORD]: 'Diamond Sword',
  [ToolType.AXE]: 'Diamond Axe',
  [ToolType.PICKAXE]: 'Diamond Pickaxe',
  [ToolType.SHOVEL]: 'Diamond Shovel',
};

export const TOOL_COLORS: Record<number, string> = {
  [ToolType.SWORD]: '#44ddee',
  [ToolType.AXE]: '#44ddee',
  [ToolType.PICKAXE]: '#44ddee',
  [ToolType.SHOVEL]: '#44ddee',
};

// Colors for each face type: [top, side, bottom]
export const BLOCK_FACE_COLORS: Record<number, [string, string, string]> = {
  [BlockType.GRASS]:       ['#5cb832', '#6b8c3e', '#8b6914'],
  [BlockType.DIRT]:        ['#8b6914', '#7a5c12', '#6b4e10'],
  [BlockType.STONE]:       ['#888888', '#808080', '#707070'],
  [BlockType.BEDROCK]:     ['#333333', '#2a2a2a', '#222222'],
  [BlockType.WOOD]:        ['#9a7a4a', '#6b4226', '#9a7a4a'],
  [BlockType.LEAVES]:      ['#35922e', '#2d7a2d', '#257a20'],
  [BlockType.LEAVES_BIRCH]:['#5aaa40', '#4a9935', '#3a8828'],
  [BlockType.SAND]:        ['#f0e0a0', '#e8d68c', '#d8c67c'],
  [BlockType.WATER]:       ['#1a5faa', '#2266bb', '#1a5faa'],
  [BlockType.COBBLESTONE]: ['#6a6a6a', '#626262', '#555555'],
  [BlockType.PLANKS]:      ['#b8945a', '#a88040', '#987030'],
  [BlockType.GLASS]:       ['#c8e8ff', '#c8e8ff', '#c8e8ff'],
  [BlockType.BRICK]:       ['#9b4a2a', '#8b3a1a', '#7b2a0a'],
  [BlockType.REDSTONE_DUST]:   ['#cc0000', '#aa0000', '#880000'],
  [BlockType.REDSTONE_TORCH]:  ['#ff4400', '#dd2200', '#bb0000'],
  [BlockType.REDSTONE_BLOCK]:  ['#bb0000', '#aa0000', '#880000'],
  [BlockType.REDSTONE_LAMP]:   ['#cc8833', '#bb7722', '#aa6611'],
  [BlockType.REDSTONE_REPEATER]: ['#884444', '#773333', '#662222'],
  [BlockType.LEVER]:       ['#777766', '#666655', '#555544'],
  [BlockType.BUTTON]:      ['#aaaaaa', '#999999', '#888888'],
  [BlockType.PISTON]:      ['#bbaa77', '#aa9966', '#998855'],
  [BlockType.TNT]:         ['#ee4433', '#dd3322', '#cc2211'],
  [BlockType.OBSERVER]:    ['#5a5a5a', '#6b6b6b', '#4a4a4a'],
  [BlockType.COMPARATOR]:  ['#885555', '#774444', '#663333'],
  [BlockType.NOTE_BLOCK]:  ['#7b5533', '#6b4523', '#5b3513'],
  [BlockType.IRON_BLOCK]:  ['#dddddd', '#cccccc', '#bbbbbb'],
  [BlockType.GOLD_BLOCK]:  ['#ffdd44', '#ffcc33', '#eebb22'],
  [BlockType.DIAMOND_BLOCK]: ['#55eeff', '#44ddee', '#33ccdd'],
  [BlockType.CRAFTING_TABLE]: ['#aa8844', '#9b7733', '#886633'],
  [BlockType.FURNACE]:     ['#666666', '#777777', '#555555'],
  [BlockType.TORCH]:       ['#ffaa33', '#dd8811', '#bb6600'],
  [BlockType.WOOL_WHITE]:  ['#f0f0f0', '#eeeeee', '#dddddd'],
  [BlockType.WOOL_RED]:    ['#dd3333', '#cc2222', '#bb1111'],
  [BlockType.WOOL_BLUE]:   ['#3355dd', '#2244cc', '#1133bb'],
  [BlockType.WOOL_GREEN]:  ['#33bb33', '#22aa22', '#119911'],
  [BlockType.WOOL_YELLOW]: ['#eedd33', '#ddcc22', '#ccbb11'],
  [BlockType.LOG_BIRCH]:   ['#ccbb99', '#ddccaa', '#ccbb99'],
  [BlockType.SNOW]:        ['#ffffff', '#f0f0f5', '#e0e0e5'],
  [BlockType.ICE]:         ['#bbddff', '#aaddff', '#99ccff'],
  [BlockType.OBSIDIAN]:    ['#1a1028', '#150d22', '#100a1c'],
  [BlockType.GLOWSTONE]:   ['#ffee88', '#ffdd77', '#ffcc66'],
  [BlockType.BOOKSHELF]:   ['#b8945a', '#8b6b3a', '#b8945a'],
  [BlockType.MOSSY_COBBLE]: ['#5a7a5a', '#4a6a4a', '#3a5a3a'],
  [BlockType.FLOWER_RED]:  ['#ff3333', '#ff3333', '#ff3333'],
  [BlockType.FLOWER_YELLOW]: ['#ffdd33', '#ffdd33', '#ffdd33'],
  [BlockType.TALL_GRASS]:  ['#3d9e2a', '#3d9e2a', '#3d9e2a'],
  [BlockType.MUSHROOM_RED]: ['#cc2222', '#cc2222', '#cc2222'],
  [BlockType.MUSHROOM_BROWN]: ['#8b6b4a', '#8b6b4a', '#8b6b4a'],
  [BlockType.FERN]:        ['#2d8826', '#2d8826', '#2d8826'],
  [BlockType.SUGAR_CANE]:  ['#88cc55', '#77bb44', '#66aa33'],
  [BlockType.CACTUS]:      ['#2d8a2d', '#1e7a1e', '#157015'],
  [BlockType.SUNFLOWER]:   ['#ffcc00', '#ddaa00', '#bb8800'],
  [BlockType.ROSE_BUSH]:   ['#cc2255', '#bb1144', '#aa0033'],
  [BlockType.LILAC]:       ['#cc88dd', '#bb77cc', '#aa66bb'],
  [BlockType.LILY_PAD]:    ['#228822', '#117711', '#006600'],
  [BlockType.DOOR_OAK]:    ['#9a7a4a', '#8b6b3a', '#7c5c2a'],
  [BlockType.FENCE_OAK]:   ['#b8945a', '#a88040', '#987030'],
  [BlockType.GRAVEL]:      ['#777777', '#707070', '#666666'],
  [BlockType.CLAY]:        ['#9999aa', '#8888aa', '#7777aa'],
  [BlockType.STICK]:       ['#8b5a2b', '#8b5a2b', '#8b5a2b'],
  [BlockType.LAPIS_BLOCK]: ['#2244cc', '#1133bb', '#0022aa'],
  [BlockType.COMMAND_BLOCK]: ['#cc8844', '#bb7733', '#aa6622'],
  [BlockType.PORTAL]: ['#9b59b6', '#8e44ad', '#7d3c98'],
  [BlockType.PORTAL_FRAME]: ['#2c3e50', '#34495e', '#2c3e50'],
};

export function getBlockFaceColor(block: BlockType, face: 'top' | 'side' | 'bottom'): string {
  const fc = BLOCK_FACE_COLORS[block];
  if (fc) return face === 'top' ? fc[0] : face === 'bottom' ? fc[2] : fc[1];

  // Deterministic neutral fallback per block type.
  const hue = (Number(block) * 37) % 360;
  const sat = 28;
  const lightBase = 48;
  const light = face === 'top' ? lightBase + 8 : face === 'bottom' ? lightBase - 8 : lightBase;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

export const HOTBAR_BLOCKS = [
  BlockType.GRASS, BlockType.DIRT, BlockType.STONE, BlockType.WOOD,
  BlockType.PLANKS, BlockType.COBBLESTONE, BlockType.SAND,
  BlockType.GLASS, BlockType.BRICK,
];

export const BLOCK_NAMES: Record<number, string> = {
  [BlockType.AIR]: 'Air', [BlockType.GRASS]: 'Grass Block', [BlockType.DIRT]: 'Dirt',
  [BlockType.STONE]: 'Stone', [BlockType.WOOD]: 'Oak Log', [BlockType.PLANKS]: 'Oak Planks',
  [BlockType.COBBLESTONE]: 'Cobblestone', [BlockType.SAND]: 'Sand', [BlockType.GLASS]: 'Glass',
  [BlockType.BRICK]: 'Bricks', [BlockType.LEAVES]: 'Oak Leaves', [BlockType.LEAVES_BIRCH]: 'Birch Leaves',
  [BlockType.BEDROCK]: 'Bedrock', [BlockType.REDSTONE_DUST]: 'Redstone Dust',
  [BlockType.REDSTONE_TORCH]: 'Redstone Torch', [BlockType.REDSTONE_BLOCK]: 'Redstone Block',
  [BlockType.REDSTONE_LAMP]: 'Redstone Lamp', [BlockType.REDSTONE_REPEATER]: 'Repeater',
  [BlockType.LEVER]: 'Lever', [BlockType.BUTTON]: 'Stone Button', [BlockType.PISTON]: 'Piston',
  [BlockType.TNT]: 'TNT', [BlockType.OBSERVER]: 'Observer', [BlockType.COMPARATOR]: 'Comparator',
  [BlockType.NOTE_BLOCK]: 'Note Block', [BlockType.IRON_BLOCK]: 'Iron Block',
  [BlockType.GOLD_BLOCK]: 'Gold Block', [BlockType.DIAMOND_BLOCK]: 'Diamond Block',
  [BlockType.CRAFTING_TABLE]: 'Crafting Table', [BlockType.FURNACE]: 'Furnace',
  [BlockType.TORCH]: 'Torch', [BlockType.WOOL_WHITE]: 'White Wool', [BlockType.WOOL_RED]: 'Red Wool',
  [BlockType.WOOL_BLUE]: 'Blue Wool', [BlockType.WOOL_GREEN]: 'Green Wool',
  [BlockType.WOOL_YELLOW]: 'Yellow Wool', [BlockType.LOG_BIRCH]: 'Birch Log',
  [BlockType.SNOW]: 'Snow Block', [BlockType.ICE]: 'Ice', [BlockType.OBSIDIAN]: 'Obsidian',
  [BlockType.GLOWSTONE]: 'Glowstone', [BlockType.BOOKSHELF]: 'Bookshelf',
  [BlockType.MOSSY_COBBLE]: 'Mossy Cobble', [BlockType.FLOWER_RED]: 'Poppy',
  [BlockType.FLOWER_YELLOW]: 'Dandelion', [BlockType.TALL_GRASS]: 'Tall Grass',
  [BlockType.MUSHROOM_RED]: 'Red Mushroom', [BlockType.MUSHROOM_BROWN]: 'Brown Mushroom',
  [BlockType.WATER]: 'Water', [BlockType.FERN]: 'Fern', [BlockType.SUGAR_CANE]: 'Sugar Cane',
  [BlockType.CACTUS]: 'Cactus', [BlockType.SUNFLOWER]: 'Sunflower', [BlockType.ROSE_BUSH]: 'Rose Bush',
  [BlockType.LILAC]: 'Lilac', [BlockType.LILY_PAD]: 'Lily Pad', [BlockType.DOOR_OAK]: 'Oak Door',
  [BlockType.FENCE_OAK]: 'Oak Fence',   [BlockType.GRAVEL]: 'Gravel', [BlockType.CLAY]: 'Clay',
  [BlockType.STICK]: 'Stick', [BlockType.LAPIS_BLOCK]: 'Lapis Lazuli Block',
  [BlockType.COMMAND_BLOCK]: 'Command Block', [BlockType.PORTAL]: 'Portal',
  [BlockType.PORTAL_FRAME]: 'Portal Frame',
  // Additional wood types
  [BlockType.LOG_SPRUCE]: 'Spruce Log', [BlockType.LOG_JUNGLE]: 'Jungle Log',
  [BlockType.LOG_ACACIA]: 'Acacia Log', [BlockType.LOG_DARK_OAK]: 'Dark Oak Log',
  [BlockType.LOG_CHERRY]: 'Cherry Log',
  [BlockType.PLANKS_SPRUCE]: 'Spruce Planks', [BlockType.PLANKS_BIRCH]: 'Birch Planks',
  [BlockType.PLANKS_JUNGLE]: 'Jungle Planks', [BlockType.PLANKS_ACACIA]: 'Acacia Planks',
  [BlockType.PLANKS_DARK_OAK]: 'Dark Oak Planks', [BlockType.PLANKS_CHERRY]: 'Cherry Planks',
  [BlockType.LEAVES_SPRUCE]: 'Spruce Leaves', [BlockType.LEAVES_JUNGLE]: 'Jungle Leaves',
  [BlockType.LEAVES_ACACIA]: 'Acacia Leaves', [BlockType.LEAVES_DARK_OAK]: 'Dark Oak Leaves',
  [BlockType.LEAVES_CHERRY]: 'Cherry Leaves',
  // Stone variants
  [BlockType.SANDSTONE]: 'Sandstone', [BlockType.RED_SANDSTONE]: 'Red Sandstone',
  [BlockType.QUARTZ_BLOCK]: 'Quartz Block', [BlockType.QUARTZ_PILLAR]: 'Quartz Pillar',
  // Organic blocks
  [BlockType.MELON]: 'Melon', [BlockType.PUMPKIN]: 'Pumpkin',
  [BlockType.HAY_BLOCK]: 'Hay Bale', [BlockType.BONE_BLOCK]: 'Bone Block',
  // Terrain variants
  [BlockType.MYCELIUM]: 'Mycelium', [BlockType.PODZOL]: 'Podzol',
  [BlockType.BASALT]: 'Basalt', [BlockType.POLISHED_BASALT]: 'Polished Basalt',
  [BlockType.DEEPSLATE]: 'Deepslate', [BlockType.ANCIENT_DEBRIS]: 'Ancient Debris',
  // Functional blocks
  [BlockType.LODESTONE]: 'Lodestone', [BlockType.TARGET]: 'Target',
  [BlockType.JUKEBOX]: 'Jukebox', [BlockType.ENCHANTING_TABLE]: 'Enchanting Table',
  [BlockType.ANVIL]: 'Anvil', [BlockType.HOPPER]: 'Hopper',
  [BlockType.CAULDRON]: 'Cauldron', [BlockType.CAKE]: 'Cake',
};

export const DECORATIVE_BLOCKS = new Set([
  BlockType.FLOWER_RED, BlockType.FLOWER_YELLOW,
  BlockType.TALL_GRASS, BlockType.MUSHROOM_RED,
  BlockType.MUSHROOM_BROWN, BlockType.TORCH,
  BlockType.REDSTONE_DUST, BlockType.REDSTONE_TORCH,
  BlockType.LEVER, BlockType.BUTTON,
  BlockType.FERN, BlockType.SUGAR_CANE,
  BlockType.SUNFLOWER, BlockType.ROSE_BUSH,
  BlockType.LILAC, BlockType.LILY_PAD,
]);

export const TRANSPARENT_BLOCKS = new Set([
  BlockType.AIR, BlockType.GLASS, BlockType.WATER,
  BlockType.LEAVES, BlockType.LEAVES_BIRCH, BlockType.LEAVES_SPRUCE,
  BlockType.LEAVES_JUNGLE, BlockType.LEAVES_ACACIA, BlockType.LEAVES_DARK_OAK,
  BlockType.LEAVES_CHERRY, BlockType.ICE,
  ...DECORATIVE_BLOCKS,
]);

export function isCollidable(b: BlockType): boolean {
  return b !== BlockType.AIR && !DECORATIVE_BLOCKS.has(b) && b !== BlockType.WATER;
}

export interface InventoryCategory {
  name: string;
  icon: string;
  blocks: BlockType[];
}

export const INVENTORY_CATEGORIES: InventoryCategory[] = [
  { name: 'Building', icon: '🧱', blocks: [
    BlockType.GRASS, BlockType.DIRT, BlockType.STONE, BlockType.COBBLESTONE,
    BlockType.MOSSY_COBBLE, BlockType.WOOD, BlockType.LOG_BIRCH, BlockType.PLANKS,
    BlockType.BRICK, BlockType.SAND, BlockType.GRAVEL, BlockType.CLAY,
    BlockType.GLASS, BlockType.SNOW, BlockType.ICE, BlockType.OBSIDIAN, BlockType.BEDROCK,
    BlockType.DOOR_OAK, BlockType.FENCE_OAK, BlockType.WATER,
  ]},
  { name: 'Nature', icon: '🌿', blocks: [
    BlockType.LEAVES, BlockType.LEAVES_BIRCH,
    BlockType.FLOWER_RED, BlockType.FLOWER_YELLOW,
    BlockType.SUNFLOWER, BlockType.ROSE_BUSH, BlockType.LILAC,
    BlockType.TALL_GRASS, BlockType.FERN,
    BlockType.MUSHROOM_RED, BlockType.MUSHROOM_BROWN,
    BlockType.SUGAR_CANE, BlockType.CACTUS, BlockType.LILY_PAD,
    BlockType.TORCH, BlockType.GLOWSTONE,
  ]},
  { name: 'Wool', icon: '🎨', blocks: [
    BlockType.WOOL_WHITE, BlockType.WOOL_RED, BlockType.WOOL_BLUE,
    BlockType.WOOL_GREEN, BlockType.WOOL_YELLOW, BlockType.BOOKSHELF,
  ]},
  { name: 'Redstone', icon: '⚡', blocks: [
    BlockType.REDSTONE_DUST, BlockType.REDSTONE_TORCH, BlockType.REDSTONE_BLOCK,
    BlockType.REDSTONE_LAMP, BlockType.REDSTONE_REPEATER, BlockType.COMPARATOR,
    BlockType.LEVER, BlockType.BUTTON, BlockType.PISTON,
    BlockType.OBSERVER, BlockType.NOTE_BLOCK, BlockType.TNT,
  ]},
  { name: 'Minerals', icon: '💎', blocks: [
    BlockType.IRON_BLOCK, BlockType.GOLD_BLOCK, BlockType.DIAMOND_BLOCK,
    BlockType.CRAFTING_TABLE, BlockType.FURNACE,
  ]},
  { name: 'Portals', icon: '🌀', blocks: [
    BlockType.PORTAL, BlockType.PORTAL_FRAME, BlockType.COMMAND_BLOCK,
    BlockType.OBSIDIAN, BlockType.GLOWSTONE,
  ]},
];

export function drawBlockIcon(ctx: CanvasRenderingContext2D, block: BlockType, x: number, y: number, size: number) {
  const top = getBlockFaceColor(block, 'top');
  const side = getBlockFaceColor(block, 'side');
  const bottom = getBlockFaceColor(block, 'bottom');
  const topPts: [number, number][] = [
    [x + size * 0.5, y + size * 0.08],
    [x + size * 0.95, y + size * 0.30],
    [x + size * 0.5, y + size * 0.50],
    [x + size * 0.05, y + size * 0.30],
  ];
  const leftPts: [number, number][] = [
    [x + size * 0.05, y + size * 0.30],
    [x + size * 0.5, y + size * 0.50],
    [x + size * 0.5, y + size * 0.95],
    [x + size * 0.05, y + size * 0.75],
  ];
  const rightPts: [number, number][] = [
    [x + size * 0.5, y + size * 0.50],
    [x + size * 0.95, y + size * 0.30],
    [x + size * 0.95, y + size * 0.75],
    [x + size * 0.5, y + size * 0.95],
  ];
  const fillFace = (pts: [number, number][], color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  };
  const strokeFace = (pts: [number, number][]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.stroke();
  };

  fillFace(topPts, top);
  fillFace(leftPts, side);
  fillFace(rightPts, bottom);

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  strokeFace(topPts);
  strokeFace(leftPts);
  strokeFace(rightPts);
  ctx.globalAlpha = 1;
}

export function drawToolIcon(ctx: CanvasRenderingContext2D, tool: ToolType, x: number, y: number, size: number) {
  ctx.save();
  const s = size;
  const handleColor = '#8b5a2b';
  const bladeColor = TOOL_COLORS[tool] || '#aaa';
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = 'round';
  if (tool === ToolType.SWORD) {
    // Handle
    ctx.strokeStyle = handleColor;
    ctx.beginPath(); ctx.moveTo(x+s*0.3,y+s*0.85); ctx.lineTo(x+s*0.45,y+s*0.6); ctx.stroke();
    // Guard
    ctx.strokeStyle = '#8b8b00';
    ctx.beginPath(); ctx.moveTo(x+s*0.3,y+s*0.6); ctx.lineTo(x+s*0.6,y+s*0.6); ctx.stroke();
    // Blade
    ctx.strokeStyle = bladeColor; ctx.lineWidth = s * 0.08;
    ctx.beginPath(); ctx.moveTo(x+s*0.45,y+s*0.6); ctx.lineTo(x+s*0.7,y+s*0.15); ctx.stroke();
  } else if (tool === ToolType.AXE) {
    ctx.strokeStyle = handleColor; ctx.lineWidth = s * 0.06;
    ctx.beginPath(); ctx.moveTo(x+s*0.25,y+s*0.85); ctx.lineTo(x+s*0.65,y+s*0.3); ctx.stroke();
    ctx.fillStyle = bladeColor;
    ctx.beginPath();
    ctx.moveTo(x+s*0.55,y+s*0.15); ctx.lineTo(x+s*0.85,y+s*0.3);
    ctx.lineTo(x+s*0.7,y+s*0.5); ctx.lineTo(x+s*0.5,y+s*0.4);
    ctx.closePath(); ctx.fill();
  } else if (tool === ToolType.PICKAXE) {
    ctx.strokeStyle = handleColor; ctx.lineWidth = s * 0.06;
    ctx.beginPath(); ctx.moveTo(x+s*0.25,y+s*0.85); ctx.lineTo(x+s*0.6,y+s*0.4); ctx.stroke();
    ctx.strokeStyle = bladeColor; ctx.lineWidth = s * 0.08;
    ctx.beginPath(); ctx.moveTo(x+s*0.3,y+s*0.2); ctx.lineTo(x+s*0.85,y+s*0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+s*0.3,y+s*0.2); ctx.lineTo(x+s*0.4,y+s*0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+s*0.85,y+s*0.2); ctx.lineTo(x+s*0.75,y+s*0.4); ctx.stroke();
  } else if (tool === ToolType.SHOVEL) {
    ctx.strokeStyle = handleColor; ctx.lineWidth = s * 0.06;
    ctx.beginPath(); ctx.moveTo(x+s*0.4,y+s*0.85); ctx.lineTo(x+s*0.55,y+s*0.45); ctx.stroke();
    ctx.fillStyle = bladeColor;
    ctx.beginPath();
    ctx.moveTo(x+s*0.4,y+s*0.15); ctx.quadraticCurveTo(x+s*0.55,y+s*0.05,x+s*0.7,y+s*0.15);
    ctx.lineTo(x+s*0.65,y+s*0.45); ctx.lineTo(x+s*0.45,y+s*0.45);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
