import { BlockType } from './constants';

export interface CraftingRecipe {
  output: BlockType;
  outputCount: number;
  ingredients: { block: BlockType; count: number }[];
  name: string;
  description: string;
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // Basic recipes
  {
    output: BlockType.PLANKS,
    outputCount: 4,
    ingredients: [{ block: BlockType.WOOD, count: 1 }],
    name: 'Oak Planks',
    description: 'Convert wood into planks'
  },
  {
    output: BlockType.PLANKS,
    outputCount: 4,
    ingredients: [{ block: BlockType.LOG_BIRCH, count: 1 }],
    name: 'Birch Planks',
    description: 'Convert birch wood into planks'
  },
  {
    output: BlockType.CRAFTING_TABLE,
    outputCount: 1,
    ingredients: [{ block: BlockType.PLANKS, count: 4 }],
    name: 'Crafting Table',
    description: 'Essential for crafting'
  },
  {
    output: BlockType.STICK,
    outputCount: 4,
    ingredients: [{ block: BlockType.PLANKS, count: 2 }],
    name: 'Sticks',
    description: 'Used for tools and more'
  },
  // Stone recipes
  {
    output: BlockType.COBBLESTONE,
    outputCount: 1,
    ingredients: [{ block: BlockType.STONE, count: 1 }],
    name: 'Cobblestone',
    description: 'Mine stone to get cobblestone'
  },
  {
    output: BlockType.FURNACE,
    outputCount: 1,
    ingredients: [{ block: BlockType.COBBLESTONE, count: 8 }],
    name: 'Furnace',
    description: 'Used for smelting'
  },
  {
    output: BlockType.STONE,
    outputCount: 1,
    ingredients: [{ block: BlockType.COBBLESTONE, count: 1 }],
    name: 'Smooth Stone',
    description: 'Cook cobblestone in furnace'
  },
  // Glass recipes
  {
    output: BlockType.GLASS,
    outputCount: 1,
    ingredients: [{ block: BlockType.SAND, count: 1 }],
    name: 'Glass',
    description: 'Smelt sand in furnace'
  },
  // Metal recipes
  {
    output: BlockType.IRON_BLOCK,
    outputCount: 1,
    ingredients: [{ block: BlockType.STONE, count: 9 }],
    name: 'Iron Block',
    description: 'Compact storage'
  },
  {
    output: BlockType.GOLD_BLOCK,
    outputCount: 1,
    ingredients: [{ block: BlockType.SAND, count: 9 }],
    name: 'Gold Block',
    description: 'Compact storage'
  },
  {
    output: BlockType.DIAMOND_BLOCK,
    outputCount: 1,
    ingredients: [{ block: BlockType.OBSIDIAN, count: 9 }],
    name: 'Diamond Block',
    description: 'Compact storage'
  },
  // Redstone recipes
  {
    output: BlockType.REDSTONE_BLOCK,
    outputCount: 1,
    ingredients: [{ block: BlockType.REDSTONE_DUST, count: 9 }],
    name: 'Redstone Block',
    description: 'Compact redstone storage'
  },
  {
    output: BlockType.REDSTONE_TORCH,
    outputCount: 1,
    ingredients: [{ block: BlockType.REDSTONE_DUST, count: 1 }, { block: BlockType.STICK, count: 1 }],
    name: 'Redstone Torch',
    description: 'Redstone power source'
  },
  {
    output: BlockType.REDSTONE_REPEATER,
    outputCount: 1,
    ingredients: [
      { block: BlockType.REDSTONE_DUST, count: 2 },
      { block: BlockType.STONE, count: 3 },
      { block: BlockType.REDSTONE_TORCH, count: 2 }
    ],
    name: 'Redstone Repeater',
    description: 'Delays redstone signals'
  },
  {
    output: BlockType.REDSTONE_LAMP,
    outputCount: 1,
    ingredients: [
      { block: BlockType.REDSTONE_DUST, count: 4 },
      { block: BlockType.GLOWSTONE, count: 1 }
    ],
    name: 'Redstone Lamp',
    description: 'Light controlled by redstone'
  },
  // Unique feature: Echo Block (not in Minecraft!)
  {
    output: BlockType.OBSIDIAN,
    outputCount: 4,
    ingredients: [
      { block: BlockType.OBSIDIAN, count: 4 },
      { block: BlockType.GLOWSTONE, count: 4 },
      { block: BlockType.DIAMOND_BLOCK, count: 1 }
    ],
    name: 'Echo Block',
    description: 'A mystical block that resonates with energy!'
  },
  // Decorative
  {
    output: BlockType.BOOKSHELF,
    outputCount: 1,
    ingredients: [
      { block: BlockType.PLANKS, count: 6 },
      { block: BlockType.LEAVES, count: 3 }
    ],
    name: 'Bookshelf',
    description: 'For decoration'
  },
  {
    output: BlockType.MOSSY_COBBLE,
    outputCount: 1,
    ingredients: [
      { block: BlockType.COBBLESTONE, count: 1 },
      { block: BlockType.LEAVES, count: 1 }
    ],
    name: 'Mossy Cobblestone',
    description: 'Old stone covered in moss'
  },
  // Wool recipes
  {
    output: BlockType.WOOL_WHITE,
    outputCount: 1,
    ingredients: [{ block: BlockType.LEAVES, count: 4 }],
    name: 'White Wool',
    description: 'Soft and fluffy'
  },
  {
    output: BlockType.WOOL_RED,
    outputCount: 1,
    ingredients: [
      { block: BlockType.WOOL_WHITE, count: 1 },
      { block: BlockType.FLOWER_RED, count: 1 }
    ],
    name: 'Red Wool',
    description: 'Dyed wool'
  },
  {
    output: BlockType.WOOL_BLUE,
    outputCount: 1,
    ingredients: [
      { block: BlockType.WOOL_WHITE, count: 1 },
      { block: BlockType.LAPIS_BLOCK, count: 1 }
    ],
    name: 'Blue Wool',
    description: 'Dyed wool'
  },
  {
    output: BlockType.WOOL_GREEN,
    outputCount: 1,
    ingredients: [
      { block: BlockType.WOOL_WHITE, count: 1 },
      { block: BlockType.LEAVES, count: 1 }
    ],
    name: 'Green Wool',
    description: 'Dyed wool'
  },
  {
    output: BlockType.WOOL_YELLOW,
    outputCount: 1,
    ingredients: [
      { block: BlockType.WOOL_WHITE, count: 1 },
      { block: BlockType.FLOWER_YELLOW, count: 1 }
    ],
    name: 'Yellow Wool',
    description: 'Dyed wool'
  },
  // Unique: Time Manipulator (special block!)
  {
    output: BlockType.OBSERVER,
    outputCount: 1,
    ingredients: [
      { block: BlockType.OBSIDIAN, count: 4 },
      { block: BlockType.REDSTONE_BLOCK, count: 4 },
      { block: BlockType.DIAMOND_BLOCK, count: 1 }
    ],
    name: 'Chronos Block',
    description: 'Controls time! Changes day/night cycle when activated.'
  }
];

