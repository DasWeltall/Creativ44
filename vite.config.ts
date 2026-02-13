import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function multiplayerDevPlugin() {
  const rooms = new Map<string, any>();
  const rid = () => Math.random().toString(36).slice(2, 10);
  const roomCode = () => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };
  const send = (res: any, status: number, payload: any) => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(payload));
  };

  return {
    name: "multiplayer-dev-api",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || "";
        if (!url.startsWith("/.netlify/functions/multiplayer") && !url.startsWith("/netlify/functions/multiplayer")) {
          return next();
        }

        if (req.method === "GET") {
          const u = new URL(`http://localhost${url}`);
          const action = u.searchParams.get("action");
          if (action !== "pull") return send(res, 400, { ok: false, error: "Unknown action" });
          const code = (u.searchParams.get("roomCode") || "").toUpperCase();
          const playerId = u.searchParams.get("playerId") || "";
          const sinceSeq = Number(u.searchParams.get("sinceSeq") || "0");
          const room = rooms.get(code);
          if (!room) return send(res, 404, { ok: false, error: "Room not found" });
          if (!room.players[playerId]) return send(res, 403, { ok: false, error: "Not in room" });
          return send(res, 200, {
            ok: true,
            players: Object.values(room.players).map((p: any) => p.state),
            events: room.events.filter((e: any) => e.seq > sinceSeq),
            animals: room.animals || [],
            latestSeq: room.lastSeq || 0,
            world: room.world,
          });
        }

        if (req.method !== "POST") return send(res, 405, { ok: false, error: "Method not allowed" });
        let raw = "";
        req.on("data", (c: Buffer) => { raw += c.toString("utf8"); });
        req.on("end", () => {
          let body: any = {};
          try { body = raw ? JSON.parse(raw) : {}; } catch { return send(res, 400, { ok: false, error: "Invalid JSON" }); }
          const action = String(body.action || "");

          if (action === "create") {
            const name = String(body.name || "Host");
            const world = body.world || { seed: 12345, worldType: "normal" };
            let code = roomCode();
            while (rooms.has(code)) code = roomCode();
            const playerId = rid();
            const room = {
              code,
              hostId: playerId,
              world: { seed: Number(world.seed) || 12345, worldType: world.worldType === "flat" ? "flat" : "normal" },
              players: {} as Record<string, any>,
              events: [] as any[],
              lastSeq: 0,
              animals: [] as any[],
            };
            room.players[playerId] = { id: playerId, name, lastSeen: Date.now(), state: { id: playerId, name, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 } };
            rooms.set(code, room);
            return send(res, 200, { ok: true, roomCode: code, playerId, world: room.world });
          }

          if (action === "join") {
            const code = String(body.roomCode || "").toUpperCase();
            const name = String(body.name || "Player");
            const room = rooms.get(code);
            if (!room) return send(res, 404, { ok: false, error: "Room not found" });
            const playerId = rid();
            room.players[playerId] = { id: playerId, name, lastSeen: Date.now(), state: { id: playerId, name, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 } };
            return send(res, 200, { ok: true, roomCode: code, playerId, world: room.world });
          }

          if (action === "leave") {
            const code = String(body.roomCode || "").toUpperCase();
            const playerId = String(body.playerId || "");
            const room = rooms.get(code);
            if (room) {
              delete room.players[playerId];
              if (Object.keys(room.players).length === 0) rooms.delete(code);
            }
            return send(res, 200, { ok: true });
          }

          if (action === "push") {
            const code = String(body.roomCode || "").toUpperCase();
            const playerId = String(body.playerId || "");
            const room = rooms.get(code);
            if (!room) return send(res, 404, { ok: false, error: "Room not found" });
            const player = room.players[playerId];
            if (!player) return send(res, 403, { ok: false, error: "Not in room" });
            if (body.player) {
              player.state = { ...body.player, id: playerId, name: player.name };
              player.lastSeen = Date.now();
            }
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
            if (room.events.length > 50000) room.events = room.events.slice(room.events.length - 50000);
            if (playerId === room.hostId && Array.isArray(body.animals)) {
              room.animals = body.animals.slice(0, 128).map((a: any) => ({ x: Number(a.x || 0), y: Number(a.y || 0), z: Number(a.z || 0) }));
            }
            return send(res, 200, { ok: true, latestSeq: room.lastSeq });
          }

          return send(res, 400, { ok: false, error: "Unknown action" });
        });
      });
    },
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss(), multiplayerDevPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // Don't use publicDir — assets are at project root and need a post-build copy
  publicDir: false,
  build: {
    outDir: "dist",
  },
});
