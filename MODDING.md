# Creativ44 Modding Guide

This project supports runtime mods via:

- Settings -> `Mods` tab (import/export/run)
- Commands (`/js`, `/mod`, `/cmdadd`, `/blockprop`)
- Global API in browser console: `window.Creativ44`

## 1. Modpack format

Use JSON with this structure:

```json
{
  "format": "creativ44-modpack-v1",
  "name": "My Pack",
  "mods": [
    {
      "id": "optional-id",
      "name": "SkyTweaks",
      "description": "Simple weather/time setup",
      "code": "game.setWeather('rain'); game.setTime(18000);",
      "enabled": true
    }
  ]
}
```

You can also import plain `.js` files. They are added as single mods.

## 2. Runtime commands

- `/js <javascript>`: Execute JS with game API
- `/mod add <name> <javascript>`: Store a named mod
- `/mod run <name>`: Execute stored mod
- `/mod list`: List stored mods
- `/mod remove <name>`: Remove stored mod
- `/cmdadd <name> <javascript>`: Add new command dynamically
- `/cmdremove <name>`: Remove runtime command
- `/blockprop <BLOCK> <property> <value>`: Override block behavior

## 3. JS API (`game`)

Available inside `/js` and mods:

- `game.getPlayerPos()`
- `game.teleport(x,y,z)`
- `game.getBlock(x,y,z)`
- `game.setBlock(x,y,z, blockType)`
- `game.fill(x1,y1,z1,x2,y2,z2, blockType)`
- `game.clone(x1,y1,z1,x2,y2,z2, dx,dy,dz)`
- `game.explode(x,y,z,power?)`
- `game.setTime(value)`
- `game.setWeather('clear'|'rain'|'snow'|'storm')`
- `game.setGameMode('creative'|'survival')`
- `game.summon(entity,x,y,z)`
- `game.execute('command string')`
- `game.registerCommand(name, async (args, ctx) => ({ success, output }))`
- `game.blockEnum` (all `BlockType` values)

## 4. Browser console API

When a world is running:

```js
window.Creativ44
```

This exposes the same API as `game`.

## 5. Example quick scripts

Night storm:

```js
game.setTime(18000);
game.setWeather('storm');
```

Huge platform:

```js
const p = game.getPlayerPos();
game.fill(
  Math.floor(p.x) - 20, Math.floor(p.y) - 1, Math.floor(p.z) - 20,
  Math.floor(p.x) + 20, Math.floor(p.y) - 1, Math.floor(p.z) + 20,
  game.blockEnum.IRON_BLOCK
);
```

Add a custom command:

```js
game.registerCommand('skybase', async () => {
  const p = game.getPlayerPos();
  game.teleport(Math.floor(p.x), 180, Math.floor(p.z));
  return { success: true, output: 'Teleported to skybase' };
});
```