// Simple inventory for crafting
export class CraftingInventory {
  private items: Map<BlockType, number> = new Map();

  addItem(block: BlockType, count: number) {
    const current = this.items.get(block) || 0;
    this.items.set(block, current + count);
  }

  removeItem(block: BlockType, count: number): boolean {
    const current = this.items.get(block) || 0;
    if (current < count) return false;
    this.items.set(block, current - count);
    return true;
  }

  getItemCount(block: BlockType): number {
    return this.items.get(block) || 0;
  }

  canCraft(recipe: CraftingRecipe): boolean {
    for (const ingredient of recipe.ingredients) {
      if (this.getItemCount(ingredient.block) < ingredient.count) {
        return false;
      }
    }
    return true;
  }

  craft(recipe: CraftingRecipe): boolean {
    if (!this.canCraft(recipe)) return false;
    
    for (const ingredient of recipe.ingredients) {
      this.removeItem(ingredient.block, ingredient.count);
    }
    this.addItem(recipe.output, recipe.outputCount);
    return true;
  }

  getAllItems(): { block: BlockType; count: number }[] {
    return Array.from(this.items.entries())
      .filter(([_, count]) => count > 0)
      .map(([block, count]) => ({ block, count }));
  }
}

// Helper to get recipes by output
export function getRecipesForOutput(block: BlockType): CraftingRecipe[] {
  return CRAFTING_RECIPES.filter(r => r.output === block);
}

// Helper to get all available recipes
export function getAllRecipes(): CraftingRecipe[] {
  return CRAFTING_RECIPES;
}