import * as THREE from 'three';
import { ChunkData, getBlock, generateChunk, chunkKey, setBlock as setBlockInChunk, configureWorldGeneration } from './worldgen';
import {
  BlockType, CHUNK_SIZE, CHUNK_HEIGHT,
  BLOCK_FACE_COLORS, HOTBAR_BLOCKS, DECORATIVE_BLOCKS, TRANSPARENT_BLOCKS, getBlockFaceColor,
  PLAYER_HEIGHT, PLAYER_WIDTH, PLAYER_EYE_HEIGHT,
  GRAVITY, JUMP_FORCE, PLAYER_SPEED, FLY_SPEED, isCollidable, WATER_LEVEL, ToolType
} from './constants';
import { textureManager, FaceDir } from './textureManager';
import { settingsManager } from './settings';
import { PhysicsEngine } from './physics';
import { commandSystem, CommandContext } from './commandSystem';
import { customizationManager } from './customization';

interface Animal {
  mesh: THREE.Group;
  type: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetAngle: number;
  changeTimer: number;
  bobPhase: number;
  health: number;
  legMeshes: THREE.Mesh[];
  headMesh?: THREE.Mesh;
  bodyMesh?: THREE.Mesh;
  tailMesh?: THREE.Mesh;
  state: 'idle' | 'walking' | 'eating' | 'fleeing';
  stateTimer: number;
  fleeTarget?: THREE.Vector3;
  animations: {
    legSwing: number;
    headBob: number;
    tailWag: number;
  };
}

interface DroppedItem {
  mesh: THREE.Group;
  blockType: BlockType;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  bobPhase: number;
  rotationSpeed: THREE.Vector3;
}

interface BreakParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  resting: boolean;
  restTimer: number;
}

interface ActiveBreakState {
  x: number;
  y: number;
  z: number;
  block: BlockType;
  progress: number;
  lastHit: number;
}

interface NPC {
  mesh: THREE.Group;
  name: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetAngle: number;
  state: 'idle' | 'walking' | 'interacting';
  stateTimer: number;
  color: number;
  tradeItems: BlockType[];
  dialogues: string[];
  currentDialogue: number;
}

export interface MultiplayerPlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  skin?: MultiplayerSkin;
}

export interface MultiplayerSkin {
  skinTone: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
}

export interface MultiplayerBlockEvent {
  x: number;
  y: number;
  z: number;
  type: number;
  authorId?: string;
}

export interface MultiplayerAnimalState {
  x: number;
  y: number;
  z: number;
}

type WeatherType = 'clear' | 'rain' | 'snow' | 'storm';

export type GameMode = 'creative' | 'survival';

