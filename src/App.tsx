import { useState, useEffect, useRef, useCallback } from 'react';
import { GameRenderer, GameMode, MultiplayerBlockEvent, MultiplayerPlayerState } from './game/renderer';
import {
  HOTBAR_BLOCKS, BLOCK_NAMES, BLOCK_FACE_COLORS, INVENTORY_CATEGORIES, BlockType, drawBlockIcon,
  ToolType, TOOL_NAMES, drawToolIcon,
} from './game/constants';
import { settingsManager, GameSettings } from './game/settings';
import { textureManager, FaceDir } from './game/textureManager';
import { worldManager } from './game/worldManager';
import { modManager, RuntimeMod } from './game/modManager';
import { multiplayerClient, MultiplayerSession } from './game/multiplayerClient';

type GameState = 'menu' | 'worldselect' | 'multiplayermenu' | 'loading' | 'playing';
type HotbarItem = { type: 'block'; block: BlockType } | { type: 'tool'; tool: ToolType };
type CustomBlockDef = { block: BlockType; name: string; top: string; side: string; bottom: string };
type PlayerSkin = {
  skinTone: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
};
type PlayerProfile = {
  name: string;
  skin: PlayerSkin;
};

const CUSTOM_BLOCK_SLOTS: BlockType[] = [
  BlockType.WOOL_WHITE,
  BlockType.WOOL_RED,
  BlockType.WOOL_BLUE,
  BlockType.WOOL_GREEN,
  BlockType.WOOL_YELLOW,
];
const CUSTOM_BLOCKS_STORAGE_KEY = 'creativ44_custom_blocks_v1';
const PROFILE_STORAGE_KEY = 'creativ44_profile_v1';
const PLAYER_INVENTORY_PREFIX = 'creativ44_inventory_v1';

function makeDefaultCustomBlocks(): CustomBlockDef[] {
  const baseColors = ['#f2f2f2', '#d94545', '#4d6cf0', '#4eb95f', '#f0cf45'];
  return CUSTOM_BLOCK_SLOTS.map((block, i) => ({
    block,
    name: `Custom ${i + 1}`,
    top: baseColors[i],
    side: baseColors[i],
    bottom: baseColors[i],
  }));
}

function applyCustomBlocksToRuntime(customBlocks: CustomBlockDef[]) {
  for (const def of customBlocks) {
    BLOCK_NAMES[def.block] = def.name.trim() || `Custom ${def.block}`;
    BLOCK_FACE_COLORS[def.block] = [def.top, def.side, def.bottom];
  }
}

function loadCustomBlocksFromStorage(): CustomBlockDef[] {
  try {
    const raw = localStorage.getItem(CUSTOM_BLOCKS_STORAGE_KEY);
    if (!raw) {
      const defaults = makeDefaultCustomBlocks();
      applyCustomBlocksToRuntime(defaults);
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('invalid custom block payload');
    const defaults = makeDefaultCustomBlocks();
    const merged = defaults.map((d) => {
      const found = parsed.find((x: any) => Number(x?.block) === d.block);
      if (!found) return d;
      return {
        block: d.block,
        name: typeof found.name === 'string' ? found.name : d.name,
        top: typeof found.top === 'string' ? found.top : d.top,
        side: typeof found.side === 'string' ? found.side : d.side,
        bottom: typeof found.bottom === 'string' ? found.bottom : d.bottom,
      };
    });
    applyCustomBlocksToRuntime(merged);
    return merged;
  } catch {
    const defaults = makeDefaultCustomBlocks();
    applyCustomBlocksToRuntime(defaults);
    return defaults;
  }
}

const DEFAULT_PROFILE: PlayerProfile = {
  name: 'Player',
  skin: {
    skinTone: '#f1c27d',
    hair: '#3b2518',
    shirt: '#4aa3ff',
    pants: '#2f3f56',
    shoes: '#222222',
  },
};

function loadProfileFromStorage(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    return {
      name: typeof parsed?.name === 'string' && parsed.name.trim() ? parsed.name.trim().slice(0, 20) : DEFAULT_PROFILE.name,
      skin: {
        ...DEFAULT_PROFILE.skin,
        ...(parsed?.skin || {}),
      },
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function saveProfileToStorage(profile: PlayerProfile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {}
}

function inventoryStorageKey(worldId: string, playerName: string) {
  return `${PLAYER_INVENTORY_PREFIX}:${worldId}:${playerName || 'Player'}`;
}

function loadHotbarFromStorage(worldId: string, playerName: string): HotbarItem[] | null {
  try {
    const raw = localStorage.getItem(inventoryStorageKey(worldId, playerName));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 9) return null;
    const items: HotbarItem[] = [];
    for (const item of parsed) {
      if (item?.type === 'tool' && Number.isFinite(item.tool)) {
        items.push({ type: 'tool', tool: Number(item.tool) as ToolType });
      } else if (item?.type === 'block' && Number.isFinite(item.block)) {
        items.push({ type: 'block', block: Number(item.block) as BlockType });
      } else {
        return null;
      }
    }
    return items;
  } catch {
    return null;
  }
}

function saveHotbarToStorage(worldId: string, playerName: string, items: HotbarItem[]) {
  try {
    localStorage.setItem(inventoryStorageKey(worldId, playerName), JSON.stringify(items));
  } catch {}
}

const MC = '"VT323","Inter",sans-serif';
const TITLE_FONT = '"Press Start 2P","MinecraftFont","VT323","Inter",sans-serif';
const GAME_BRAND = 'Creativ44';
const BASE_URL = import.meta.env.BASE_URL || '/';
const assetUrl = (path: string): string => `${BASE_URL.replace(/\/?$/, '/')}${path.replace(/^\/+/, '')}`;
const assetCssUrl = (path: string): string => `url(${assetUrl(path)})`;

function BlockIcon({ block, size = 32 }: { block: BlockType; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const s = size * 2; c.width = s; c.height = s;
    ctx.clearRect(0, 0, s, s); ctx.imageSmoothingEnabled = false;
    drawBlockIcon(ctx, block, 0, 0, s);
  }, [block, size]);
  return <canvas ref={ref} style={{ width: size, height: size, imageRendering: 'pixelated' }} />;
}

function ToolIcon({ tool, size = 32 }: { tool: ToolType; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const s = size * 2; c.width = s; c.height = s;
    ctx.clearRect(0, 0, s, s); ctx.imageSmoothingEnabled = false;
    drawToolIcon(ctx, tool, 0, 0, s);
  }, [tool, size]);
  return <canvas ref={ref} style={{ width: size, height: size, imageRendering: 'pixelated' }} />;
}

// ===== MC BUTTON using Minecraft GUI textures =====
function MCBtn({ children, onClick, color: _color, style, disabled = false }: {
  children: React.ReactNode;
  onClick: () => void;
  color?: 'green' | 'gray';
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  // _color parameter kept for API compatibility
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const baseBg = disabled
    ? 'linear-gradient(180deg, #666 0%, #4e4e4e 100%)'
    : _color === 'green'
      ? 'linear-gradient(180deg, #6faa4c 0%, #4d7f33 100%)'
      : 'linear-gradient(180deg, #7b7b7b 0%, #5c5c5c 100%)';
  const hoverFilter = isHovered && !disabled ? 'brightness(1.08)' : 'none';
  const pressTransform = isPressed && !disabled ? 'translateY(2px)' : 'translateY(0)';
  
  return (
    <button 
      onClick={disabled ? undefined : onClick} 
      disabled={disabled}
      className="relative w-full h-10 md:h-12 overflow-hidden"
      style={{ 
        background: baseBg,
        border: '2px solid #222',
        borderRadius: 6,
        boxShadow: disabled ? 'none' : '0 3px 0 #1c1c1c, inset 0 1px 0 rgba(255,255,255,0.2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        filter: hoverFilter,
        transform: pressTransform,
        transition: 'transform 0.08s ease, filter 0.12s ease',
        ...style,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
    >
      <span className="absolute inset-0 flex items-center justify-center text-white text-shadow-mc"
        style={{ 
          fontFamily: MC,
          fontSize: '14px',
          letterSpacing: '0.04em',
          textShadow: '1px 1px 0 #000',
          pointerEvents: 'none'
        }}>
        {children}
      </span>
    </button>
  );
}

function SkinAvatarPreview({ skin, size = 84 }: { skin: PlayerSkin; size?: number }) {
  const bodyW = Math.round(size * 0.34);
  const bodyH = Math.round(size * 0.36);
  const head = Math.round(size * 0.3);
  const limbW = Math.max(8, Math.round(size * 0.1));
  const limbH = Math.round(size * 0.3);
  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 1.2 }}>
      <div style={{ width: head, height: head, background: skin.skinTone, border: `3px solid ${skin.hair}`, position: 'absolute', left: (size - head) / 2, top: 0, borderRadius: 4 }} />
      <div style={{ width: bodyW, height: bodyH, background: skin.shirt, position: 'absolute', left: (size - bodyW) / 2, top: head + 6, borderRadius: 4 }} />
      <div style={{ width: limbW, height: limbH, background: skin.skinTone, position: 'absolute', left: (size - bodyW) / 2 - limbW - 4, top: head + 8, borderRadius: 3 }} />
      <div style={{ width: limbW, height: limbH, background: skin.skinTone, position: 'absolute', left: (size + bodyW) / 2 + 4, top: head + 8, borderRadius: 3 }} />
      <div style={{ width: limbW + 4, height: limbH + 8, background: skin.pants, position: 'absolute', left: size / 2 - (limbW + 8), top: head + bodyH + 8, borderRadius: 3 }} />
      <div style={{ width: limbW + 4, height: limbH + 8, background: skin.pants, position: 'absolute', left: size / 2 + 4, top: head + bodyH + 8, borderRadius: 3 }} />
      <div style={{ width: limbW + 8, height: 8, background: skin.shoes, position: 'absolute', left: size / 2 - (limbW + 10), top: head + bodyH + limbH + 8, borderRadius: 2 }} />
      <div style={{ width: limbW + 8, height: 8, background: skin.shoes, position: 'absolute', left: size / 2 + 2, top: head + bodyH + limbH + 8, borderRadius: 2 }} />
    </div>
  );
}

