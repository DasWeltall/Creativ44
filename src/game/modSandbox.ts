import * as THREE from 'three';
import { BlockType } from './constants';
import { customizationManager } from './customization';

const BLOCKED_PATTERNS = [
  /(?:^|[^.\w])(window|document|globalThis|self)(?:[^\w]|$)/,
  /\b(?:eval|Function|importScripts|XMLHttpRequest|WebSocket|Worker|SharedWorker)\b/,
  /\b(?:localStorage|sessionStorage|indexedDB|navigator|location|history)\b/,
];

export interface SandboxResult {
  ok: boolean;
  value?: any;
  error?: string;
}

export async function executeSandboxedMod(code: string, gameApi: any, context?: any): Promise<SandboxResult> {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(code)) {
      return { ok: false, error: `Blocked by sandbox rule: ${pattern}` };
    }
  }

  try {
    const runner = new Function(
      'game',
      'context',
      'THREE',
      'BlockType',
      'customizationManager',
      '"use strict";\n' +
      // Shadow common escape hatches.
      'const window=undefined, document=undefined, globalThis=undefined, self=undefined;\n' +
      'const fetch=undefined, XMLHttpRequest=undefined, WebSocket=undefined;\n' +
      'const localStorage=undefined, sessionStorage=undefined, indexedDB=undefined;\n' +
      'return (async () => { ' + code + ' })();'
    );
    const value = await runner(gameApi, context, THREE, BlockType, customizationManager);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

