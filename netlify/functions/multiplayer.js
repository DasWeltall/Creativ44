const memory = new Map();
const memoryIndex = {};

let blobsStorePromise = null;
async function getBlobStore() {
  if (blobsStorePromise) return blobsStorePromise;
  blobsStorePromise = (async () => {
    try {
      const mod = await import('@netlify/blobs');
      if (typeof mod.getStore !== 'function') return null;
      return mod.getStore('creativ44-multiplayer');
    } catch {
      return null;
    }
  })();
  return blobsStorePromise;
}

async function kvGet(key) {
  const store = await getBlobStore();
  if (!store) return memory.has(key) ? memory.get(key) : null;
  const v = await store.get(key);
  return v ?? null;
}

async function kvSet(key, value) {
  const store = await getBlobStore();
  if (!store) {
    memory.set(key, value);
    return;
  }
  await store.set(key, value);
}

async function kvDelete(key) {
  const store = await getBlobStore();
  if (!store) {
    memory.delete(key);
    return;
  }
  await store.delete(key);
}

async function readRoomIndex() {
  const raw = await kvGet('rooms:index');
  if (!raw) return { ...memoryIndex };
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

async function writeRoomIndex(index) {
  await kvSet('rooms:index', JSON.stringify(index));
}

function roomKey(code) {
  return `room:${code}`;
}

async function readRoom(code) {
  const raw = await kvGet(roomKey(code));
  if (!raw) return null;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

async function writeRoom(room) {
  await kvSet(roomKey(room.code), JSON.stringify(room));
  const idx = await readRoomIndex();
  idx[room.code] = room.updatedAt;
  await writeRoomIndex(idx);
}

async function deleteRoom(code) {
  await kvDelete(roomKey(code));
  const idx = await readRoomIndex();
  delete idx[code];
  await writeRoomIndex(idx);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
    body: JSON.stringify(body),
  };
}

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

function roomCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function cleanupRooms() {
  const now = Date.now();
  const idx = await readRoomIndex();
  for (const code of Object.keys(idx)) {
    const room = await readRoom(code);
    if (!room) {
      delete idx[code];
      continue;
    }
    if (now - room.updatedAt > 1000 * 60 * 60 * 4) {
      await deleteRoom(code);
      continue;
    }
    let changed = false;
    for (const pid of Object.keys(room.players || {})) {
      const p = room.players[pid];
      if (!p || now - p.lastSeen > 1000 * 60 * 2) {
        delete room.players[pid];
        changed = true;
      }
    }
    if (changed) {
      room.updatedAt = now;
      await writeRoom(room);
    }
  }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  await cleanupRooms();

  try {
    if (event.httpMethod === 'GET') {
      const qs = event.queryStringParameters || {};
      if (qs.action !== 'pull') return json(400, { ok: false, error: 'Unknown action' });
      const code = String(qs.roomCode || '').toUpperCase();
      const playerId = String(qs.playerId || '');
      const sinceSeq = Number(qs.sinceSeq || 0);
      const room = await readRoom(code);
      if (!room) return json(404, { ok: false, error: 'Room not found' });
      if (!room.players?.[playerId]) return json(403, { ok: false, error: 'Not in room' });

      const players = Object.values(room.players || {}).map((p) => p.state);
      const events = room.events.filter((e) => e.seq > sinceSeq);
      return json(200, {
        ok: true,
        players,
        events,
        animals: room.animals || [],
        latestSeq: room.lastSeq,
        world: room.world,
      });
    }

    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
    const body = JSON.parse(event.body || '{}');
    const action = String(body.action || '');

    if (action === 'create') {
      const name = String(body.name || 'Host');
      const world = body.world || { seed: 12345, worldType: 'normal' };
      let code = roomCode();
      while (await readRoom(code)) code = roomCode();
      const playerId = rid();
      const room = {
        code,
        hostId: playerId,
        world: {
          seed: Number.isFinite(world.seed) ? Math.floor(world.seed) : 12345,
          worldType: world.worldType === 'flat' ? 'flat' : 'normal',
        },
        players: {},
        events: [],
        lastSeq: 0,
        animals: [],
        updatedAt: Date.now(),
      };
      room.players[playerId] = {
        id: playerId,
        name,
        lastSeen: Date.now(),
        state: { id: playerId, name, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
      };
      await writeRoom(room);
      return json(200, { ok: true, roomCode: code, playerId, world: room.world });
    }

    if (action === 'join') {
      const code = String(body.roomCode || '').toUpperCase();
      const name = String(body.name || 'Player');
      const room = await readRoom(code);
      if (!room) return json(404, { ok: false, error: 'Room not found' });
      const playerId = rid();
      room.players[playerId] = {
        id: playerId,
        name,
        lastSeen: Date.now(),
        state: { id: playerId, name, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
      };
      room.updatedAt = Date.now();
      await writeRoom(room);
      return json(200, { ok: true, roomCode: code, playerId, world: room.world });
    }

    if (action === 'leave') {
      const code = String(body.roomCode || '').toUpperCase();
      const playerId = String(body.playerId || '');
      const room = await readRoom(code);
      if (!room) return json(200, { ok: true });
      delete room.players[playerId];
      room.updatedAt = Date.now();
      if (Object.keys(room.players || {}).length === 0) await deleteRoom(code);
      else await writeRoom(room);
      return json(200, { ok: true });
    }

    if (action === 'push') {
      const code = String(body.roomCode || '').toUpperCase();
      const playerId = String(body.playerId || '');
      const room = await readRoom(code);
      if (!room) return json(404, { ok: false, error: 'Room not found' });
      const player = room.players?.[playerId];
      if (!player) return json(403, { ok: false, error: 'Not in room' });

      if (body.player && typeof body.player === 'object') {
        player.state = {
          ...body.player,
          id: playerId,
          name: player.name,
        };
      }
      player.lastSeen = Date.now();

      const events = Array.isArray(body.events) ? body.events : [];
      for (const ev of events) {
        room.lastSeq += 1;
        room.events.push({
          seq: room.lastSeq,
          authorId: playerId,
          x: Math.floor(Number(ev.x || 0)),
          y: Math.floor(Number(ev.y || 0)),
          z: Math.floor(Number(ev.z || 0)),
          type: Number(ev.type || 0),
        });
      }
      if (room.events.length > 50000) {
        room.events = room.events.slice(room.events.length - 50000);
      }

      if (playerId === room.hostId && Array.isArray(body.animals)) {
        room.animals = body.animals.slice(0, 128).map((a) => ({
          x: Number(a.x || 0),
          y: Number(a.y || 0),
          z: Number(a.z || 0),
        }));
      }

      room.updatedAt = Date.now();
      await writeRoom(room);
      return json(200, { ok: true, latestSeq: room.lastSeq });
    }

    return json(400, { ok: false, error: 'Unknown action' });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
}
