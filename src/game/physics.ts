import * as THREE from 'three';
import { BlockType, CHUNK_HEIGHT } from './constants';

// ══════════════════════════════════════════════════════════════════
// ADVANCED PHYSICS SYSTEM - Beyond Minecraft
// ══════════════════════════════════════════════════════════════════

export interface PhysicsEntity {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  mass: number;
  friction: number;
  restitution: number; // bounciness
  isGrounded: boolean;
}

export interface FallingBlock {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  blockType: BlockType;
  mesh: THREE.Mesh;
  lifetime: number;
}

export interface DroppedItem {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  blockType: BlockType;
  mesh: THREE.Group;
  lifetime: number;
  magnetRange: number;
}

export interface Explosion {
  position: THREE.Vector3;
  power: number;
  lifetime: number;
  particles: Array<{ pos: THREE.Vector3; vel: THREE.Vector3; life: number }>;
}

export interface WaterFlow {
  x: number;
  y: number;
  z: number;
  level: number; // 0-8, 0 = source
  flowDirection: THREE.Vector3;
}

export class PhysicsEngine {
  private fallingBlocks: FallingBlock[] = [];
  private droppedItems: DroppedItem[] = [];
  private explosions: Explosion[] = [];
  private waterFlows: Map<string, WaterFlow> = new Map();
  private gravity = 20;
  private airResistance = 0.01;
  private scene: THREE.Scene;
  private gameRenderer: any;

  constructor(scene: THREE.Scene, gameRenderer: any) {
    this.scene = scene;
    this.gameRenderer = gameRenderer;
  }

  // ══════════════════════════════════════════════════════════════════
  // FALLING BLOCKS SYSTEM
  // ══════════════════════════════════════════════════════════════════

