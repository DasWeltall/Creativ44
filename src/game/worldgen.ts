import { SimplexNoise } from './noise';
import { BlockType, CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL, BEDROCK_LEVEL, WATER_LEVEL } from './constants';

export interface WorldGenConfig {
  seed: number;
  worldType: 'normal' | 'flat';
}

let worldGenConfig: WorldGenConfig = { seed: 12345, worldType: 'normal' };

let noise = new SimplexNoise(12345);
let treeNoise = new SimplexNoise(67890);
let flowerNoise = new SimplexNoise(11111);
let biomeNoise = new SimplexNoise(22222);
let houseNoise = new SimplexNoise(33333);
let plantNoise = new SimplexNoise(44444);
let caveNoise = new SimplexNoise(55555);

function rebuildNoises(seed: number) {
  const base = Math.floor(seed) || 12345;
  noise = new SimplexNoise(base + 11);
  treeNoise = new SimplexNoise(base + 29);
  flowerNoise = new SimplexNoise(base + 47);
  biomeNoise = new SimplexNoise(base + 71);
  houseNoise = new SimplexNoise(base + 89);
  plantNoise = new SimplexNoise(base + 113);
  caveNoise = new SimplexNoise(base + 137);
}

export function configureWorldGeneration(config: WorldGenConfig) {
  worldGenConfig = {
    seed: Number.isFinite(config.seed) ? Math.floor(config.seed) : 12345,
    worldType: config.worldType === 'flat' ? 'flat' : 'normal',
  };
  rebuildNoises(worldGenConfig.seed);
}

export interface ChunkData {
  blocks: Uint8Array;
  cx: number;
  cz: number;
}

function getIndex(x: number, y: number, z: number): number {
  return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
}

export function getBlock(chunk: ChunkData, x: number, y: number, z: number): BlockType {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return BlockType.AIR;
  return chunk.blocks[getIndex(x, y, z)];
}

export function setBlock(chunk: ChunkData, x: number, y: number, z: number, type: BlockType) {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
  chunk.blocks[getIndex(x, y, z)] = type;
}

function getTerrainHeight(worldX: number, worldZ: number): number {
  if (worldGenConfig.worldType === 'flat') return Math.max(BEDROCK_LEVEL + 4, WATER_LEVEL + 2);

  const scale = 0.008;
  const detailScale = 0.03;
  const microScale = 0.08;
  
  const base = noise.fbm(worldX * scale, worldZ * scale, 6, 2, 0.5);
  const detail = noise.fbm(worldX * detailScale, worldZ * detailScale, 3, 2, 0.5);
  const micro = noise.noise2D(worldX * microScale, worldZ * microScale);
  
  const biome = biomeNoise.fbm(worldX * 0.003, worldZ * 0.003, 3, 2, 0.5);
  
  let height: number;
  if (biome > 0.2) {
    height = SEA_LEVEL + base * 20 + detail * 8 + micro * 2;
  } else if (biome > -0.1) {
    height = SEA_LEVEL + base * 10 + detail * 4 + micro;
  } else {
    height = SEA_LEVEL + base * 5 + detail * 2 + micro * 0.5;
  }
  
  return Math.floor(Math.max(BEDROCK_LEVEL + 3, Math.min(CHUNK_HEIGHT - 2, height)));
}

function placeBirchTree(chunk: ChunkData, tx: number, ty: number, tz: number) {
  const trunkHeight = 5 + Math.floor(Math.random() * 2);
  for (let y = 0; y < trunkHeight; y++) {
    setBlock(chunk, tx, ty + y, tz, BlockType.LOG_BIRCH);
  }
  const leafStart = ty + trunkHeight - 2;
  const leafEnd = ty + trunkHeight + 1;
  for (let y = leafStart; y <= leafEnd; y++) {
    const radius = y < leafEnd ? 2 : 1;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx === 0 && dz === 0 && y < leafEnd) continue;
        if (Math.abs(dx) === radius && Math.abs(dz) === radius && Math.random() > 0.4) continue;
        const lx = tx + dx, lz = tz + dz;
        if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && y < CHUNK_HEIGHT) {
          if (getBlock(chunk, lx, y, lz) === BlockType.AIR) {
            setBlock(chunk, lx, y, lz, BlockType.LEAVES_BIRCH);
          }
        }
      }
    }
  }
}

