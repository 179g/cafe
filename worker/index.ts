// worker/index.ts
// Cafe Sync - Cloudflare Workers + Durable Objects

export interface Env {
  ROOM: DurableObjectNamespace;
  DB: D1Database;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  snack: string | null;
  joinedAt: number;
}

interface RoomState {
  videoId: string | null;
  playlist: string[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  lastSyncAt: number;
  hostId: string | null;
  participants: Record<string, Participant>;
}

type WSMessage =
  | { type: "join"; name: string; userId: string }
  | { type: "leave"; userId: string }
  | { type: "play"; time: number }
  | { type: "pause"; time: number }
  | { type: "seek"; time: number }
  | { type: "add_video"; videoId: string }
  | { type: "next_video" }
  | { type: "prev_video" }
  | { type: "snack"; snack: string }
  | { type: "reaction"; reaction: string }
  | { type: "ping" };

// ─── Durable Object ───────────────────────────────────────────────────────────

export class RoomDO implements DurableObject {
  private sessions: Map<WebSocket, { userId: string; name: string }> = new Map();
  private state: RoomState = {
    videoId: null,
    playlist: [],
    currentIndex: 0,
    isPlaying: false,
    currentTime: 0,
    lastSyncAt: Date.now(),
    hostId: null,
    participants: {},
  };