export class GameRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private chunks: Map<string, ChunkData> = new Map();
  private chunkMeshes: Map<string, THREE.Mesh[]> = new Map();
  private playerPos: THREE.Vector3;
  private playerVelocity = new THREE.Vector3();
  private playerRotation = { yaw: 0, pitch: 0 };
  private moveInput = { x: 0, z: 0 };
  private flyUp = false;
  private flyDown = false;
  private jumping = false;
  private onGround = false;
  private animationId = 0;
  private lastTime = 0;
  private sunLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;
  private skyColor = new THREE.Color(0x87ceeb);
  private timeOfDay = 0.3;
  private selectedBlock: BlockType = BlockType.GRASS;
  private selectedTool: ToolType = ToolType.NONE;
  private _selectedSlot = 0;
  private crosshairTarget: { pos: THREE.Vector3; normal: THREE.Vector3; blockPos: THREE.Vector3 } | null = null;
  private highlightMesh!: THREE.LineSegments;
  private animals: Animal[] = [];
  private npcs: NPC[] = [];
  private droppedItems: DroppedItem[] = [];
  private breakParticles: BreakParticle[] = [];
  private cloudsGroup!: THREE.Group;
  private onLoadProgress: (_p: number) => void = () => {};
  private fog!: THREE.Fog;
  private sunMesh!: THREE.Mesh;
  private moonMesh!: THREE.Mesh;
  private sunGlow!: THREE.Sprite;
  private moonGlow!: THREE.Sprite;
  private starsGroup!: THREE.Group;
  private _gameMode: GameMode = 'creative';
  private _hotbar: BlockType[] = [...HOTBAR_BLOCKS];
  private _hotbarTools: (ToolType | null)[] = [null,null,null,null,null,null,null,null,null];
  private health = 20;
  public hungerVal = 20;
  private onHealthChange: (_h: number) => void = () => {};
  private onHungerChange: (_h: number) => void = () => {};
  private onModeChange: (_m: GameMode) => void = () => {};
  private redstonePower: Map<string, number> = new Map();
  private redstoneActive: Map<string, boolean> = new Map();
  private rsPoweredState: Map<string, boolean> = new Map();
  private lastRedstoneUpdate = 0;
  private redstoneDirty = true;
  private onBlockChanged: ((ev: MultiplayerBlockEvent) => void) | null = null;
  private worldSeed: number;
  private worldType: 'normal' | 'flat';
  private portalCooldown = 0;
  private onPortalTravel: ((targetWorldType: 'normal' | 'flat') => void) | null = null;
  private remotePlayers = new Map<string, { mesh: THREE.Group; label: THREE.Sprite; skinKey: string }>();
  private lastGroundY = 0;
  private wasFalling = false;
  private noteParticles: { mesh: THREE.Mesh; life: number; vy: number }[] = [];
  private breakOverlayMesh!: THREE.Mesh;
  private breakOverlayMaterial!: THREE.MeshBasicMaterial;
  private breakStageTextures: THREE.Texture[] = [];
  private activeBreak: ActiveBreakState | null = null;
  private chunkRefreshTimer = 0;
  private lastPlayerChunkX = Number.NaN;
  private lastPlayerChunkZ = Number.NaN;
  private skyUpdateAccumulator = 0;
  private animalsUpdateAccumulator = 0;
  private weatherUpdateAccumulator = 0;
  private waterFlowAccumulator = 0;
  private raycastAccumulator = 0;
  private skyStep = 1 / 40;
  private animalsStep = 1 / 30;
  private weatherStep = 1 / 36;
  private waterFlowStep = 1 / 8;
  private raycastStep = 1 / 60;
  private moveVec = new THREE.Vector3();
  private forwardVec = new THREE.Vector3();
  private rightVec = new THREE.Vector3();
  private waterFlowActive = new Set<string>();

  // Advanced systems
  private physicsEngine!: PhysicsEngine;
  private commandBlockData: Map<string, any> = new Map();

  // Weather system
  private weather: WeatherType = 'clear';
  private rainParticles!: THREE.Points;
  private snowParticles!: THREE.Points;
  private lightningLight!: THREE.PointLight;
  private nextLightningTime = 0;
  private weatherTimer = 0;
  private externalEnvironmentControl = false;
  private readonly dayCycleSpeed = 1 / 720;
  
  // Season system
  private currentSeason: 'spring' | 'summer' | 'autumn' | 'winter' = 'summer';
  private seasonTimer = 0;
  private seasonDuration = 300; // 5 minutes per season
  private seasonColors = {
    spring: { sky: 0x87ceeb, grass: 0x5cb832, leaves: 0x35922e, fog: 0x87ceeb },
    summer: { sky: 0x4fc3f7, grass: 0x4caf50, leaves: 0x2d7a2d, fog: 0x4fc3f7 },
    autumn: { sky: 0xffb74d, grass: 0x8d6e63, leaves: 0xd84315, fog: 0xffcc80 },
    winter: { sky: 0xe0e0e0, grass: 0xffffff, leaves: 0xc5cae9, fog: 0xe0e0e0 }
  };
  private currentSeasonColors = { ...this.seasonColors.summer };
  
  // Device detection
  private readonly lowEndDevice: boolean;
  private readonly maxRenderDistance: number;
  private renderDistance: number;

  private detectLowEndDevice(): boolean {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
    const lowRam = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
    const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
    return isMobile || lowRam || lowCpu;
  }

  constructor(private container: HTMLElement, worldOptions?: { seed?: number; worldType?: 'normal' | 'flat' }) {
    this.worldSeed = Number.isFinite(worldOptions?.seed) ? Math.floor(worldOptions!.seed as number) : 12345;
    this.worldType = worldOptions?.worldType === 'flat' ? 'flat' : 'normal';
    this.lowEndDevice = this.detectLowEndDevice();
    this.skyStep = this.lowEndDevice ? 1 / 28 : 1 / 40;
    this.animalsStep = this.lowEndDevice ? 1 / 20 : 1 / 30;
    this.weatherStep = this.lowEndDevice ? 1 / 24 : 1 / 36;
    this.waterFlowStep = this.lowEndDevice ? 1 / 5 : 1 / 8;
    this.raycastStep = this.lowEndDevice ? 1 / 42 : 1 / 60;
    configureWorldGeneration({
      seed: this.worldSeed,
      worldType: this.worldType,
    });
    
    // Load settings
    const settings = settingsManager.getSettings();
    this.maxRenderDistance = 16;
    this.renderDistance = Math.max(3, Math.min(this.maxRenderDistance, settings.renderDistance));

    this.scene = new THREE.Scene();
    
    // Set initial background color to prevent black screen
    this.scene.background = this.skyColor;
    
    // BSL-like fog - starts earlier for atmospheric depth, ends smoothly
    const fogNear = this.renderDistance * CHUNK_SIZE * 0.3;
    const fogFar = this.renderDistance * CHUNK_SIZE * 0.9;
    this.fog = new THREE.Fog(0x87ceeb, fogNear, fogFar);
    this.scene.fog = this.fog;
    
    // Better camera settings with FOV from settings
    this.camera = new THREE.PerspectiveCamera(
      settings.fov, 
      window.innerWidth / window.innerHeight, 
      0.01, 
      2000
    );
    this.playerPos = new THREE.Vector3(8, 50, 8);
    this.camera.position.copy(this.playerPos);
    
    // Enhanced renderer with BSL-like quality
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: !this.lowEndDevice && settings.shadows && settings.fancyGraphics,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.lowEndDevice ? 1 : (settings.fancyGraphics ? 1.5 : 1.2)));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = !this.lowEndDevice && settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    
    this.setupLighting();
    this.setupSkyObjects();
    
    // Clouds based on settings
    if (settings.clouds) {
      this.setupClouds();
    }
    
    this.setupHighlight();
    this.setupBreakOverlay();
    this.setupWeather();

    // Initialize advanced systems
    this.physicsEngine = new PhysicsEngine(this.scene, this);

    window.addEventListener('resize', () => this.onResize());
    this.installGlobalModApi();

    // Listen for settings changes
    settingsManager.addListener((newSettings) => {
      this.applySettings(newSettings);
    });
  }
  
  // Apply settings dynamically
  private applySettings(settings: import('./settings').GameSettings) {
    const nextRenderDistance = Math.max(3, Math.min(this.maxRenderDistance, settings.renderDistance));
    if (nextRenderDistance !== this.renderDistance) {
      this.renderDistance = nextRenderDistance;
      this.fog.near = this.renderDistance * CHUNK_SIZE * 0.3;
      this.fog.far = this.renderDistance * CHUNK_SIZE * 0.9;
      this.chunkRefreshTimer = 999;
      this.lastPlayerChunkX = Number.NaN;
      this.lastPlayerChunkZ = Number.NaN;
      this.updateChunks();
    }

    // Update FOV
    this.camera.fov = settings.fov;
    this.camera.updateProjectionMatrix();
    
    // Update shadows
    this.renderer.shadowMap.enabled = !this.lowEndDevice && settings.shadows;
    this.sunLight.castShadow = !this.lowEndDevice && settings.shadows;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.lowEndDevice ? 1 : (settings.fancyGraphics ? 1.5 : 1.2)));
    
    // Update clouds visibility
    if (settings.clouds && !this.cloudsGroup) {
      this.setupClouds();
    } else if (!settings.clouds && this.cloudsGroup) {
      this.scene.remove(this.cloudsGroup);
      this.cloudsGroup = undefined as any;
    }
  }

  private setupLighting() {
    // BSL-like advanced lighting setup
    const shadowsEnabled = !this.lowEndDevice && settingsManager.getSettings().shadows;
    
    // 1. Ambient Light with warm tones
    this.ambientLight = new THREE.AmbientLight(0xffe4c4, 0.4);
    this.scene.add(this.ambientLight);
    
    // 2. Main Directional Light (Sun) with high quality shadows
    this.sunLight = new THREE.DirectionalLight(0xfff8e7, 2.5);
    this.sunLight.position.set(60, 120, 40);
    this.sunLight.castShadow = shadowsEnabled;
    
    // High quality shadow map
    const shadowMapSize = this.lowEndDevice ? 512 : 1536;
    this.sunLight.shadow.mapSize.width = shadowMapSize;
    this.sunLight.shadow.mapSize.height = shadowMapSize;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 300;
    this.sunLight.shadow.camera.left = -100;
    this.sunLight.shadow.camera.right = 100;
    this.sunLight.shadow.camera.top = 100;
    this.sunLight.shadow.camera.bottom = -100;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.radius = 2;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    
    // 3. Hemisphere Light for realistic sky/ground illumination
    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d5c3d, 0.6);
    this.scene.add(this.hemiLight);
    
    // 4. Rim light for depth
    const rimLight = new THREE.DirectionalLight(0xffd700, 0.5);
    rimLight.position.set(-50, 50, -50);
    this.scene.add(rimLight);
    
    // 5. Soft fill light
    const fill = new THREE.PointLight(0xffcc88, 0.3, 20);
    fill.position.set(0, 2, 0);
    this.camera.add(fill);
    this.scene.add(this.camera);
    
    // 6. Lightning light for storms
    this.lightningLight = new THREE.PointLight(0xcceeff, 0, 150);
    this.lightningLight.position.set(0, 80, 0);
    this.scene.add(this.lightningLight);
    
    // 7. Global illumination simulation
    const globalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    globalLight.position.set(0, -1, 0);
    this.scene.add(globalLight);
  }
  
  private setupSkyObjects() {
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(9, 22, 22), new THREE.MeshBasicMaterial({ color: 0xffee88, fog: false }));
    this.scene.add(this.sunMesh);
    this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(6, 18, 18), new THREE.MeshBasicMaterial({ color: 0xddeeff, fog: false }));
    this.scene.add(this.moonMesh);

    this.sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.createSkyGlowTexture('rgba(255,236,170,1)', 'rgba(255,164,48,0)'),
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        fog: false,
      })
    );
    this.sunGlow.scale.set(64, 64, 1);
    this.scene.add(this.sunGlow);

    this.moonGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.createSkyGlowTexture('rgba(220,232,255,0.9)', 'rgba(145,180,255,0)'),
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
        fog: false,
      })
    );
    this.moonGlow.scale.set(44, 44, 1);
    this.scene.add(this.moonGlow);

    this.starsGroup = new THREE.Group();
    const sp: number[] = [];
    for (let i = 0; i < 600; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      sp.push(280 * Math.sin(phi) * Math.cos(theta), 280 * Math.cos(phi), 280 * Math.sin(phi) * Math.sin(theta));
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.starsGroup.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, fog: false, sizeAttenuation: false })));
    this.scene.add(this.starsGroup);
  }

  private createSkyGlowTexture(inner: string, outer: string): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.36, inner);
    grad.addColorStop(1, outer);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  private setupClouds() {
    this.cloudsGroup = new THREE.Group();
    const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, fog: false });
    for (let i = 0; i < 30; i++) {
      const c = new THREE.Group();
      for (let j = 0; j < 3 + Math.floor(Math.random() * 4); j++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(4+Math.random()*8, 1.5+Math.random(), 4+Math.random()*6), cm);
        b.position.set((Math.random()-0.5)*10, (Math.random()-0.5)*1.5, (Math.random()-0.5)*10);
        c.add(b);
      }
      c.position.set((Math.random()-0.5)*400, 58+Math.random()*12, (Math.random()-0.5)*400);
      this.cloudsGroup.add(c);
    }
    this.scene.add(this.cloudsGroup);
  }

  private setupHighlight() {
    const e = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005));
    this.highlightMesh = new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color: 0x111111, linewidth: 2, transparent: true, opacity: 0.7 }));
    this.highlightMesh.visible = false;
    this.scene.add(this.highlightMesh);
  }

  private setupBreakOverlay() {
    const geo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    this.breakOverlayMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.0,
      color: 0xffffff,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      alphaTest: 0.03,
    });
    this.breakOverlayMesh = new THREE.Mesh(geo, this.breakOverlayMaterial);
    this.breakOverlayMesh.visible = false;
    this.breakOverlayMesh.renderOrder = 8;
    this.scene.add(this.breakOverlayMesh);
    this.loadBreakTextures();
  }

  private loadBreakTextures() {
    const baseUrl = (((import.meta as any)?.env?.BASE_URL) as string) || '/';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const loader = new THREE.TextureLoader();

    for (let i = 0; i < 10; i++) {
      const fallback = this.createProceduralCrackTexture(i);
      this.breakStageTextures[i] = fallback;
      const url = `${cleanBase}assets/block/destroy_stage_${i}.png`;
      loader.load(
        url,
        (tex) => {
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestFilter;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          const prev = this.breakStageTextures[i];
          if (prev && prev !== tex) prev.dispose();
          this.breakStageTextures[i] = tex;
        },
        undefined,
        () => {
          // Keep procedural fallback.
        }
      );
    }
  }

  private createProceduralCrackTexture(stage: number): THREE.CanvasTexture {
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);

    const crackCount = 4 + stage * 2;
    let seed = (stage + 1) * 9127;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    ctx.strokeStyle = 'rgba(0,0,0,0.95)';
    ctx.lineCap = 'round';
    for (let i = 0; i < crackCount; i++) {
      const x0 = rand() * size;
      const y0 = rand() * size;
      const angle = rand() * Math.PI * 2;
      const len = 3 + rand() * (3 + stage * 0.7);
      const x1 = x0 + Math.cos(angle) * len;
      const y1 = y0 + Math.sin(angle) * len;
      ctx.lineWidth = 0.8 + stage * 0.08;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      // Branch crack.
      if (stage > 2 && rand() > 0.45) {
        const a2 = angle + (rand() > 0.5 ? 1 : -1) * (0.5 + rand() * 0.8);
        const l2 = len * (0.3 + rand() * 0.45);
        ctx.beginPath();
        ctx.moveTo(x0 + (x1 - x0) * 0.6, y0 + (y1 - y0) * 0.6);
        ctx.lineTo(x0 + (x1 - x0) * 0.6 + Math.cos(a2) * l2, y0 + (y1 - y0) * 0.6 + Math.sin(a2) * l2);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  private clearBreakState() {
    this.activeBreak = null;
    if (this.breakOverlayMesh) this.breakOverlayMesh.visible = false;
  }

  private isBreakingTargetSame(x: number, y: number, z: number, block: BlockType): boolean {
    return !!this.activeBreak &&
      this.activeBreak.x === x &&
      this.activeBreak.y === y &&
      this.activeBreak.z === z &&
      this.activeBreak.block === block;
  }

  private getBreakIncrement(block: BlockType): number {
    if (DECORATIVE_BLOCKS.has(block)) return 1.0;
    if (block === BlockType.LEAVES || block === BlockType.LEAVES_BIRCH || block === BlockType.LEAVES_SPRUCE
      || block === BlockType.LEAVES_JUNGLE || block === BlockType.LEAVES_ACACIA
      || block === BlockType.LEAVES_DARK_OAK || block === BlockType.LEAVES_CHERRY
      || block === BlockType.GLASS) return 0.65;

    const props = customizationManager.getBlockProperties(block);
    const hardness = Math.max(4, Number(props?.hardness ?? 50));
    let toolBoost = 1;

    const pickaxeBlocks = new Set([
      BlockType.STONE, BlockType.COBBLESTONE, BlockType.OBSIDIAN, BlockType.DEEPSLATE,
      BlockType.IRON_BLOCK, BlockType.GOLD_BLOCK, BlockType.DIAMOND_BLOCK, BlockType.LAPIS_BLOCK,
      BlockType.REDSTONE_BLOCK, BlockType.QUARTZ_BLOCK, BlockType.QUARTZ_PILLAR, BlockType.BASALT,
      BlockType.POLISHED_BASALT, BlockType.BEDROCK,
    ]);
    const axeBlocks = new Set([
      BlockType.WOOD, BlockType.LOG_BIRCH, BlockType.LOG_SPRUCE, BlockType.LOG_JUNGLE, BlockType.LOG_ACACIA,
      BlockType.LOG_DARK_OAK, BlockType.LOG_CHERRY, BlockType.PLANKS, BlockType.PLANKS_BIRCH, BlockType.PLANKS_SPRUCE,
      BlockType.PLANKS_JUNGLE, BlockType.PLANKS_ACACIA, BlockType.PLANKS_DARK_OAK, BlockType.PLANKS_CHERRY,
      BlockType.BOOKSHELF, BlockType.CRAFTING_TABLE, BlockType.FENCE_OAK, BlockType.DOOR_OAK,
    ]);
    const shovelBlocks = new Set([
      BlockType.DIRT, BlockType.GRASS, BlockType.SAND, BlockType.GRAVEL, BlockType.CLAY,
      BlockType.SNOW, BlockType.MYCELIUM, BlockType.PODZOL,
    ]);

    if (this.selectedTool === ToolType.PICKAXE && pickaxeBlocks.has(block)) toolBoost = 2.2;
    if (this.selectedTool === ToolType.AXE && axeBlocks.has(block)) toolBoost = 2.0;
    if (this.selectedTool === ToolType.SHOVEL && shovelBlocks.has(block)) toolBoost = 2.0;
    if (this.selectedTool === ToolType.SWORD && DECORATIVE_BLOCKS.has(block)) toolBoost = 1.7;

    const base = (10 / hardness) * toolBoost;
    return Math.max(0.06, Math.min(0.48, base));
  }

  private updateBreakOverlay() {
    if (!this.activeBreak || !this.breakOverlayMesh) {
      if (this.breakOverlayMesh) this.breakOverlayMesh.visible = false;
      return;
    }
    const stage = Math.max(0, Math.min(9, Math.floor(this.activeBreak.progress * 10)));
    const tex = this.breakStageTextures[stage];
    if (tex && this.breakOverlayMaterial.map !== tex) {
      this.breakOverlayMaterial.map = tex;
      this.breakOverlayMaterial.needsUpdate = true;
    }
    this.breakOverlayMaterial.opacity = 0.22 + this.activeBreak.progress * 0.78;
    this.breakOverlayMesh.visible = true;
    this.breakOverlayMesh.position.set(this.activeBreak.x + 0.5, this.activeBreak.y + 0.5, this.activeBreak.z + 0.5);
  }

  private updateBreakState(dt: number) {
    if (!this.activeBreak) {
      if (this.breakOverlayMesh) this.breakOverlayMesh.visible = false;
      return;
    }

    if (!this.crosshairTarget) {
      this.activeBreak.progress = Math.max(0, this.activeBreak.progress - dt * 3.5);
    } else {
      const bx = Math.floor(this.crosshairTarget.blockPos.x);
      const by = Math.floor(this.crosshairTarget.blockPos.y);
      const bz = Math.floor(this.crosshairTarget.blockPos.z);
      const same = bx === this.activeBreak.x && by === this.activeBreak.y && bz === this.activeBreak.z;
      const currentBlock = this.getBlockAtLoaded(this.activeBreak.x, this.activeBreak.y, this.activeBreak.z);
      if (!same || currentBlock === BlockType.AIR || currentBlock !== this.activeBreak.block) {
        this.clearBreakState();
        return;
      }
      const sinceLastHit = (performance.now() - this.activeBreak.lastHit) / 1000;
      if (sinceLastHit > 0.22) this.activeBreak.progress = Math.max(0, this.activeBreak.progress - dt * 2.2);
    }

    if (this.activeBreak.progress <= 0) {
      this.clearBreakState();
      return;
    }
    this.updateBreakOverlay();
  }

  private setupWeather() {
    // Rain particles
    const rainGeo = new THREE.BufferGeometry();
    const rainCount = this.lowEndDevice ? 2200 : 8000;
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount * 3; i += 3) {
      rainPos[i] = (Math.random() - 0.5) * 100;
      rainPos[i + 1] = Math.random() * 60;
      rainPos[i + 2] = (Math.random() - 0.5) * 100;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0xaaccff,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      fog: true
    });
    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);

    // Snow particles
    const snowGeo = new THREE.BufferGeometry();
    const snowCount = this.lowEndDevice ? 1600 : 5000;
    const snowPos = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount * 3; i += 3) {
      snowPos[i] = (Math.random() - 0.5) * 100;
      snowPos[i + 1] = Math.random() * 60;
      snowPos[i + 2] = (Math.random() - 0.5) * 100;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.25,
      transparent: true,
      opacity: 0.8,
      fog: true
    });
    this.snowParticles = new THREE.Points(snowGeo, snowMat);
    this.snowParticles.visible = false;
    this.scene.add(this.snowParticles);
  }

  // Public API
  setLoadProgress(cb: (_p: number) => void) { this.onLoadProgress = cb; }
  setHealthCallback(cb: (_h: number) => void) { this.onHealthChange = cb; }
  setHungerCallback(cb: (_h: number) => void) { this.onHungerChange = cb; }
  setModeCallback(cb: (_m: GameMode) => void) { this.onModeChange = cb; }
  setMoveInput(x: number, z: number) { this.moveInput = { x, z }; }
  setRotation(yaw: number, pitch: number) {
    this.playerRotation.yaw = yaw;
    this.playerRotation.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
  }
  getRotation() { return { ...this.playerRotation }; }
  setFlyUp(v: boolean) { this.flyUp = v; }
  setFlyDown(v: boolean) { this.flyDown = v; }
  setJump(v: boolean) { this.jumping = v; }
  getPlayerPos() { return this.playerPos.clone(); }
  getGameMode() { return this._gameMode; }
  getWorldConfig() { return { seed: this.worldSeed, worldType: this.worldType }; }
  setBlockChangeCallback(cb: ((ev: MultiplayerBlockEvent) => void) | null) { this.onBlockChanged = cb; }
  setPortalTravelCallback(cb: ((targetWorldType: 'normal' | 'flat') => void) | null) { this.onPortalTravel = cb; }

  createSpawnPortalTo(targetWorldType: 'normal' | 'flat') {
    const frameBlock = targetWorldType === 'normal' ? BlockType.OBSIDIAN : BlockType.PORTAL_FRAME;
    const baseX = Math.floor(this.playerPos.x) + 4;
    const baseZ = Math.floor(this.playerPos.z);
    let baseY = 40;
    for (let y = CHUNK_HEIGHT - 2; y >= 2; y--) {
      if (this.isBlockSolid(baseX, y, baseZ)) {
        baseY = y + 1;
        break;
      }
    }

    for (let dx = -4; dx <= 4; dx++) for (let dy = 0; dy <= 6; dy++) for (let dz = -2; dz <= 2; dz++) {
      const b = this.getBlockAtLoaded(baseX + dx, baseY + dy, baseZ + dz);
      if (b === BlockType.PORTAL) return;
    }

    const width = 2;
    const height = 3;
    for (let dx = 0; dx <= width + 1; dx++) {
      for (let dy = 0; dy <= height + 1; dy++) {
        const border = dx === 0 || dx === width + 1 || dy === 0 || dy === height + 1;
        const wx = baseX + dx;
        const wy = baseY + dy;
        const wz = baseZ;
        this.setBlockAt(wx, wy, wz, border ? frameBlock : BlockType.PORTAL);
      }
    }
    this.rebuildAllChunks();
  }

  setSelectedSlot(slot: number) {
    this._selectedSlot = slot;
    const tool = this._hotbarTools[slot];
    if (tool) { this.selectedTool = tool; this.selectedBlock = BlockType.AIR; }
    else { this.selectedTool = ToolType.NONE; this.selectedBlock = this._hotbar[slot] || BlockType.GRASS; }
  }
  setHotbarSlot(slot: number, block: BlockType) {
    this._hotbar[slot] = block;
    this._hotbarTools[slot] = null;
    if (slot === this._selectedSlot) { this.selectedBlock = block; this.selectedTool = ToolType.NONE; }
  }
  setHotbarTool(slot: number, tool: ToolType) {
    this._hotbarTools[slot] = tool;
    this._hotbar[slot] = BlockType.AIR;
    if (slot === this._selectedSlot) { this.selectedTool = tool; this.selectedBlock = BlockType.AIR; }
  }
  getHotbarTools() { return [...this._hotbarTools]; }

  toggleGameMode() {
    this._gameMode = this._gameMode === 'creative' ? 'survival' : 'creative';
    if (this._gameMode === 'creative') {
      this.health = 20; this.hungerVal = 20;
      this.onHealthChange(20); this.onHungerChange(20);
      this.playerVelocity.set(0, 0, 0);
    }
    this.onModeChange(this._gameMode);
  }

  getBlockAt(wx: number, wy: number, wz: number): BlockType {
    const bx = Math.floor(wx), by = Math.floor(wy), bz = Math.floor(wz);
    if (by < 0 || by >= CHUNK_HEIGHT) return BlockType.AIR;
    const cx = Math.floor(bx / CHUNK_SIZE), cz = Math.floor(bz / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return BlockType.STONE;
    return getBlock(chunk, ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, by, ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE);
  }

  private getBlockAtLoaded(wx: number, wy: number, wz: number): BlockType {
    const bx = Math.floor(wx), by = Math.floor(wy), bz = Math.floor(wz);
    if (by < 0 || by >= CHUNK_HEIGHT) return BlockType.AIR;
    const cx = Math.floor(bx / CHUNK_SIZE), cz = Math.floor(bz / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return BlockType.AIR;
    return getBlock(chunk, ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, by, ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE);
  }

  private waterKey(x: number, y: number, z: number) {
    return `${x},${y},${z}`;
  }

  private queueWaterAt(x: number, y: number, z: number) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    if (this.getBlockAtLoaded(x, y, z) !== BlockType.WATER) return;
    this.waterFlowActive.add(this.waterKey(x, y, z));
  }

  private queueWaterAround(x: number, y: number, z: number) {
    this.queueWaterAt(x, y, z);
    this.queueWaterAt(x + 1, y, z);
    this.queueWaterAt(x - 1, y, z);
    this.queueWaterAt(x, y, z + 1);
    this.queueWaterAt(x, y, z - 1);
    this.queueWaterAt(x, y + 1, z);
    this.queueWaterAt(x, y - 1, z);
  }

  private setLoadedBlockFast(x: number, y: number, z: number, blockType: BlockType, rebuildChunks: Set<string>): BlockType | null {
    if (y < 0 || y >= CHUNK_HEIGHT) return null;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return null;

    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const prev = getBlock(chunk, lx, y, lz);
    if (prev === blockType) return prev;

    setBlockInChunk(chunk, lx, y, lz, blockType);
    rebuildChunks.add(key);
    if (lx === 0) rebuildChunks.add(chunkKey(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) rebuildChunks.add(chunkKey(cx + 1, cz));
    if (lz === 0) rebuildChunks.add(chunkKey(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) rebuildChunks.add(chunkKey(cx, cz + 1));
    return prev;
  }

  private rebuildChunkSet(chunks: Set<string>) {
    for (const key of chunks) {
      const chunk = this.chunks.get(key);
      if (chunk) this.buildChunkMesh(chunk);
    }
  }

  private isBlockSolid(wx: number, wy: number, wz: number): boolean {
    return isCollidable(this.getBlockAt(wx, wy, wz));
  }

  // Collision per axis
  private collideAxis(pos: THREE.Vector3, vel: THREE.Vector3, axis: 'x' | 'y' | 'z', dt: number): boolean {
    const hw = PLAYER_WIDTH / 2;
    const newVal = pos[axis] + vel[axis] * dt;
    const tp = pos.clone(); tp[axis] = newVal;
    const mnX = tp.x - hw, mxX = tp.x + hw - 0.001;
    const mnY = tp.y, mxY = tp.y + PLAYER_HEIGHT - 0.001;
    const mnZ = tp.z - hw, mxZ = tp.z + hw - 0.001;
    for (let bx = Math.floor(mnX); bx <= Math.floor(mxX); bx++) {
      for (let by = Math.floor(mnY); by <= Math.floor(mxY); by++) {
        for (let bz = Math.floor(mnZ); bz <= Math.floor(mxZ); bz++) {
          if (this.isBlockSolid(bx, by, bz)) {
            if (axis === 'y') {
              if (vel.y < 0) { pos.y = by + 1.0; this.onGround = true; }
              else { pos.y = by - PLAYER_HEIGHT; }
              vel.y = 0;
            } else if (axis === 'x') {
              pos.x = vel.x > 0 ? bx - hw : bx + 1 + hw;
              vel.x = 0;
            } else {
              pos.z = vel.z > 0 ? bz - hw : bz + 1 + hw;
              vel.z = 0;
            }
            return true;
          }
        }
      }
    }
    pos[axis] = newVal;
    return false;
  }

  // Tree collapse
  private collapseTree(wx: number, wy: number, wz: number) {
    const visited = new Set<string>();
    const queue = [{ x: wx, y: wy, z: wz }];
    const toRemove: { x: number; y: number; z: number }[] = [];
    while (queue.length > 0 && visited.size < 200) {
      const cur = queue.shift()!;
      const k = `${cur.x},${cur.y},${cur.z}`;
      if (visited.has(k)) continue;
      visited.add(k);
      const b = this.getBlockAtLoaded(cur.x, cur.y, cur.z);
      if (b === BlockType.WOOD || b === BlockType.LOG_BIRCH || b === BlockType.LEAVES || b === BlockType.LEAVES_BIRCH) {
        toRemove.push(cur);
        for (const d of [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]]) {
          queue.push({ x: cur.x + d[0], y: cur.y + d[1], z: cur.z + d[2] });
        }
      }
    }
    const chunksToRebuild = new Set<string>();
    for (const p of toRemove) {
      const cx = Math.floor(p.x / CHUNK_SIZE), cz = Math.floor(p.z / CHUNK_SIZE);
      const key = chunkKey(cx, cz);
      const chunk = this.chunks.get(key);
      if (chunk) {
        setBlockInChunk(chunk, ((p.x%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE, p.y, ((p.z%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE, BlockType.AIR);
        chunksToRebuild.add(key);
      }
    }
    for (const key of chunksToRebuild) {
      const c = this.chunks.get(key);
      if (c) this.buildChunkMesh(c);
    }
  }

  // Redstone
  private getRedstonePower(wx: number, wy: number, wz: number): number {
    return this.redstonePower.get(`${wx},${wy},${wz}`) || 0;
  }
  private setRSPower(wx: number, wy: number, wz: number, p: number) {
    const k = `${wx},${wy},${wz}`;
    if (p > 0) this.redstonePower.set(k, p); else this.redstonePower.delete(k);
  }

  private updateRedstone() {
    this.redstonePower.clear();
    const oldActive = new Map(this.redstoneActive);
    this.redstoneActive.clear();
    const sources: { x: number; y: number; z: number; power: number }[] = [];
    for (const [, chunk] of this.chunks) {
      const w0 = chunk.cx * CHUNK_SIZE, z0 = chunk.cz * CHUNK_SIZE;
      for (let x = 0; x < CHUNK_SIZE; x++) for (let y = 0; y < CHUNK_HEIGHT; y++) for (let z = 0; z < CHUNK_SIZE; z++) {
        const b = getBlock(chunk, x, y, z);
        const wx = w0+x, wz = z0+z;
        if (b === BlockType.REDSTONE_BLOCK || b === BlockType.REDSTONE_TORCH) {
          sources.push({ x: wx, y, z: wz, power: 15 });
        } else if (b === BlockType.LEVER || b === BlockType.BUTTON) {
          const key = `${wx},${y},${wz}`;
          if (oldActive.get(key)) { sources.push({ x: wx, y, z: wz, power: 15 }); this.redstoneActive.set(key, true); }
        }
      }
    }
    const queue = [...sources];
    for (const s of queue) this.setRSPower(s.x, s.y, s.z, s.power);
    const dirs = [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[0,-1,0]];
    let iter = 0;
    while (queue.length > 0 && iter < 5000) {
      iter++;
      const cur = queue.shift()!;
      const cp = this.getRedstonePower(cur.x, cur.y, cur.z);
      if (cp <= 1) continue;
      for (const d of dirs) {
        const nx = cur.x+d[0], ny = cur.y+d[1], nz = cur.z+d[2];
        const nb = this.getBlockAtLoaded(nx, ny, nz);
        if (nb === BlockType.REDSTONE_DUST) {
          const np = cp - 1;
          if (np > this.getRedstonePower(nx, ny, nz)) { this.setRSPower(nx, ny, nz, np); queue.push({x:nx,y:ny,z:nz,power:np}); }
        }
        if (nb === BlockType.REDSTONE_REPEATER && 15 > this.getRedstonePower(nx, ny, nz)) {
          this.setRSPower(nx, ny, nz, 15); queue.push({x:nx,y:ny,z:nz,power:15});
        }
      }
    }
    let needsRebuild = false;
    for (const [, chunk] of this.chunks) {
      const w0 = chunk.cx * CHUNK_SIZE, z0 = chunk.cz * CHUNK_SIZE;
      for (let x = 0; x < CHUNK_SIZE; x++) for (let y = 0; y < CHUNK_HEIGHT; y++) for (let z = 0; z < CHUNK_SIZE; z++) {
        if (getBlock(chunk, x, y, z) === BlockType.REDSTONE_LAMP) {
          let powered = false;
          for (const d of dirs) if (this.getRedstonePower(w0+x+d[0], y+d[1], z0+z+d[2]) > 0) { powered = true; break; }
          const key = `${w0+x},${y},${z0+z}`;
          if (powered !== (oldActive.get(key) || false)) needsRebuild = true;
          if (powered) this.redstoneActive.set(key, true);
        }
      }
    }
    const triggerTypes = new Set([BlockType.COMMAND_BLOCK, BlockType.TNT, BlockType.NOTE_BLOCK]);
    const nextPoweredState = new Map<string, boolean>();
    for (const [, chunk] of this.chunks) {
      const w0 = chunk.cx * CHUNK_SIZE, z0 = chunk.cz * CHUNK_SIZE;
      for (let x = 0; x < CHUNK_SIZE; x++) for (let y = 0; y < CHUNK_HEIGHT; y++) for (let z = 0; z < CHUNK_SIZE; z++) {
        const b = getBlock(chunk, x, y, z);
        if (!triggerTypes.has(b)) continue;
        const wx = w0 + x, wz = z0 + z;
        const key = `${wx},${y},${wz}`;
        let powered = false;
        for (const d of dirs) {
          if (this.getRedstonePower(wx + d[0], y + d[1], wz + d[2]) > 0) {
            powered = true;
            break;
          }
        }
        const wasPowered = this.rsPoweredState.get(key) || false;
        if (powered && !wasPowered) {
          if (b === BlockType.COMMAND_BLOCK) {
            const saved = this.commandBlockData.get(key) as { command?: string } | undefined;
            const command = saved?.command?.trim();
            if (command) {
              const normalized = command.startsWith('/') ? command.slice(1) : command;
              void this.executeCommand(normalized);
            }
          } else if (b === BlockType.TNT) {
            this.explodeTNT(wx, y, wz);
          } else if (b === BlockType.NOTE_BLOCK) {
            this.spawnNote(wx, y + 1, wz);
          }
        }
        nextPoweredState.set(key, powered);
      }
    }
    this.rsPoweredState = nextPoweredState;

    if (needsRebuild) {
      for (const [key, chunk] of this.chunks) { if (this.chunkMeshes.has(key)) this.buildChunkMesh(chunk); }
    }
  }

  private requestRedstoneRefresh(immediate = false) {
    this.redstoneDirty = true;
    if (!immediate) return;
    this.lastRedstoneUpdate = 0;
    this.redstoneDirty = false;
    this.updateRedstone();
  }

  interactBlock() {
    if (!this.crosshairTarget) return;
    const { blockPos } = this.crosshairTarget;
    const bx = Math.floor(blockPos.x), by = Math.floor(blockPos.y), bz = Math.floor(blockPos.z);
    const posKey = `${bx},${by},${bz}`;
    const block = this.getBlockAtLoaded(bx, by, bz);
    if (block === BlockType.LEVER) {
      if (this.redstoneActive.get(posKey)) this.redstoneActive.delete(posKey);
      else this.redstoneActive.set(posKey, true);
      this.requestRedstoneRefresh(true);
    } else if (block === BlockType.BUTTON) {
      this.redstoneActive.set(posKey, true);
      this.requestRedstoneRefresh(true);
      setTimeout(() => { this.redstoneActive.delete(posKey); this.requestRedstoneRefresh(true); }, 1000);
    } else if (block === BlockType.PORTAL_FRAME || block === BlockType.OBSIDIAN) {
      if (this.tryActivatePortalFrame(bx, by, bz)) {
        return;
      }
    } else if (block === BlockType.TNT) {
      this.explodeTNT(bx, by, bz);
    } else if (block === BlockType.NOTE_BLOCK) {
      this.spawnNote(bx, by + 1, bz);
    } else if (block === BlockType.COMMAND_BLOCK) {
      const saved = this.commandBlockData.get(posKey) as { command?: string } | undefined;
      let command = saved?.command?.trim() || '';
      const shouldEdit = command ? window.confirm(`Command Block:\nCurrent command: ${command}\n\nPress OK to edit, Cancel to execute.`) : true;

      if (shouldEdit) {
        const input = window.prompt('Command Block: Enter command (example: /time set 18000)', command || '/time set 1000');
        if (input === null) return;
        command = input.trim();
        if (!command) return;
        this.commandBlockData.set(posKey, { command });
      }

      const normalized = command.startsWith('/') ? command.slice(1) : command;
      void this.executeCommand(normalized).then((result) => {
        const prefix = result.success ? 'Command Block success' : 'Command Block error';
        window.alert(`${prefix}: ${result.output}`);
      });
    }
  }

  private tryActivatePortalFrame(x: number, y: number, z: number): boolean {
    const frameOk = (b: BlockType) => b === BlockType.OBSIDIAN || b === BlockType.PORTAL_FRAME;
    const tryAxis = (axis: 'x' | 'z'): boolean => {
      const ix = axis === 'x' ? 1 : 0;
      const iz = axis === 'z' ? 1 : 0;
      const x0 = x - ix;
      const z0 = z - iz;
      const width = 2;
      const height = 3;
      for (let dx = 0; dx <= width + 1; dx++) {
        for (let dy = 0; dy <= height + 1; dy++) {
          const wx = x0 + dx * ix;
          const wz = z0 + dx * iz;
          const wy = y - 1 + dy;
          const border = dx === 0 || dx === width + 1 || dy === 0 || dy === height + 1;
          const b = this.getBlockAtLoaded(wx, wy, wz);
          if (border) {
            if (!frameOk(b)) return false;
          } else {
            if (b !== BlockType.AIR && b !== BlockType.PORTAL) return false;
          }
        }
      }
      for (let dx = 1; dx <= width; dx++) {
        for (let dy = 1; dy <= height; dy++) {
          const wx = x0 + dx * ix;
          const wz = z0 + dx * iz;
          const wy = y - 1 + dy;
          this.setBlockAt(wx, wy, wz, BlockType.PORTAL);
        }
      }
      return true;
    };
    return tryAxis('x') || tryAxis('z');
  }

  private spawnNote(x: number, y: number, z: number) {
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshBasicMaterial({ color: colors[Math.floor(Math.random()*colors.length)], transparent: true, opacity: 1 }));
    m.position.set(x+0.5, y+0.5, z+0.5);
    this.scene.add(m);
    this.noteParticles.push({ mesh: m, life: 2, vy: 1+Math.random() });
  }

  private explodeTNT(x: number, y: number, z: number) {
    const r = 4;
    const rebuild = new Set<string>();
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
      if (dx*dx+dy*dy+dz*dz > r*r) continue;
      const bx = x+dx, by = y+dy, bz = z+dz;
      const b = this.getBlockAtLoaded(bx, by, bz);
      if (b !== BlockType.AIR && b !== BlockType.BEDROCK) {
        const cx = Math.floor(bx/CHUNK_SIZE), cz = Math.floor(bz/CHUNK_SIZE);
        const key = chunkKey(cx, cz);
        const chunk = this.chunks.get(key);
        if (chunk) {
          setBlockInChunk(chunk, ((bx%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE, by, ((bz%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE, BlockType.AIR);
          rebuild.add(key);
          this.queueWaterAround(bx, by, bz);
        }
      }
    }
    for (const key of rebuild) { const c = this.chunks.get(key); if (c) this.buildChunkMesh(c); }
  }

  async generateWorld() {
    console.log('[DEBUG] Starting world generation...');
    
    // Phase 1: Load textures (0% - 20%)
    this.onLoadProgress(0);
    console.log('[DEBUG] Phase 1: Loading textures...');
    
    try {
      // Load with timeout to prevent hanging
      const textureTimeout = new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('Texture load timeout')), 10000)
      );
      
      const textureLoad = textureManager.preloadDefaultTextures((loaded, total) => {
        const progress = (loaded / total) * 0.2;
        this.onLoadProgress(progress);
        console.log(`[DEBUG] Texture progress: ${Math.round(progress * 100)}% (${loaded}/${total})`);
      });
      
      await Promise.race([textureLoad, textureTimeout]);
      console.log('[DEBUG] Textures loaded successfully');
    } catch (e) {
      console.warn('[DEBUG] Texture loading failed or timed out, continuing with colors:', e);
    }
    
    // Phase 2: Generate chunks (20% - 60%)
    console.log('[DEBUG] Phase 2: Generating chunks...');
    this.onLoadProgress(0.2);
    
    const totalChunks = (this.renderDistance * 2 + 1) ** 2;
    let generatedCount = 0;
    const pcx = Math.floor(this.playerPos.x / CHUNK_SIZE);
    const pcz = Math.floor(this.playerPos.z / CHUNK_SIZE);
    
    for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
      for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = chunkKey(cx, cz);
        
        if (!this.chunks.has(key)) {
          try {
            this.chunks.set(key, generateChunk(cx, cz));
          } catch (e) {
            console.error(`[DEBUG] Failed to generate chunk ${key}:`, e);
          }
        }
        
        generatedCount++;
        const progress = 0.2 + (generatedCount / totalChunks) * 0.4;
        this.onLoadProgress(progress);
        
        // Yield to prevent blocking
        if (generatedCount % 2 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }
    }
    
    console.log(`[DEBUG] Generated ${generatedCount} chunks`);
    
    // Phase 3: Build meshes (60% - 95%)
    console.log('[DEBUG] Phase 3: Building chunk meshes...');
    this.onLoadProgress(0.6);
    
    let builtCount = 0;
    const totalBuilt = this.chunks.size;
    
    for (const [, chunk] of this.chunks) {
      try {
        this.buildChunkMesh(chunk);
        builtCount++;
        const progress = 0.6 + (builtCount / totalBuilt) * 0.35;
        this.onLoadProgress(progress);
        
        // Yield every few chunks
        if (builtCount % 3 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      } catch (e) {
        console.error(`[DEBUG] Failed to build chunk mesh:`, e);
      }
    }
    
    console.log(`[DEBUG] Built ${builtCount} chunk meshes`);
    
    // Phase 4: Final setup (95% - 100%)
    console.log('[DEBUG] Phase 4: Final setup...');
    this.onLoadProgress(0.95);
    
    try {
      this.spawnAnimals();
      this.findSpawnHeight();
      console.log('[DEBUG] Spawn height:', this.playerPos.y);
    } catch (e) {
      console.error('[DEBUG] Error in final setup:', e);
    }
    
    this.onLoadProgress(1);
    this.requestRedstoneRefresh(false);
    console.log('[DEBUG] World generation complete!');
  }

  private findSpawnHeight() {
    const bx = Math.floor(this.playerPos.x), bz = Math.floor(this.playerPos.z);
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (this.isBlockSolid(bx, y, bz)) { this.playerPos.y = y + 1.01; this.lastGroundY = this.playerPos.y; return; }
    }
  }

  private spawnAnimals() {
    const types = ['pig', 'cow', 'chicken', 'sheep', 'rabbit', 'horse'];
    const animalCount = this.lowEndDevice ? 12 : 30;
    for (let i = 0; i < animalCount; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const x = this.playerPos.x + (Math.random() - 0.5) * 80;
      const z = this.playerPos.z + (Math.random() - 0.5) * 80;
      let gy = 40;
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) { if (this.isBlockSolid(Math.floor(x), y, Math.floor(z))) { gy = y + 1; break; } }
      if (gy <= WATER_LEVEL) continue;
      const a = this.createAnimal(type, new THREE.Vector3(x, gy, z));
      this.animals.push(a);
      this.scene.add(a.mesh);
    }
    
    // Spawn NPCs (traders)
    this.spawnNPCs();
  }
  
  private spawnNPCs() {
    const npcColors = [0x3498db, 0xe74c3c, 0x2ecc71, 0x9b59b6, 0xf39c12];
    const npcNames = ['Trader Joe', 'Merchant Mary', 'Shopkeeper Sam', 'Vendor Violet', 'Dealer Dave'];
    const npcDialogues = [
      ['Hello traveler!', 'Want to trade?', 'I have rare items!', 'Check out my goods!'],
      ['Greetings!', 'What brings you here?', 'I\'ve been waiting for you.', 'Care for a trade?'],
      ['Hail!', 'Fine weather today!', 'Need supplies?', 'Welcome to my shop!'],
      ['Well met!', 'Looking for something?', 'I have what you need.', 'Trade with me!'],
      ['Salutations!', 'Come closer!', 'Rare treasures await.', 'Let\'s make a deal!']
    ];
    
    for (let i = 0; i < 3; i++) {
      const x = this.playerPos.x + (Math.random() - 0.5) * 100;
      const z = this.playerPos.z + (Math.random() - 0.5) * 100;
      let gy = 40;
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) { 
        if (this.isBlockSolid(Math.floor(x), y, Math.floor(z))) { gy = y + 1; break; }
      }
      if (gy <= WATER_LEVEL) continue;
      
      const npc = this.createNPC(
        npcNames[i],
        new THREE.Vector3(x, gy, z),
        npcColors[i],
        npcDialogues[i]
      );
      this.npcs.push(npc);
      this.scene.add(npc.mesh);
    }
  }
  
  private createNPC(name: string, pos: THREE.Vector3, color: number, dialogues: string[]): NPC {
    const g = new THREE.Group();
    const entityShadows = !this.lowEndDevice && settingsManager.getSettings().shadows;
    
    // Body
    const bodyMat = new THREE.MeshLambertMaterial({ color: color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), bodyMat);
    body.position.y = 0.85;
    body.castShadow = entityShadows;
    g.add(body);
    
    // Head
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffccaa });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), headMat);
    head.position.y = 1.5;
    g.add(head);
    
    // Arms
    const armMat = new THREE.MeshLambertMaterial({ color: color });
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), armMat);
    armL.position.set(0.35, 1.0, 0);
    g.add(armL);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), armMat);
    armR.position.set(-0.35, 1.0, 0);
    g.add(armR);
    
    // Legs
    const legMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), legMat);
    legL.position.set(0.15, 0.25, 0);
    g.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), legMat);
    legR.position.set(-0.15, 0.25, 0);
    g.add(legR);
    
    // Name tag above head
    // Note: In a full implementation, you'd add a canvas texture with the name
    
    g.position.copy(pos);
    
    return {
      mesh: g,
      name,
      position: pos.clone(),
      velocity: new THREE.Vector3(),
      targetAngle: Math.random() * Math.PI * 2,
      state: 'idle',
      stateTimer: Math.random() * 5,
      color,
      tradeItems: [BlockType.DIAMOND_BLOCK, BlockType.GOLD_BLOCK, BlockType.IRON_BLOCK],
      dialogues,
      currentDialogue: 0
    };
  }

  private createAnimal(type: string, pos: THREE.Vector3): Animal {
    const g = new THREE.Group();
    const entityShadows = !this.lowEndDevice && settingsManager.getSettings().shadows;
    const colors: Record<string, number> = { pig: 0xf5a0a0, cow: 0x8b4513, chicken: 0xf5f5dc, sheep: 0xeeeeee, rabbit: 0xc4a060, horse: 0x8b5a2b };
    const bm = new THREE.MeshLambertMaterial({ color: colors[type] || 0xcccccc });
    const dm = new THREE.MeshLambertMaterial({ color: 0x333333 });
    
    const legMeshes: THREE.Mesh[] = [];
    let headMesh: THREE.Mesh | undefined;
    let bodyMesh: THREE.Mesh | undefined;
    let tailMesh: THREE.Mesh | undefined;
    
    if (type === 'chicken') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.4,0.5), bm); body.position.y=0.4; body.castShadow=entityShadows; g.add(body);
      bodyMesh = body;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,0.3), bm); head.position.set(0,0.7,0.3); g.add(head);
      headMesh = head;
      const beak = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.05,0.1), new THREE.MeshLambertMaterial({color:0xff8800})); beak.position.set(0,0.65,0.5); g.add(beak);
      // Wings
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.2,0.3), new THREE.MeshLambertMaterial({color:0xd0d0c0})); wingL.position.set(0.22,0.45,0); g.add(wingL);
      const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.2,0.3), new THREE.MeshLambertMaterial({color:0xd0d0c0})); wingR.position.set(-0.22,0.45,0); g.add(wingR);
      // Legs
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.15,0.08), new THREE.MeshLambertMaterial({color:0xff8800})); legL.position.set(0.1,0.075,0); g.add(legL); legMeshes.push(legL);
      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.15,0.08), new THREE.MeshLambertMaterial({color:0xff8800})); legR.position.set(-0.1,0.075,0); g.add(legR); legMeshes.push(legR);
    } else if (type === 'rabbit') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.25,0.4), bm); body.position.y=0.25; body.castShadow=entityShadows; g.add(body);
      bodyMesh = body;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.25,0.2,0.2), bm); head.position.set(0,0.45,0.2); g.add(head);
      headMesh = head;
      [-0.06,0.06].forEach(ex => { const ear = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.15,0.04), bm); ear.position.set(ex,0.6,0.15); g.add(ear); });
      // Fluffy tail
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.1), new THREE.MeshLambertMaterial({color:0xffffff})); tail.position.set(0,0.25,-0.25); g.add(tail); tailMesh = tail;
    } else if (type === 'horse') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.6,1.3), bm); body.position.y=0.8; body.castShadow=entityShadows; g.add(body);
      bodyMesh = body;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.5,0.35), bm); head.position.set(0,1.1,0.7); g.add(head);
      headMesh = head;
      // Mane
      const mane = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.4,0.2), new THREE.MeshLambertMaterial({color:0x4a3a2a})); mane.position.set(0,1.3,0.5); g.add(mane);
      [[-0.25,-0.4],[0.25,-0.4],[-0.25,0.4],[0.25,0.4]].forEach(([lx,lz]) => { 
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.6,0.12), dm); leg.position.set(lx,0.3,lz); g.add(leg); legMeshes.push(leg);
      });
      // Tail
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.4,0.15), new THREE.MeshLambertMaterial({color:0x4a3a2a})); tail.position.set(0,0.8,-0.7); g.add(tail); tailMesh = tail;
    } else {
      const bw = type==='cow'?0.9:0.7, bh = type==='cow'?0.7:0.5, bd = type==='cow'?1.2:0.9;
      const body = new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd), bm); body.position.y=0.6; body.castShadow=entityShadows; g.add(body);
      bodyMesh = body;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.4,0.4), bm); head.position.set(0,0.8,bd/2+0.1); g.add(head);
      headMesh = head;
      [[-0.2,-0.3],[0.2,-0.3],[-0.2,0.3],[0.2,0.3]].forEach(([lx,lz]) => { 
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.3,0.15), dm); leg.position.set(lx,0.15,lz); g.add(leg); legMeshes.push(leg);
      });
      if (type==='sheep') { 
        const wool = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.6,1.0), new THREE.MeshLambertMaterial({color:0xfafafa})); wool.position.y=0.65; g.add(wool); 
        // Face peeking out
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.35,0.1), bm); face.position.set(0,0.8,bd/2+0.55); g.add(face);
      }
      if (type==='pig') { 
        const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.15,0.1), new THREE.MeshLambertMaterial({color:0xd48080})); snout.position.set(0,0.75,bd/2+0.35); g.add(snout);
        // Small curly tail
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.15), new THREE.MeshLambertMaterial({color:0xd48080})); tail.position.set(0,0.7,-bd/2-0.1); tail.rotation.z = Math.PI/4; g.add(tail); tailMesh = tail;
      }
      if (type==='cow') {
        // Horns
        const hornL = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.15,0.08), new THREE.MeshLambertMaterial({color:0xdddddd})); hornL.position.set(0.25,1.0,bd/2+0.15); g.add(hornL);
        const hornR = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.15,0.08), new THREE.MeshLambertMaterial({color:0xdddddd})); hornR.position.set(-0.25,1.0,bd/2+0.15); g.add(hornR);
        // Udder
        const udder = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.1,0.3), new THREE.MeshLambertMaterial({color:0xffaaaa})); udder.position.set(0,0.25,0.1); g.add(udder);
      }
    }
    g.position.copy(pos);
    return { 
      mesh: g, type, position: pos.clone(), velocity: new THREE.Vector3(), 
      targetAngle: Math.random()*Math.PI*2, changeTimer: Math.random()*5, 
      bobPhase: Math.random()*Math.PI*2, health: 10,
      legMeshes, headMesh, bodyMesh, tailMesh,
      state: 'idle', stateTimer: Math.random() * 3,
      animations: { legSwing: 0, headBob: 0, tailWag: 0 }
    };
  }

  // ======== CHUNK MESH BUILDING (SOLID BLOCKS) ========
  private buildChunkMesh(chunk: ChunkData) {
    const key = chunkKey(chunk.cx, chunk.cz);
    const old = this.chunkMeshes.get(key);
    if (old) old.forEach(m => { this.scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); });

    const meshes: THREE.Mesh[] = [];
    const wx0 = chunk.cx * CHUNK_SIZE, wz0 = chunk.cz * CHUNK_SIZE;

    // Atlas-based buffers: one for solid, one for transparent
    const solid = { p: [] as number[], n: [] as number[], u: [] as number[], c: [] as number[] };
    const trans = { p: [] as number[], n: [] as number[], u: [] as number[], c: [] as number[] };
    // Fallback color-only buffer (no atlas texture)
    const solidColorOnly = { p: [] as number[], n: [] as number[], c: [] as number[] };
    const transColorOnly = { p: [] as number[], n: [] as number[], c: [] as number[] };

    const faces: { dir: number[]; norm: number[]; v: number[][]; face: FaceDir; ao: number }[] = [
      { dir:[0,1,0], norm:[0,1,0], v:[[-0.5,0.5,-0.5],[0.5,0.5,-0.5],[0.5,0.5,0.5],[-0.5,0.5,0.5]], face:'top', ao:1.0 },
      { dir:[0,-1,0], norm:[0,-1,0], v:[[-0.5,-0.5,0.5],[0.5,-0.5,0.5],[0.5,-0.5,-0.5],[-0.5,-0.5,-0.5]], face:'bottom', ao:0.55 },
      { dir:[1,0,0], norm:[1,0,0], v:[[0.5,-0.5,0.5],[0.5,-0.5,-0.5],[0.5,0.5,-0.5],[0.5,0.5,0.5]], face:'east', ao:0.78 },
      { dir:[-1,0,0], norm:[-1,0,0], v:[[-0.5,-0.5,-0.5],[-0.5,-0.5,0.5],[-0.5,0.5,0.5],[-0.5,0.5,-0.5]], face:'west', ao:0.78 },
      { dir:[0,0,1], norm:[0,0,1], v:[[-0.5,-0.5,0.5],[0.5,-0.5,0.5],[0.5,0.5,0.5],[-0.5,0.5,0.5]], face:'south', ao:0.85 },
      { dir:[0,0,-1], norm:[0,0,-1], v:[[0.5,-0.5,-0.5],[-0.5,-0.5,-0.5],[-0.5,0.5,-0.5],[0.5,0.5,-0.5]], face:'north', ao:0.85 },
    ];

    // Get neighbor block across chunk boundaries
    const getNb = (lx: number, ly: number, lz: number): BlockType => {
      if (ly < 0 || ly >= CHUNK_HEIGHT) return BlockType.AIR;
      if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) return getBlock(chunk, lx, ly, lz);
      const ncx = chunk.cx + (lx < 0 ? -1 : lx >= CHUNK_SIZE ? 1 : 0);
      const ncz = chunk.cz + (lz < 0 ? -1 : lz >= CHUNK_SIZE ? 1 : 0);
      const nc = this.chunks.get(chunkKey(ncx, ncz));
      if (!nc) return BlockType.STONE;
      return getBlock(nc, ((lx%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE, ly, ((lz%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE);
    };

    // Helper: push 6 UVs for a quad mapped to atlas region [u0,v0,u1,v1]
    const pushAtlasQuad = (buf: typeof solid, ps: number[], ns: number[], uvs: [number,number,number,number], ao: number) => {
      for (let i = 0; i < ps.length; i++) buf.p.push(ps[i]);
      for (let i = 0; i < ns.length; i++) buf.n.push(ns[i]);
      const [u0, v0, u1, v1] = uvs;
      buf.u.push(u0,v0, u1,v0, u1,v1, u0,v0, u1,v1, u0,v1);
      for (let i = 0; i < 6; i++) buf.c.push(ao, ao, ao);
    };

    // Helper: push color-only quad (no UVs)
    const pushColorQuad = (buf: typeof solidColorOnly, ps: number[], ns: number[], r: number, g: number, b: number) => {
      for (let i = 0; i < ps.length; i++) buf.p.push(ps[i]);
      for (let i = 0; i < ns.length; i++) buf.n.push(ns[i]);
      for (let i = 0; i < 6; i++) buf.c.push(r, g, b);
    };

    for (let x = 0; x < CHUNK_SIZE; x++) for (let y = 0; y < CHUNK_HEIGHT; y++) for (let z = 0; z < CHUNK_SIZE; z++) {
      const block = getBlock(chunk, x, y, z);
      if (block === BlockType.AIR) continue;
      const bx = wx0+x+0.5, by = y+0.5, bz = wz0+z+0.5;

      // ── Decorative blocks (cross-plane rendering) ──
      if (DECORATIVE_BLOCKS.has(block)) {
        const decoUVs: [number, number, number, number] | null = null;
        if (block === BlockType.REDSTONE_DUST) {
          const pw = this.getRedstonePower(wx0+x, y, wz0+z);
          const br = 0.3+(pw/15)*0.7;
          const ps: number[] = [], ns: number[] = [];
          const s = 0.45;
          ps.push(bx-s,by-0.48,bz-s, bx+s,by-0.48,bz+s, bx+s,by-0.48,bz-s);
          ps.push(bx-s,by-0.48,bz-s, bx-s,by-0.48,bz+s, bx+s,by-0.48,bz+s);
          for (let i=0;i<6;i++) ns.push(0,1,0);
          if (decoUVs) {
            pushAtlasQuad(solid, ps, ns, decoUVs, br);
          } else {
            pushColorQuad(solidColorOnly, ps, ns, br, 0, 0);
          }
        } else if (block === BlockType.TORCH || block === BlockType.REDSTONE_TORCH) {
          const ps: number[] = [], ns: number[] = [];
          const s = 0.08, h = 0.4;
          // Front face
          ps.push(bx-s,by-0.5,bz-s, bx+s,by-0.5,bz-s, bx+s,by-0.5+h,bz-s);
          ps.push(bx-s,by-0.5,bz-s, bx+s,by-0.5+h,bz-s, bx-s,by-0.5+h,bz-s);
          for (let i=0;i<6;i++) ns.push(0,0,-1);
          // Back face
          ps.push(bx-s,by-0.5,bz+s, bx+s,by-0.5+h,bz+s, bx+s,by-0.5,bz+s);
          ps.push(bx-s,by-0.5,bz+s, bx-s,by-0.5+h,bz+s, bx+s,by-0.5+h,bz+s);
          for (let i=0;i<6;i++) ns.push(0,0,1);
          if (decoUVs) {
            // Two quads
            const [u0,v0,u1,v1] = decoUVs;
            for (let i = 0; i < ps.length; i++) solid.p.push(ps[i]);
            for (let i = 0; i < ns.length; i++) solid.n.push(ns[i]);
            solid.u.push(u0,v0,u1,v0,u1,v1, u0,v0,u1,v1,u0,v1);
            solid.u.push(u0,v0,u1,v0,u1,v1, u0,v0,u1,v1,u0,v1);
            for (let i = 0; i < 12; i++) solid.c.push(1,1,1);
          } else {
            const col = new THREE.Color(getBlockFaceColor(block, 'side'));
            for (let i = 0; i < ps.length; i++) solidColorOnly.p.push(ps[i]);
            for (let i = 0; i < ns.length; i++) solidColorOnly.n.push(ns[i]);
            for (let i = 0; i < 12; i++) solidColorOnly.c.push(col.r, col.g, col.b);
          }
          // Flame top
          const fc2 = block===BlockType.REDSTONE_TORCH?'#ff3300':'#ffdd44';
          const fcol = new THREE.Color(fc2);
          const fps: number[] = [], fns: number[] = [];
          fps.push(bx-s,by-0.5+h,bz-s, bx+s,by-0.5+h,bz-s, bx+s,by-0.5+h,bz+s);
          fps.push(bx-s,by-0.5+h,bz-s, bx+s,by-0.5+h,bz+s, bx-s,by-0.5+h,bz+s);
          for (let i=0;i<6;i++) fns.push(0,1,0);
          pushColorQuad(solidColorOnly, fps, fns, fcol.r, fcol.g, fcol.b);
        } else if (block === BlockType.LEVER) {
          const active = this.redstoneActive.get(`${wx0+x},${y},${wz0+z}`) || false;
          const ps: number[]=[], ns: number[]=[];
          const bs = 0.2;
          ps.push(bx-bs,by-0.5,bz-bs, bx+bs,by-0.5,bz+bs, bx+bs,by-0.4,bz+bs);
          ps.push(bx-bs,by-0.5,bz-bs, bx+bs,by-0.4,bz+bs, bx-bs,by-0.4,bz-bs);
          for (let i=0;i<6;i++) ns.push(0,1,0);
          const bc = new THREE.Color('#666655');
          pushColorQuad(solidColorOnly, ps, ns, bc.r, bc.g, bc.b);
          const sc = active?'#ff4444':'#888888';
          const scol = new THREE.Color(sc);
          const sps: number[]=[], sns: number[]=[];
          const ss=0.04, lean=active?0.15:-0.15;
          sps.push(bx-ss+lean,by-0.4,bz-ss, bx+ss+lean,by-0.4,bz+ss, bx+ss,by-0.05,bz+ss);
          sps.push(bx-ss+lean,by-0.4,bz-ss, bx+ss,by-0.05,bz+ss, bx-ss,by-0.05,bz-ss);
          for (let i=0;i<6;i++) sns.push(0,0,1);
          pushColorQuad(solidColorOnly, sps, sns, scol.r, scol.g, scol.b);
        } else {
          // Generic decorative plant rendering with natural variation (lean, height, color tint).
          const wx = wx0 + x;
          const wz = wz0 + z;
          let seed = ((wx * 73856093) ^ (y * 19349663) ^ (wz * 83492791)) >>> 0;
          const rand = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967295;
          };
          const isFlower =
            block === BlockType.FLOWER_RED ||
            block === BlockType.FLOWER_YELLOW ||
            block === BlockType.SUNFLOWER ||
            block === BlockType.ROSE_BUSH ||
            block === BlockType.LILAC;
          const isTall = block === BlockType.TALL_GRASS || block === BlockType.FERN || block === BlockType.SUGAR_CANE;
          const baseHeight = block === BlockType.SUGAR_CANE ? 0.98 : isTall ? 0.92 : 0.66;
          const totalHeight = baseHeight * (0.86 + rand() * 0.34);
          const halfWidth = (isFlower ? 0.24 : 0.34) * (0.82 + rand() * 0.28);
          const bottomY = by - 0.5;
          const leanX = (rand() - 0.5) * 0.12;
          const leanZ = (rand() - 0.5) * 0.12;
          const baseRot = rand() * Math.PI;

          const pushPlantLayer = (w: number, y0: number, y1: number, color: THREE.Color, tint: number) => {
            const layerColor = color.clone().multiplyScalar(tint);
            const addPlane = (angle: number) => {
              const ax = Math.cos(angle) * w;
              const az = Math.sin(angle) * w;
              const x0 = bx - ax;
              const z0 = bz - az;
              const x1 = bx + ax;
              const z1 = bz + az;
              const ps: number[] = [];
              const ns: number[] = [];
              ps.push(x0, y0, z0, x1, y0, z1, x1 + leanX, y1, z1 + leanZ);
              ps.push(x0, y0, z0, x1 + leanX, y1, z1 + leanZ, x0 + leanX, y1, z0 + leanZ);
              const nx = az;
              const nz = -ax;
              const invLen = 1 / Math.max(0.0001, Math.hypot(nx, nz));
              const nnx = nx * invLen;
              const nnz = nz * invLen;
              for (let i = 0; i < 6; i++) ns.push(nnx, 0, nnz);
              pushColorQuad(solidColorOnly, ps, ns, layerColor.r, layerColor.g, layerColor.b);
            };
            addPlane(baseRot);
            addPlane(baseRot + Math.PI * 0.5);
          };

          if (isFlower) {
            const stemColor = new THREE.Color('#3f8f30');
            const stemTop = bottomY + totalHeight * (block === BlockType.SUNFLOWER ? 0.78 : 0.72);
            pushPlantLayer(halfWidth * 0.24, bottomY, stemTop, stemColor, 0.9 + rand() * 0.14);
            const bloomColor = new THREE.Color(getBlockFaceColor(block, 'side'));
            pushPlantLayer(halfWidth * (block === BlockType.SUNFLOWER ? 1.18 : 0.95), stemTop - totalHeight * 0.22, bottomY + totalHeight, bloomColor, 0.92 + rand() * 0.2);
          } else {
            const col = new THREE.Color(getBlockFaceColor(block, 'side'));
            pushPlantLayer(halfWidth, bottomY, bottomY + totalHeight, col, 0.84 + rand() * 0.26);
          }
        }
        continue;
      }

      // ── Water (always color-based, transparent) ──
      if (block === BlockType.WATER) {
        for (const face of faces) {
          const nx=x+face.dir[0], ny=y+face.dir[1], nz=z+face.dir[2];
          const nb = getNb(nx, ny, nz);
          if (nb === BlockType.WATER) continue;
          if (nb !== BlockType.AIR && !DECORATIVE_BLOCKS.has(nb)) continue;
          const fc = BLOCK_FACE_COLORS[block] || ['#2266bb','#2266bb','#2266bb'];
          const ci = face.face==='top'?0:face.face==='bottom'?2:1;
          const col = new THREE.Color(fc[ci]);
          col.multiplyScalar(face.ao);
          const ps: number[]=[], ns: number[]=[];
          const yOff = face.face==='top'?-0.15:0;
          for (const idx of [0,1,2,0,2,3]) {
            ps.push(bx+face.v[idx][0], by+face.v[idx][1]+yOff, bz+face.v[idx][2]);
            ns.push(face.norm[0], face.norm[1], face.norm[2]);
          }
          pushColorQuad(transColorOnly, ps, ns, col.r, col.g, col.b);
        }
        continue;
      }

      // ── Solid / transparent blocks ──
      const isGlass = block === BlockType.GLASS;
      const isLeaf = block === BlockType.LEAVES
        || block === BlockType.LEAVES_BIRCH
        || block === BlockType.LEAVES_SPRUCE
        || block === BlockType.LEAVES_JUNGLE
        || block === BlockType.LEAVES_ACACIA
        || block === BlockType.LEAVES_DARK_OAK
        || block === BlockType.LEAVES_CHERRY;
      const isIce = block === BlockType.ICE;
      const isTrans = isGlass || isLeaf || isIce;
      const hasAtlas = textureManager.isBlockCustomized(block);

      for (const face of faces) {
        const nx=x+face.dir[0], ny=y+face.dir[1], nz=z+face.dir[2];
        const nb = getNb(nx, ny, nz);

        // Face culling
        if (isGlass) { if (nb === BlockType.GLASS) continue; }
        else if (isLeaf) {
          if (
            nb === BlockType.LEAVES
            || nb === BlockType.LEAVES_BIRCH
            || nb === BlockType.LEAVES_SPRUCE
            || nb === BlockType.LEAVES_JUNGLE
            || nb === BlockType.LEAVES_ACACIA
            || nb === BlockType.LEAVES_DARK_OAK
            || nb === BlockType.LEAVES_CHERRY
          ) continue;
        }
        else if (isIce) { if (nb === BlockType.ICE) continue; }
        if (nb !== BlockType.AIR && !TRANSPARENT_BLOCKS.has(nb) && !DECORATIVE_BLOCKS.has(nb)) continue;

        // Build face vertices
        const ps: number[]=[], ns: number[]=[];
        for (const idx of [0,1,2,0,2,3]) {
          ps.push(bx+face.v[idx][0], by+face.v[idx][1], bz+face.v[idx][2]);
          ns.push(face.norm[0], face.norm[1], face.norm[2]);
        }

        // Redstone lamp glow override
        let aoMult = face.ao;
        if (block === BlockType.REDSTONE_LAMP && this.redstoneActive.get(`${wx0+x},${y},${wz0+z}`)) {
          aoMult = 1.3; // bright glow
        }

        if (hasAtlas && !isTrans) {
          const uvs = textureManager.getBlockFaceUVs(block, face.face);
          if (uvs) {
            pushAtlasQuad(solid, ps, ns, uvs, aoMult);
            continue;
          }
        }
        if (hasAtlas && isTrans) {
          const uvs = textureManager.getBlockFaceUVs(block, face.face);
          if (uvs) {
            pushAtlasQuad(trans, ps, ns, uvs, aoMult);
            continue;
          }
        }

        // Fallback: use color
        const col = new THREE.Color(getBlockFaceColor(block, face.face==='top' ? 'top' : face.face==='bottom' ? 'bottom' : 'side'));
        col.multiplyScalar(aoMult);
        const buf = isTrans ? transColorOnly : solidColorOnly;
        pushColorQuad(buf, ps, ns, col.r, col.g, col.b);
      }
    }

    // ── Create meshes ──
    const chunkShadows = !this.lowEndDevice && settingsManager.getSettings().shadows && this.renderDistance <= 10;
    const atlasTex = textureManager.getAtlasTexture();

    // Solid atlas-textured mesh
    if (solid.p.length > 0 && atlasTex) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(solid.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(solid.n, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(solid.u, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(solid.c, 3));
      geo.computeBoundingSphere();
      const mat = new THREE.MeshLambertMaterial({
        map: atlasTex, vertexColors: true, side: THREE.FrontSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = chunkShadows;
      this.scene.add(mesh); meshes.push(mesh);
    }

    // Solid color-only mesh (fallback)
    if (solidColorOnly.p.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(solidColorOnly.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(solidColorOnly.n, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(solidColorOnly.c, 3));
      geo.computeBoundingSphere();
      const mat = new THREE.MeshLambertMaterial({
        vertexColors: true, side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = chunkShadows;
      this.scene.add(mesh); meshes.push(mesh);
    }

    // Transparent atlas-textured mesh
    if (trans.p.length > 0 && atlasTex) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(trans.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(trans.n, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(trans.u, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(trans.c, 3));
      geo.computeBoundingSphere();
      const mat = new THREE.MeshLambertMaterial({
        map: atlasTex, vertexColors: true, side: THREE.DoubleSide,
        transparent: true, opacity: 0.75, depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 1;
      this.scene.add(mesh); meshes.push(mesh);
    }

    // Transparent color-only mesh
    if (transColorOnly.p.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(transColorOnly.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(transColorOnly.n, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(transColorOnly.c, 3));
      geo.computeBoundingSphere();
      const mat = new THREE.MeshLambertMaterial({
        vertexColors: true, side: THREE.DoubleSide,
        transparent: true, opacity: 0.6, depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 1;
      this.scene.add(mesh); meshes.push(mesh);
    }

    this.chunkMeshes.set(key, meshes);
  }

  placeBlock() {
    if (!this.crosshairTarget || this.selectedTool !== ToolType.NONE) return;
    if (this.selectedBlock === BlockType.AIR) return;
    this.clearBreakState();
    const { blockPos, normal } = this.crosshairTarget;
    const px = Math.floor(blockPos.x+normal.x), py = Math.floor(blockPos.y+normal.y), pz = Math.floor(blockPos.z+normal.z);
    const hw = PLAYER_WIDTH/2+0.1;
    if (px+1>this.playerPos.x-hw && px<this.playerPos.x+hw && py+1>this.playerPos.y-0.1 && py<this.playerPos.y+PLAYER_HEIGHT+0.1 && pz+1>this.playerPos.z-hw && pz<this.playerPos.z+hw) return;
    const cx = Math.floor(px/CHUNK_SIZE), cz = Math.floor(pz/CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk || py<0 || py>=CHUNK_HEIGHT) return;
    const lx = ((px%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE, lz = ((pz%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
    setBlockInChunk(chunk, lx, py, lz, this.selectedBlock);
    this.buildChunkMesh(chunk);
    this.rebuildEdge(lx, lz, cx, cz);
    this.checkRS(this.selectedBlock);
    if (this.onBlockChanged) this.onBlockChanged({ x: px, y: py, z: pz, type: Number(this.selectedBlock) });
  }

  private finishBreakingBlock(
    px: number,
    py: number,
    pz: number,
    chunk: ChunkData,
    lx: number,
    lz: number,
    existing: BlockType
  ) {
    // Check if this is the bottom of a tree - collapse tree.
    const isLog = existing === BlockType.WOOD || existing === BlockType.LOG_BIRCH;
    const blockBelow = this.getBlockAtLoaded(px, py - 1, pz);
    const blockAbove = this.getBlockAtLoaded(px, py + 1, pz);
    const isTreeBase = isLog && (blockBelow === BlockType.GRASS || blockBelow === BlockType.DIRT) &&
      (blockAbove === BlockType.WOOD || blockAbove === BlockType.LOG_BIRCH);

    if (existing !== BlockType.AIR) {
      this.spawnDroppedItem(existing, new THREE.Vector3(px + 0.5, py + 0.5, pz + 0.5));
      this.spawnBreakParticles(existing, new THREE.Vector3(px + 0.5, py + 0.5, pz + 0.5));
    }

    setBlockInChunk(chunk, lx, py, lz, BlockType.AIR);
    this.buildChunkMesh(chunk);
    this.rebuildEdge(lx, lz, Math.floor(px / CHUNK_SIZE), Math.floor(pz / CHUNK_SIZE));
    this.checkRS(existing);
    if (this.onBlockChanged) this.onBlockChanged({ x: px, y: py, z: pz, type: Number(BlockType.AIR) });
    if (isTreeBase) this.collapseTree(px, py + 1, pz);
    this.clearBreakState();
  }

  breakBlock() {
    if (!this.crosshairTarget) return;
    const { blockPos } = this.crosshairTarget;
    const px = Math.floor(blockPos.x), py = Math.floor(blockPos.y), pz = Math.floor(blockPos.z);
    const cx = Math.floor(px/CHUNK_SIZE), cz = Math.floor(pz/CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return;
    const lx = ((px%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE, lz = ((pz%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
    const existing = getBlock(chunk, lx, py, lz);
    if (existing === BlockType.AIR) {
      this.clearBreakState();
      return;
    }
    if (existing === BlockType.BEDROCK) return;

    // Tool damage to animals nearby
    if (this.selectedTool === ToolType.SWORD) {
      for (const a of this.animals) {
        const dist = a.position.distanceTo(new THREE.Vector3(px+0.5, py+0.5, pz+0.5));
        if (dist < 3) { a.health -= 5; if (a.health <= 0) { this.scene.remove(a.mesh); } }
      }
      this.animals = this.animals.filter(a => a.health > 0);
    }

    if (this._gameMode === 'creative') {
      this.finishBreakingBlock(px, py, pz, chunk, lx, lz, existing);
      return;
    }

    const now = performance.now();
    if (!this.isBreakingTargetSame(px, py, pz, existing)) {
      this.activeBreak = { x: px, y: py, z: pz, block: existing, progress: 0, lastHit: now };
    } else if (this.activeBreak) {
      this.activeBreak.lastHit = now;
    }

    if (!this.activeBreak) return;
    this.activeBreak.progress = Math.min(1, this.activeBreak.progress + this.getBreakIncrement(existing));
    this.activeBreak.lastHit = now;
    this.updateBreakOverlay();
    if (this.activeBreak.progress < 1) return;

    this.finishBreakingBlock(px, py, pz, chunk, lx, lz, existing);
  }

  private spawnDroppedItem(blockType: BlockType, pos: THREE.Vector3) {
    const g = new THREE.Group();
    
    // Create small representation of the block
    const geo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(getBlockFaceColor(blockType, 'side')) });
    const mesh = new THREE.Mesh(geo, mat);
    g.add(mesh);
    
    g.position.copy(pos);
    this.scene.add(g);
    
    this.droppedItems.push({
      mesh: g,
      blockType,
      position: pos.clone(),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        2 + Math.random(),
        (Math.random() - 0.5) * 2
      ),
      life: 120, // 2 minutes
      bobPhase: Math.random() * Math.PI * 2,
      rotationSpeed: new THREE.Vector3(
        Math.random() * 2,
        Math.random() * 2,
        Math.random() * 2
      )
    });
  }

  private spawnBreakParticles(blockType: BlockType, pos: THREE.Vector3) {
    const count = 14;
    const color = new THREE.Color(getBlockFaceColor(blockType, 'side'));
    for (let i = 0; i < count; i++) {
      const size = 0.06 + Math.random() * 0.05;
      const geo = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        1.8 + Math.random() * 2.2,
        (Math.random() - 0.5) * 4
      );
      const life = 0.9 + Math.random() * 0.45;
      this.breakParticles.push({ mesh, velocity: dir, life, maxLife: life, resting: false, restTimer: 0.16 + Math.random() * 0.22 });
    }
  }

  private updateBreakParticles(dt: number) {
    for (let i = this.breakParticles.length - 1; i >= 0; i--) {
      const p = this.breakParticles[i];
      p.life -= dt;
      if (!p.resting) {
        p.velocity.y -= 14 * dt;
        p.mesh.position.addScaledVector(p.velocity, dt);
        const bx = Math.floor(p.mesh.position.x);
        const by = Math.floor(p.mesh.position.y - 0.04);
        const bz = Math.floor(p.mesh.position.z);
        if (this.isBlockSolid(bx, by, bz) && p.velocity.y < 0) {
          p.resting = true;
          p.velocity.set((Math.random() - 0.5) * 0.15, 0, (Math.random() - 0.5) * 0.15);
          p.mesh.position.y = by + 1.02;
        }
      } else {
        p.restTimer -= dt;
        p.mesh.position.addScaledVector(p.velocity, dt);
      }
      p.mesh.rotation.x += 10 * dt;
      p.mesh.rotation.y += 8 * dt;

      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, p.life / p.maxLife);

      if (p.life <= 0 || (p.resting && p.restTimer <= 0)) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        mat.dispose();
        this.breakParticles.splice(i, 1);
      }
    }
  }
  
  private updateDroppedItems(dt: number) {
    const playerPos = this.playerPos.clone();
    
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const item = this.droppedItems[i];
      
      // Apply gravity
      item.velocity.y -= 20 * dt;
      
      // Update position
      item.position.x += item.velocity.x * dt;
      item.position.y += item.velocity.y * dt;
      item.position.z += item.velocity.z * dt;
      
      // Ground collision
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) { 
        if(this.isBlockSolid(Math.floor(item.position.x), y, Math.floor(item.position.z))) { 
          if (item.position.y <= y + 1) {
            item.position.y = y + 1;
            item.velocity.y = 0;
            item.velocity.x *= 0.8;
            item.velocity.z *= 0.8;
          }
          break;
        }
      }
      
      // Rotate
      item.mesh.rotation.x += item.rotationSpeed.x * dt;
      item.mesh.rotation.y += item.rotationSpeed.y * dt;
      item.mesh.rotation.z += item.rotationSpeed.z * dt;
      
      // Bobbing animation
      const bob = Math.sin(item.bobPhase) * 0.05;
      item.mesh.position.copy(item.position);
      item.mesh.position.y += bob;
      
      // Check for player pickup
      const distToPlayer = item.position.distanceTo(playerPos);
      if (distToPlayer < 1.5) {
        // Move toward player
        const toPlayer = playerPos.clone().sub(item.position);
        toPlayer.normalize();
        item.position.add(toPlayer.multiplyScalar(5 * dt));
        
        if (distToPlayer < 0.5) {
          // Pick up the item
          this.scene.remove(item.mesh);
          this.droppedItems.splice(i, 1);
          // TODO: Add to inventory
          continue;
        }
      }
      
      // Decrease life
      item.life -= dt;
      if (item.life <= 0) {
        this.scene.remove(item.mesh);
        this.droppedItems.splice(i, 1);
      }
    }
  }

  private checkRS(b: BlockType) {
    const rs = [BlockType.REDSTONE_DUST, BlockType.REDSTONE_TORCH, BlockType.REDSTONE_BLOCK,
      BlockType.REDSTONE_LAMP, BlockType.LEVER, BlockType.BUTTON, BlockType.REDSTONE_REPEATER, BlockType.COMPARATOR,
      BlockType.COMMAND_BLOCK, BlockType.TNT, BlockType.NOTE_BLOCK];
    if (rs.includes(b)) this.requestRedstoneRefresh(false);
  }

  private rebuildEdge(lx: number, lz: number, cx: number, cz: number) {
    if (lx===0) { const c=this.chunks.get(chunkKey(cx-1,cz)); if(c) this.buildChunkMesh(c); }
    if (lx===CHUNK_SIZE-1) { const c=this.chunks.get(chunkKey(cx+1,cz)); if(c) this.buildChunkMesh(c); }
    if (lz===0) { const c=this.chunks.get(chunkKey(cx,cz-1)); if(c) this.buildChunkMesh(c); }
    if (lz===CHUNK_SIZE-1) { const c=this.chunks.get(chunkKey(cx,cz+1)); if(c) this.buildChunkMesh(c); }
  }

  private detectPortalTargetType(x: number, y: number, z: number): 'normal' | 'flat' {
    const dirs = [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[0,-1,0]];
    let frameCount = 0;
    let obsidianCount = 0;
    for (const d of dirs) {
      const b = this.getBlockAtLoaded(x + d[0], y + d[1], z + d[2]);
      if (b === BlockType.PORTAL_FRAME) frameCount++;
      if (b === BlockType.OBSIDIAN) obsidianCount++;
    }
    if (frameCount > 0) return 'flat';
    if (obsidianCount > 0) return 'normal';
    return this.worldType === 'normal' ? 'flat' : 'normal';
  }

  private raycast() {
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.playerRotation.pitch, this.playerRotation.yaw, 0, 'YXZ'));
    const step = 0.05, maxDist = 8;
    const stepVec = dir.multiplyScalar(step);
    const eye = new THREE.Vector3(this.playerPos.x, this.playerPos.y + PLAYER_EYE_HEIGHT, this.playerPos.z);
    const ray = eye.clone(), prev = ray.clone();
    for (let d = 0; d < maxDist; d += step) {
      prev.copy(ray);
      ray.add(stepVec);
      const bx=Math.floor(ray.x), by=Math.floor(ray.y), bz=Math.floor(ray.z);
      const b = this.getBlockAtLoaded(bx, by, bz);
      if (b !== BlockType.AIR && b !== BlockType.WATER) {
        const pbx=Math.floor(prev.x), pby=Math.floor(prev.y), pbz=Math.floor(prev.z);
        const n = new THREE.Vector3(pbx!==bx?(pbx>bx?1:-1):0, pby!==by?(pby>by?1:-1):0, pbz!==bz?(pbz>bz?1:-1):0);
        if (n.length()===0) n.set(0,1,0);
        return { pos: ray.clone(), normal: n, blockPos: new THREE.Vector3(bx, by, bz) };
      }
    }
    return null;
  }

  private updateChunks() {
    const pcx = Math.floor(this.playerPos.x/CHUNK_SIZE), pcz = Math.floor(this.playerPos.z/CHUNK_SIZE);
    const missing: { cx: number; cz: number; dist2: number }[] = [];
    for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
      for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = chunkKey(cx, cz);
        if (!this.chunks.has(key)) missing.push({ cx, cz, dist2: dx * dx + dz * dz });
      }
    }

    if (missing.length > 0) {
      missing.sort((a, b) => a.dist2 - b.dist2);
      const budget = this.lowEndDevice ? 1 : (this._gameMode === 'creative' ? 3 : 2);
      const take = Math.min(budget, missing.length);
      for (let i = 0; i < take; i++) {
        const { cx, cz } = missing[i];
        const key = chunkKey(cx, cz);
        if (this.chunks.has(key)) continue;
        const chunk = generateChunk(cx, cz);
        this.chunks.set(key, chunk);
        this.buildChunkMesh(chunk);
        const neighbors = [chunkKey(cx - 1, cz), chunkKey(cx + 1, cz), chunkKey(cx, cz - 1), chunkKey(cx, cz + 1)];
        for (const nk of neighbors) {
          const nc = this.chunks.get(nk);
          if (nc && this.chunkMeshes.has(nk)) this.buildChunkMesh(nc);
        }
      }
    }

    const unloadMargin = this.lowEndDevice ? 1 : 2;
    for (const [key, ms] of this.chunkMeshes) {
      const [cxs,czs] = key.split(',').map(Number);
      if (Math.abs(cxs-pcx)>this.renderDistance+unloadMargin||Math.abs(czs-pcz)>this.renderDistance+unloadMargin) {
        ms.forEach(m => { this.scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
        this.chunkMeshes.delete(key); this.chunks.delete(key);
      }
    }
  }

  private updateSky(dt: number) {
    if (!this.externalEnvironmentControl) {
      this.timeOfDay = (this.timeOfDay + dt * this.dayCycleSpeed) % 1;
    }

    const sunAngle = this.timeOfDay * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);
    const orbitRadius = 250;
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const smoothstep = (v: number) => {
      const t = clamp01(v);
      return t * t * (3 - 2 * t);
    };

    // Position sun and moon
    this.sunMesh.position.set(this.playerPos.x + sunX * orbitRadius, sunY * orbitRadius, this.playerPos.z);
    this.moonMesh.position.set(this.playerPos.x - sunX * orbitRadius, -sunY * orbitRadius, this.playerPos.z);
    this.sunGlow.position.copy(this.sunMesh.position);
    this.moonGlow.position.copy(this.moonMesh.position);
    this.starsGroup.position.copy(this.playerPos);

    // Smoother daylight/twilight curves.
    const daylight = smoothstep((sunY + 0.2) / 0.82);
    const twilight = smoothstep(1 - Math.abs(sunY) / 0.34);
    const dawn = twilight * (sunX > 0 ? 1 : 0);
    const dusk = twilight * (sunX <= 0 ? 1 : 0);

    // Sky colors
    const nightColor = new THREE.Color(0x05091b);
    const dayColor = new THREE.Color(0x75ccff);
    const dawnColor = new THREE.Color(0xffa063);
    const duskColor = new THREE.Color(0xff744d);

    this.skyColor.copy(nightColor).lerp(dayColor, daylight);
    if (dawn > 0) this.skyColor.lerp(dawnColor, dawn * 0.58);
    if (dusk > 0) this.skyColor.lerp(duskColor, dusk * 0.62);
    this.scene.background = this.skyColor;

    // Fog color follows sky with weather tint.
    const fogColor = this.skyColor.clone().lerp(new THREE.Color(0xffffff), 0.08);
    if (this.weather === 'rain') fogColor.lerp(new THREE.Color(0x8092a8), 0.26);
    if (this.weather === 'snow') fogColor.lerp(new THREE.Color(0xe5f2ff), 0.2);
    if (this.weather === 'storm') fogColor.lerp(new THREE.Color(0x4f5d76), 0.44);
    this.fog.color = fogColor;

    // Weather-dimmed sunlight at same time curve.
    const weatherLightMul = this.weather === 'storm' ? 0.52 : this.weather === 'rain' ? 0.72 : this.weather === 'snow' ? 0.86 : 1;
    this.sunLight.position.set(this.playerPos.x + sunX * 100, Math.max(sunY * 100, 10), this.playerPos.z + 50);
    this.sunLight.target.position.copy(this.playerPos);
    this.sunLight.intensity = (0.2 + daylight * 2.35) * weatherLightMul;

    const sunColor = new THREE.Color(0xfff8e8);
    if (dawn > 0) sunColor.lerp(new THREE.Color(0xffb36d), dawn * 0.85);
    if (dusk > 0) sunColor.lerp(new THREE.Color(0xff8f66), dusk * 0.85);
    if (daylight < 0.1) sunColor.lerp(new THREE.Color(0x6c78b8), 1 - daylight * 10);
    this.sunLight.color = sunColor;

    this.hemiLight.groundColor.lerp(new THREE.Color(0x4a6b4a), 0.01);
    this.hemiLight.intensity = (0.09 + daylight * 0.56) * weatherLightMul;
    this.ambientLight.intensity = 0.12 + daylight * 0.4 * weatherLightMul;

    // Stars, sun, moon visuals
    const starsOpacity = clamp01(1 - daylight * 1.35);
    const sp = this.starsGroup.children[0] as THREE.Points;
    (sp.material as THREE.PointsMaterial).opacity = starsOpacity;

    const sunMeshColor = new THREE.Color(0xffef9e);
    if (dawn > 0.4 || dusk > 0.4) sunMeshColor.lerp(new THREE.Color(0xff7f58), 0.65);
    (this.sunMesh.material as THREE.MeshBasicMaterial).color = sunMeshColor;
    (this.sunGlow.material as THREE.SpriteMaterial).opacity = clamp01(0.15 + daylight * 0.75);
    (this.sunGlow.material as THREE.SpriteMaterial).color.set(sunMeshColor);

    const moonColor = new THREE.Color(0xcfdfff).lerp(new THREE.Color(0xf7fbff), starsOpacity * 0.7);
    (this.moonMesh.material as THREE.MeshBasicMaterial).color = moonColor;
    (this.moonGlow.material as THREE.SpriteMaterial).opacity = clamp01(0.14 + starsOpacity * 0.62);
    (this.moonGlow.material as THREE.SpriteMaterial).color.set(moonColor);

    // Cloud movement
    if (this.cloudsGroup) {
      this.cloudsGroup.children.forEach((c, i) => {
        c.position.x += dt * 0.5 * (0.5 + (i % 3) * 0.3);
        if (c.position.x > this.playerPos.x + 300) c.position.x = this.playerPos.x - 300;
      });
    }

    // Tone mapping exposure
    this.renderer.toneMappingExposure = 0.45 + daylight * 0.9;

    // Update fog density based on weather and time
    let fogDensity = 0.008;
    if (this.weather === 'rain') fogDensity = 0.015;
    else if (this.weather === 'snow') fogDensity = 0.012;
    else if (this.weather === 'storm') fogDensity = 0.02;
    if (daylight < 0.3) fogDensity *= 1.45;  // Thicker fog at night

    if (this.fog instanceof THREE.FogExp2) {
      this.fog.density = fogDensity;
    }
  }

  private updateAnimals(dt: number) {
    const playerPos = this.playerPos.clone();
    
    for (const a of this.animals) {
      a.changeTimer -= dt;
      a.bobPhase += dt * 3;
      a.animations.headBob += dt * 2;
      a.animations.tailWag += dt * 4;
      
      // State machine
      const distToPlayer = a.position.distanceTo(playerPos);
      
      // Check if should flee from player
      if (distToPlayer < 8 && a.state !== 'fleeing') {
        a.state = 'fleeing';
        a.stateTimer = 5;
        const fleeDir = a.position.clone().sub(playerPos).normalize();
        a.fleeTarget = a.position.clone().add(fleeDir.multiplyScalar(20));
        a.targetAngle = Math.atan2(fleeDir.x, fleeDir.z);
      }
      
      // State transitions
      if (a.stateTimer <= 0 || (a.state === 'fleeing' && distToPlayer > 15)) {
        a.stateTimer = 2 + Math.random() * 4;
        const rand = Math.random();
        if (rand < 0.5) {
          a.state = 'idle';
          a.velocity.set(0, 0, 0);
        } else if (rand < 0.8) {
          a.state = 'walking';
          a.targetAngle = Math.random() * Math.PI * 2;
        } else {
          a.state = 'eating';
          a.velocity.set(0, 0, 0);
          a.stateTimer = 1 + Math.random() * 2;
        }
      }
      
      // Movement based on state
      if (a.state === 'fleeing' && a.fleeTarget) {
        const toTarget = a.fleeTarget.clone().sub(a.position);
        const dist = toTarget.length();
        if (dist < 0.5) {
          a.state = 'idle';
          a.velocity.set(0, 0, 0);
        } else {
          toTarget.normalize();
          const fleeSpeed = a.type === 'rabbit' ? 4 : a.type === 'horse' ? 3 : 2;
          a.velocity.x = toTarget.x * fleeSpeed;
          a.velocity.z = toTarget.z * fleeSpeed;
          a.targetAngle = Math.atan2(a.velocity.x, a.velocity.z);
        }
      } else if (a.state === 'walking') {
        const walkSpeed = a.type === 'rabbit' ? 1.2 : a.type === 'horse' ? 1.0 : 0.6;
        a.velocity.x = Math.cos(a.targetAngle) * walkSpeed;
        a.velocity.z = Math.sin(a.targetAngle) * walkSpeed;
      }
      
      // Update position
      a.position.x += a.velocity.x * dt;
      a.position.z += a.velocity.z * dt;
      
      // Ground collision
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) { 
        if(this.isBlockSolid(Math.floor(a.position.x), y, Math.floor(a.position.z))) { 
          a.position.y = y + 1; 
          break; 
        } 
      }
      
      // Animation updates
      const isMoving = a.velocity.length() > 0.1;
      a.animations.legSwing += isMoving ? dt * 8 : 0;
      
      // Apply animations
      a.mesh.position.copy(a.position);
      
      // Body bob
      const bob = isMoving ? Math.sin(a.bobPhase) * 0.05 : Math.sin(a.animations.headBob) * 0.02;
      if (a.bodyMesh) {
        a.bodyMesh.position.y = (a.type === 'chicken' ? 0.4 : a.type === 'horse' ? 0.8 : 0.6) + bob;
      }
      
      // Head bob
      if (a.headMesh) {
        const headBobOffset = a.state === 'eating' ? Math.sin(a.animations.headBob * 2) * 0.1 : Math.sin(a.animations.headBob) * 0.03;
        const baseHeadY = a.type === 'chicken' ? 0.7 : a.type === 'rabbit' ? 0.45 : a.type === 'horse' ? 1.1 : 0.8;
        a.headMesh.position.y = baseHeadY + headBobOffset;
        if (a.state === 'eating') {
          a.headMesh.rotation.x = Math.PI / 6;
        } else {
          a.headMesh.rotation.x = 0;
        }
      }
      
      // Leg swing
      a.legMeshes.forEach((leg, i) => {
        const swing = isMoving ? Math.sin(a.animations.legSwing + (i % 2) * Math.PI) * 0.3 : 0;
        leg.rotation.x = swing;
      });
      
      // Tail wag
      if (a.tailMesh) {
        a.tailMesh.rotation.y = Math.sin(a.animations.tailWag) * 0.2;
      }
      
      // Rotation
      if (isMoving) {
        const targetRotation = Math.atan2(a.velocity.x, a.velocity.z);
        const currentRotation = a.mesh.rotation.y;
        const diff = targetRotation - currentRotation;
        const adjustedDiff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
        a.mesh.rotation.y += adjustedDiff * 5 * dt;
      }
    }
    
    // Update NPCs
    this.updateNPCs(dt, playerPos);
  }
  
  private updateNPCs(dt: number, playerPos: THREE.Vector3) {
    for (const npc of this.npcs) {
      npc.stateTimer -= dt;
      
      const distToPlayer = npc.position.distanceTo(playerPos);
      
      // Look at player when close
      if (distToPlayer < 10) {
        const toPlayer = playerPos.clone().sub(npc.position);
        toPlayer.y = 0;
        toPlayer.normalize();
        const targetAngle = Math.atan2(toPlayer.x, toPlayer.z);
        const currentRotation = npc.mesh.rotation.y;
        const diff = targetAngle - currentRotation;
        const adjustedDiff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
        npc.mesh.rotation.y += adjustedDiff * 3 * dt;
        npc.state = 'interacting';
        npc.stateTimer = 3;
      } else if (npc.stateTimer <= 0) {
        // Random movement
        npc.stateTimer = 2 + Math.random() * 4;
        const rand = Math.random();
        if (rand < 0.6) {
          npc.state = 'idle';
          npc.velocity.set(0, 0, 0);
        } else {
          npc.state = 'walking';
          npc.targetAngle = Math.random() * Math.PI * 2;
        }
      }
      
      // Movement
      if (npc.state === 'walking') {
        npc.velocity.x = Math.cos(npc.targetAngle) * 0.8;
        npc.velocity.z = Math.sin(npc.targetAngle) * 0.8;
        npc.position.x += npc.velocity.x * dt;
        npc.position.z += npc.velocity.z * dt;
        
        // Ground collision
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) { 
          if(this.isBlockSolid(Math.floor(npc.position.x), y, Math.floor(npc.position.z))) { 
            npc.position.y = y + 1; 
            break; 
          } 
        }
      }
      
      npc.mesh.position.copy(npc.position);
      
      // Rotate toward movement direction
      if (npc.velocity.length() > 0.1) {
        const targetRotation = Math.atan2(npc.velocity.x, npc.velocity.z);
        const currentRotation = npc.mesh.rotation.y;
        const diff = targetRotation - currentRotation;
        const adjustedDiff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
        npc.mesh.rotation.y += adjustedDiff * 5 * dt;
      }
    }
  }

  private update(dt: number) {
    const creative = this._gameMode === 'creative';
    const speed = creative ? FLY_SPEED : PLAYER_SPEED;
    const fwd = this.forwardVec.set(0, 0, -1).applyEuler(new THREE.Euler(0, this.playerRotation.yaw, 0, 'YXZ'));
    const right = this.rightVec.set(1, 0, 0).applyEuler(new THREE.Euler(0, this.playerRotation.yaw, 0, 'YXZ'));
    const mv = this.moveVec.set(0, 0, 0);

    if (creative) {
      mv.addScaledVector(fwd, -this.moveInput.z);
      mv.addScaledVector(right, this.moveInput.x);
      if (this.flyUp) mv.y+=1; if (this.flyDown) mv.y-=1;
      if (mv.length()>0) mv.normalize().multiplyScalar(speed*dt);
      this.playerPos.add(mv);
      this.playerPos.y = Math.max(1, Math.min(CHUNK_HEIGHT+30, this.playerPos.y));
    } else {
      mv.addScaledVector(fwd, -this.moveInput.z);
      mv.addScaledVector(right, this.moveInput.x);
      if (mv.length()>0) mv.normalize().multiplyScalar(speed);
      this.playerVelocity.x = mv.x; this.playerVelocity.z = mv.z;
      this.playerVelocity.y -= GRAVITY*dt;
      if (this.jumping && this.onGround) { this.playerVelocity.y = JUMP_FORCE; this.onGround = false; }
      this.onGround = false;
      this.collideAxis(this.playerPos, this.playerVelocity, 'y', dt);
      this.collideAxis(this.playerPos, this.playerVelocity, 'x', dt);
      this.collideAxis(this.playerPos, this.playerVelocity, 'z', dt);
      if (this.onGround) {
        if (this.wasFalling) {
          const fall = this.lastGroundY - this.playerPos.y;
          if (fall > 3) { this.health = Math.max(0, this.health - Math.floor(fall-3)); this.onHealthChange(this.health); }
        }
        this.lastGroundY = this.playerPos.y; this.wasFalling = false;
      } else { this.wasFalling = true; }
      this.playerPos.y = Math.max(0, this.playerPos.y);
    }

    this.camera.position.set(this.playerPos.x, this.playerPos.y+PLAYER_EYE_HEIGHT, this.playerPos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.playerRotation.yaw;
    this.camera.rotation.x = this.playerRotation.pitch;

    this.raycastAccumulator += dt;
    if (this.crosshairTarget === null || this.raycastAccumulator >= this.raycastStep) {
      this.raycastAccumulator = 0;
      this.crosshairTarget = this.raycast();
    }
    if (this.crosshairTarget) {
      this.highlightMesh.visible = true;
      this.highlightMesh.position.set(this.crosshairTarget.blockPos.x+0.5, this.crosshairTarget.blockPos.y+0.5, this.crosshairTarget.blockPos.z+0.5);
    } else { this.highlightMesh.visible = false; }
    this.updateBreakState(dt);

    this.skyUpdateAccumulator += dt;
    if (this.skyUpdateAccumulator >= this.skyStep) {
      this.updateSky(this.skyUpdateAccumulator);
      this.skyUpdateAccumulator = 0;
    }
    this.animalsUpdateAccumulator += dt;
    if (this.animalsUpdateAccumulator >= this.animalsStep) {
      this.updateAnimals(this.animalsUpdateAccumulator);
      this.animalsUpdateAccumulator = 0;
    }
    this.updateDroppedItems(dt);
    this.updateBreakParticles(dt);
    this.weatherUpdateAccumulator += dt;
    if (this.weatherUpdateAccumulator >= this.weatherStep) {
      this.updateWeather(this.weatherUpdateAccumulator);
      this.weatherUpdateAccumulator = 0;
    }
    this.waterFlowAccumulator += dt;
    if (this.waterFlowAccumulator >= this.waterFlowStep) {
      this.updateWaterFlow();
      this.waterFlowAccumulator = 0;
    }
    this.updateSeasons(dt);
    const playerChunkX = Math.floor(this.playerPos.x / CHUNK_SIZE);
    const playerChunkZ = Math.floor(this.playerPos.z / CHUNK_SIZE);
    this.chunkRefreshTimer += dt;
    if (
      playerChunkX !== this.lastPlayerChunkX ||
      playerChunkZ !== this.lastPlayerChunkZ ||
      this.chunkRefreshTimer >= (this.lowEndDevice ? 0.55 : 0.33)
    ) {
      this.lastPlayerChunkX = playerChunkX;
      this.lastPlayerChunkZ = playerChunkZ;
      this.chunkRefreshTimer = 0;
      this.updateChunks();
    }
    this.lastRedstoneUpdate += dt;
    this.portalCooldown = Math.max(0, this.portalCooldown - dt);
    if (this.redstoneDirty && this.lastRedstoneUpdate >= 0.05) {
      this.lastRedstoneUpdate = 0;
      this.redstoneDirty = false;
      this.updateRedstone();
    }
    if (this.portalCooldown <= 0 && this.onPortalTravel) {
      const px = Math.floor(this.playerPos.x);
      const py = Math.floor(this.playerPos.y + 0.5);
      const pz = Math.floor(this.playerPos.z);
      const b1 = this.getBlockAtLoaded(px, py, pz);
      const b2 = this.getBlockAtLoaded(px, py + 1, pz);
      if (b1 === BlockType.PORTAL || b2 === BlockType.PORTAL) {
        this.portalCooldown = 2.5;
        const targetType = this.detectPortalTargetType(px, py, pz);
        this.onPortalTravel(targetType);
      }
    }

    for (let i=this.noteParticles.length-1;i>=0;i--) {
      const p=this.noteParticles[i]; p.life-=dt; p.mesh.position.y+=p.vy*dt;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity=Math.max(0,p.life/2);
      if (p.life<=0) { this.scene.remove(p.mesh); p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); this.noteParticles.splice(i,1); }
    }

    // Update physics engine
    this.physicsEngine.update(dt, this.playerPos);
  }
  
  private updateWeather(dt: number) {
    // Random weather changes (disabled for multiplayer clients controlled by host).
    if (!this.externalEnvironmentControl) {
      this.weatherTimer += dt;
      if (this.weatherTimer > 60) { // Check every minute
        this.weatherTimer = 0;
        const rand = Math.random();
        if (rand < 0.6) {
          this.setWeather('clear');
        } else if (rand < 0.8) {
          this.setWeather('rain');
        } else if (rand < 0.95) {
          this.setWeather('snow');
        } else {
          this.setWeather('storm');
        }
      }
    }
    
    // Update rain particles
    if (this.weather === 'rain' || this.weather === 'storm') {
      const positions = this.rainParticles.geometry.attributes.position.array as Float32Array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= 20 * dt; // Fall down
        if (positions[i] < 0) {
          positions[i] = 60;
          positions[i - 1] = this.playerPos.x + (Math.random() - 0.5) * 100;
          positions[i + 1] = this.playerPos.z + (Math.random() - 0.5) * 100;
        }
      }
      this.rainParticles.geometry.attributes.position.needsUpdate = true;
    }
    
    // Update snow particles
    if (this.weather === 'snow') {
      const positions = this.snowParticles.geometry.attributes.position.array as Float32Array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= 5 * dt; // Fall slowly
        positions[i - 1] += Math.sin(this.timeOfDay * Math.PI * 4 + i) * 0.1; // Drift
        if (positions[i] < 0) {
          positions[i] = 60;
          positions[i - 1] = this.playerPos.x + (Math.random() - 0.5) * 100;
          positions[i + 1] = this.playerPos.z + (Math.random() - 0.5) * 100;
        }
      }
      this.snowParticles.geometry.attributes.position.needsUpdate = true;
    }
    
    // Lightning in storms
    if (this.weather === 'storm') {
      this.nextLightningTime -= dt;
      if (this.nextLightningTime <= 0) {
        this.nextLightningTime = 5 + Math.random() * 15;
        // Flash lightning
        this.lightningLight.intensity = 2;
        this.skyColor.setHex(0x444466);
        this.scene.background = this.skyColor;
        setTimeout(() => {
          this.lightningLight.intensity = 0;
        }, 100);
      }
    }
  }

  private updateWaterFlow() {
    if (this.waterFlowActive.size === 0) return;

    const pending = Array.from(this.waterFlowActive);
    this.waterFlowActive.clear();

    const maxUpdates = this.lowEndDevice ? 64 : 140;
    const rebuildChunks = new Set<string>();
    let processed = 0;

    for (let i = 0; i < pending.length && processed < maxUpdates; i++) {
      const parts = pending[i].split(',');
      if (parts.length !== 3) continue;
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      const z = Number(parts[2]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      if (this.getBlockAtLoaded(x, y, z) !== BlockType.WATER) continue;

      processed++;
      let changed = false;

      // Gravity first: always try to flow down.
      if (y > 0 && this.getBlockAtLoaded(x, y - 1, z) === BlockType.AIR) {
        const prev = this.setLoadedBlockFast(x, y - 1, z, BlockType.WATER, rebuildChunks);
        if (prev === BlockType.AIR) {
          changed = true;
          this.waterFlowActive.add(this.waterKey(x, y - 1, z));
        }
      } else {
        // Side flow on supported ground to avoid instant flooding in mid-air.
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        let spreads = 0;
        for (const d of dirs) {
          if (spreads >= 2) break;
          const nx = x + d[0];
          const nz = z + d[1];
          if (this.getBlockAtLoaded(nx, y, nz) !== BlockType.AIR) continue;
          const below = y > 0 ? this.getBlockAtLoaded(nx, y - 1, nz) : BlockType.BEDROCK;
          if (below === BlockType.AIR) continue;
          const prev = this.setLoadedBlockFast(nx, y, nz, BlockType.WATER, rebuildChunks);
          if (prev === BlockType.AIR) {
            spreads++;
            changed = true;
            this.waterFlowActive.add(this.waterKey(nx, y, nz));
          }
        }
      }

      if (changed) this.waterFlowActive.add(this.waterKey(x, y, z));
    }

    if (rebuildChunks.size > 0) this.rebuildChunkSet(rebuildChunks);
  }
  
  private updateSeasons(dt: number) {
    this.seasonTimer += dt;
    
    // Change season every 5 minutes
    if (this.seasonTimer > this.seasonDuration) {
      this.seasonTimer = 0;
      
      // Cycle through seasons
      const seasons: ('spring' | 'summer' | 'autumn' | 'winter')[] = ['spring', 'summer', 'autumn', 'winter'];
      const currentIndex = seasons.indexOf(this.currentSeason);
      const nextIndex = (currentIndex + 1) % 4;
      this.currentSeason = seasons[nextIndex];
      
      // Interpolate to new season colors
      const targetColors = this.seasonColors[this.currentSeason];
      this.animateSeasonChange(targetColors);
      
      console.log(`Season changed to: ${this.currentSeason}`);
    }
  }
  
  private animateSeasonChange(targetColors: { sky: number; grass: number; leaves: number; fog: number }) {
    // Smoothly transition colors over 2 seconds
    const duration = 2000;
    const startTime = performance.now();
    const startSky = this.currentSeasonColors.sky;
    const startFog = this.currentSeasonColors.fog;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Lerp colors
      const startSkyColor = new THREE.Color(startSky);
      const targetSkyColor = new THREE.Color(targetColors.sky);
      this.currentSeasonColors.sky = startSkyColor.lerp(targetSkyColor, progress).getHex();
      
      const startFogColor = new THREE.Color(startFog);
      const targetFogColor = new THREE.Color(targetColors.fog);
      this.currentSeasonColors.fog = startFogColor.lerp(targetFogColor, progress).getHex();
      
      // Apply to scene
      this.fog.color.setHex(this.currentSeasonColors.fog);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Mark chunks for rebuild to update block colors
        for (const [key, chunk] of this.chunks) {
          if (this.chunkMeshes.has(key)) {
            this.buildChunkMesh(chunk);
          }
        }
      }
    };
    
    requestAnimationFrame(animate);
  }
  
  public getCurrentSeason(): string {
    return this.currentSeason;
  }

  start() {
    this.lastTime = performance.now();
    const loop = (time: number) => {
      const dt = Math.min((time-this.lastTime)/1000, 0.1);
      this.lastTime = time;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }
  stop() { cancelAnimationFrame(this.animationId); }
  private onResize() {
    this.camera.aspect = window.innerWidth/window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  dispose() {
    this.stop(); this.renderer.dispose();
    for (const [, remote] of this.remotePlayers) this.scene.remove(remote.mesh);
    this.remotePlayers.clear();
    for (const p of this.breakParticles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.breakParticles = [];
    if (this.breakOverlayMesh) {
      this.scene.remove(this.breakOverlayMesh);
      this.breakOverlayMesh.geometry.dispose();
      this.breakOverlayMaterial.dispose();
      this.breakOverlayMesh.visible = false;
    }
    for (const tex of this.breakStageTextures) tex.dispose();
    this.breakStageTextures = [];
    this.activeBreak = null;
    const g = window as any;
    if (g.Creativ44?.__renderer === this) delete g.Creativ44;
    if (this.container.contains(this.renderer.domElement)) this.container.removeChild(this.renderer.domElement);
  }

  // ══════════════════════════════════════════════════════════════════
  // COMMAND SYSTEM INTEGRATION
  // ══════════════════════════════════════════════════════════════════

  async executeCommand(command: string): Promise<{success: boolean; output: string}> {
    const context: CommandContext = {
      executor: { x: this.playerPos.x, y: this.playerPos.y, z: this.playerPos.z },
      position: { x: this.playerPos.x, y: this.playerPos.y, z: this.playerPos.z },
      gameRenderer: this,
      variables: new Map()
    };
    return await commandSystem.execute(command, context);
  }

  rebuildAllChunks() {
    for (const [key, chunk] of this.chunks) {
      if (this.chunkMeshes.has(key)) this.buildChunkMesh(chunk);
    }
  }

  getMultiplayerPlayerState(id: string, name: string, skin?: MultiplayerSkin): MultiplayerPlayerState {
    return {
      id,
      name,
      x: this.playerPos.x,
      y: this.playerPos.y,
      z: this.playerPos.z,
      yaw: this.playerRotation.yaw,
      pitch: this.playerRotation.pitch,
      skin,
    };
  }

  applyWorldBlockEdits(edits: MultiplayerBlockEvent[]) {
    this.applyMultiplayerBlockEvents(edits);
  }

  applyMultiplayerBlockEvents(events: MultiplayerBlockEvent[]) {
    const rebuild = new Set<string>();
    for (const ev of events) {
      const cx = Math.floor(ev.x / CHUNK_SIZE);
      const cz = Math.floor(ev.z / CHUNK_SIZE);
      const key = chunkKey(cx, cz);
      const chunk = this.chunks.get(key);
      if (!chunk || ev.y < 0 || ev.y >= CHUNK_HEIGHT) continue;
      const lx = ((ev.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((ev.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const prev = getBlock(chunk, lx, ev.y, lz);
      const nextType = Number(ev.type) as BlockType;
      setBlockInChunk(chunk, lx, ev.y, lz, nextType);
      this.checkRS(prev);
      this.checkRS(nextType);
      this.queueWaterAround(ev.x, ev.y, ev.z);
      if (nextType === BlockType.WATER) this.queueWaterAt(ev.x, ev.y, ev.z);
      rebuild.add(key);
      if (lx === 0) rebuild.add(chunkKey(cx - 1, cz));
      if (lx === CHUNK_SIZE - 1) rebuild.add(chunkKey(cx + 1, cz));
      if (lz === 0) rebuild.add(chunkKey(cx, cz - 1));
      if (lz === CHUNK_SIZE - 1) rebuild.add(chunkKey(cx, cz + 1));
    }
    for (const key of rebuild) {
      const c = this.chunks.get(key);
      if (c) this.buildChunkMesh(c);
    }
  }

  getMultiplayerAnimals(): MultiplayerAnimalState[] {
    return this.animals.map((a) => ({ x: a.position.x, y: a.position.y, z: a.position.z }));
  }

  applyMultiplayerAnimals(states: MultiplayerAnimalState[]) {
    const count = Math.min(states.length, this.animals.length);
    for (let i = 0; i < count; i++) {
      const s = states[i];
      const a = this.animals[i];
      a.position.set(s.x, s.y, s.z);
      a.mesh.position.copy(a.position);
    }
  }

  updateRemotePlayers(players: MultiplayerPlayerState[], selfId: string) {
    const seen = new Set<string>();
    for (const p of players) {
      if (!p || p.id === selfId) continue;
      seen.add(p.id);
      let remote = this.remotePlayers.get(p.id);
      const skin = p.skin || {
        skinTone: '#f1c27d',
        hair: '#3d2b1f',
        shirt: '#4aa3ff',
        pants: '#2f3f56',
        shoes: '#1f1f1f',
      };
      const skinKey = `${skin.skinTone}|${skin.hair}|${skin.shirt}|${skin.pants}|${skin.shoes}`;
      if (remote && remote.skinKey !== skinKey) {
        this.scene.remove(remote.mesh);
        this.remotePlayers.delete(p.id);
        remote = undefined;
      }
      if (!remote) {
        const g = this.createRemoteAvatarMesh(skin);

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 16, 256, 32);
        ctx.fillStyle = '#ffffff';
        ctx.font = '24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.name || 'Player', 128, 40);
        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        spr.scale.set(2.2, 0.55, 1);
        spr.position.set(0, 2.4, 0);
        g.add(spr);

        this.scene.add(g);
        remote = { mesh: g, label: spr, skinKey };
        this.remotePlayers.set(p.id, remote);
      }
      remote.mesh.position.set(p.x, p.y, p.z);
      remote.mesh.rotation.y = p.yaw;
    }
    for (const [id, remote] of this.remotePlayers) {
      if (!seen.has(id)) {
        this.scene.remove(remote.mesh);
        this.remotePlayers.delete(id);
      }
    }
  }

  private createRemoteAvatarMesh(skin: MultiplayerSkin): THREE.Group {
    const g = new THREE.Group();
    const matSkin = new THREE.MeshLambertMaterial({ color: new THREE.Color(skin.skinTone) });
    const matHair = new THREE.MeshLambertMaterial({ color: new THREE.Color(skin.hair) });
    const matShirt = new THREE.MeshLambertMaterial({ color: new THREE.Color(skin.shirt) });
    const matPants = new THREE.MeshLambertMaterial({ color: new THREE.Color(skin.pants) });
    const matShoes = new THREE.MeshLambertMaterial({ color: new THREE.Color(skin.shoes) });

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), matSkin);
    head.position.y = 1.55;
    g.add(head);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.52), matHair);
    hair.position.y = 1.78;
    g.add(hair);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.7, 0.3), matShirt);
    body.position.y = 0.98;
    g.add(body);

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.64, 0.16), matSkin);
    armL.position.set(-0.36, 0.98, 0);
    g.add(armL);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.64, 0.16), matSkin);
    armR.position.set(0.36, 0.98, 0);
    g.add(armR);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.18), matPants);
    legL.position.set(-0.14, 0.34, 0);
    g.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.18), matPants);
    legR.position.set(0.14, 0.34, 0);
    g.add(legR);

    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.2), matShoes);
    shoeL.position.set(-0.14, 0.02, 0.03);
    g.add(shoeL);
    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.2), matShoes);
    shoeR.position.set(0.14, 0.02, 0.03);
    g.add(shoeR);
    return g;
  }

  // Methods called by command system
  teleportPlayer(x: number, y: number, z: number) {
    this.playerPos.set(x, y, z);
    console.log(`[Renderer] Teleported player to ${x}, ${y}, ${z}`);
  }

  setBlockAt(x: number, y: number, z: number, blockType: BlockType) {
    const rebuildChunks = new Set<string>();
    const prev = this.setLoadedBlockFast(x, y, z, blockType, rebuildChunks);
    if (prev === null || prev === blockType) return;

    this.rebuildChunkSet(rebuildChunks);
    this.checkRS(prev);
    this.checkRS(blockType);

    // Check if block should fall
    if (this.physicsEngine.shouldBlockFall(blockType)) {
      this.physicsEngine.makeFallingBlock(x, y, z, blockType);
    }
    this.queueWaterAround(x, y, z);
    if (blockType === BlockType.WATER) this.queueWaterAt(x, y, z);
    if (this.onBlockChanged) this.onBlockChanged({ x, y, z, type: Number(blockType) });
  }


  setWorldTime(timeValue: number) {
    const wrapped = ((timeValue % 24000) + 24000) % 24000;
    this.timeOfDay = wrapped / 24000;
    console.log(`[Renderer] Set world time to ${timeValue}`);
  }

  setWeather(weather: string) {
    const normalized = weather === 'rain' || weather === 'snow' || weather === 'storm' ? weather : 'clear';
    if (this.weather === normalized) return;
    this.weather = normalized;
    this.rainParticles.visible = normalized === 'rain' || normalized === 'storm';
    this.snowParticles.visible = normalized === 'snow';
    console.log(`[Renderer] Set weather to ${normalized}`);
  }

  setExternalEnvironmentControl(enabled: boolean) {
    this.externalEnvironmentControl = enabled;
    if (!enabled) this.weatherTimer = 0;
  }

  getTimeOfDayNormalized() {
    return ((this.timeOfDay % 1) + 1) % 1;
  }

  setTimeOfDayNormalized(value: number) {
    if (!Number.isFinite(value)) return;
    this.timeOfDay = ((value % 1) + 1) % 1;
  }

  getWeatherType(): 'clear' | 'rain' | 'snow' | 'storm' {
    return this.weather;
  }

  setGameMode(mode: string) {
    const normalized = mode === 'grounded' ? 'survival' : mode;
    this._gameMode = normalized as GameMode;
    this.onModeChange(this._gameMode);
    console.log(`[Renderer] Set game mode to ${normalized}`);
  }

  spawnEntity(entityType: string, x: number, y: number, z: number) {
    console.log(`[Renderer] Spawned ${entityType} at ${x}, ${y}, ${z}`);
    // This would integrate with animal spawning system
  }

  // ══════════════════════════════════════════════════════════════════
  // PHYSICS SYSTEM INTEGRATION
  // ══════════════════════════════════════════════════════════════════

  createExplosion(x: number, y: number, z: number, power: number) {
    this.physicsEngine.createExplosion(x, y, z, power);
  }

  dropItemPhysics(x: number, y: number, z: number, blockType: BlockType) {
    this.physicsEngine.dropItem(x, y, z, blockType);
  }

  // ══════════════════════════════════════════════════════════════════
  // CUSTOMIZATION SYSTEM INTEGRATION
  // ══════════════════════════════════════════════════════════════════

  getCustomBlockProperties(blockType: BlockType) {
    return customizationManager.getBlockProperties(blockType);
  }

  applyCustomizations() {
    // Apply all customizations from manager
    console.log('[Renderer] Applied customizations');
  }

  // ══════════════════════════════════════════════════════════════════
  // CREATIVE MODE TOOLS
  // ══════════════════════════════════════════════════════════════════

  fillRegion(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, blockType: BlockType) {
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          this.setBlockAt(x, y, z, blockType);
        }
      }
    }
    console.log(`[Renderer] Filled region with ${blockType}`);
  }

  cloneRegion(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, destX: number, destY: number, destZ: number) {
    const blocks: Array<{x: number, y: number, z: number, type: BlockType}> = [];

    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) {
          const blockType = this.getBlockAt(x, y, z);
          if (blockType !== BlockType.AIR) {
            blocks.push({
              x: destX + (x - x1),
              y: destY + (y - y1),
              z: destZ + (z - z1),
              type: blockType
            });
          }
        }
      }
    }

    blocks.forEach(b => this.setBlockAt(b.x, b.y, b.z, b.type));
    console.log(`[Renderer] Cloned ${blocks.length} blocks`);
  }

  getScriptingAPI() {
    return {
      getPlayerPos: () => this.getPlayerPos(),
      teleport: (x: number, y: number, z: number) => this.teleportPlayer(x, y, z),
      getBlock: (x: number, y: number, z: number) => this.getBlockAt(x, y, z),
      setBlock: (x: number, y: number, z: number, block: BlockType) => this.setBlockAt(x, y, z, block),
      fill: (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, block: BlockType) =>
        this.fillRegion(x1, y1, z1, x2, y2, z2, block),
      clone: (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, dx: number, dy: number, dz: number) =>
        this.cloneRegion(x1, y1, z1, x2, y2, z2, dx, dy, dz),
      explode: (x: number, y: number, z: number, power = 4) => this.createExplosion(x, y, z, power),
      setTime: (value: number) => this.setWorldTime(value),
      setWeather: (weather: 'clear' | 'rain' | 'snow' | 'storm') => this.setWeather(weather),
      setGameMode: (mode: 'creative' | 'survival' | 'grounded') => this.setGameMode(mode),
      summon: (entity: string, x: number, y: number, z: number) => this.spawnEntity(entity, x, y, z),
      execute: (command: string) => this.executeCommand(command),
      registerCommand: (name: string, handler: (args: string[], ctx: CommandContext) => Promise<{ success: boolean; output: string }>) => {
        commandSystem.registerCommand(name, handler as any);
      },
      blockEnum: BlockType,
      __renderer: this,
    };
  }

  private installGlobalModApi() {
    const g = window as any;
    g.Creativ44 = this.getScriptingAPI();
  }
}