function placeTree(chunk: ChunkData, tx: number, ty: number, tz: number) {
  const trunkHeight = 4 + Math.floor(Math.random() * 3);
  for (let y = 0; y < trunkHeight; y++) {
    setBlock(chunk, tx, ty + y, tz, BlockType.WOOD);
  }
  const leafStart = ty + trunkHeight - 2;
  const leafEnd = ty + trunkHeight + 2;
  for (let y = leafStart; y <= leafEnd; y++) {
    const radius = y < leafEnd - 1 ? 2 : 1;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx === 0 && dz === 0 && y < leafEnd) continue;
        if (Math.abs(dx) === radius && Math.abs(dz) === radius && Math.random() > 0.5) continue;
        const lx = tx + dx, lz = tz + dz;
        if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && y < CHUNK_HEIGHT) {
          if (getBlock(chunk, lx, y, lz) === BlockType.AIR) {
            setBlock(chunk, lx, y, lz, BlockType.LEAVES);
          }
        }
      }
    }
  }
}

function placeHouse(chunk: ChunkData, hx: number, hy: number, hz: number) {
  const w = 5, d = 6, h = 4;
  // Check if it fits
  if (hx + w >= CHUNK_SIZE || hz + d >= CHUNK_SIZE || hx < 1 || hz < 1) return;
  
  // Floor
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < d; z++) {
      setBlock(chunk, hx + x, hy, hz + z, BlockType.PLANKS);
    }
  }
  
  // Walls
  for (let y = 1; y <= h; y++) {
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        const isWall = x === 0 || x === w - 1 || z === 0 || z === d - 1;
        if (isWall) {
          // Window holes
          const isWindow = y === 2 && (
            (x === 0 && z === 2) || (x === 0 && z === 3) ||
            (x === w - 1 && z === 2) || (x === w - 1 && z === 3)
          );
          // Door hole  
          const isDoor = z === 0 && x === 2 && (y === 1 || y === 2);
          
          if (isDoor) {
            // leave open for door
          } else if (isWindow) {
            setBlock(chunk, hx + x, hy + y, hz + z, BlockType.GLASS);
          } else {
            // Lower walls cobblestone, upper planks
            setBlock(chunk, hx + x, hy + y, hz + z, y <= 1 ? BlockType.COBBLESTONE : BlockType.PLANKS);
          }
        }
      }
    }
  }
  
  // Roof (pitched)
  for (let z = -1; z < d + 1; z++) {
    for (let x = -1; x < w + 1; x++) {
      const rx = hx + x, rz = hz + z;
      if (rx < 0 || rx >= CHUNK_SIZE || rz < 0 || rz >= CHUNK_SIZE) continue;
      setBlock(chunk, rx, hy + h + 1, rz, BlockType.PLANKS);
    }
  }
  // Second roof layer narrower
  for (let z = 0; z < d; z++) {
    for (let x = 1; x < w - 1; x++) {
      const rx = hx + x, rz = hz + z;
      if (rx < 0 || rx >= CHUNK_SIZE || rz < 0 || rz >= CHUNK_SIZE) continue;
      setBlock(chunk, rx, hy + h + 2, rz, BlockType.BRICK);
    }
  }
  
  // Torch inside
  setBlock(chunk, hx + 2, hy + 3, hz + 3, BlockType.TORCH);
  
  // Crafting table
  setBlock(chunk, hx + 1, hy + 1, hz + d - 2, BlockType.CRAFTING_TABLE);
  // Furnace
  setBlock(chunk, hx + 3, hy + 1, hz + d - 2, BlockType.FURNACE);
}

