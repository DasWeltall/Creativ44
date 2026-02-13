// Creativ44 Example Overhaul Mod
// Use via Settings -> Mods -> Import (.js) or paste into editor and run.

const p = game.getPlayerPos();

// 1) World mood
game.setGameMode('creative');
game.setTime(17500);
game.setWeather('storm');

// 2) Build a huge arena around the player
const cx = Math.floor(p.x);
const cy = Math.floor(p.y);
const cz = Math.floor(p.z);
const B = game.blockEnum;

// Floor
game.fill(cx - 28, cy - 2, cz - 28, cx + 28, cy - 2, cz + 28, B.OBSIDIAN);

// Walls
game.fill(cx - 28, cy - 1, cz - 28, cx - 28, cy + 12, cz + 28, B.QUARTZ_BLOCK);
game.fill(cx + 28, cy - 1, cz - 28, cx + 28, cy + 12, cz + 28, B.QUARTZ_BLOCK);
game.fill(cx - 28, cy - 1, cz - 28, cx + 28, cy + 12, cz - 28, B.QUARTZ_BLOCK);
game.fill(cx - 28, cy - 1, cz + 28, cx + 28, cy + 12, cz + 28, B.QUARTZ_BLOCK);

// Light pillars
for (let x = cx - 24; x <= cx + 24; x += 12) {
  for (let z = cz - 24; z <= cz + 24; z += 12) {
    game.fill(x, cy - 1, z, x, cy + 10, z, B.GLOWSTONE);
  }
}

// 3) Functional edits
game.execute('blockprop GLASS transparent true');
game.execute('blockprop OBSIDIAN hardness 5');

// 4) Spawn some entities
game.summon('cow', cx + 4, cy, cz + 4);
game.summon('pig', cx - 5, cy, cz - 3);