function ProfileModal({
  open,
  profile,
  onClose,
  onSave,
}: {
  open: boolean;
  profile: PlayerProfile;
  onClose: () => void;
  onSave: (p: PlayerProfile) => void;
}) {
  const [local, setLocal] = useState<PlayerProfile>(profile);
  useEffect(() => { setLocal(profile); }, [profile, open]);
  if (!open) return null;
  const setSkin = (k: keyof PlayerSkin, v: string) => setLocal(prev => ({ ...prev, skin: { ...prev.skin, [k]: v } }));
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-[min(92vw,680px)] p-5 rounded-2xl border-2"
        style={{ background: 'linear-gradient(180deg,#232f40,#1a2331)', borderColor: '#6a85a8', fontFamily: MC }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-white text-xl mb-3" style={{ fontFamily: TITLE_FONT }}>Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
          <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.25)' }}>
            <SkinAvatarPreview skin={local.skin} size={120} />
            <div className="text-center text-white text-sm mt-2">{local.name || 'Player'}</div>
          </div>
          <div className="space-y-3">
            <input
              value={local.name}
              onChange={(e) => setLocal(prev => ({ ...prev, name: e.target.value.slice(0, 20) }))}
              placeholder="Player name"
              className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600"
              style={{ fontFamily: MC }}
            />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {([
                ['skinTone', 'Skin'],
                ['hair', 'Hair'],
                ['shirt', 'Shirt'],
                ['pants', 'Pants'],
                ['shoes', 'Shoes'],
              ] as [keyof PlayerSkin, string][]).map(([k, label]) => (
                <label key={k} className="text-xs text-gray-200">
                  {label}
                  <input type="color" value={local.skin[k]} onChange={(e) => setSkin(k, e.target.value)} className="w-full h-10 mt-1" />
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <MCBtn onClick={() => { onSave({ ...local, name: local.name.trim() || 'Player' }); onClose(); }} color="green">Save Profile</MCBtn>
          <MCBtn onClick={onClose} color="gray">Cancel</MCBtn>
        </div>
      </div>
    </div>
  );
}

// ===== MENU SCREEN with Background Image =====
function MenuScreen({
  onPlay,
  onOpenSettings,
  onMultiplayer,
  onOpenProfile,
  profile,
}: {
  onPlay: () => void;
  onOpenSettings: () => void;
  onMultiplayer: () => void;
  onOpenProfile: () => void;
  profile: PlayerProfile;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Minecraft panorama background */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'url(https://i.ytimg.com/vi/39Y1ZSc6ySk/hq720.jpg)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'blur(2px) brightness(0.7)',
      }} />
      <div className="absolute inset-0 bg-black/30" />

      {/* Title */}
      <div className={`relative z-10 transition-all duration-1000 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}>
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-center mb-1"
          style={{ fontFamily: TITLE_FONT, color: '#ffffff', textShadow: '0 0 10px rgba(255,255,255,0.28)', letterSpacing: '0.08em', transform: 'perspective(500px) rotateX(5deg)' }}>
          {GAME_BRAND}
        </h1>
        <p className="text-center text-xs md:text-sm" style={{ fontFamily: MC, color: '#bbbbbb', textShadow: '1px 1px 0 #000' }}>
          Build. Explore. Create.
        </p>
      </div>

      {/* Buttons */}
      <div className={`relative z-10 mt-8 flex flex-col items-center gap-3 transition-all duration-700 delay-300 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        style={{ width: 'min(85vw, 400px)' }}>
        <MCBtn onClick={onPlay} color="green">Singleplayer</MCBtn>
        <MCBtn onClick={onMultiplayer} color="gray">Multiplayer</MCBtn>
        <div className="flex gap-3 w-full mt-2">
          <div className="flex-1"><MCBtn onClick={onOpenSettings} color="gray">Options...</MCBtn></div>
          <div className="flex-1"><MCBtn onClick={() => {}} color="gray">Quit Game</MCBtn></div>
        </div>
      </div>
      <div className="relative z-10 mt-5 flex items-center gap-3 px-4 py-2 rounded-xl"
        style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.2)' }}>
        <SkinAvatarPreview skin={profile.skin} size={44} />
        <div className="text-white text-sm" style={{ fontFamily: MC }}>{profile.name}</div>
        <button
          onClick={onOpenProfile}
          className="px-3 py-2 rounded bg-blue-600 text-white text-xs"
          style={{ fontFamily: MC }}>
          Edit Profile
        </button>
      </div>

      {/* Footer */}
      <div className={`relative z-10 mt-4 transition-all duration-1000 delay-500 ${show ? 'opacity-100' : 'opacity-0'}`}>
        <p style={{ fontFamily: MC, color: '#aaa', fontSize: '10px', textShadow: '1px 1px 0 #000' }}>
          {GAME_BRAND} 1.21.2 — Not affiliated with Mojang
        </p>
      </div>
      <div className="absolute bottom-2 right-2 z-10">
        <p style={{ fontFamily: MC, color: '#555', fontSize: '9px', textShadow: '1px 1px 0 #000' }}>
          Copyright {GAME_BRAND}. Do not distribute!
        </p>
      </div>
    </div>
  );
}

// ===== LOADING SCREEN =====
function LoadingScreen({ progress }: { progress: number }) {
  const pct = Math.floor(progress * 100);
  const tips = [
    'Preparing textures...',
    'Generating terrain...',
    'Carving caves...',
    'Planting forests...',
    'Spawning life...',
    'Building meshes...',
    'Finalizing world...',
    'Almost ready...'
  ];
  const ti = Math.min(Math.floor(progress * tips.length), tips.length - 1);
  const cubeRotate = `rotateX(${20 + progress * 360}deg) rotateY(${35 + progress * 540}deg)`;
  const glowWidth = Math.max(6, pct);
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center select-none">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, #243447 0%, #101722 55%, #0a0f16 100%)' }} />
      <div className="absolute inset-0" style={{
        backgroundImage: 'url(https://i.ytimg.com/vi/39Y1ZSc6ySk/hq720.jpg)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'blur(8px) brightness(0.22) saturate(1.05)',
      }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.65) 100%)' }} />
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-4 perspective-[800px]">
          <div
            className="relative w-14 h-14 md:w-16 md:h-16 transition-transform duration-300"
            style={{ transformStyle: 'preserve-3d', transform: cubeRotate }}
          >
            <div className="absolute inset-0 rounded-sm border-2 border-white/60" style={{ transform: 'translateZ(8px)', background: 'rgba(84, 179, 64, 0.75)' }} />
            <div className="absolute inset-0 rounded-sm border-2 border-white/40" style={{ transform: 'rotateY(90deg) translateZ(8px)', background: 'rgba(126, 217, 87, 0.55)' }} />
            <div className="absolute inset-0 rounded-sm border-2 border-black/40" style={{ transform: 'rotateX(90deg) translateZ(8px)', background: 'rgba(58, 127, 51, 0.8)' }} />
          </div>
        </div>

        <h2 className="text-xl md:text-2xl font-bold mb-2 text-white"
          style={{ fontFamily: MC, textShadow: '2px 2px 0 #121212' }}>
          Loading world
        </h2>
        <p className="text-xs md:text-sm mb-4" style={{ fontFamily: MC, color: '#aaa', textShadow: '1px 1px 0 #000' }}>
          {tips[ti]}
        </p>

        <div className="relative overflow-hidden rounded-md"
          style={{ width: 'min(85vw, 440px)', height: 24, background: '#141a23', border: '2px solid #0c1119' }}>
          <div className="absolute inset-0 opacity-30"
            style={{ backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.05) 75%, transparent 75%, transparent)', backgroundSize: '16px 16px' }} />
          <div className="h-full transition-all duration-200"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #5cae46 0%, #7ed957 45%, #4d8f3a 100%)', boxShadow: `0 0 18px rgba(126,217,87,0.45), inset 0 1px 0 rgba(255,255,255,0.22)` }} />
          <div className="absolute top-0 h-full transition-all duration-150"
            style={{ left: `${Math.max(0, glowWidth - 6)}%`, width: '10px', background: 'rgba(255,255,255,0.45)', filter: 'blur(2px)' }} />
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ fontFamily: MC, color: '#fff', fontSize: '11px', textShadow: '1px 1px 0 #111' }}>
            {pct}%
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== HAMBURGER MENU =====
function HamburgerMenu({ renderer, gameMode, onModeChange, onOpenSettings }: { renderer: GameRenderer; gameMode: GameMode; onModeChange: (m: GameMode) => void; onOpenSettings: () => void }) {
  const [open, setOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setMenuVisible(true), 10);
      return () => clearTimeout(t);
    }
    setMenuVisible(false);
  }, [open]);
  return (
    <>
      <button onClick={() => setOpen(!open)}
        className="fixed top-2 right-2 z-40 w-12 h-12 flex flex-col items-center justify-center gap-1.5 active:scale-90 transition-transform"
        style={{ background: 'rgba(0,0,0,0.5)', border: '3px solid rgba(255,255,255,0.2)', borderRadius: '16px' }}>
        <div className="w-6 h-1 bg-white rounded" />
        <div className="w-6 h-1 bg-white rounded" />
        <div className="w-6 h-1 bg-white rounded" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setOpen(false)}>
          <div className={`absolute inset-0 bg-black/55 transition-opacity duration-300 ${menuVisible ? 'opacity-100' : 'opacity-0'}`} style={{ backdropFilter: 'blur(2px)' }} />
          <div
            className={`relative w-[94vw] max-w-xl transition-all duration-300 ${menuVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-3'}`}
            onClick={e => e.stopPropagation()}
            style={{ fontFamily: MC, background: '#2a2a2a', border: '3px solid #555', borderRadius: '0', boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }}
          >
            <div className="p-8 md:p-10">
              <h2 className="text-center text-white text-xl mb-6 font-bold" style={{ textShadow: '2px 2px 0 #000', fontWeight: 'bold' }}>
                Game Menu
              </h2>
              <div className="flex flex-col items-center gap-4 max-w-[420px] mx-auto w-full">
                <div className="w-full flex justify-center">
                  <MCBtn onClick={() => { renderer.toggleGameMode(); onModeChange(renderer.getGameMode()); setOpen(false); }}
                    color={gameMode === 'survival' ? 'green' : 'gray'}
                    style={{ width: 'min(100%, 340px)', borderRadius: 0 }}>
                    {gameMode === 'creative' ? '⚔ Switch to Survival' : '✦ Switch to Creative'}
                  </MCBtn>
                </div>
                <div className="text-center text-sm text-gray-400 -mt-1 font-bold" style={{ fontFamily: MC, textShadow: '1px 1px 0 #000' }}>
                  {gameMode === 'creative' ? 'Fly freely, unlimited blocks' : 'Gravity, health, fall damage'}
                </div>
                <div className="w-full flex justify-center">
                  <MCBtn onClick={() => { setOpen(false); onOpenSettings(); }} color="gray" style={{ width: 'min(100%, 340px)', borderRadius: 0 }}>
                    ⚙️ Settings
                  </MCBtn>
                </div>
                <div className="w-full flex justify-center">
                  <MCBtn onClick={() => setOpen(false)} color="gray" style={{ width: 'min(100%, 340px)', borderRadius: 0 }}>Back to Game</MCBtn>
                </div>
                <div className="w-full flex justify-center">
                  <MCBtn onClick={() => window.location.reload()} color="gray" style={{ width: 'min(100%, 340px)', borderRadius: 0 }}>Back to Menu</MCBtn>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ===== IMPROVED INVENTORY MODAL =====