  makeFallingBlock(x: number, y: number, z: number, blockType: BlockType) {
    // Create falling block entity
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({
      color: this.getBlockColor(blockType)
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const block: FallingBlock = {
      position: new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5),
      velocity: new THREE.Vector3(0, 0, 0),
      blockType,
      mesh,
      lifetime: 0
    };

    this.fallingBlocks.push(block);

    // Remove block from world
    if (this.gameRenderer) {
      this.gameRenderer.setBlockAt(Math.floor(x), Math.floor(y), Math.floor(z), BlockType.AIR);
    }
  }

  // Check if block should fall (sand, gravel, etc.)
  shouldBlockFall(blockType: BlockType): boolean {
    return [
      BlockType.SAND,
      BlockType.GRAVEL,
      BlockType.ANVIL,
      // Add more falling blocks here
    ].includes(blockType);
  }

  // Update falling blocks
  updateFallingBlocks(deltaTime: number) {
    const toRemove: number[] = [];

    for (let i = 0; i < this.fallingBlocks.length; i++) {
      const block = this.fallingBlocks[i];

      // Apply gravity
      block.velocity.y -= this.gravity * deltaTime;

      // Apply air resistance
      block.velocity.multiplyScalar(1 - this.airResistance);

      // Update position
      block.position.add(block.velocity.clone().multiplyScalar(deltaTime));
      block.mesh.position.copy(block.position);

      block.lifetime += deltaTime;

      // Check ground collision
      const groundY = Math.floor(block.position.y - 0.5);
      if (this.gameRenderer) {
        const blockBelow = this.gameRenderer.getBlockAt(
          Math.floor(block.position.x),
          groundY,
          Math.floor(block.position.z)
        );

        if (blockBelow !== BlockType.AIR && block.position.y <= groundY + 1.5) {
          // Land on ground
          this.scene.remove(block.mesh);
          block.mesh.geometry.dispose();
          (block.mesh.material as THREE.Material).dispose();

          // Place block
          this.gameRenderer.setBlockAt(
            Math.floor(block.position.x),
            groundY + 1,
            Math.floor(block.position.z),
            block.blockType
          );

          toRemove.push(i);
        }
      }

      // Remove if too old or fell out of world
      if (block.lifetime > 30 || block.position.y < -10) {
        this.scene.remove(block.mesh);
        block.mesh.geometry.dispose();
        (block.mesh.material as THREE.Material).dispose();
        toRemove.push(i);
      }
    }

    // Remove finished blocks
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.fallingBlocks.splice(toRemove[i], 1);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // ITEM DROP PHYSICS
  // ══════════════════════════════════════════════════════════════════

  dropItem(x: number, y: number, z: number, blockType: BlockType) {
    // Create item entity (small spinning cube)
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const material = new THREE.MeshLambertMaterial({
      color: this.getBlockColor(blockType)
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    group.add(mesh);
    group.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.scene.add(group);

    // Random ejection velocity
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 2;

    const item: DroppedItem = {
      position: new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5),
      velocity: new THREE.Vector3(
        Math.cos(angle) * speed,
        5 + Math.random() * 3,
        Math.sin(angle) * speed
      ),
      blockType,
      mesh: group,
      lifetime: 0,
      magnetRange: 1.5 // Player can pick up from this distance
    };

    this.droppedItems.push(item);
  }

  updateDroppedItems(deltaTime: number, playerPos: THREE.Vector3) {
    const toRemove: number[] = [];

    for (let i = 0; i < this.droppedItems.length; i++) {
      const item = this.droppedItems[i];

      // Apply gravity
      item.velocity.y -= this.gravity * deltaTime;

      // Apply air resistance
      item.velocity.multiplyScalar(1 - this.airResistance);

      // Magnet effect toward player
      const distToPlayer = item.position.distanceTo(playerPos);
      if (distToPlayer < item.magnetRange) {
        const toPlayer = playerPos.clone().sub(item.position).normalize();
        item.velocity.add(toPlayer.multiplyScalar(10 * deltaTime));
      }

      // Update position
      item.position.add(item.velocity.clone().multiplyScalar(deltaTime));
      item.mesh.position.copy(item.position);

      // Spin animation
      item.mesh.rotation.y += deltaTime * 3;

      // Bobbing animation
      item.mesh.position.y += Math.sin(item.lifetime * 4) * 0.02;

      item.lifetime += deltaTime;

      // Ground collision with bounce
      const groundY = Math.floor(item.position.y - 0.15);
      if (this.gameRenderer) {
        const blockBelow = this.gameRenderer.getBlockAt(
          Math.floor(item.position.x),
          groundY,
          Math.floor(item.position.z)
        );

        if (blockBelow !== BlockType.AIR && item.velocity.y < 0) {
          item.position.y = groundY + 1.15;
          item.velocity.y *= -0.5; // Bounce with energy loss
          item.velocity.x *= 0.8; // Friction
          item.velocity.z *= 0.8;
        }
      }

      // Pick up by player
      if (distToPlayer < 0.5) {
        // Add to inventory
        this.scene.remove(item.mesh);
        toRemove.push(i);
        continue;
      }

      // Remove if too old
      if (item.lifetime > 60) { // 60 seconds despawn
        this.scene.remove(item.mesh);
        toRemove.push(i);
      }
    }

    // Remove collected items
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.droppedItems.splice(toRemove[i], 1);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // EXPLOSION PHYSICS
  // ══════════════════════════════════════════════════════════════════

  createExplosion(x: number, y: number, z: number, power: number) {
    // Create explosion effect
    const particles: Array<{ pos: THREE.Vector3; vel: THREE.Vector3; life: number }> = [];

    // Spawn explosion particles
    for (let i = 0; i < 50; i++) {
      const angle1 = Math.random() * Math.PI * 2;
      const angle2 = Math.random() * Math.PI;
      const speed = 5 + Math.random() * 5;

      particles.push({
        pos: new THREE.Vector3(x, y, z),
        vel: new THREE.Vector3(
          Math.sin(angle2) * Math.cos(angle1) * speed,
          Math.cos(angle2) * speed,
          Math.sin(angle2) * Math.sin(angle1) * speed
        ),
        life: 1 + Math.random()
      });
    }

    const explosion: Explosion = {
      position: new THREE.Vector3(x, y, z),
      power,
      lifetime: 0,
      particles
    };

    this.explosions.push(explosion);

    // Destroy blocks in radius
    if (this.gameRenderer) {
      const radius = Math.ceil(power);
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist <= power) {
              const bx = Math.floor(x + dx);
              const by = Math.floor(y + dy);
              const bz = Math.floor(z + dz);

              const blockType = this.gameRenderer.getBlockAt(bx, by, bz);
              if (blockType !== BlockType.AIR && blockType !== BlockType.BEDROCK) {
                // Chance to drop item
                if (Math.random() < 0.3) {
                  this.dropItem(bx, by, bz, blockType);
                }
                // Destroy block
                this.gameRenderer.setBlockAt(bx, by, bz, BlockType.AIR);
              }
            }
          }
        }
      }
    }

    // Apply force to nearby entities
    // TODO: push animals/players away from explosion

    console.log(`[Physics] Explosion at ${x}, ${y}, ${z} with power ${power}`);
  }

