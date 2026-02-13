import { useState, useEffect, ChangeEvent } from 'react';
import { 
  Settings, 
  VideoSettings, 
  AudioSettings, 
  ControlSettings,
  ResourcePack,
  WorldSave,
  DEFAULT_SETTINGS 
} from '../types/settings';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: Settings) => void;
  currentSettings: Settings;
}

export function SettingsPanel({ isOpen, onClose, onSettingsChange, currentSettings }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'controls' | 'resource' | 'worlds'>('video');
  const [settings, setSettings] = useState<Settings>(currentSettings);
  const [exportMessage, setExportMessage] = useState<string>('');

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  if (!isOpen) return null;

  const updateSettings = (section: keyof Settings, values: Partial<any>) => {
    const newSettings = {
      ...settings,
      [section]: { ...settings[section], ...values }
    };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleExportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'minicraft-settings.json';
    link.click();
    URL.revokeObjectURL(url);
    setExportMessage('Settings exported!');
    setTimeout(() => setExportMessage(''), 3000);
  };

  const handleImportSettings = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        const newSettings = { ...DEFAULT_SETTINGS, ...imported };
        setSettings(newSettings);
        onSettingsChange(newSettings);
        setExportMessage('Settings imported!');
        setTimeout(() => setExportMessage(''), 3000);
      } catch (err) {
        setExportMessage('Error importing settings!');
        setTimeout(() => setExportMessage(''), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="ui-panel w-[95vw] max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-3xl font-bold text-white mc-font">Settings</h2>
          <button onClick={onClose} className="text-2xl text-white/70 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4 bg-black/20">
          {[
            { id: 'video', label: '🎮 Video', icon: '🎮' },
            { id: 'audio', label: '🔊 Audio', icon: '🔊' },
            { id: 'controls', label: '🎮 Controls', icon: '🎯' },
            { id: 'resource', label: '🎨 Resource Pack', icon: '🎨' },
            { id: 'worlds', label: '🌍 Worlds', icon: '🌍' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                activeTab === tab.id
                  ? 'ui-button-green text-white'
                  : 'ui-button text-white/70 hover:text-white'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'video' && (
            <VideoSettingsTab 
              settings={settings.video} 
              onChange={(v) => updateSettings('video', v)} 
            />
          )}
          {activeTab === 'audio' && (
            <AudioSettingsTab 
              settings={settings.audio} 
              onChange={(v) => updateSettings('audio', v)} 
            />
          )}
          {activeTab === 'controls' && (
            <ControlsSettingsTab 
              settings={settings.controls} 
              onChange={(v) => updateSettings('controls', v)} 
            />
          )}
          {activeTab === 'resource' && (
            <ResourcePackTab 
              settings={settings.resourcePack} 
              onChange={(v) => updateSettings('resourcePack', v)} 
            />
          )}
          {activeTab === 'worlds' && (
            <WorldsTab />
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex gap-4">
          <button onClick={handleExportSettings} className="ui-button-green px-6 py-3 rounded-xl font-bold">
            📤 Export Settings
          </button>
          <label className="ui-button px-6 py-3 rounded-xl font-bold cursor-pointer">
            📥 Import Settings
            <input type="file" accept=".json" onChange={handleImportSettings} className="hidden" />
          </label>
          <button 
            onClick={() => {
              setSettings(DEFAULT_SETTINGS);
              onSettingsChange(DEFAULT_SETTINGS);
            }}
            className="ui-button px-6 py-3 rounded-xl font-bold ml-auto"
          >
            🔄 Reset to Default
          </button>
        </div>

        {exportMessage && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg">
            {exportMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function VideoSettingsTab({ settings, onChange }: { settings: VideoSettings; onChange: (s: Partial<VideoSettings>) => void }) {
  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-white mb-4">Video Settings</h3>
      
      {/* Render Distance */}
      <div className="card">
        <div className="flex justify-between items-center mb-2">
          <label className="text-white font-bold">Render Distance</label>
          <span className="text-white/70 mc-font text-xl">{settings.renderDistance} chunks</span>
        </div>
        <input
          type="range"
          min="4"
          max="16"
          value={settings.renderDistance}
          onChange={(e) => onChange({ renderDistance: parseInt(e.target.value) })}
        />
        <p className="text-sm text-white/50 mt-2">Higher values require more performance</p>
      </div>

      {/* FOV */}
      <div className="card">
        <div className="flex justify-between items-center mb-2">
          <label className="text-white font-bold">Field of View (FOV)</label>
          <span className="text-white/70 mc-font text-xl">{settings.fov}°</span>
        </div>
        <input
          type="range"
          min="60"
          max="110"
          value={settings.fov}
          onChange={(e) => onChange({ fov: parseInt(e.target.value) })}
        />
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-2 gap-4">
        <ToggleSetting 
          label="Clouds" 
          value={settings.clouds} 
          onChange={(v) => onChange({ clouds: v })} 
        />
        <ToggleSetting 
          label="Show Hand" 
          value={settings.showHand} 
          onChange={(v) => onChange({ showHand: v })} 
        />
        <ToggleSetting 
          label="Shadows" 
          value={settings.shadows} 
          onChange={(v) => onChange({ shadows: v })} 
        />
        <ToggleSetting 
          label="Particles" 
          value={settings.particles} 
          onChange={(v) => onChange({ particles: v })} 
        />
        <ToggleSetting 
          label="V-Sync" 
          value={settings.vsync} 
          onChange={(v) => onChange({ vsync: v })} 
        />
        <ToggleSetting 
          label="Fullscreen" 
          value={settings.fullscreen} 
          onChange={(v) => onChange({ fullscreen: v })} 
        />
      </div>
    </div>
  );
}

function AudioSettingsTab({ settings, onChange }: { settings: AudioSettings; onChange: (s: Partial<AudioSettings>) => void }) {
  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-white mb-4">Audio Settings</h3>
      
      {[
        { key: 'master', label: 'Master Volume' },
        { key: 'music', label: 'Music' },
        { key: 'sound', label: 'Sound Effects' },
        { key: 'ambient', label: 'Ambient' },
      ].map(({ key, label }) => (
        <div key={key} className="card">
          <div className="flex justify-between items-center mb-2">
            <label className="text-white font-bold">{label}</label>
            <span className="text-white/70 mc-font text-xl">{settings[key as keyof AudioSettings]}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings[key as keyof AudioSettings] as number}
            onChange={(e) => onChange({ [key]: parseInt(e.target.value) })}
          />
        </div>
      ))}
    </div>
  );
}

function ControlsSettingsTab({ settings, onChange }: { settings: ControlSettings; onChange: (s: Partial<ControlSettings>) => void }) {
  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-white mb-4">Control Settings</h3>
      
      {/* Mouse Sensitivity */}
      <div className="card">
        <div className="flex justify-between items-center mb-2">
          <label className="text-white font-bold">Mouse Sensitivity</label>
          <span className="text-white/70 mc-font text-xl">{settings.mouseSensitivity}%</span>
        </div>
        <input
          type="range"
          min="1"
          max="200"
          value={settings.mouseSensitivity}
          onChange={(e) => onChange({ mouseSensitivity: parseInt(e.target.value) })}
        />
      </div>

      {/* Joystick Size */}
      <div className="card">
        <div className="flex justify-between items-center mb-2">
          <label className="text-white font-bold">Joystick Size</label>
          <span className="text-white/70 mc-font text-xl">{Math.round(settings.joystickSize * 100)}%</span>
        </div>
        <input
          type="range"
          min="50"
          max="200"
          value={settings.joystickSize * 100}
          onChange={(e) => onChange({ joystickSize: parseInt(e.target.value) / 100 })}
        />
      </div>

      {/* Button Size */}
      <div className="card">
        <div className="flex justify-between items-center mb-2">
          <label className="text-white font-bold">Button Size</label>
          <span className="text-white/70 mc-font text-xl">{Math.round(settings.buttonSize * 100)}%</span>
        </div>
        <input
          type="range"
          min="50"
          max="200"
          value={settings.buttonSize * 100}
          onChange={(e) => onChange({ buttonSize: parseInt(e.target.value) / 100 })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ToggleSetting 
          label="Invert Mouse Y" 
          value={settings.invertMouse} 
          onChange={(v) => onChange({ invertMouse: v })} 
        />
        <ToggleSetting 
          label="Touchscreen Mode" 
          value={settings.touchscreenMode} 
          onChange={(v) => onChange({ touchscreenMode: v })} 
        />
        <ToggleSetting 
          label="Auto Jump" 
          value={settings.autoJump} 
          onChange={(v) => onChange({ autoJump: v })} 
        />
        <ToggleSetting 
          label="Keyboard Controls" 
          value={settings.keyboardControls} 
          onChange={(v) => onChange({ keyboardControls: v })} 
        />
      </div>
    </div>
  );
}

function ToggleSetting({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="card flex justify-between items-center">
      <label className="text-white font-bold">{label}</label>
      <button
        onClick={() => onChange(!value)}
        className={`w-16 h-8 rounded-full transition-all relative ${
          value ? 'bg-green-500' : 'bg-gray-600'
        }`}
      >
        <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${
          value ? 'left-9' : 'left-1'
        }`} />
      </button>
    </div>
  );
}

function ResourcePackTab({ settings, onChange }: { settings: ResourcePack; onChange: (s: Partial<ResourcePack>) => void }) {
  const [customTextures, setCustomTextures] = useState<Record<string, string>>(settings.customTextures || {});
  const [packName, setPackName] = useState(settings.name || 'My Resource Pack');

  const handleExportPack = () => {
    const pack: ResourcePack = {
      name: packName,
      customTextures,
      enabled: true
    };
    const dataStr = JSON.stringify(pack, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${packName.replace(/\s+/g, '_').toLowerCase()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPack = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported: ResourcePack = JSON.parse(event.target?.result as string);
        setPackName(imported.name || 'Imported Pack');
        setCustomTextures(imported.customTextures || {});
        onChange({ name: imported.name, customTextures: imported.customTextures, enabled: true });
      } catch (err) {
        alert('Error importing resource pack!');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const updateTexture = (blockType: string, url: string) => {
    const newTextures = { ...customTextures, [blockType]: url };
    setCustomTextures(newTextures);
    onChange({ customTextures: newTextures });
  };

  const blockTypes = [
    'GRASS', 'DIRT', 'STONE', 'WOOD', 'LEAVES', 'SAND', 'COBBLESTONE', 
    'PLANKS', 'GLASS', 'BRICK', 'DIAMOND_BLOCK', 'GOLD_BLOCK', 'IRON_BLOCK',
    'OBSIDIAN', 'BEDROCK', 'TNT', 'CRAFTING_TABLE', 'FURNACE'
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-white mb-4">Resource Pack</h3>
      
      {/* Pack Name */}
      <div className="card">
        <label className="text-white font-bold block mb-2">Pack Name</label>
        <input
          type="text"
          value={packName}
          onChange={(e) => {
            setPackName(e.target.value);
            onChange({ name: e.target.value });
          }}
          className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-white"
          placeholder="Enter pack name..."
        />
      </div>

      {/* Export/Import */}
      <div className="flex gap-4">
        <button onClick={handleExportPack} className="ui-button-green flex-1 py-3 rounded-xl font-bold">
          📤 Export Resource Pack
        </button>
        <label className="ui-button flex-1 py-3 rounded-xl font-bold text-center cursor-pointer">
          📥 Import Resource Pack
          <input type="file" accept=".json" onChange={handleImportPack} className="hidden" />
        </label>
      </div>

      {/* Custom Textures */}
      <div className="card">
        <h4 className="text-lg font-bold text-white mb-4">Custom Textures</h4>
        <p className="text-sm text-white/50 mb-4">
          Enter image URLs for each block type. Changes apply immediately!
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
          {blockTypes.map((blockType) => (
            <div key={blockType} className="bg-black/20 p-3 rounded-lg">
              <label className="text-white text-sm font-bold block mb-1">{blockType}</label>
              <input
                type="url"
                value={customTextures[blockType] || ''}
                onChange={(e) => updateTexture(blockType, e.target.value)}
                placeholder="https://example.com/texture.png"
                className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-sm text-white"
              />
              {customTextures[blockType] && (
                <img 
                  src={customTextures[blockType]} 
                  alt={blockType}
                  className="mt-2 w-12 h-12 object-cover rounded border border-white/20"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                  onLoad={(e) => (e.currentTarget.style.display = 'block')}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Example Pack Info */}
      <div className="card bg-blue-500/20 border-blue-500/50">
        <h4 className="text-lg font-bold text-white mb-2">💡 Tip</h4>
        <p className="text-sm text-white/70">
          You can create your own textures or use existing ones. Make sure images are square (16x16, 32x32, 64x64, etc.) 
          and in PNG format for best results.
        </p>
      </div>
    </div>
  );
}

function WorldsTab() {
  const [savedWorlds, setSavedWorlds] = useState<WorldSave[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Load saved worlds from localStorage
    const worlds: WorldSave[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('minicraft_world_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          worlds.push({
            name: data.name || 'Unknown World',
            date: data.date || new Date().toISOString(),
            size: JSON.stringify(data).length,
            preview: data.preview
          });
        } catch (e) {
          console.error('Error loading world:', key);
        }
      }
    }
    setSavedWorlds(worlds.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  }, []);

  const handleExportWorld = (worldName: string) => {
    const key = `minicraft_world_${worldName}`;
    const data = localStorage.getItem(key);
    if (!data) {
      setMessage('World not found!');
      return;
    }

    const dataBlob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${worldName.replace(/\s+/g, '_').toLowerCase()}.minicraft`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('World exported!');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleImportWorld = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const world = JSON.parse(event.target?.result as string);
        if (world.name && world.chunks) {
          const key = `minicraft_world_${world.name}`;
          localStorage.setItem(key, JSON.stringify(world));
          setSavedWorlds(prev => [{
            name: world.name,
            date: world.date || new Date().toISOString(),
            size: JSON.stringify(world).length,
            preview: world.preview
          }, ...prev]);
          setMessage('World imported!');
        } else {
          setMessage('Invalid world file!');
        }
      } catch (err) {
        setMessage('Error importing world!');
      }
      setTimeout(() => setMessage(''), 3000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDeleteWorld = (worldName: string) => {
    if (!confirm(`Delete world "${worldName}"? This cannot be undone!`)) return;
    
    const key = `minicraft_world_${worldName}`;
    localStorage.removeItem(key);
    setSavedWorlds(prev => prev.filter(w => w.name !== worldName));
    setMessage('World deleted!');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-white">Saved Worlds</h3>
        <label className="ui-button-green px-6 py-2 rounded-xl font-bold cursor-pointer">
          📥 Import World
          <input type="file" accept=".minicraft,.json" onChange={handleImportWorld} className="hidden" />
        </label>
      </div>

      {savedWorlds.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-white/50 text-lg">No saved worlds yet</p>
          <p className="text-white/30 text-sm mt-2">Start playing to create a world!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {savedWorlds.map((world) => (
            <div key={world.name} className="card flex items-center gap-4">
              {world.preview ? (
                <img src={world.preview} alt={world.name} className="w-24 h-24 object-cover rounded-lg border border-white/20" />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-green-600 to-blue-600 rounded-lg flex items-center justify-center text-4xl">
                  🌍
                </div>
              )}
              <div className="flex-1">
                <h4 className="text-xl font-bold text-white">{world.name}</h4>
                <p className="text-sm text-white/50">
                  Saved: {new Date(world.date).toLocaleDateString()} • Size: {(world.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleExportWorld(world.name)}
                  className="ui-button px-4 py-2 rounded-lg font-bold"
                >
                  📤
                </button>
                <button 
                  onClick={() => handleDeleteWorld(world.name)}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {message && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg">
          {message}
        </div>
      )}
    </div>
  );
}

export default SettingsPanel;
