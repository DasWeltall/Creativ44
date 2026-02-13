import * as THREE from 'three';
import { BlockType } from './constants';
import { customizationManager } from './customization';
import { executeSandboxedMod } from './modSandbox';
import { modManager } from './modManager';

// ══════════════════════════════════════════════════════════════════
// ADVANCED COMMAND BLOCK SYSTEM - Beyond Minecraft
// ══════════════════════════════════════════════════════════════════

export type CommandBlockMode = 'impulse' | 'chain' | 'repeat';
export type CommandBlockCondition = 'unconditional' | 'conditional';

export interface CommandBlockData {
  command: string;
  mode: CommandBlockMode;
  condition: CommandBlockCondition;
  auto: boolean; // auto-execute on redstone
  lastOutput: string;
  successCount: number;
  trackOutput: boolean;
}

export interface CommandContext {
  executor: { x: number; y: number; z: number }; // Who/what executed the command
  position: { x: number; y: number; z: number }; // Where the command was executed
  gameRenderer?: any; // Reference to game renderer for world manipulation
  variables: Map<string, any>; // Variable storage
}

export interface CommandResult {
  success: boolean;
  output: string;
  value?: any;
}

// ══════════════════════════════════════════════════════════════════
// COMMAND PARSER
// ══════════════════════════════════════════════════════════════════

export class CommandParser {
  private commands = new Map<string, CommandHandler>();
  private variables = new Map<string, any>();
  private functions = new Map<string, string[]>(); // stored command sequences
  private runtimeMods = new Map<string, string>();
  private runtimeCommandScripts = new Map<string, string>();

  constructor() {
    this.registerDefaultCommands();
  }

  // Register a command handler
  registerCommand(name: string, handler: CommandHandler) {
    this.commands.set(name, handler);
  }

  // Parse and execute a command
  async execute(command: string, context: CommandContext): Promise<CommandResult> {
    try {
      const raw = command.trim();
      const rawLower = raw.toLowerCase();
      if (rawLower.startsWith('js ') || rawLower === 'js') {
        const script = raw.length > 2 ? raw.slice(2).trim() : '';
        const handler = this.commands.get('js');
        if (!handler) return { success: false, output: 'JS handler not available' };
        return await handler([script], context);
      }

      // Handle variables: $varName
      command = this.replaceVariables(command, context);

      // Handle comments
      if (command.trim().startsWith('#') || command.trim().startsWith('//')) {
        return { success: true, output: 'Comment ignored' };
      }

      // Parse command
      const parts = this.parseCommand(command);
      if (parts.length === 0) {
        return { success: false, output: 'Empty command' };
      }

      const cmdName = parts[0].toLowerCase();
      const args = parts.slice(1);

      // Special commands
      if (cmdName === 'var') {
        return this.handleVariable(args, context);
      }
      if (cmdName === 'function') {
        return this.handleFunction(args, context);
      }
      if (cmdName === 'call') {
        return this.handleFunctionCall(args, context);
      }

      // Find and execute command
      const handler = this.commands.get(cmdName);
      if (!handler) {
        return { success: false, output: `Unknown command: ${cmdName}` };
      }

      return await handler(args, context);
    } catch (error) {
      return { success: false, output: `Error: ${error}` };
    }
  }