function carveCaves(chunk: ChunkData, worldOffsetX: number, worldOffsetZ: number) {
  if (worldGenConfig.worldType === 'flat') return;

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const worldX = worldOffsetX + x;
      const worldZ = worldOffsetZ + z;
      const surfaceY = getTerrainHeight(worldX, worldZ);
      const caveTop = Math.max(BEDROCK_LEVEL + 3, surfaceY - 4);

      for (let y = BEDROCK_LEVEL + 2; y < caveTop; y++) {
        const block = getBlock(chunk, x, y, z);
        if (block !== BlockType.STONE && block !== BlockType.DIRT && block !== BlockType.GRAVEL && block !== BlockType.CLAY) continue;

        const shapeA = caveNoise.noise2D(worldX * 0.055 + y * 0.11, worldZ * 0.055 - y * 0.09);
        const shapeB = caveNoise.noise2D(worldX * 0.095 - y * 0.07, worldZ * 0.095 + y * 0.06);
        const tunnels = caveNoise.noise2D(worldX * 0.18 + 300, worldZ * 0.18 + y * 0.14);
        const caveValue = shapeA * 0.58 + shapeB * 0.32 + tunnels * 0.1;

        if (caveValue > 0.34 && y < WATER_LEVEL - 1) {
          setBlock(chunk, x, y, z, BlockType.AIR);
          // Widening to create larger cave rooms/tunnels.
          if (caveValue > 0.44 && y + 1 < caveTop) setBlock(chunk, x, y + 1, z, BlockType.AIR);
          if (caveValue > 0.48 && y - 1 > BEDROCK_LEVEL + 1) setBlock(chunk, x, y - 1, z, BlockType.AIR);
          if (caveValue > 0.52 && x + 1 < CHUNK_SIZE) setBlock(chunk, x + 1, y, z, BlockType.AIR);
          if (caveValue > 0.52 && x - 1 >= 0) setBlock(chunk, x - 1, y, z, BlockType.AIR);
          if (caveValue > 0.52 && z + 1 < CHUNK_SIZE) setBlock(chunk, x, y, z + 1, BlockType.AIR);
          if (caveValue > 0.52 && z - 1 >= 0) setBlock(chunk, x, y, z - 1, BlockType.AIR);
        }
      }
    }
  }

  // Secondary expansion pass for larger chambers.
  for (let x = 1; x < CHUNK_SIZE - 1; x++) {
    for (let z = 1; z < CHUNK_SIZE - 1; z++) {
      const worldX = worldOffsetX + x;
      const worldZ = worldOffsetZ + z;
      const caveTop = getTerrainHeight(worldX, worldZ) - 5;
      for (let y = BEDROCK_LEVEL + 2; y < caveTop; y++) {
        const current = getBlock(chunk, x, y, z);
        if (current === BlockType.AIR || current === BlockType.BEDROCK || y >= WATER_LEVEL - 1) continue;
        let airNeighbors = 0;
        if (getBlock(chunk, x + 1, y, z) === BlockType.AIR) airNeighbors++;
        if (getBlock(chunk, x - 1, y, z) === BlockType.AIR) airNeighbors++;
        if (getBlock(chunk, x, y + 1, z) === BlockType.AIR) airNeighbors++;
        if (getBlock(chunk, x, y - 1, z) === BlockType.AIR) airNeighbors++;
        if (getBlock(chunk, x, y, z + 1) === BlockType.AIR) airNeighbors++;
        if (getBlock(chunk, x, y, z - 1) === BlockType.AIR) airNeighbors++;
        if (airNeighbors >= 3) setBlock(chunk, x, y, z, BlockType.AIR);
      }
    }
  }
}