  updateExplosions(deltaTime: number) {
    const toRemove: number[] = [];

    for (let i = 0; i < this.explosions.length; i++) {
      const explosion = this.explosions[i];
      explosion.lifetime += deltaTime;

      // Update particles
      for (const particle of explosion.particles) {
        particle.vel.y -= this.gravity * deltaTime;
        particle.pos.add(particle.vel.clone().multiplyScalar(deltaTime));
        particle.life -= deltaTime;
      }

      // Remove old explosions
      if (explosion.lifetime > 3) {
        toRemove.push(i);
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.explosions.splice(toRemove[i], 1);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // WATER PHYSICS (Basic)
  // ══════════════════════════════════════════════════════════════════

  updateWaterFlow(x: number, y: number, z: number) {
    if (!this.gameRenderer) return;

    const key = `${x},${y},${z}`;
    const blockType = this.gameRenderer.getBlockAt(x, y, z);

    if (blockType !== BlockType.WATER) {
      this.waterFlows.delete(key);
      return;
    }

    // Check if this is a source block (has water above)
    const blockAbove = this.gameRenderer.getBlockAt(x, y + 1, z);
    const isSource = blockAbove === BlockType.WATER;

    const flow: WaterFlow = {
      x, y, z,
      level: isSource ? 0 : 7,
      flowDirection: new THREE.Vector3(0, 0, 0)
    };

    // Calculate flow direction (flows to lower blocks)
    const directions = [
      { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
      { dx: 0, dz: 1 }, { dx: 0, dz: -1 }
    ];

    for (const dir of directions) {
      const nx = x + dir.dx;
      const nz = z + dir.dz;
      const neighborBlock = this.gameRenderer.getBlockAt(nx, y, nz);
      const neighborBelow = this.gameRenderer.getBlockAt(nx, y - 1, nz);

      // Flow to empty adjacent blocks
      if (neighborBlock === BlockType.AIR && !isSource && flow.level < 7) {
        // Spread water
        // this.gameRenderer.setBlockAt(nx, y, nz, BlockType.WATER);
      }

      // Flow down if possible
      if (neighborBelow === BlockType.AIR) {
        // this.gameRenderer.setBlockAt(x, y - 1, z, BlockType.WATER);
      }
    }

    this.waterFlows.set(key, flow);
  }

  // ══════════════════════════════════════════════════════════════════
  // MAIN UPDATE
  // ══════════════════════════════════════════════════════════════════

  update(deltaTime: number, playerPos: THREE.Vector3) {
    this.updateFallingBlocks(deltaTime);
    this.updateDroppedItems(deltaTime, playerPos);
    this.updateExplosions(deltaTime);
  }

  // ══════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════

  private getBlockColor(blockType: BlockType): number {
    const colors: Record<BlockType, number> = {
      [BlockType.GRASS]: 0x5cb832,
      [BlockType.DIRT]: 0x8b6914,
      [BlockType.STONE]: 0x888888,
      [BlockType.SAND]: 0xf0e0a0,
      [BlockType.GRAVEL]: 0x777777,
      [BlockType.WOOD]: 0x9a7a4a,
      [BlockType.PLANKS]: 0xb8945a,
      [BlockType.COBBLESTONE]: 0x6a6a6a,
      [BlockType.TNT]: 0xee4433,
      [BlockType.GLASS]: 0xc8e8ff,
      [BlockType.BRICK]: 0x9b4a2a,
      [BlockType.GOLD_BLOCK]: 0xffdd44,
      [BlockType.DIAMOND_BLOCK]: 0x55eeff,
      [BlockType.IRON_BLOCK]: 0xdddddd,
    };
    return colors[blockType] || 0xcccccc;
  }

  // ══════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════

  getFallingBlockCount(): number {
    return this.fallingBlocks.length;
  }

  getDroppedItemCount(): number {
    return this.droppedItems.length;
  }

  getExplosionCount(): number {
    return this.explosions.length;
  }

  getExplosions(): Explosion[] {
    return this.explosions;
  }
}