  // Parse command string into parts (handles quotes)
  private parseCommand(command: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if ((char === '"' || char === "'") && (i === 0 || command[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        } else {
          current += char;
        }
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) parts.push(current);
    return parts;
  }

  // Replace $variables with their values
  private replaceVariables(command: string, context: CommandContext): string {
    return command.replace(/\$(\w+)/g, (match, varName) => {
      if (context.variables.has(varName)) {
        return String(context.variables.get(varName));
      }
      if (this.variables.has(varName)) {
        return String(this.variables.get(varName));
      }
      return match;
    });
  }

  // Handle variable assignment: var name value
  private handleVariable(args: string[], context: CommandContext): CommandResult {
    if (args.length < 2) {
      return { success: false, output: 'Usage: var <name> <value>' };
    }
    const name = args[0];
    const value = args.slice(1).join(' ');
    context.variables.set(name, value);
    this.variables.set(name, value);
    return { success: true, output: `Variable ${name} = ${value}` };
  }

  // Handle function definition: function name { commands... }
  private handleFunction(args: string[], _context: CommandContext): CommandResult {
    if (args.length < 2) {
      return { success: false, output: 'Usage: function <name> { <commands> }' };
    }
    const name = args[0];
    const body = args.slice(1).join(' ');
    // Parse commands from body (split by ;)
    const commands = body.replace(/[{}]/g, '').split(';').map(c => c.trim()).filter(c => c);
    this.functions.set(name, commands);
    return { success: true, output: `Function ${name} defined with ${commands.length} commands` };
  }

  // Call a stored function: call name
  private async handleFunctionCall(args: string[], context: CommandContext): Promise<CommandResult> {
    if (args.length < 1) {
      return { success: false, output: 'Usage: call <function_name>' };
    }
    const name = args[0];
    const func = this.functions.get(name);
    if (!func) {
      return { success: false, output: `Function not found: ${name}` };
    }
    let output = `Executing function ${name}:\n`;
    for (const cmd of func) {
      const result = await this.execute(cmd, context);
      output += `  ${cmd} -> ${result.output}\n`;
      if (!result.success) break;
    }
    return { success: true, output };
  }

  // ══════════════════════════════════════════════════════════════════
  // DEFAULT COMMANDS
  // ══════════════════════════════════════════════════════════════════

  private registerDefaultCommands() {
    // /tp <x> <y> <z> - Teleport
    this.registerCommand('tp', async (args, context) => {
      if (args.length < 3) return { success: false, output: 'Usage: /tp <x> <y> <z>' };
      const x = parseFloat(args[0]);
      const y = parseFloat(args[1]);
      const z = parseFloat(args[2]);
      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        return { success: false, output: 'Invalid coordinates' };
      }
      if (context.gameRenderer) {
        context.gameRenderer.teleportPlayer(x, y, z);
        return { success: true, output: `Teleported to ${x}, ${y}, ${z}` };
      }
      return { success: false, output: 'Game renderer not available' };
    });

    // /give <block> [count] - Give blocks
    this.registerCommand('give', async (args, context) => {
      if (args.length < 1) return { success: false, output: 'Usage: /give <block_type> [count]' };
      const blockName = args[0].toUpperCase();
      const count = args[1] ? parseInt(args[1]) : 64;
      // This would need integration with inventory system
      return { success: true, output: `Gave ${count}x ${blockName}` };
    });

    // /setblock <x> <y> <z> <block> - Place a block
    this.registerCommand('setblock', async (args, context) => {
      if (args.length < 4) return { success: false, output: 'Usage: /setblock <x> <y> <z> <block_type>' };
      const x = parseInt(args[0]);
      const y = parseInt(args[1]);
      const z = parseInt(args[2]);
      const blockName = args[3].toUpperCase();
      const blockType = BlockType[blockName as keyof typeof BlockType];

      if (blockType === undefined) {
        return { success: false, output: `Unknown block type: ${blockName}` };
      }

      if (context.gameRenderer) {
        context.gameRenderer.setBlockAt(x, y, z, blockType);
        return { success: true, output: `Placed ${blockName} at ${x}, ${y}, ${z}` };
      }
      return { success: false, output: 'Game renderer not available' };
    });

    // /fill <x1> <y1> <z1> <x2> <y2> <z2> <block> - Fill region
    this.registerCommand('fill', async (args, context) => {
      if (args.length < 7) {
        return { success: false, output: 'Usage: /fill <x1> <y1> <z1> <x2> <y2> <z2> <block_type>' };
      }
      const x1 = parseInt(args[0]), y1 = parseInt(args[1]), z1 = parseInt(args[2]);
      const x2 = parseInt(args[3]), y2 = parseInt(args[4]), z2 = parseInt(args[5]);
      const blockName = args[6].toUpperCase();
      const blockType = BlockType[blockName as keyof typeof BlockType];

      if (blockType === undefined) {
        return { success: false, output: `Unknown block type: ${blockName}` };
      }

      if (context.gameRenderer) {
        const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
        const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
        let count = 0;

        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
              context.gameRenderer.setBlockAt(x, y, z, blockType);
              count++;
            }
          }
        }
        return { success: true, output: `Filled ${count} blocks with ${blockName}` };
      }
      return { success: false, output: 'Game renderer not available' };
    });

    // /time set <value> - Set world time
    this.registerCommand('time', async (args, context) => {
      if (args.length < 2) return { success: false, output: 'Usage: /time set <value>' };
      if (args[0] !== 'set') return { success: false, output: 'Usage: /time set <value>' };
      const time = args[1];
      const timeMap: Record<string, number> = {
        'day': 1000, 'noon': 6000, 'sunset': 12000,
        'night': 13000, 'midnight': 18000, 'sunrise': 23000
      };
      const timeValue = timeMap[time] ?? parseInt(time);
      if (isNaN(timeValue)) return { success: false, output: 'Invalid time value' };

      if (context.gameRenderer) {
        context.gameRenderer.setWorldTime(timeValue);
        return { success: true, output: `Time set to ${time}` };
      }
      return { success: false, output: 'Game renderer not available' };
    });

    // /weather <clear|rain|snow|thunder|storm> - Set weather
    this.registerCommand('weather', async (args, context) => {
      if (args.length < 1) return { success: false, output: 'Usage: /weather <clear|rain|snow|thunder|storm>' };
      const input = args[0].toLowerCase();
      if (!['clear', 'rain', 'snow', 'thunder', 'storm'].includes(input)) {
        return { success: false, output: 'Invalid weather type' };
      }
      const weather = input === 'thunder' ? 'storm' : input;
      if (context.gameRenderer) {
        context.gameRenderer.setWeather(weather);
        return { success: true, output: `Weather set to ${weather}` };
      }
      return { success: false, output: 'Game renderer not available' };
    });

    // /gamemode <survival|grounded|creative> - Change game mode
    this.registerCommand('gamemode', async (args, context) => {
      if (args.length < 1) return { success: false, output: 'Usage: /gamemode <survival|grounded|creative>' };
      const inputMode = args[0].toLowerCase();
      if (!['survival', 'grounded', 'creative'].includes(inputMode)) {
        return { success: false, output: 'Invalid game mode' };
      }
      const mode = inputMode === 'grounded' ? 'survival' : inputMode;
      if (context.gameRenderer) {
        context.gameRenderer.setGameMode(mode);
        return { success: true, output: `Game mode set to ${inputMode}` };
      }
      return { success: false, output: 'Game renderer not available' };
    });

    // /summon <entity> <x> <y> <z> - Spawn entity
    this.registerCommand('summon', async (args, context) => {
      if (args.length < 4) return { success: false, output: 'Usage: /summon <entity> <x> <y> <z>' };
      const entity = args[0];
      const x = parseFloat(args[1]), y = parseFloat(args[2]), z = parseFloat(args[3]);
      if (context.gameRenderer) {
        context.gameRenderer.spawnEntity(entity, x, y, z);
        return { success: true, output: `Summoned ${entity} at ${x}, ${y}, ${z}` };
      }
      return { success: false, output: 'Game renderer not available' };
    });

    // /particle <type> <x> <y> <z> [count] - Spawn particles
    this.registerCommand('particle', async (args, _context) => {
      if (args.length < 4) return { success: false, output: 'Usage: /particle <type> <x> <y> <z> [count]' };
      const type = args[0];
      const x = parseFloat(args[1]), y = parseFloat(args[2]), z = parseFloat(args[3]);
      const count = args[4] ? parseInt(args[4]) : 10;
      // Would spawn particle effects
      return { success: true, output: `Spawned ${count}x ${type} particles at ${x}, ${y}, ${z}` };
    });

    // /explode <x> <y> <z> [power] - Create explosion
    this.registerCommand('explode', async (args, context) => {
      if (args.length < 3) return { success: false, output: 'Usage: /explode <x> <y> <z> [power]' };
      const x = parseFloat(args[0]), y = parseFloat(args[1]), z = parseFloat(args[2]);
      const power = args[3] ? parseFloat(args[3]) : 4;
      if (context.gameRenderer) {
        context.gameRenderer.createExplosion(x, y, z, power);
        return { success: true, output: `Created explosion at ${x}, ${y}, ${z} with power ${power}` };
      }
      return { success: false, output: 'Game renderer not available' };
    });

    // /clone <x1> <y1> <z1> <x2> <y2> <z2> <destX> <destY> <destZ> - Clone region
    this.registerCommand('clone', async (args, context) => {
      if (args.length < 9) {
        return { success: false, output: 'Usage: /clone <x1> <y1> <z1> <x2> <y2> <z2> <destX> <destY> <destZ>' };
      }
      const x1 = parseInt(args[0]), y1 = parseInt(args[1]), z1 = parseInt(args[2]);
      const x2 = parseInt(args[3]), y2 = parseInt(args[4]), z2 = parseInt(args[5]);
      const dx = parseInt(args[6]), dy = parseInt(args[7]), dz = parseInt(args[8]);

      if (context.gameRenderer) {
        const blocks: Array<{x: number, y: number, z: number, type: BlockType}> = [];
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
          for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) {
              const blockType = context.gameRenderer.getBlockAt(x, y, z);
              if (blockType !== BlockType.AIR) {
                blocks.push({
                  x: dx + (x - x1),
                  y: dy + (y - y1),
                  z: dz + (z - z1),
                  type: blockType
                });
              }
            }
          }
        }
        blocks.forEach(b => context.gameRenderer.setBlockAt(b.x, b.y, b.z, b.type));
        return { success: true, output: `Cloned ${blocks.length} blocks` };
      }
      return { success: false, output: 'Game renderer not available' };
    });

    // /say <message> - Send message
    this.registerCommand('say', async (args, _context) => {
      const message = args.join(' ');
      console.log(`[Command] ${message}`);
      return { success: true, output: message };
    });

    // /js <script> - Execute runtime JavaScript against game API
    this.registerCommand('js', async (args, context) => {
      const script = (args[0] ?? '').trim();
      if (!script) return { success: false, output: 'Usage: /js <javascript_code>' };
      if (!context.gameRenderer) return { success: false, output: 'Game renderer not available' };
      try {
        const game = typeof context.gameRenderer.getScriptingAPI === 'function'
          ? context.gameRenderer.getScriptingAPI()
          : context.gameRenderer;
        if (modManager.isSandboxMode()) {
          const result = await executeSandboxedMod(script, game, context);
          if (!result.ok) return { success: false, output: `Sandbox error: ${result.error}` };
          return { success: true, output: `JS executed${result.value !== undefined ? `: ${String(result.value)}` : ''}`, value: result.value };
        }
        const fn = new Function('game', 'context', 'THREE', 'BlockType', 'customizationManager', `"use strict";\n${script}`);
        const value = await Promise.resolve(fn(game, context, THREE, BlockType, customizationManager));
        return { success: true, output: `JS executed${value !== undefined ? `: ${String(value)}` : ''}`, value };
      } catch (error) {
        return { success: false, output: `JS error: ${String(error)}` };
      }
    });

    // /mod <add|run|remove|list> ...
    this.registerCommand('mod', async (args, context) => {
      if (args.length < 1) return { success: false, output: 'Usage: /mod <add|run|remove|list> ...' };
      const action = args[0].toLowerCase();

      if (action === 'list') {
        const names = Array.from(this.runtimeMods.keys());
        return { success: true, output: names.length ? `Mods:\n${names.map(n => `  ${n}`).join('\n')}` : 'No runtime mods registered' };
      }

      if (action === 'remove') {
        const name = args[1];
        if (!name) return { success: false, output: 'Usage: /mod remove <name>' };
        const removed = this.runtimeMods.delete(name);
        return { success: removed, output: removed ? `Removed mod ${name}` : `Mod not found: ${name}` };
      }

      if (action === 'add') {
        const name = args[1];
        const script = args.slice(2).join(' ').trim();
        if (!name || !script) return { success: false, output: 'Usage: /mod add <name> <javascript_code>' };
        this.runtimeMods.set(name, script);
        return { success: true, output: `Registered mod ${name}` };
      }

      if (action === 'run') {
        const name = args[1];
        if (!name) return { success: false, output: 'Usage: /mod run <name>' };
        const script = this.runtimeMods.get(name);
        if (!script) return { success: false, output: `Mod not found: ${name}` };
        return this.execute(`js ${script}`, context);
      }

      return { success: false, output: 'Unknown mod action. Use add/run/remove/list' };
    });

    // /cmdadd <name> <javascript_code> - Add a new command at runtime
    this.registerCommand('cmdadd', async (args, _context) => {
      const name = args[0]?.toLowerCase();
      const script = args.slice(1).join(' ').trim();
      if (!name || !script) return { success: false, output: 'Usage: /cmdadd <name> <javascript_code>' };
      if (this.commands.has(name)) return { success: false, output: `Command already exists: ${name}` };

      this.runtimeCommandScripts.set(name, script);
      this.registerCommand(name, async (cmdArgs, context) => {
        const game = context.gameRenderer?.getScriptingAPI?.() || context.gameRenderer;
        try {
          const fn = new Function('game', 'args', 'context', 'THREE', 'BlockType', 'customizationManager', `"use strict";\n${script}`);
          const value = await Promise.resolve(fn(game, cmdArgs, context, THREE, BlockType, customizationManager));
          return { success: true, output: `${name} executed${value !== undefined ? `: ${String(value)}` : ''}`, value };
        } catch (error) {
          return { success: false, output: `${name} error: ${String(error)}` };
        }
      });

      return { success: true, output: `Registered command /${name}` };
    });

    // /cmdremove <name> - Remove runtime command
    this.registerCommand('cmdremove', async (args, _context) => {
      const name = args[0]?.toLowerCase();
      if (!name) return { success: false, output: 'Usage: /cmdremove <name>' };
      if (!this.runtimeCommandScripts.has(name)) return { success: false, output: `Runtime command not found: ${name}` };
      this.runtimeCommandScripts.delete(name);
      this.commands.delete(name);
      return { success: true, output: `Removed command /${name}` };
    });

    // /blockprop <block> <property> <value> - Override block properties at runtime
    this.registerCommand('blockprop', async (args, _context) => {
      if (args.length < 3) return { success: false, output: 'Usage: /blockprop <block> <property> <value>' };
      const blockName = args[0].toUpperCase();
      const prop = args[1];
      const raw = args.slice(2).join(' ');
      const blockType = BlockType[blockName as keyof typeof BlockType];
      if (blockType === undefined) return { success: false, output: `Unknown block: ${blockName}` };

      let value: any = raw;
      if (raw === 'true') value = true;
      else if (raw === 'false') value = false;
      else if (!Number.isNaN(Number(raw))) value = Number(raw);

      customizationManager.setBlockProperties(blockType, { [prop]: value } as any);
      customizationManager.saveToLocalStorage();
      return { success: true, output: `Set ${blockName}.${prop} = ${String(value)}` };
    });

    // /help - List commands
    this.registerCommand('help', async (_args, _context) => {
      const cmds = Array.from(this.commands.keys()).sort();
      return {
        success: true,
        output: `Available commands:\n${cmds.map(c => `  /${c}`).join('\n')}`
      };
    });
  }
}

type CommandHandler = (args: string[], context: CommandContext) => Promise<CommandResult>;

// Singleton instance
export const commandSystem = new CommandParser();