export function generateChunk(cx: number, cz: number): ChunkData {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
  const chunk: ChunkData = { blocks, cx, cz };
  
  const worldOffsetX = cx * CHUNK_SIZE;
  const worldOffsetZ = cz * CHUNK_SIZE;
  
  // Terrain generation with water
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const worldX = worldOffsetX + x;
      const worldZ = worldOffsetZ + z;
      const height = getTerrainHeight(worldX, worldZ);
      
      for (let y = 0; y <= Math.max(height, WATER_LEVEL); y++) {
        if (y > height && y <= WATER_LEVEL) {
          // Water above terrain but below water level
          setBlock(chunk, x, y, z, BlockType.WATER);
        } else if (y <= height) {
          if (y === BEDROCK_LEVEL) {
            setBlock(chunk, x, y, z, BlockType.BEDROCK);
          } else if (y < height - 4) {
            setBlock(chunk, x, y, z, BlockType.STONE);
          } else if (y < height) {
            setBlock(chunk, x, y, z, BlockType.DIRT);
          } else {
            // Surface block
            const biome = biomeNoise.fbm(worldX * 0.003, worldZ * 0.003, 3, 2, 0.5);
            if (height <= WATER_LEVEL + 1) {
              setBlock(chunk, x, y, z, BlockType.SAND);
              // Gravel patches near water
              if (plantNoise.noise2D(worldX * 0.1, worldZ * 0.1) > 0.5) {
                setBlock(chunk, x, y, z, BlockType.GRAVEL);
              }
            } else if (biome < -0.3) {
              setBlock(chunk, x, y, z, BlockType.SAND);
            } else {
              setBlock(chunk, x, y, z, BlockType.GRASS);
            }
          }
        }
      }
      
      // Clay underwater
      if (height < WATER_LEVEL - 2) {
        const clayVal = plantNoise.noise2D(worldX * 0.15, worldZ * 0.15);
        if (clayVal > 0.4) {
          setBlock(chunk, x, height, z, BlockType.CLAY);
        }
      }
    }
  }

  // Cave generation pass.
  carveCaves(chunk, worldOffsetX, worldOffsetZ);
  
  if (worldGenConfig.worldType === 'flat') {
    return chunk;
  }

  // Tree placement
  for (let x = 2; x < CHUNK_SIZE - 2; x++) {
    for (let z = 2; z < CHUNK_SIZE - 2; z++) {
      const worldX = worldOffsetX + x;
      const worldZ = worldOffsetZ + z;
      const height = getTerrainHeight(worldX, worldZ);
      if (height <= WATER_LEVEL + 1) continue;
      const surfaceBlock = getBlock(chunk, x, height, z);
      
      if (surfaceBlock === BlockType.GRASS) {
        const treeVal = treeNoise.noise2D(worldX * 0.5, worldZ * 0.5);
        if (treeVal > 0.6) {
          // Mix of oak and birch
          const birchChance = treeNoise.noise2D(worldX * 0.2 + 500, worldZ * 0.2 + 500);
          if (birchChance > 0.3) {
            placeBirchTree(chunk, x, height + 1, z);
          } else {
            placeTree(chunk, x, height + 1, z);
          }
        }
      }
    }
  }
  
  // Vegetation placement
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const worldX = worldOffsetX + x;
      const worldZ = worldOffsetZ + z;
      const height = getTerrainHeight(worldX, worldZ);
      const surfaceBlock = getBlock(chunk, x, height, z);
      const aboveBlock = getBlock(chunk, x, height + 1, z);
      
      // Lily pads on water
      if (surfaceBlock === BlockType.WATER || getBlock(chunk, x, WATER_LEVEL, z) === BlockType.WATER) {
        if (height <= WATER_LEVEL) {
          const lilyVal = plantNoise.noise2D(worldX * 0.8, worldZ * 0.8);
          if (lilyVal > 0.7) {
            setBlock(chunk, x, WATER_LEVEL + 1, z, BlockType.LILY_PAD);
          }
        }
      }
      
      // Sugar cane near water
      if (surfaceBlock === BlockType.GRASS || surfaceBlock === BlockType.SAND) {
        if (height === WATER_LEVEL + 1 || height === WATER_LEVEL + 2) {
          const caneVal = plantNoise.noise2D(worldX * 0.6 + 200, worldZ * 0.6 + 200);
          if (caneVal > 0.55 && aboveBlock === BlockType.AIR) {
            const caneH = 1 + Math.floor(Math.random() * 3);
            for (let cy = 1; cy <= caneH; cy++) {
              setBlock(chunk, x, height + cy, z, BlockType.SUGAR_CANE);
            }
            continue;
          }
        }
      }
      
      // Cactus on sand
      if (surfaceBlock === BlockType.SAND && height > WATER_LEVEL + 2 && aboveBlock === BlockType.AIR) {
        const cactVal = plantNoise.noise2D(worldX * 0.4 + 300, worldZ * 0.4 + 300);
        if (cactVal > 0.7) {
          const cactH = 1 + Math.floor(Math.random() * 3);
          for (let cy = 1; cy <= cactH; cy++) {
            setBlock(chunk, x, height + cy, z, BlockType.CACTUS);
          }
          continue;
        }
      }
      
      if (surfaceBlock === BlockType.GRASS && aboveBlock === BlockType.AIR) {
        const fVal = flowerNoise.noise2D(worldX * 0.3, worldZ * 0.3);
        const fVal2 = flowerNoise.noise2D(worldX * 0.7 + 100, worldZ * 0.7 + 100);
        const pVal = plantNoise.noise2D(worldX * 0.5 + 400, worldZ * 0.5 + 400);
        
        if (fVal > 0.65) {
          setBlock(chunk, x, height + 1, z, BlockType.FLOWER_RED);
        } else if (fVal < -0.65) {
          setBlock(chunk, x, height + 1, z, BlockType.FLOWER_YELLOW);
        } else if (pVal > 0.7) {
          setBlock(chunk, x, height + 1, z, BlockType.SUNFLOWER);
        } else if (pVal < -0.7) {
          setBlock(chunk, x, height + 1, z, BlockType.LILAC);
        } else if (pVal > 0.55 && pVal < 0.6) {
          setBlock(chunk, x, height + 1, z, BlockType.ROSE_BUSH);
        } else if (fVal2 > 0.3 && fVal2 < 0.5) {
          setBlock(chunk, x, height + 1, z, BlockType.TALL_GRASS);
        } else if (fVal2 > 0.5 && fVal2 < 0.6) {
          setBlock(chunk, x, height + 1, z, BlockType.FERN);
        } else if (fVal2 > 0.7) {
          const hasCanopy = getBlock(chunk, x, height + 3, z) === BlockType.LEAVES || getBlock(chunk, x, height + 3, z) === BlockType.LEAVES_BIRCH;
          if (hasCanopy) {
            setBlock(chunk, x, height + 1, z, fVal > 0 ? BlockType.MUSHROOM_RED : BlockType.MUSHROOM_BROWN);
          }
        }
      }
    }
  }
  
  // House placement - deterministic based on chunk coords
  const hVal = houseNoise.noise2D(cx * 0.3, cz * 0.3);
  if (hVal > 0.55) {
    // Find a flat spot
    const hx = 3 + Math.floor(Math.abs(houseNoise.noise2D(cx * 1.7, cz * 1.7)) * 5);
    const hz = 3 + Math.floor(Math.abs(houseNoise.noise2D(cx * 2.3, cz * 2.3)) * 5);
    const worldHX = worldOffsetX + hx;
    const worldHZ = worldOffsetZ + hz;
    const hy = getTerrainHeight(worldHX, worldHZ);
    
    // Only build on grass, above water
    if (hy > WATER_LEVEL + 2 && getBlock(chunk, hx, hy, hz) === BlockType.GRASS) {
      placeHouse(chunk, hx, hy, hz);
    }
  }
  
  return chunk;
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}