  constructor(private durableState: DurableObjectState, private env: Env) {
    this.durableState.blockConcurrencyWhile(async () => {
      const stored = await this.durableState.storage.get<RoomState>("state");
      if (stored) this.state = stored;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/websocket") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
      await this.handleSession(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/state") {
      return Response.json(this.state);
    }

    return new Response("Not found", { status: 404 });
  }

  private async handleSession(ws: WebSocket) {
    this.durableState.acceptWebSocket(ws);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const msg: WSMessage = JSON.parse(message as string);
      const session = this.sessions.get(ws);

      switch (msg.type) {
        case "join": {
          const isFirstUser = Object.keys(this.state.participants).length === 0;
          this.sessions.set(ws, { userId: msg.userId, name: msg.name });
          this.state.participants[msg.userId] = {
            id: msg.userId,
            name: msg.name,
            isHost: isFirstUser,
            snack: null,
            joinedAt: Date.now(),
          };
          if (isFirstUser) this.state.hostId = msg.userId;
          await this.persist();
          this.broadcast({ type: "room_state", state: this.state });
          this.broadcastExcept(ws, {
            type: "log",
            text: `${msg.name} が入室しました`,
            emoji: "☕",
          });
          break;
        }

        case "leave": {
          if (!session) break;
          delete this.state.participants[session.userId];
          this.sessions.delete(ws);

          // Re-assign host if needed
          if (this.state.hostId === session.userId) {
            const remaining = Object.keys(this.state.participants);
            this.state.hostId = remaining.length > 0 ? remaining[0] : null;
            if (this.state.hostId) {
              this.state.participants[this.state.hostId].isHost = true;
            }
          }
          await this.persist();
          this.broadcast({ type: "room_state", state: this.state });
          this.broadcast({
            type: "log",
            text: `${session.name} が退室しました`,
            emoji: "👋",
          });
          break;
        }

        case "play": {
          if (!session || this.state.hostId !== session.userId) break;
          this.state.isPlaying = true;
          this.state.currentTime = msg.time;
          this.state.lastSyncAt = Date.now();
          await this.persist();
          this.broadcastExcept(ws, { type: "play", time: msg.time });
          break;
        }

        case "pause": {
          if (!session || this.state.hostId !== session.userId) break;
          this.state.isPlaying = false;
          this.state.currentTime = msg.time;
          this.state.lastSyncAt = Date.now();
          await this.persist();
          this.broadcastExcept(ws, { type: "pause", time: msg.time });
          break;
        }

        case "seek": {
          if (!session || this.state.hostId !== session.userId) break;
          this.state.currentTime = msg.time;
          this.state.lastSyncAt = Date.now();
          await this.persist();
          this.broadcastExcept(ws, { type: "seek", time: msg.time });
          break;
        }

        case "add_video": {
          if (!session) break;
          if (!this.state.playlist.includes(msg.videoId)) {
            this.state.playlist.push(msg.videoId);
            if (!this.state.videoId) {
              this.state.videoId = msg.videoId;
              this.state.currentIndex = 0;
            }
            await this.persist();
            this.broadcast({ type: "room_state", state: this.state });
          }
          break;
        }

        case "next_video": {
          if (!session || this.state.hostId !== session.userId) break;
          const next = this.state.currentIndex + 1;
          if (next < this.state.playlist.length) {
            this.state.currentIndex = next;
            this.state.videoId = this.state.playlist[next];
            this.state.currentTime = 0;
            this.state.isPlaying = true;
            await this.persist();
            this.broadcast({ type: "room_state", state: this.state });
          }
          break;
        }

        case "prev_video": {
          if (!session || this.state.hostId !== session.userId) break;
          const prev = this.state.currentIndex - 1;
          if (prev >= 0) {
            this.state.currentIndex = prev;
            this.state.videoId = this.state.playlist[prev];
            this.state.currentTime = 0;
            this.state.isPlaying = true;
            await this.persist();
            this.broadcast({ type: "room_state", state: this.state });
          }
          break;
        }

        case "snack": {
          if (!session) break;
          this.state.participants[session.userId].snack = msg.snack;
          await this.persist();
          this.broadcast({ type: "room_state", state: this.state });
          this.broadcast({
            type: "log",
            text: `${session.name} が ${msg.snack} を注文しました`,
            emoji: "🍭",
          });
          break;
        }

        case "reaction": {
          if (!session) break;
          this.broadcast({
            type: "reaction",
            userId: session.userId,
            name: session.name,
            reaction: msg.reaction,
          });
          break;
        }

        case "ping": {
          ws.send(JSON.stringify({ type: "pong" }));
          break;
        }
      }
    } catch (e) {
      console.error("WS message error:", e);
    }
  }

  async webSocketClose(ws: WebSocket) {
    const session = this.sessions.get(ws);
    if (!session) return;
    delete this.state.participants[session.userId];
    this.sessions.delete(ws);
    if (this.state.hostId === session.userId) {
      const remaining = Object.keys(this.state.participants);
      this.state.hostId = remaining.length > 0 ? remaining[0] : null;
      if (this.state.hostId) this.state.participants[this.state.hostId].isHost = true;
    }
    await this.persist();
    this.broadcast({ type: "room_state", state: this.state });
    this.broadcast({ type: "log", text: `${session.name} が切断しました`, emoji: "📴" });
  }

  private broadcast(data: object) {
    const msg = JSON.stringify(data);
    for (const [ws] of this.sessions) {
      try { ws.send(msg); } catch {}
    }
  }

  private broadcastExcept(exclude: WebSocket, data: object) {
    const msg = JSON.stringify(data);
    for (const [ws] of this.sessions) {
      if (ws !== exclude) {
        try { ws.send(msg); } catch {}
      }
    }
  }

  private async persist() {
    await this.durableState.storage.put("state", this.state);
  }
}

// ─── Main Worker ──────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Room WebSocket: /api/room/:code/ws
    const wsMatch = url.pathname.match(/^\/api\/room\/([A-Z0-9]{4})\/ws$/);
    if (wsMatch) {
      const code = wsMatch[1];
      const id = env.ROOM.idFromName(code);
      const stub = env.ROOM.get(id);
      return stub.fetch(new Request(url.origin + "/websocket", request));
    }

    // Room state: /api/room/:code/state
    const stateMatch = url.pathname.match(/^\/api\/room\/([A-Z0-9]{4})\/state$/);
    if (stateMatch) {
      const code = stateMatch[1];
      const id = env.ROOM.idFromName(code);
      const stub = env.ROOM.get(id);
      const res = await stub.fetch(new Request(url.origin + "/state"));
      return new Response(res.body, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create room: POST /api/rooms
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const code = generateCode();
      return Response.json({ code }, { headers: corsHeaders });
    }

    return new Response("Not found", { status: 404 });
  },
};

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