function InventoryModal({ isOpen, onClose, onSelectBlock, onSelectTool, hotbarItems, onSetHotbar, customBlocks, onUpdateCustomBlocks }: {
  isOpen: boolean; onClose: () => void;
  onSelectBlock: (b: BlockType) => void;
  onSelectTool: (t: ToolType) => void;
  hotbarItems: HotbarItem[];
  onSetHotbar: (slot: number, item: HotbarItem) => void;
  customBlocks: CustomBlockDef[];
  onUpdateCustomBlocks: (next: CustomBlockDef[]) => void;
}) {
  const [selCat, setSelCat] = useState(0);
  const [selItem, setSelItem] = useState<HotbarItem | null>(null);
  const [selectedHotbarSlot, setSelectedHotbarSlot] = useState(0);
  const [customEditBlock, setCustomEditBlock] = useState<BlockType>(CUSTOM_BLOCK_SLOTS[0]);
  const selectedCustom = customBlocks.find(c => c.block === customEditBlock) || customBlocks[0];
  
  if (!isOpen) return null;
  const cat = INVENTORY_CATEGORIES[selCat];
  const updateCustom = (patch: Partial<CustomBlockDef>) => {
    const next = customBlocks.map((c) => c.block === customEditBlock ? { ...c, ...patch } : c);
    onUpdateCustomBlocks(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-[96vw] max-w-5xl max-h-[92vh] overflow-hidden"
        style={{
          fontFamily: MC,
          background: 'linear-gradient(180deg, #1a202a 0%, #141a23 100%)',
          border: '2px solid #67c7ff',
          borderRadius: '10px',
          boxShadow: '0 14px 34px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600"
          style={{ background: 'linear-gradient(90deg, #243447 0%, #2b4864 100%)', borderColor: 'rgba(103,199,255,0.5)' }}>
          <h2 className="text-base text-white font-bold tracking-wide">Inventory</h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500/80 rounded-sm transition-all"
            style={{ fontFamily: MC }}>
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] h-[74vh]">
          <aside className="border-r p-3 space-y-3" style={{ background: '#1d2430', borderColor: 'rgba(103,199,255,0.45)' }}>
            <div className="rounded-lg p-3 space-y-2" style={{ border: '1px solid rgba(255,255,255,0.12)', background: '#1a202a' }}>
              <p className="text-[11px] text-gray-300">Custom Blocks</p>
              <div className="grid grid-cols-5 gap-1.5">
                {customBlocks.map((c) => (
                  <button
                    key={c.block}
                    className={`aspect-square rounded ${customEditBlock === c.block ? 'ring-2 ring-yellow-300' : ''}`}
                    style={{ background: c.side, border: '1px solid rgba(255,255,255,0.2)' }}
                    onClick={() => setCustomEditBlock(c.block)}
                    title={c.name}
                  />
                ))}
              </div>
              {selectedCustom && (
                <div className="space-y-2">
                  <input
                    value={selectedCustom.name}
                    onChange={(e) => updateCustom({ name: e.target.value.slice(0, 24) })}
                    className="w-full px-2 py-2 bg-gray-700 text-white rounded border border-gray-600 text-xs"
                    style={{ fontFamily: MC }}
                    placeholder="Block name"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[10px] text-gray-300">
                      Top
                      <input type="color" value={selectedCustom.top} onChange={(e) => updateCustom({ top: e.target.value })} className="w-full h-8 mt-1" />
                    </label>
                    <label className="text-[10px] text-gray-300">
                      Side
                      <input type="color" value={selectedCustom.side} onChange={(e) => updateCustom({ side: e.target.value })} className="w-full h-8 mt-1" />
                    </label>
                    <label className="text-[10px] text-gray-300">
                      Bottom
                      <input type="color" value={selectedCustom.bottom} onChange={(e) => updateCustom({ bottom: e.target.value })} className="w-full h-8 mt-1" />
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div className="overflow-y-auto">
              <p className="text-[11px] text-gray-300 mb-2">Categories</p>
              <div className="space-y-2">
                {INVENTORY_CATEGORIES.map((c, i) => (
                  <button key={i}
                    className={`w-full py-3 px-3 flex items-center gap-3 rounded-md transition-all ${
                      i === selCat 
                        ? 'bg-blue-500/20 text-blue-300' 
                        : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                    }`}
                    style={{ 
                      fontFamily: MC,
                      borderLeft: i === selCat ? '3px solid #67c7ff' : '3px solid transparent'
                    }}
                    onClick={() => setSelCat(i)}>
                    <span className="text-xl">{c.icon}</span>
                    <span className="text-xs font-bold">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main className="flex flex-col min-h-0">
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ background: '#223142', borderColor: 'rgba(103,199,255,0.45)' }}>
              <span className="text-sm text-white font-bold">{cat.name}</span>
              <span className="text-xs text-gray-400">{cat.blocks.length} blocks</span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="mb-4 p-3 rounded-lg" style={{ background: '#1a202a', border: '1px solid rgba(255,255,255,0.12)' }}>
                <div className="text-xs text-gray-200 mb-2" style={{ fontFamily: MC }}>Your Custom Blocks</div>
                <div className="grid grid-cols-5 gap-2">
                  {customBlocks.map((c) => (
                    <button
                      key={c.block}
                      className="aspect-square rounded-md flex flex-col items-center justify-center p-1"
                      style={{ background: '#2a3342', border: '1px solid rgba(120,210,255,0.45)' }}
                      onClick={() => {
                        const item: HotbarItem = { type: 'block', block: c.block };
                        onSelectBlock(c.block);
                        setSelItem(item);
                        onSetHotbar(selectedHotbarSlot, item);
                      }}
                      title={c.name}
                    >
                      <BlockIcon block={c.block} size={30} />
                      <span className="text-[8px] text-white truncate w-full text-center" style={{ fontFamily: MC }}>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-5 md:grid-cols-8 gap-3">
                {cat.blocks.map(block => (
                  <button key={block}
                    className={`aspect-square flex flex-col items-center justify-center p-2 rounded-md transition-all ${
                      selItem?.type === 'block' && selItem.block === block
                        ? 'bg-blue-500/30 ring-2 ring-blue-400'
                        : 'bg-gray-700/50 hover:bg-gray-600'
                    }`}
                    style={{ 
                      border: '2px solid', 
                      borderColor: selItem?.type === 'block' && selItem.block === block ? '#67c7ff' : '#4a5568',
                      boxShadow: selItem?.type === 'block' && selItem.block === block ? '0 0 14px rgba(103,199,255,0.32)' : 'none'
                    }}
                    onClick={() => {
                      const item: HotbarItem = { type: 'block', block };
                      onSelectBlock(block);
                      setSelItem(item);
                      onSetHotbar(selectedHotbarSlot, item);
                    }}
                    title={BLOCK_NAMES[block]}>
                    <BlockIcon block={block} size={34} />
                    <span className="text-white leading-none text-center truncate w-full font-bold mt-1"
                      style={{ fontSize: '7px', fontFamily: MC }}>
                      {BLOCK_NAMES[block]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-600" style={{ background: '#2a303d' }}>
              <div className="flex gap-2 justify-center">
                {hotbarItems.map((item, i) => (
                  <button
                    key={i}
                    className={`w-12 h-12 flex items-center justify-center rounded-sm transition-all ${
                      i === selectedHotbarSlot ? 'bg-yellow-500/20 ring-2 ring-yellow-400' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    style={{ border: '1px solid #4a5568' }}
                    onClick={() => setSelectedHotbarSlot(i)}
                  >
                    {item.type === 'tool' ? (
                      <ToolIcon tool={item.tool} size={24} />
                    ) : (
                      <BlockIcon block={item.block} size={24} />
                    )}
                  </button>
                ))}
              </div>
              {selItem && (
                <p className="text-center text-[10px] text-gray-300 mt-2">
                  Selected: {selItem.type === 'tool' ? TOOL_NAMES[selItem.tool] : BLOCK_NAMES[selItem.block]}
                </p>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// ===== GAME UI =====
function GameUI({
  renderer,
  onPortalTravel,
  onSwitchToWorldConfig,
  initialMultiplayerSession,
  initialMultiplayerName,
  worldId,
  profile,
}: {
  renderer: GameRenderer;
  onPortalTravel: (targetWorldType: 'normal' | 'flat') => void;
  onSwitchToWorldConfig: (cfg: { seed: number; worldType: 'normal' | 'flat' }) => void;
  initialMultiplayerSession?: MultiplayerSession | null;
  initialMultiplayerName?: string;
  worldId: string;
  profile: PlayerProfile;
}) {
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customBlocks, setCustomBlocks] = useState<CustomBlockDef[]>(() => loadCustomBlocksFromStorage());
  const [hotbarItems, setHotbarItems] = useState<HotbarItem[]>(
    () => loadHotbarFromStorage(worldId, initialMultiplayerName || profile.name) || HOTBAR_BLOCKS.map(b => ({ type: 'block' as const, block: b }))
  );
  const [gameMode, setGameMode] = useState<GameMode>('creative');
  const [fps, setFps] = useState(0);
  const [mpOpen, setMpOpen] = useState(false);
  const [mpName, setMpName] = useState(() => initialMultiplayerName || localStorage.getItem('creativ44_mp_name') || 'Player');
  const [mpJoinCode, setMpJoinCode] = useState('');
  const [mpSession, setMpSession] = useState<MultiplayerSession | null>(initialMultiplayerSession || null);
  const [mpStatus, setMpStatus] = useState('');
  const [mpPeers, setMpPeers] = useState(1);
  const [uiSettings, setUiSettings] = useState<GameSettings>(() => settingsManager.getSettings());
  const mpPendingEvents = useRef<MultiplayerBlockEvent[]>([]);
  const mpLastSeq = useRef(0);

  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const jTouchId = useRef<number | null>(null);
  const lTouchId = useRef<number | null>(null);
  const jOrigin = useRef({ x: 0, y: 0 });
  const lastLook = useRef({ x: 0, y: 0 });
  const pointerReleasedByEsc = useRef(false);
  const joystickScale = Math.max(0.65, Math.min(1.8, uiSettings.joystickSize || 1));
  const hotbarScale = Math.max(0.75, Math.min(1.8, uiSettings.hotbarScale || 1));
  const joystickSizePx = Math.round(176 * joystickScale);
  const joystickKnobPx = Math.round(80 * joystickScale);
  const joystickSidePx = Math.max(0, Math.round(32 + (uiSettings.joystickSideOffset || 0)));
  const joystickBottomPx = Math.max(0, Math.round(80 + (uiSettings.joystickBottomOffset || 0)));
  const hotbarItemSize = Math.round(64 * hotbarScale);
  const hotbarPadX = Math.round(20 * hotbarScale);
  const hotbarPadY = Math.round(16 * hotbarScale);
  const hotbarBottom = Math.max(0, Math.round(8 + (uiSettings.hotbarBottomOffset || 0)));
  const hotbarSideOffset = Math.round(uiSettings.hotbarSideOffset || 0);

  useEffect(() => {
    renderer.setModeCallback(setGameMode);
    renderer.setPortalTravelCallback(onPortalTravel);
    return () => renderer.setPortalTravelCallback(null);
  }, [renderer, onPortalTravel]);

  useEffect(() => {
    const handler = (s: GameSettings) => setUiSettings(s);
    settingsManager.addListener(handler);
    return () => settingsManager.removeListener(handler);
  }, []);

  useEffect(() => {
    renderer.setBlockChangeCallback((ev) => {
      if (mpSession) mpPendingEvents.current.push(ev);
      worldManager.setBlockEdit(worldId, ev.x, ev.y, ev.z, ev.type);
    });
    return () => renderer.setBlockChangeCallback(null);
  }, [renderer, mpSession, worldId]);

  useEffect(() => {
    localStorage.setItem('creativ44_mp_name', mpName);
  }, [mpName]);

  const activePlayerName = mpSession ? mpName : profile.name;
  useEffect(() => {
    saveHotbarToStorage(worldId, activePlayerName, hotbarItems);
  }, [worldId, activePlayerName, hotbarItems]);

  useEffect(() => {
    if (mpSession) return;
    setMpName(profile.name);
    const saved = loadHotbarFromStorage(worldId, profile.name);
    if (saved) setHotbarItems(saved);
  }, [profile.name, worldId, mpSession]);

  useEffect(() => {
    if (!mpSession) {
      renderer.updateRemotePlayers([], '');
      return;
    }
    let cancelled = false;
    const loop = async () => {
      if (cancelled) return;
      try {
        const player = renderer.getMultiplayerPlayerState(mpSession.playerId, mpName || 'Player', profile.skin);
        const events = mpPendingEvents.current.splice(0, mpPendingEvents.current.length);
        await multiplayerClient.pushState({
          roomCode: mpSession.roomCode,
          playerId: mpSession.playerId,
          player,
          events,
          animals: mpSession.isHost ? renderer.getMultiplayerAnimals() : undefined,
        });
        const data = await multiplayerClient.pullState(mpSession.roomCode, mpSession.playerId, mpLastSeq.current);
        mpLastSeq.current = data.latestSeq;
        const foreignEvents = data.events.filter((e) => e.authorId !== mpSession.playerId);
        if (foreignEvents.length > 0) {
          renderer.applyMultiplayerBlockEvents(foreignEvents);
          for (const ev of foreignEvents) worldManager.setBlockEdit(worldId, ev.x, ev.y, ev.z, ev.type);
        }
        if (!mpSession.isHost) renderer.applyMultiplayerAnimals(data.animals);
        renderer.updateRemotePlayers(data.players as MultiplayerPlayerState[], mpSession.playerId);
        setMpPeers(data.players.length);
        setMpStatus(`Connected (${data.players.length} players)`);
      } catch (e) {
        setMpStatus(`Multiplayer error: ${String((e as Error).message || e)}`);
      } finally {
        if (!cancelled) window.setTimeout(loop, 220);
      }
    };
    loop();
    return () => { cancelled = true; };
  }, [renderer, mpSession, mpName, profile.skin, worldId]);

  useEffect(() => {
    applyCustomBlocksToRuntime(customBlocks);
    localStorage.setItem(CUSTOM_BLOCKS_STORAGE_KEY, JSON.stringify(customBlocks));
    textureManager.clearBlockCustomTextureBatch(CUSTOM_BLOCK_SLOTS).then(() => renderer.rebuildAllChunks()).catch(() => renderer.rebuildAllChunks());
  }, [customBlocks, renderer]);

  useEffect(() => {
    for (let i = 0; i < hotbarItems.length; i++) {
      const item = hotbarItems[i];
      if (item.type === 'tool') renderer.setHotbarTool(i, item.tool);
      else renderer.setHotbarSlot(i, item.block);
    }
    renderer.setSelectedSlot(selectedSlot);
  }, [renderer, hotbarItems, selectedSlot]);

  useEffect(() => {
    let rafId = 0;
    let frameCount = 0;
    let lastTick = performance.now();
    const tick = (now: number) => {
      frameCount++;
      if (now - lastTick >= 2000) {
        const value = Math.round((frameCount * 1000) / (now - lastTick));
        setFps(value);
        frameCount = 0;
        lastTick = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const jStart = useCallback((e: React.TouchEvent) => {
    if (jTouchId.current !== null) return;
    const t = e.changedTouches[0];
    jTouchId.current = t.identifier;
    const r = joystickRef.current!.getBoundingClientRect();
    jOrigin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, []);
  const jMove = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === jTouchId.current) {
        const dx = t.clientX - jOrigin.current.x, dy = t.clientY - jOrigin.current.y;
        const maxD = 64 * joystickScale;
        const dist = Math.min(Math.sqrt(dx*dx+dy*dy), maxD), ang = Math.atan2(dy, dx);
        renderer.setMoveInput((Math.cos(ang)*dist)/maxD, (Math.sin(ang)*dist)/maxD);
        if (knobRef.current) knobRef.current.style.transform = `translate(${Math.cos(ang)*dist}px, ${Math.sin(ang)*dist}px)`;
      }
    }
  }, [renderer, joystickScale]);
  const jEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === jTouchId.current) {
        jTouchId.current = null; renderer.setMoveInput(0, 0);
        if (knobRef.current) knobRef.current.style.transform = 'translate(0,0)';
      }
    }
  }, [renderer]);
  const lStart = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX > window.innerWidth * 0.4 && lTouchId.current === null) {
        lTouchId.current = t.identifier; lastLook.current = { x: t.clientX, y: t.clientY };
      }
    }
  }, []);
  const lMove = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lTouchId.current) {
        const dx = t.clientX - lastLook.current.x, dy = t.clientY - lastLook.current.y;
        lastLook.current = { x: t.clientX, y: t.clientY };
        const rot = renderer.getRotation();
        renderer.setRotation(rot.yaw - dx * 0.004, rot.pitch - dy * 0.004);
      }
    }
  }, [renderer]);
  const lEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lTouchId.current) lTouchId.current = null;
    }
  }, []);

  // Keyboard
  useEffect(() => {
    const keys = new Set<string>();
    const upd = () => {
      let mx = 0, mz = 0;
      if (keys.has('w') || keys.has('arrowup')) mz = 1;
      if (keys.has('s') || keys.has('arrowdown')) mz = -1;
      if (keys.has('a') || keys.has('arrowleft')) mx = -1;
      if (keys.has('d') || keys.has('arrowright')) mx = 1;
      renderer.setMoveInput(mx, mz);
      renderer.setFlyUp(keys.has(' ')); renderer.setFlyDown(keys.has('shift'));
      renderer.setJump(keys.has(' '));
    };
    const kd = (e: KeyboardEvent) => {
      if (inventoryOpen) { 
        if (e.key === 'Escape' || e.key === 'e') {
          setInventoryOpen(false);
        }
        return; 
      }
      if (e.key === 'Escape') {
        pointerReleasedByEsc.current = true;
        if (document.pointerLockElement) document.exitPointerLock();
        return;
      }
      keys.add(e.key.toLowerCase()); upd();
      const n = parseInt(e.key);
      if (n >= 1 && n <= 9) { setSelectedSlot(n-1); renderer.setSelectedSlot(n-1); }
      if (e.key.toLowerCase() === 'e') {
        setInventoryOpen(true);
        // Release mouse lock when opening inventory
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
      if (e.key.toLowerCase() === 'f') renderer.interactBlock();
    };
    const ku = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); upd(); };
    const mm = (e: MouseEvent) => {
      if (document.pointerLockElement && !inventoryOpen) {
        const rot = renderer.getRotation();
        renderer.setRotation(rot.yaw - e.movementX * 0.002, rot.pitch - e.movementY * 0.002);
      }
    };
    const cl = () => { 
      if (!document.pointerLockElement && !inventoryOpen) { 
        pointerReleasedByEsc.current = false;
        const c = document.querySelector('canvas'); 
        if (c) c.requestPointerLock(); 
      } 
    };
    // Continuous building/breaking system
    let breakInterval: NodeJS.Timeout | null = null;
    let placeInterval: NodeJS.Timeout | null = null;
    const BUILD_DELAY = 150; // milliseconds between blocks
    
    const startBreaking = () => {
      if (breakInterval) return;
      renderer.breakBlock();
      breakInterval = setInterval(() => {
        if (document.pointerLockElement && !inventoryOpen) {
          renderer.breakBlock();
        }
      }, BUILD_DELAY);
    };
    
    const stopBreaking = () => {
      if (breakInterval) {
        clearInterval(breakInterval);
        breakInterval = null;
      }
    };
    
    const startPlacing = () => {
      if (placeInterval) return;
      renderer.placeBlock();
      placeInterval = setInterval(() => {
        if (document.pointerLockElement && !inventoryOpen) {
          renderer.placeBlock();
        }
      }, BUILD_DELAY);
    };
    
    const stopPlacing = () => {
      if (placeInterval) {
        clearInterval(placeInterval);
        placeInterval = null;
      }
    };
    
    const md = (e: MouseEvent) => {
      if (document.pointerLockElement && !inventoryOpen) {
        if (e.button === 0) startBreaking();
        if (e.button === 2) startPlacing();
        if (e.button === 1) renderer.interactBlock();
      }
    };
    
    const mu = (e: MouseEvent) => {
      if (e.button === 0) stopBreaking();
      if (e.button === 2) stopPlacing();
    };
    
    const cm = (e: Event) => e.preventDefault();
    
    // Handle pointer lock change
    const handlePointerLockChange = () => {
      if (!document.pointerLockElement && inventoryOpen) {
        // Mouse was unlocked because inventory is open - this is expected
      }
    };
    
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    window.addEventListener('mousemove', mm); window.addEventListener('click', cl);
    window.addEventListener('mousedown', md); window.addEventListener('mouseup', mu);
    window.addEventListener('contextmenu', cm);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      window.removeEventListener('mousemove', mm); window.removeEventListener('click', cl);
      window.removeEventListener('mousedown', md); window.removeEventListener('mouseup', mu);
      window.removeEventListener('contextmenu', cm);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      stopBreaking();
      stopPlacing();
    };
  }, [renderer, inventoryOpen]);

  const selectSlot = (i: number) => { setSelectedSlot(i); renderer.setSelectedSlot(i); };
  const setHotbarItem = useCallback((slot: number, item: HotbarItem) => {
    const newItems = [...hotbarItems];
    newItems[slot] = item;
    setHotbarItems(newItems);
    if (item.type === 'tool') renderer.setHotbarTool(slot, item.tool);
    else renderer.setHotbarSlot(slot, item.block);
  }, [hotbarItems, renderer]);

  const hostMultiplayer = async () => {
    try {
      const world = renderer.getWorldConfig();
      const session = await multiplayerClient.createRoom(mpName || 'Host', world);
      mpLastSeq.current = 0;
      mpPendingEvents.current = [];
      setMpSession(session);
      setMpStatus(`Room Code: ${session.roomCode}`);
    } catch (e) {
      setMpStatus(`Host failed: ${String((e as Error).message || e)}`);
    }
  };

  const joinMultiplayer = async () => {
    try {
      const session = await multiplayerClient.joinRoom(mpJoinCode.trim().toUpperCase(), mpName || 'Player');
      const cfg = renderer.getWorldConfig();
      if (cfg.seed !== session.world.seed || cfg.worldType !== session.world.worldType) {
        onSwitchToWorldConfig(session.world);
        setMpStatus(`Host world loaded (${session.world.worldType}, seed ${session.world.seed}). Join again after loading.`);
        return;
      }
      mpLastSeq.current = 0;
      mpPendingEvents.current = [];
      setMpSession(session);
      setMpStatus(`Joined ${session.roomCode}`);
    } catch (e) {
      setMpStatus(`Join failed: ${String((e as Error).message || e)}`);
    }
  };

  const leaveMultiplayer = async () => {
    const s = mpSession;
    if (!s) return;
    try { await multiplayerClient.leaveRoom(s.roomCode, s.playerId); } catch {}
    setMpSession(null);
    setMpPeers(1);
    setMpStatus('Disconnected');
    renderer.updateRemotePlayers([], '');
  };

  return (
    <>
      {/* Look area */}
      <div className="fixed top-0 right-0 w-[60%] h-full z-10"
        onTouchStart={lStart} onTouchMove={lMove} onTouchEnd={lEnd}
        style={{ touchAction: 'none' }} />

      {/* Crosshair */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
        <div className="w-6 h-6 relative">
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/60 -translate-y-1/2 mix-blend-difference" />
          <div className="absolute left-1/2 top-0 h-full w-[2px] bg-white/60 -translate-x-1/2 mix-blend-difference" />
        </div>
      </div>

      {/* Hamburger Menu */}
      <HamburgerMenu 
        renderer={renderer} 
        gameMode={gameMode} 
        onModeChange={setGameMode} 
        onOpenSettings={() => {
          setSettingsOpen(true);
          if (document.pointerLockElement) {
            document.exitPointerLock();
          }
        }}
      />

      <div className="fixed top-2 right-16 z-40">
        <button
          className="px-5 py-3 rounded-xl text-white text-sm font-bold"
          style={{ fontFamily: MC, background: 'rgba(0,0,0,0.55)', border: '2px solid rgba(120,210,255,0.65)' }}
          onClick={() => setMpOpen(v => !v)}
        >
          MP
        </button>
      </div>
      {mpOpen && (
        <div className="fixed top-14 right-2 z-50 w-80 p-3 rounded-xl"
          style={{ background: 'rgba(15,24,35,0.94)', border: '2px solid rgba(120,210,255,0.7)', fontFamily: MC }}>
          <div className="text-white text-sm mb-2 font-bold">Multiplayer (Live)</div>
          <input
            value={mpName}
            onChange={(e) => setMpName(e.target.value.slice(0, 20))}
            placeholder="Your name"
            className="w-full mb-2 px-2 py-2 rounded bg-gray-800 text-white text-xs border border-gray-600"
          />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button onClick={hostMultiplayer} className="py-2 rounded bg-green-600 text-white text-xs font-bold">Host</button>
            <button onClick={leaveMultiplayer} className="py-2 rounded bg-gray-700 text-white text-xs font-bold">Leave</button>
          </div>
          <div className="flex gap-2 mb-2">
            <input
              value={mpJoinCode}
              onChange={(e) => setMpJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              placeholder="Room code"
              className="flex-1 px-2 py-2 rounded bg-gray-800 text-white text-xs border border-gray-600"
            />
            <button onClick={joinMultiplayer} className="px-3 py-2 rounded bg-blue-600 text-white text-xs font-bold">Join</button>
          </div>
          <div className="text-[10px] text-gray-300">Players: {mpPeers}</div>
          <div className="text-[10px] text-yellow-300 mt-1 break-words">{mpStatus}</div>
          {mpSession && (
            <div className="text-[10px] text-cyan-300 mt-1">Code: {mpSession.roomCode}</div>
          )}
        </div>
      )}

      {/* Joystick */}
      <div ref={joystickRef} className="fixed z-30 rounded-full"
        style={{
          width: joystickSizePx,
          height: joystickSizePx,
          left: joystickSidePx,
          bottom: joystickBottomPx,
          background: 'radial-gradient(circle at 30% 30%, rgba(188,208,165,0.32), rgba(50,72,39,0.6))',
          border: '2px solid rgba(34,48,27,0.9)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 6px 20px rgba(0,0,0,0.4)',
          touchAction: 'none',
        }}
        onTouchStart={jStart} onTouchMove={jMove} onTouchEnd={jEnd}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div ref={knobRef} className="rounded-full"
            style={{
              width: joystickKnobPx,
              height: joystickKnobPx,
              background: 'radial-gradient(circle at 30% 30%, #d4e3b6, #66844d)',
              border: '2px solid #2c4422',
              boxShadow: '0 2px 0 #1f3117',
            }} />
        </div>
      </div>

      {/* Fly/Jump */}
      <div className="fixed bottom-32 right-5 z-30 flex flex-col gap-2">
        <button className="w-[52px] h-[52px] rounded-lg flex items-center justify-center text-white text-lg font-bold active:scale-90"
          style={{
            fontFamily: MC,
            background: 'linear-gradient(180deg, #6f8d4f 0%, #4f6b36 100%)',
            border: '2px solid #24331a',
            boxShadow: '0 3px 0 #1b2614',
            textShadow: '1px 1px 0 #000',
          }}
          onTouchStart={() => { renderer.setFlyUp(true); renderer.setJump(true); }}
          onTouchEnd={() => { renderer.setFlyUp(false); renderer.setJump(false); }}>UP</button>
        <button className="w-[52px] h-[52px] rounded-lg flex items-center justify-center text-white text-lg font-bold active:scale-90"
          style={{
            fontFamily: MC,
            background: 'linear-gradient(180deg, #6f8d4f 0%, #4f6b36 100%)',
            border: '2px solid #24331a',
            boxShadow: '0 3px 0 #1b2614',
            textShadow: '1px 1px 0 #000',
          }}
          onTouchStart={() => renderer.setFlyDown(true)}
          onTouchEnd={() => renderer.setFlyDown(false)}>DN</button>
      </div>

      {/* Action buttons */}
      <div className="fixed bottom-6 right-5 z-30 flex gap-1.5">
        <button className="w-12 h-12 rounded-lg flex items-center justify-center active:scale-90"
          style={{
            fontFamily: MC,
            background: 'linear-gradient(180deg, #aa5e42 0%, #7f3f28 100%)',
            border: '2px solid #3f2014',
            boxShadow: '0 3px 0 #2b160d',
            color: '#fff',
            textShadow: '1px 1px 0 #000',
          }}
          onTouchStart={() => renderer.breakBlock()}>
          <span className="text-[11px]">BRK</span>
        </button>
        <button className="w-12 h-12 rounded-lg flex items-center justify-center active:scale-90"
          style={{
            fontFamily: MC,
            background: 'linear-gradient(180deg, #5e88aa 0%, #355975 100%)',
            border: '2px solid #1a2f40',
            boxShadow: '0 3px 0 #13212d',
            color: '#fff',
            textShadow: '1px 1px 0 #000',
          }}
          onTouchStart={() => renderer.placeBlock()}>
          <span className="text-[11px]">SET</span>
        </button>
        <button className="w-12 h-12 rounded-lg flex items-center justify-center active:scale-90"
          style={{
            fontFamily: MC,
            background: 'linear-gradient(180deg, #ab9656 0%, #7c682f 100%)',
            border: '2px solid #3f3518',
            boxShadow: '0 3px 0 #2a2310',
            color: '#fff',
            textShadow: '1px 1px 0 #000',
          }}
          onTouchStart={() => renderer.interactBlock()}>
          <span className="text-[11px]">USE</span>
        </button>
      </div>

      {/* Hotbar with inventory button */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-2"
        style={{ bottom: `max(${hotbarBottom}px, calc(env(safe-area-inset-bottom) + ${hotbarBottom}px))`, left: `calc(50% + ${hotbarSideOffset}px)` }}
      >
        <div
          className="flex items-center"
          style={{
            paddingLeft: hotbarPadX,
            paddingRight: hotbarPadX,
            paddingTop: hotbarPadY,
            paddingBottom: hotbarPadY,
            background: 'linear-gradient(180deg, rgba(10,18,28,0.72) 0%, rgba(8,14,22,0.6) 100%)',
            border: '3px solid rgba(120,210,255,0.7)',
            borderRadius: 16,
            backdropFilter: 'blur(4px)',
          }}
        >
          {hotbarItems.map((item, i) => {
            const isActive = i === selectedSlot;
            return (
              <button
                key={i}
                className="relative flex items-center justify-center active:scale-90"
                style={{
                  width: hotbarItemSize,
                  height: hotbarItemSize,
                  borderRadius: 0,
                  background: 'transparent',
                  border: 'none',
                  borderLeft: i === 0 ? 'none' : '3px solid rgba(120,210,255,0.7)',
                  boxShadow: 'none',
                }}
                onClick={() => selectSlot(i)}
              >
                {item.type === 'tool' ? <ToolIcon tool={item.tool} size={Math.round(38 * hotbarScale)} /> : <BlockIcon block={item.block} size={Math.round(38 * hotbarScale)} />}
                {isActive && (
                  <div
                    className="absolute"
                    style={{
                      left: 10,
                      right: 10,
                      bottom: -3,
                      height: 4,
                      borderRadius: 1,
                      background: '#f4d03f',
                      boxShadow: '0 0 6px rgba(244,208,63,0.6)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <button
          className="flex items-center justify-center active:scale-90"
          style={{
            width: Math.round(50 * hotbarScale),
            height: Math.round(50 * hotbarScale),
            background: 'rgba(0,0,0,0.5)',
            border: '3px solid rgba(120,210,255,0.7)',
            borderRadius: 16,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
          }}
          onClick={() => setInventoryOpen(true)}
        >
          <span className="text-white font-bold" style={{ fontFamily: MC, fontSize: Math.max(11, Math.round(11 * hotbarScale)), textShadow: '1px 1px 0 #000' }}>INV</span>
        </button>
      </div>

      {/* Coordinates */}
      <div className="fixed top-2 left-2 z-20 pointer-events-none"
        style={{ fontFamily: MC, color: 'rgba(255,255,255,0.5)', fontSize: '9px', textShadow: '1px 1px 0 #000' }}>
        <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px' }}>FPS: {fps}</div>
        <PosDisplay renderer={renderer} gameMode={gameMode} />
      </div>

      {/* Desktop help */}
      <div className="fixed top-14 left-2 z-20 pointer-events-none hidden md:block"
        style={{ fontFamily: MC, color: 'rgba(255,255,255,0.2)', fontSize: '8px', textShadow: '1px 1px 0 #000' }}>
        <div>WASD - Move | Mouse - Look</div>
        <div>LMB - Break | RMB - Place | F - Interact</div>
        <div>E - Inventory</div>
        <div>Space - Jump/Fly Up | Shift - Fly Down</div>
      </div>

      <InventoryModal
        isOpen={inventoryOpen}
        onClose={() => {
          setInventoryOpen(false);
        }}
        onSelectBlock={(b) => {
          const newItems = [...hotbarItems];
          newItems[selectedSlot] = { type: 'block', block: b };
          setHotbarItems(newItems);
          renderer.setHotbarSlot(selectedSlot, b);
        }}
        onSelectTool={(t) => {
          const newItems = [...hotbarItems];
          newItems[selectedSlot] = { type: 'tool', tool: t };
          setHotbarItems(newItems);
          renderer.setHotbarTool(selectedSlot, t);
        }}
        hotbarItems={hotbarItems}
        onSetHotbar={setHotbarItem}
        customBlocks={customBlocks}
        onUpdateCustomBlocks={setCustomBlocks}
      />
      <SettingsModal
        isOpen={settingsOpen}
        renderer={renderer}
        onClose={() => {
          setSettingsOpen(false);
        }}
      />
    </>
  );
}

function PosDisplay({ renderer, gameMode }: { renderer: GameRenderer; gameMode: GameMode }) {
  const [pos, setPos] = useState({ x: 0, y: 0, z: 0 });
  const [season, setSeason] = useState('summer');
  
  useEffect(() => {
    const iv = setInterval(() => { 
      const p = renderer.getPlayerPos(); 
      setPos({ x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) });
      setSeason(renderer.getCurrentSeason());
    }, 200);
    return () => clearInterval(iv);
  }, [renderer]);
  
  const seasonEmojis: Record<string, string> = {
    spring: '🌸',
    summer: '☀️',
    autumn: '🍂',
    winter: '❄️'
  };
  
  return (
    <div>
      <div>XYZ: {pos.x} / {pos.y} / {pos.z}</div>
      <div style={{ color: 'rgba(255,255,255,0.3)' }}>
        {gameMode === 'creative' ? '✦ Creative' : '⚔ Survival'} | {seasonEmojis[season]} {season.charAt(0).toUpperCase() + season.slice(1)}
      </div>
    </div>
  );
}

// ===== SETTINGS MODAL =====
function SettingsModal({ isOpen, onClose, renderer }: { isOpen: boolean; onClose: () => void; renderer?: GameRenderer | null }) {
  const [settings, setSettings] = useState<GameSettings>(settingsManager.getSettings());
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'controls' | 'resourcepack' | 'mods'>('video');
  const [customUrls, setCustomUrls] = useState<Record<string, string>>({});
  const [mods, setMods] = useState<RuntimeMod[]>(() => modManager.list());
  const [sandboxMode, setSandboxMode] = useState(modManager.isSandboxMode());
  const [newModName, setNewModName] = useState('MyMod');
  const [newModCode, setNewModCode] = useState('// Example:\n// game.setWeather("rain");\n// game.setGameMode("creative");');
  const [designerBlock, setDesignerBlock] = useState<BlockType>(BlockType.GRASS);
  const [designerFace, setDesignerFace] = useState<FaceDir>('top');
  const [designerColor, setDesignerColor] = useState('#4caf50');
  const [designerFaces, setDesignerFaces] = useState<Record<FaceDir, string[][]>>(() => {
    const mk = (c: string) => Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => c));
    return { top: mk('#4caf50'), bottom: mk('#8b6b3d'), north: mk('#6aa84f'), south: mk('#6aa84f'), east: mk('#6aa84f'), west: mk('#6aa84f') };
  });
  const designerCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const handler = (s: GameSettings) => setSettings(s);
    settingsManager.addListener(handler);
    return () => settingsManager.removeListener(handler);
  }, []);

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    settingsManager.updateSettings({ [key]: value });
  };

  const handleResourceUrlChange = (blockType: string, url: string) => {
    setCustomUrls(prev => ({ ...prev, [blockType]: url }));
  };

  const applyResourceUrl = async (blockType: string) => {
    const url = customUrls[blockType];
    if (url) {
      const blockEnum = BlockType[blockType as keyof typeof BlockType];
      if (blockEnum !== undefined) {
        const ok = await textureManager.loadCustomTexture(blockEnum, url);
        if (ok) {
          renderer?.rebuildAllChunks();
          alert(`Texture applied to ${blockType}.`);
        } else {
          alert(`Could not apply texture to ${blockType}.`);
        }
      }
    }
  };

  const clearAllTextures = async () => {
    await textureManager.reloadDefaultTextures(true);
    renderer?.rebuildAllChunks();
    setCustomUrls({});
    alert('All custom textures cleared!');
  };

  const refreshMods = () => setMods(modManager.list());

  const buildAiPrompt = () => {
    const blockEntries = Object.entries(BLOCK_NAMES)
      .filter(([k]) => !Number.isNaN(Number(k)))
      .map(([k, v]) => `${v}=${k}`)
      .join(', ');
    const installedMods = mods.map(m => `${m.enabled ? '[on]' : '[off]'} ${m.name}`).join('\n');
    return [
      'Du bist ein Senior-Modding-Assistent fuer Creativ44.',
      'Erzeuge nur direkt ausfuehrbare, sichere JS-Mods ohne Platzhalter und erklaere kurz die Installation.',
      '',
      'WICHTIGE REGELN:',
      '- Nutze die API ueber `game`.',
      '- Schreibe lauffaehigen Code fuer Browser Runtime (kein Node.js).',
      '- Wenn benoetigt, liefere ein komplettes Modpack-JSON plus einzelne .js Version.',
      '- Nutze defensive Checks und try/catch.',
      '',
      `Sandbox Mode: ${sandboxMode ? 'ON' : 'OFF'}`,
      '',
      'Verfuegbare Runtime Commands:',
      '- /js <javascript>',
      '- /mod add <name> <javascript>',
      '- /mod run <name>',
      '- /mod list',
      '- /mod remove <name>',
      '- /cmdadd <name> <javascript>',
      '- /cmdremove <name>',
      '- /blockprop <BLOCK> <property> <value>',
      '',
      'Game API (game.*):',
      '- getPlayerPos(), teleport(x,y,z)',
      '- getBlock(x,y,z), setBlock(x,y,z,blockType)',
      '- fill(x1,y1,z1,x2,y2,z2,blockType)',
      '- clone(x1,y1,z1,x2,y2,z2,dx,dy,dz)',
      '- explode(x,y,z,power?)',
      '- setTime(value), setWeather("clear"|"rain"|"snow"|"storm")',
      '- setGameMode("creative"|"survival")',
      '- summon(entity,x,y,z)',
      '- execute(commandString)',
      '- registerCommand(name, async (args, ctx) => ({success, output}))',
      '- blockEnum (alle BlockType Werte)',
      '',
      'Modpack JSON Schema:',
      '{ "format":"creativ44-modpack-v1","name":"My Pack","mods":[{"name":"Example","description":"","code":"game.setWeather(\\"rain\\");","enabled":true}] }',
      '',
      'Aktuell installierte Mods:',
      installedMods || 'Keine',
      '',
      'Block IDs:',
      blockEntries,
      '',
      'Liefere jetzt eine komplette Mod-Loesung fuer: <HIER USER-WUNSCH EINFUEGEN>',
    ].join('\n');
  };
  const openAiHelper = async (provider: 'chatgpt' | 'claude') => {
    const fullPrompt = buildAiPrompt();
    try { await navigator.clipboard.writeText(fullPrompt); } catch {}
    const urlPrompt = fullPrompt.length > 2200
      ? 'Ich habe den kompletten Creativ44-Modding-Kontext bereits in die Zwischenablage kopiert. Bitte fordere mich auf, ihn einzufuegen, und baue danach lauffaehige, komplette Mod-Skripte.'
      : fullPrompt;
    const url = provider === 'chatgpt'
      ? `https://chatgpt.com/?q=${encodeURIComponent(urlPrompt)}`
      : `https://claude.ai/new?q=${encodeURIComponent(urlPrompt)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    alert('Voller Modding-Kontext wurde in die Zwischenablage kopiert.');
  };

  const addModFromEditor = () => {
    const name = newModName.trim();
    const code = newModCode.trim();
    if (!name || !code) return;
    modManager.add({ name, description: '', code, enabled: true });
    refreshMods();
    setNewModName(`MyMod${mods.length + 1}`);
  };

  const runMod = async (mod: RuntimeMod) => {
    if (!renderer) {
      alert('Mod saved. Start a world to execute it.');
      return;
    }
    const result = await renderer.executeCommand(`js ${mod.code}`);
    alert(`${mod.name}: ${result.output}`);
  };

  const applyAllMods = async () => {
    if (!renderer) {
      alert('Mods are saved. They run automatically after world load.');
      return;
    }
    const list = modManager.list().filter(m => m.enabled);
    let ok = 0;
    for (const mod of list) {
      const result = await renderer.executeCommand(`js ${mod.code}`);
      if (result.success) ok++;
    }
    alert(`Executed ${ok}/${list.length} enabled mods`);
  };

  const exportModPack = () => {
    const json = modManager.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'creativ44-modpack.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importModPackFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      if (file.name.toLowerCase().endsWith('.js')) {
        modManager.add({
          name: file.name.replace(/\.js$/i, ''),
          description: 'Imported JS mod file',
          code: content,
          enabled: true,
        });
        refreshMods();
        alert(`Imported JS mod: ${file.name}`);
        return;
      }
      const result = modManager.importJson(content);
      refreshMods();
      alert(result.message);
    };
    reader.readAsText(file);
  };

  const drawDesigner = useCallback(() => {
    const c = designerCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const cell = 18;
    c.width = 16 * cell;
    c.height = 16 * cell;
    ctx.clearRect(0, 0, c.width, c.height);
    const grid = designerFaces[designerFace];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        ctx.fillStyle = grid[y][x];
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i <= 16; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, c.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(c.width, i * cell); ctx.stroke();
    }
  }, [designerFaces, designerFace]);

  useEffect(() => { drawDesigner(); }, [drawDesigner]);

  const paintDesigner = (clientX: number, clientY: number) => {
    const c = designerCanvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const cell = r.width / 16;
    const x = Math.floor((clientX - r.left) / cell);
    const y = Math.floor((clientY - r.top) / cell);
    if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
    setDesignerFaces(prev => {
      const next = { ...prev, [designerFace]: prev[designerFace].map(row => [...row]) };
      next[designerFace][y][x] = designerColor;
      return next;
    });
  };

  const faceToDataUrl = (face: FaceDir): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    const grid = designerFaces[face];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      ctx.fillStyle = grid[y][x];
      ctx.fillRect(x, y, 1, 1);
    }
    return canvas.toDataURL('image/png');
  };

  const applyDesignedBlockTextures = async () => {
    const faces: FaceDir[] = ['top', 'bottom', 'north', 'south', 'east', 'west'];
    for (const f of faces) {
      await textureManager.setCustomFaceTexture(designerBlock, f, faceToDataUrl(f));
    }
    alert('Block design applied to all faces.');
  };

  if (!isOpen) return null;

  const videoSettings = (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white mb-4" style={{ fontFamily: MC }}>Video Settings</h3>
      
      {/* Render Distance */}
      <div className="bg-[#3a3a3a] p-4 rounded-xl">
        <label className="block text-white text-sm font-bold mb-2" style={{ fontFamily: MC }}>
          Render Distance: {settings.renderDistance} chunks
        </label>
        <input
          type="range"
          min="4"
          max="16"
          value={settings.renderDistance}
          onChange={(e) => updateSetting('renderDistance', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
        <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: MC }}>
          Higher values need more performance
        </p>
      </div>

      {/* FOV */}
      <div className="bg-[#3a3a3a] p-4 rounded-xl">
        <label className="block text-white text-sm font-bold mb-2" style={{ fontFamily: MC }}>
          Field of View: {settings.fov}°
        </label>
        <input
          type="range"
          min="60"
          max="110"
          value={settings.fov}
          onChange={(e) => updateSetting('fov', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Clouds Toggle */}
      <div className="bg-[#3a3a3a] p-4 rounded-xl flex justify-between items-center">
        <label className="text-white text-sm font-bold" style={{ fontFamily: MC }}>Clouds</label>
        <button
          onClick={() => updateSetting('clouds', !settings.clouds)}
          className={`px-4 py-2 rounded-lg font-bold ${settings.clouds ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ fontFamily: MC }}
        >
          {settings.clouds ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Show Hand Toggle */}
      <div className="bg-[#3a3a3a] p-4 rounded-xl flex justify-between items-center">
        <label className="text-white text-sm font-bold" style={{ fontFamily: MC }}>Show Hand</label>
        <button
          onClick={() => updateSetting('showHand', !settings.showHand)}
          className={`px-4 py-2 rounded-lg font-bold ${settings.showHand ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ fontFamily: MC }}
        >
          {settings.showHand ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Fancy Graphics Toggle */}
      <div className="bg-[#3a3a3a] p-4 rounded-xl flex justify-between items-center">
        <label className="text-white text-sm font-bold" style={{ fontFamily: MC }}>Fancy Graphics</label>
        <button
          onClick={() => updateSetting('fancyGraphics', !settings.fancyGraphics)}
          className={`px-4 py-2 rounded-lg font-bold ${settings.fancyGraphics ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ fontFamily: MC }}
        >
          {settings.fancyGraphics ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );

  const audioSettings = (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white mb-4" style={{ fontFamily: MC }}>Audio Settings</h3>
      
      {/* Master Volume */}
      <div className="bg-[#3a3a3a] p-4 rounded-xl">
        <label className="block text-white text-sm font-bold mb-2" style={{ fontFamily: MC }}>
          Master Volume: {Math.round(settings.masterVolume * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.masterVolume * 100}
          onChange={(e) => updateSetting('masterVolume', parseInt(e.target.value) / 100)}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Music Volume */}
      <div className="bg-[#3a3a3a] p-4 rounded-xl">
        <label className="block text-white text-sm font-bold mb-2" style={{ fontFamily: MC }}>
          Music: {Math.round(settings.musicVolume * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.musicVolume * 100}
          onChange={(e) => updateSetting('musicVolume', parseInt(e.target.value) / 100)}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Sound Volume */}
      <div className="bg-[#3a3a3a] p-4 rounded-xl">
        <label className="block text-white text-sm font-bold mb-2" style={{ fontFamily: MC }}>
          Sounds: {Math.round(settings.soundVolume * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.soundVolume * 100}
          onChange={(e) => updateSetting('soundVolume', parseInt(e.target.value) / 100)}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );

  const controlsSettings = (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white mb-4" style={{ fontFamily: MC }}>Controls</h3>
      
      <div className="bg-[#3a3a3a] p-4 rounded-xl">
        <h4 className="text-white text-sm font-bold mb-3" style={{ fontFamily: MC }}>Keyboard Controls</h4>
        <div className="grid grid-cols-2 gap-2 text-sm" style={{ fontFamily: MC }}>
          <div className="text-gray-400">WASD</div>
          <div className="text-white">Move</div>
          <div className="text-gray-400">Mouse</div>
          <div className="text-white">Look around</div>
          <div className="text-gray-400">LMB</div>
          <div className="text-white">Break block</div>
          <div className="text-gray-400">RMB</div>
          <div className="text-white">Place block</div>
          <div className="text-gray-400">F</div>
          <div className="text-white">Interact</div>
          <div className="text-gray-400">E</div>
          <div className="text-white">Inventory</div>
          <div className="text-gray-400">Space</div>
          <div className="text-white">Jump / Fly up</div>
          <div className="text-gray-400">Shift</div>
          <div className="text-white">Fly down</div>
          <div className="text-gray-400">1-9</div>
          <div className="text-white">Select hotbar slot</div>
        </div>
      </div>

      <div className="bg-[#3a3a3a] p-4 rounded-xl">
        <h4 className="text-white text-sm font-bold mb-3" style={{ fontFamily: MC }}>Mouse Sensitivity</h4>
        <input
          type="range"
          min="1"
          max="100"
          value={settings.mouseSensitivity}
          onChange={(e) => updateSetting('mouseSensitivity', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
        <p className="text-xs text-gray-400 mt-2" style={{ fontFamily: MC }}>{settings.mouseSensitivity}%</p>
      </div>

      <div className="bg-[#3a3a3a] p-4 rounded-xl">
        <h4 className="text-white text-sm font-bold mb-3" style={{ fontFamily: MC }}>Touch Layout</h4>
        <label className="block text-white text-xs mb-1" style={{ fontFamily: MC }}>
          Joystick Size: {settings.joystickSize.toFixed(2)}x
        </label>
        <input
          type="range"
          min="0.7"
          max="1.8"
          step="0.05"
          value={settings.joystickSize}
          onChange={(e) => updateSetting('joystickSize', parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer mb-3"
        />
        <label className="block text-white text-xs mb-1" style={{ fontFamily: MC }}>
          Joystick Side Offset: {settings.joystickSideOffset}px
        </label>
        <input
          type="range"
          min="-40"
          max="180"
          step="2"
          value={settings.joystickSideOffset}
          onChange={(e) => updateSetting('joystickSideOffset', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer mb-3"
        />
        <label className="block text-white text-xs mb-1" style={{ fontFamily: MC }}>
          Joystick Bottom Offset: {settings.joystickBottomOffset}px
        </label>
        <input
          type="range"
          min="-60"
          max="220"
          step="2"
          value={settings.joystickBottomOffset}
          onChange={(e) => updateSetting('joystickBottomOffset', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer mb-4"
        />
        <label className="block text-white text-xs mb-1" style={{ fontFamily: MC }}>
          Inventory Bar Size: {settings.hotbarScale.toFixed(2)}x
        </label>
        <input
          type="range"
          min="0.75"
          max="1.8"
          step="0.05"
          value={settings.hotbarScale}
          onChange={(e) => updateSetting('hotbarScale', parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer mb-3"
        />
        <label className="block text-white text-xs mb-1" style={{ fontFamily: MC }}>
          Inventory Bar Side Offset: {settings.hotbarSideOffset}px
        </label>
        <input
          type="range"
          min="-240"
          max="240"
          step="2"
          value={settings.hotbarSideOffset}
          onChange={(e) => updateSetting('hotbarSideOffset', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer mb-3"
        />
        <label className="block text-white text-xs mb-1" style={{ fontFamily: MC }}>
          Inventory Bar Bottom Offset: {settings.hotbarBottomOffset}px
        </label>
        <input
          type="range"
          min="-40"
          max="220"
          step="2"
          value={settings.hotbarBottomOffset}
          onChange={(e) => updateSetting('hotbarBottomOffset', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );

  const resourcePackSettings = (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-white mb-4" style={{ fontFamily: MC }}>Resource Packs</h3>
      
      <div className="bg-[#3a3a3a] p-5 rounded-xl">
        <h4 className="text-white text-sm font-bold mb-3" style={{ fontFamily: MC }}>Custom Textures</h4>
        <p className="text-gray-400 text-xs mb-3" style={{ fontFamily: MC }}>
          Enter URL to custom texture images (PNG format recommended)
        </p>
        
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {Object.entries(BlockType)
            .filter(([key]) => isNaN(Number(key)))
            .slice(0, 20)
            .map(([name]) => (
              <div key={name} className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder={`${name} texture URL...`}
                  className="flex-1 px-3 py-3 bg-gray-700 text-white rounded text-sm border border-gray-600"
                  style={{ fontFamily: MC }}
                  value={customUrls[name] || ''}
                  onChange={(e) => handleResourceUrlChange(name, e.target.value)}
                />
                <button
                  onClick={() => applyResourceUrl(name)}
                  className="px-4 py-3 min-w-[84px] bg-blue-500 text-white rounded text-sm font-bold"
                  style={{ fontFamily: MC }}
                >
                  Apply
                </button>
              </div>
            ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-600">
          <button
            onClick={clearAllTextures}
            className="w-full py-2 bg-red-500 text-white rounded-lg font-bold"
            style={{ fontFamily: MC }}
          >
            Reset All Textures
          </button>
        </div>

        <div className="mt-4 p-3 bg-gray-700 rounded-lg">
          <p className="text-yellow-400 text-xs" style={{ fontFamily: MC }}>
            💡 Tip: Use direct image URLs (ending in .png or .jpg). Textures apply immediately.
          </p>
        </div>
      </div>

      <div className="bg-[#3a3a3a] p-5 rounded-xl">
        <h4 className="text-white text-sm font-bold mb-3" style={{ fontFamily: MC }}>Block Designer (16x16 per face)</h4>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
          <div>
            <canvas
              ref={designerCanvasRef}
              className="w-full max-w-[320px] rounded border border-gray-500 bg-black cursor-crosshair touch-none"
              onMouseDown={(e) => paintDesigner(e.clientX, e.clientY)}
              onMouseMove={(e) => { if (e.buttons === 1) paintDesigner(e.clientX, e.clientY); }}
            />
          </div>
          <div className="space-y-3">
            <select
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
              style={{ fontFamily: MC }}
              value={designerBlock}
              onChange={(e) => setDesignerBlock(Number(e.target.value))}
            >
              {Object.entries(BlockType).filter(([k, v]) => isNaN(Number(k)) && typeof v === 'number').map(([name, value]) => (
                <option key={name} value={value}>{name}</option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2">
              {(['top', 'bottom', 'north', 'south', 'east', 'west'] as FaceDir[]).map(f => (
                <button key={f}
                  onClick={() => setDesignerFace(f)}
                  className={`px-2 py-2 rounded text-xs font-bold ${designerFace === f ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}
                  style={{ fontFamily: MC }}>
                  {f}
                </button>
              ))}
            </div>
            <input type="color" value={designerColor} onChange={(e) => setDesignerColor(e.target.value)} className="w-full h-10 bg-transparent" />
            <button onClick={applyDesignedBlockTextures} className="w-full py-2 bg-green-600 text-white rounded-lg font-bold" style={{ fontFamily: MC }}>
              Apply Designed Faces
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#3a3a3a] p-5 rounded-xl">
        <h4 className="text-white text-sm font-bold mb-3" style={{ fontFamily: MC }}>Import/Export World</h4>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const data = localStorage.getItem('minicraft_world');
              if (data) {
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'minicraft_world.json';
                a.click();
                URL.revokeObjectURL(url);
              } else {
                alert('No world data found!');
              }
            }}
            className="flex-1 py-2 bg-green-500 text-white rounded-lg font-bold"
            style={{ fontFamily: MC }}
          >
            Export World
          </button>
          <label className="flex-1">
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const data = event.target?.result as string;
                      localStorage.setItem('minicraft_world', data);
                      alert('World imported! Reload the page to play.');
                    } catch {
                      alert('Invalid world file!');
                    }
                  };
                  reader.readAsText(file);
                }
              }}
            />
            <div className="w-full py-2 bg-blue-500 text-white rounded-lg font-bold text-center cursor-pointer"
              style={{ fontFamily: MC }}>
              Import World
            </div>
          </label>
        </div>
      </div>
    </div>
  );

  const modsSettings = (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: MC }}>Mods & Scripting</h3>

      <div className="bg-[#3a3a3a] p-5 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm" style={{ fontFamily: MC }}>Sandbox Mode</span>
          <button
            onClick={() => { modManager.setSandboxMode(!sandboxMode); setSandboxMode(modManager.isSandboxMode()); }}
            className={`px-3 py-1 rounded text-xs font-bold ${sandboxMode ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
            style={{ fontFamily: MC }}
          >
            {sandboxMode ? 'ON' : 'OFF'}
          </button>
        </div>
        <p className="text-sm text-gray-200" style={{ fontFamily: MC }}>
          Import modpacks, write JS code, and run it live.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="w-full">
            <input
              type="file"
              accept=".json,.js,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importModPackFile(file);
              }}
            />
            <div className="w-full py-3 bg-blue-500 text-white rounded-lg font-bold text-center cursor-pointer"
              style={{ fontFamily: MC }}>
              Import Modpack / JS
            </div>
          </label>
          <button
            onClick={exportModPack}
            className="w-full py-3 bg-green-500 text-white rounded-lg font-bold"
            style={{ fontFamily: MC }}
          >
            Export Modpack
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button onClick={() => openAiHelper('chatgpt')} className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold" style={{ fontFamily: MC }}>
            Open ChatGPT Helper
          </button>
          <button onClick={() => openAiHelper('claude')} className="w-full py-3 bg-orange-600 text-white rounded-lg font-bold" style={{ fontFamily: MC }}>
            Open Claude Helper
          </button>
        </div>
      </div>

      <div className="bg-[#3a3a3a] p-5 rounded-xl space-y-3">
        <input
          type="text"
          value={newModName}
          onChange={(e) => setNewModName(e.target.value)}
          placeholder="Mod name"
          className="w-full px-3 py-3 bg-gray-700 text-white rounded text-sm border border-gray-600"
          style={{ fontFamily: MC }}
        />
        <textarea
          value={newModCode}
          onChange={(e) => setNewModCode(e.target.value)}
          rows={8}
          className="w-full px-3 py-3 bg-gray-900 text-green-300 rounded text-sm border border-gray-600"
          style={{ fontFamily: 'monospace' }}
          placeholder="// Write JavaScript mod code here"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button onClick={addModFromEditor} className="py-3 bg-indigo-500 text-white rounded-lg font-bold" style={{ fontFamily: MC }}>
            Save Mod
          </button>
          <button onClick={applyAllMods} className="py-3 bg-purple-500 text-white rounded-lg font-bold" style={{ fontFamily: MC }}>
            Run Enabled Mods
          </button>
          <button
            onClick={async () => {
              if (!renderer) return alert('Open a world to run code.');
              const result = await renderer.executeCommand(`js ${newModCode}`);
              alert(result.output);
            }}
            className="py-3 bg-orange-500 text-white rounded-lg font-bold"
            style={{ fontFamily: MC }}
          >
            Run Editor Code
          </button>
        </div>
      </div>

      <div className="bg-[#3a3a3a] p-5 rounded-xl space-y-3">
        <h4 className="text-white text-sm font-bold" style={{ fontFamily: MC }}>Installed Mods</h4>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {mods.length === 0 && (
            <p className="text-gray-400 text-sm" style={{ fontFamily: MC }}>No mods installed yet.</p>
          )}
          {mods.map(mod => (
            <div key={mod.id} className="p-3 rounded-lg border border-gray-600 bg-gray-800/80">
              <div className="flex items-center justify-between gap-2">
                <div className="text-white text-sm font-bold" style={{ fontFamily: MC }}>{mod.name}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { modManager.toggle(mod.id, !mod.enabled); refreshMods(); }}
                    className={`px-2 py-1 rounded text-xs font-bold ${mod.enabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-200'}`}
                    style={{ fontFamily: MC }}
                  >
                    {mod.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => runMod(mod)}
                    className="px-2 py-1 rounded text-xs font-bold bg-blue-600 text-white"
                    style={{ fontFamily: MC }}
                  >
                    Run
                  </button>
                  <button
                    onClick={() => { modManager.remove(mod.id); refreshMods(); }}
                    className="px-2 py-1 rounded text-xs font-bold bg-red-600 text-white"
                    style={{ fontFamily: MC }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-[96vw] max-w-4xl max-h-[90vh] overflow-hidden"
        style={{
          fontFamily: MC,
          backgroundImage: assetCssUrl('assets/gui/options_background.png'),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: 'rgba(26,26,26,0.95)',
          border: '4px solid #555',
          borderRadius: '16px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          imageRendering: 'pixelated',
        }}
        onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-gray-700"
          style={{ background: 'linear-gradient(to right, #2a2a2a, #3a3a3a, #2a2a2a)' }}>
          <h2 className="text-xl text-white font-bold" style={{ textShadow: '2px 2px 0 #000', fontFamily: MC }}>
            ⚙️ Settings
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl px-3 py-1 rounded-full hover:bg-red-500 transition-colors">
            ✕
          </button>
        </div>

        <div className="flex h-[66vh]">
          {/* Sidebar tabs */}
          <div className="w-52 border-r-2 border-gray-700 flex flex-col gap-1 p-2"
            style={{ background: '#1a1a1a' }}>
            {[
              { id: 'video', label: 'Video', icon: '🎮' },
              { id: 'audio', label: 'Audio', icon: '🔊' },
              { id: 'controls', label: 'Controls', icon: '🎮' },
              { id: 'resourcepack', label: 'Resource Packs', icon: '📦' },
              { id: 'mods', label: 'Mods', icon: '🧩' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-4 text-left rounded-lg transition-all ${
                  activeTab === tab.id 
                    ? 'bg-blue-500/20 text-blue-400 border-r-2 border-blue-400' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
                style={{ fontFamily: MC }}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto" style={{ background: '#222' }}>
            {activeTab === 'video' && videoSettings}
            {activeTab === 'audio' && audioSettings}
            {activeTab === 'controls' && controlsSettings}
            {activeTab === 'resourcepack' && resourcePackSettings}
            {activeTab === 'mods' && modsSettings}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t-2 border-gray-700 flex justify-between items-center"
          style={{ background: '#1a1a1a' }}>
          <span className="text-gray-500 text-xs" style={{ fontFamily: MC }}>
            {GAME_BRAND} v1.21.2
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-green-500 text-white rounded-lg font-bold"
            style={{ fontFamily: MC }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== WORLD SELECT SCREEN =====
function WorldSelectScreen({ onSelectWorld, onBack }: { onSelectWorld: (worldId: string) => void; onBack: () => void }) {
  const [worlds, setWorlds] = useState(() => worldManager.getAllWorlds());
  const [newWorldName, setNewWorldName] = useState('');
  const [newWorldSeed, setNewWorldSeed] = useState('');
  const [newWorldType, setNewWorldType] = useState<'normal' | 'flat'>('normal');
  const [showCreate, setShowCreate] = useState(false);

  const createWorld = () => {
    if (newWorldName.trim()) {
      const parsedSeed = Number.parseInt(newWorldSeed.trim(), 10);
      const world = worldManager.createWorld(newWorldName.trim(), {
        seed: Number.isFinite(parsedSeed) ? parsedSeed : undefined,
        worldType: newWorldType,
      });
      setWorlds(worldManager.getAllWorlds());
      setNewWorldName('');
      setNewWorldSeed('');
      setNewWorldType('normal');
      setShowCreate(false);
      onSelectWorld(world.id);
    }
  };

  const deleteWorld = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this world? This cannot be undone!')) {
      worldManager.deleteWorld(id);
      setWorlds(worldManager.getAllWorlds());
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden select-none">
      <div className="absolute inset-0" style={{
        backgroundImage: 'url(https://i.ytimg.com/vi/39Y1ZSc6ySk/hq720.jpg)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'blur(2px) brightness(0.7)',
      }} />
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 w-full max-w-4xl p-6">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 text-center"
          style={{ fontFamily: TITLE_FONT, textShadow: '3px 3px 0 #000', letterSpacing: '0.05em' }}>
          Select World
        </h2>

        {/* World list */}
        <div className="mb-10 max-h-[58vh] overflow-y-auto pr-1">
          {worlds.length === 0 && (
            <p className="text-center text-gray-400" style={{ fontFamily: MC }}>
              No worlds yet. Create one!
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-5">
            {worlds.map(world => (
              <button
                key={world.id}
                onClick={() => onSelectWorld(world.id)}
                className="relative text-left rounded-2xl overflow-hidden transition-all border-2 hover:-translate-y-0.5"
                style={{
                  fontFamily: MC,
                  background: 'linear-gradient(180deg, rgba(53,63,80,0.92) 0%, rgba(37,45,58,0.92) 100%)',
                  borderColor: '#52607a',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
                }}>
                <img
                  src={world.snapshot}
                  alt={`${world.name} snapshot`}
                  className="w-full h-28 object-cover"
                  style={{ imageRendering: 'pixelated' }}
                />
                <div className="p-3">
                  <h3 className="text-base font-bold text-white truncate">{world.name}</h3>
                  <p className="text-[11px] text-gray-300 truncate">Seed: {world.seed}</p>
                  <p className="text-[10px] text-gray-400 truncate">{world.worldType === 'flat' ? 'Flat' : 'Normal'} · {formatDate(world.lastPlayed)}</p>
                </div>
                <button
                  onClick={(e) => deleteWorld(world.id, e)}
                  className="absolute top-2 right-2 w-7 h-7 bg-red-500/85 hover:bg-red-600 text-white rounded-lg text-sm"
                  style={{ fontFamily: MC }}>
                  🗑️
                </button>
              </button>
            ))}
          </div>
        </div>

        {/* Create new world */}
        {showCreate ? (
          <div className="p-6 rounded-2xl border-2 mb-6"
            style={{ background: 'rgba(42,50,66,0.92)', borderColor: '#5d6b86' }}>
            <input
              type="text"
              value={newWorldName}
              onChange={(e) => setNewWorldName(e.target.value)}
              placeholder="World name..."
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg mb-4"
              style={{ fontFamily: MC }}
              onKeyPress={(e) => e.key === 'Enter' && createWorld()}
              autoFocus
            />
            <input
              type="text"
              value={newWorldSeed}
              onChange={(e) => setNewWorldSeed(e.target.value.replace(/[^\d-]/g, ''))}
              placeholder="Seed (optional, empty = random)"
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg mb-4"
              style={{ fontFamily: MC }}
              onKeyPress={(e) => e.key === 'Enter' && createWorld()}
            />
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                onClick={() => setNewWorldType('normal')}
                className="px-3 py-2 rounded-lg text-white border-2"
                style={{
                  fontFamily: MC,
                  background: newWorldType === 'normal' ? '#3f7d38' : '#374151',
                  borderColor: newWorldType === 'normal' ? '#7ed957' : '#4b5563',
                }}>
                Normal
              </button>
              <button
                onClick={() => setNewWorldType('flat')}
                className="px-3 py-2 rounded-lg text-white border-2"
                style={{
                  fontFamily: MC,
                  background: newWorldType === 'flat' ? '#3f7d38' : '#374151',
                  borderColor: newWorldType === 'flat' ? '#7ed957' : '#4b5563',
                }}>
                Flat
              </button>
            </div>
            <div className="flex gap-2">
              <MCBtn onClick={createWorld} color="green">Create</MCBtn>
              <MCBtn onClick={() => { setShowCreate(false); setNewWorldName(''); setNewWorldSeed(''); setNewWorldType('normal'); }} color="gray">Cancel</MCBtn>
            </div>
          </div>
        ) : (
          <MCBtn onClick={() => setShowCreate(true)} color="green">
            + Create New World
          </MCBtn>
        )}

        <div className="mt-4">
          <MCBtn onClick={onBack} color="gray">Back</MCBtn>
        </div>
      </div>
    </div>
  );
}

function MultiplayerMenuScreen({
  onBack,
  onStartWithSession,
  profile,
  onUpdateProfileName,
}: {
  onBack: () => void;
  onStartWithSession: (worldId: string, session: MultiplayerSession, playerName: string) => void;
  profile: PlayerProfile;
  onUpdateProfileName: (name: string) => void;
}) {
  const [mode, setMode] = useState<'host' | 'join'>('host');
  const [name, setName] = useState(() => profile.name || localStorage.getItem('creativ44_mp_name') || 'Player');
  const [code, setCode] = useState('');
  const [worlds, setWorlds] = useState(() => worldManager.getAllWorlds());
  const [selectedWorldId, setSelectedWorldId] = useState<string>(() => worldManager.getAllWorlds()[0]?.id || '');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedWorldId && worlds.length > 0) setSelectedWorldId(worlds[0].id);
  }, [selectedWorldId, worlds]);

  const ensureWorldForConfig = (cfg: { seed: number; worldType: 'normal' | 'flat' }) => {
    let w = worldManager.getAllWorlds().find(x => x.seed === cfg.seed && x.worldType === cfg.worldType);
    if (!w) w = worldManager.createWorld(cfg.worldType === 'flat' ? `Flat ${cfg.seed}` : `Normal ${cfg.seed}`, cfg);
    return w;
  };

  const hostGame = async () => {
    setLoading(true);
    setStatus('');
    try {
      let world = worlds.find(w => w.id === selectedWorldId);
      if (!world) {
        world = worldManager.ensureDefaultWorld();
        setWorlds(worldManager.getAllWorlds());
      }
      const session = await multiplayerClient.createRoom(name || 'Host', { seed: world.seed, worldType: world.worldType });
      localStorage.setItem('creativ44_mp_name', name || 'Host');
      onUpdateProfileName(name || 'Host');
      onStartWithSession(world.id, session, name || 'Host');
    } catch (e) {
      setStatus(`Host failed: ${String((e as Error).message || e)}`);
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async () => {
    setLoading(true);
    setStatus('');
    try {
      const session = await multiplayerClient.joinRoom(code.trim().toUpperCase(), name || 'Player');
      const world = ensureWorldForConfig(session.world);
      localStorage.setItem('creativ44_mp_name', name || 'Player');
      onUpdateProfileName(name || 'Player');
      onStartWithSession(world.id, session, name || 'Player');
    } catch (e) {
      setStatus(`Join failed: ${String((e as Error).message || e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden select-none">
      <div className="absolute inset-0" style={{
        backgroundImage: 'url(https://i.ytimg.com/vi/39Y1ZSc6ySk/hq720.jpg)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'blur(2px) brightness(0.62)',
      }} />
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative z-10 w-[min(94vw,720px)] p-6 rounded-2xl border-2" style={{ background: 'rgba(34,43,57,0.95)', borderColor: '#5f6f88' }}>
        <h2 className="text-3xl text-white text-center mb-4" style={{ fontFamily: TITLE_FONT, textShadow: '2px 2px 0 #000' }}>Multiplayer</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button onClick={() => setMode('host')} className="py-2 rounded text-white border-2" style={{ fontFamily: MC, background: mode === 'host' ? '#3f7d38' : '#374151', borderColor: mode === 'host' ? '#7ed957' : '#4b5563' }}>Host Game</button>
          <button onClick={() => setMode('join')} className="py-2 rounded text-white border-2" style={{ fontFamily: MC, background: mode === 'join' ? '#3f7d38' : '#374151', borderColor: mode === 'join' ? '#7ed957' : '#4b5563' }}>Join Game</button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 20))}
          placeholder="Your player name"
          className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg mb-4"
          style={{ fontFamily: MC }}
        />

        {mode === 'host' ? (
          <div className="space-y-3 mb-4">
            <div className="text-gray-200 text-sm" style={{ fontFamily: MC }}>Choose world to host</div>
            <select
              value={selectedWorldId}
              onChange={(e) => setSelectedWorldId(e.target.value)}
              className="w-full px-3 py-3 rounded-lg bg-gray-700 text-white"
              style={{ fontFamily: MC }}
            >
              {worlds.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.worldType}, seed {w.seed})</option>
              ))}
            </select>
            <button
              onClick={() => {
                const w = worldManager.createWorld(`World ${worlds.length + 1}`, {});
                setWorlds(worldManager.getAllWorlds());
                setSelectedWorldId(w.id);
              }}
              className="px-3 py-2 rounded bg-gray-600 text-white text-sm"
              style={{ fontFamily: MC }}
            >
              + Create New World
            </button>
            <MCBtn onClick={hostGame} color="green" disabled={loading || worlds.length === 0}>
              {loading ? 'Hosting...' : 'Start Host'}
            </MCBtn>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              placeholder="Enter room code"
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg"
              style={{ fontFamily: MC }}
            />
            <MCBtn onClick={joinGame} color="green" disabled={loading || code.length < 4}>
              {loading ? 'Joining...' : 'Join by Code'}
            </MCBtn>
          </div>
        )}

        <div className="min-h-[20px] text-yellow-300 text-xs mb-3" style={{ fontFamily: MC }}>{status}</div>
        <MCBtn onClick={onBack} color="gray">Back</MCBtn>
      </div>
    </div>
  );
}

// ===== MAIN APP =====
function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [loadProgress, setLoadProgress] = useState(0);
  const [menuSettingsOpen, setMenuSettingsOpen] = useState(false);
  const [pendingReturnPortalTarget, setPendingReturnPortalTarget] = useState<'normal' | 'flat' | null>(null);
  const [multiplayerBootstrap, setMultiplayerBootstrap] = useState<{ session: MultiplayerSession; playerName: string } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfileFromStorage());
  const [activeWorldId, setActiveWorldId] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);

  useEffect(() => { saveProfileToStorage(profile); }, [profile]);

  const tryEnterFullscreen = useCallback(() => {
    const el = document.documentElement;
    const anyEl = el as any;
    if (document.fullscreenElement) return;
    const fn = el.requestFullscreen || anyEl.webkitRequestFullscreen || anyEl.mozRequestFullScreen || anyEl.msRequestFullscreen;
    if (typeof fn === 'function') {
      Promise.resolve(fn.call(el)).catch(() => {});
    }
  }, []);

  const handlePlay = () => {
    // Check if we have worlds
    const worlds = worldManager.getAllWorlds();
    if (worlds.length === 0) {
      // Create default world
      const world = worldManager.createWorld('Overworld');
      worldManager.setCurrentWorld(world.id);
      tryEnterFullscreen();
      setMultiplayerBootstrap(null);
      startGame(world.id);
    } else {
      // Show world selection
      setGameState('worldselect');
    }
  };
  const handleOpenMultiplayer = () => setGameState('multiplayermenu');

  const startGame = useCallback((worldId: string) => {
    worldManager.setCurrentWorld(worldId);
    setActiveWorldId(worldId);
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
    setGameState('loading');
    setLoadProgress(0);
  }, []);

  // Initialize renderer once the container is available and we're in loading state
  useEffect(() => {
    if (gameState !== 'loading' || !containerRef.current || rendererRef.current) return;

    const currentWorld = worldManager.getCurrentWorld();
    const renderer = new GameRenderer(containerRef.current, {
      seed: currentWorld?.seed,
      worldType: currentWorld?.worldType || 'normal',
    });
    rendererRef.current = renderer;
    renderer.setLoadProgress(setLoadProgress);

    renderer.generateWorld().then(async () => {
      // Auto-apply enabled mods for this session after world generation.
      const enabledMods = modManager.list().filter(m => m.enabled);
      for (const mod of enabledMods) {
        await renderer.executeCommand(`js ${mod.code}`);
      }
      if (currentWorld?.id) {
        const edits = worldManager.getBlockEdits(currentWorld.id);
        if (edits.length > 0) renderer.applyWorldBlockEdits(edits);
      }
      if (pendingReturnPortalTarget) {
        renderer.createSpawnPortalTo(pendingReturnPortalTarget);
        setPendingReturnPortalTarget(null);
      }
      setGameState('playing');
      renderer.start();
    });
  }, [gameState, pendingReturnPortalTarget]);

  const handleSelectWorld = (worldId: string) => {
    tryEnterFullscreen();
    setMultiplayerBootstrap(null);
    startGame(worldId);
  };

  const handleStartWithMultiplayerSession = (worldId: string, session: MultiplayerSession, playerName: string) => {
    tryEnterFullscreen();
    setMultiplayerBootstrap({ session, playerName });
    startGame(worldId);
  };

  const handlePortalTravel = useCallback((targetWorldType: 'normal' | 'flat') => {
    const sourceType = rendererRef.current?.getWorldConfig().worldType || 'normal';
    const worlds = worldManager.getAllWorlds();
    let next = worlds.find(w => w.worldType === targetWorldType);
    if (!next) {
      next = worldManager.createWorld(targetWorldType === 'flat' ? 'Flat Realm' : 'Overworld Realm', { worldType: targetWorldType });
    }
    setPendingReturnPortalTarget(sourceType);
    startGame(next.id);
  }, [startGame]);

  const handleSwitchToWorldConfig = useCallback((cfg: { seed: number; worldType: 'normal' | 'flat' }) => {
    const worlds = worldManager.getAllWorlds();
    let next = worlds.find(w => w.seed === cfg.seed && w.worldType === cfg.worldType);
    if (!next) {
      next = worldManager.createWorld(
        cfg.worldType === 'flat' ? `Flat ${cfg.seed}` : `Normal ${cfg.seed}`,
        { seed: cfg.seed, worldType: cfg.worldType }
      );
    }
    startGame(next.id);
  }, [startGame]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-black">
      {/* Always render the container so the renderer can attach during loading */}
      <div ref={containerRef} className="w-full h-full absolute inset-0"
        style={{ visibility: gameState === 'playing' ? 'visible' : 'hidden' }} />
      {gameState === 'menu' && (
        <MenuScreen
          onPlay={handlePlay}
          onOpenSettings={() => setMenuSettingsOpen(true)}
          onMultiplayer={handleOpenMultiplayer}
          onOpenProfile={() => setProfileOpen(true)}
          profile={profile}
        />
      )}
      {gameState === 'worldselect' && (
        <WorldSelectScreen
          onSelectWorld={handleSelectWorld}
          onBack={() => setGameState('menu')}
        />
      )}
      {gameState === 'multiplayermenu' && (
        <MultiplayerMenuScreen
          onBack={() => setGameState('menu')}
          onStartWithSession={handleStartWithMultiplayerSession}
          profile={profile}
          onUpdateProfileName={(name) => setProfile(prev => ({ ...prev, name }))}
        />
      )}
      {gameState === 'loading' && <LoadingScreen progress={loadProgress} />}
      {gameState === 'playing' && rendererRef.current && (
        <GameUI
          renderer={rendererRef.current}
          onPortalTravel={handlePortalTravel}
          onSwitchToWorldConfig={handleSwitchToWorldConfig}
          initialMultiplayerSession={multiplayerBootstrap?.session || null}
          initialMultiplayerName={multiplayerBootstrap?.playerName || undefined}
          worldId={activeWorldId || worldManager.getCurrentWorld()?.id || ''}
          profile={profile}
        />
      )}
      {gameState === 'menu' && (
        <SettingsModal isOpen={menuSettingsOpen} renderer={null} onClose={() => setMenuSettingsOpen(false)} />
      )}
      <ProfileModal
        open={profileOpen}
        profile={profile}
        onClose={() => setProfileOpen(false)}
        onSave={setProfile}
      />
    </div>
  );
}

export { App };
