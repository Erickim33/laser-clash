/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { MultiplayerEngine, PLAYER_COLORS } from './src/server/MultiplayerEngine';
import { ClientMessage, ServerMessage } from './src/types/multiplayer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Active battle rooms (2-12 players per room)
const rooms: Map<string, MultiplayerEngine> = new Map();

function getOrCreateRoom(roomId = 'nexus-arena'): MultiplayerEngine {
  let room = rooms.get(roomId);
  if (!room) {
    room = new MultiplayerEngine(roomId, 'Apex Laser Nexus');
    rooms.set(roomId, room);
  }
  return room;
}

// WebSocket handler
wss.on('connection', (ws: WebSocket) => {
  let currentRoomId: string | null = null;
  let playerId: string | null = null;

  ws.on('message', (rawData: string) => {
    try {
      const msg: ClientMessage = JSON.parse(rawData.toString());

      if (msg.type === 'join') {
        const targetRoomId = (msg.roomId || 'nexus-arena').trim().toLowerCase();
        currentRoomId = targetRoomId;
        playerId = `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        const room = getOrCreateRoom(targetRoomId);

        // Check if room is full (12 players max)
        const currentCount = room.getSnapshot().totalPlayers;
        if (currentCount >= 12) {
          const err: ServerMessage = { type: 'error', message: 'Room has reached maximum capacity (12 players).' };
          ws.send(JSON.stringify(err));
          return;
        }

        // Add real player
        const preferredColor = msg.color || PLAYER_COLORS[currentCount % PLAYER_COLORS.length];
        const assignedPlayer = room.addClient(playerId, msg.name || 'Operative', preferredColor, ws, false);

        // If bots requested to fill lobby to target count (2-12 players)
        if (msg.fillBots) {
          const target = Math.min(12, Math.max(2, msg.targetCount || 8));
          room.fillBotsUpTo(target);
        }

        // Send init confirmation
        const initMsg: ServerMessage = {
          type: 'init',
          playerId: assignedPlayer.id,
          roomId: room.roomId,
          isHost: currentCount === 0,
          obstacles: room.getSnapshot().obstacles,
        };
        ws.send(JSON.stringify(initMsg));
      } else if (msg.type === 'input') {
        if (currentRoomId && playerId) {
          const room = rooms.get(currentRoomId);
          if (room) {
            room.handleInput(playerId, msg.input);
          }
        }
      } else if (msg.type === 'start_match') {
        if (currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room) {
            room.startMatch();
          }
        }
      } else if (msg.type === 'ping') {
        const pong: ServerMessage = {
          type: 'pong',
          clientTime: msg.clientTime,
          serverTime: Date.now(),
        };
        ws.send(JSON.stringify(pong));
      }
    } catch {
      // Ignore malformed packets safely
    }
  });

  ws.on('close', () => {
    if (currentRoomId && playerId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.removeClient(playerId);
      }
    }
  });
});

// REST routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: Date.now(), activeRooms: rooms.size });
});

app.get('/api/download-zip', (_req, res) => {
  const zipFile = path.join(__dirname, 'laser-clash-game.zip');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="laser-clash-game.zip"');
  res.setHeader('Content-Transfer-Encoding', 'binary');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(zipFile, (err) => {
    if (err && !res.headersSent) {
      res.status(500).send('Error downloading zip file');
    }
  });
});

app.get('/api/rooms', (_req, res) => {
  const roomSummaries = Array.from(rooms.values()).map((r) => {
    const snap = r.getSnapshot();
    return {
      id: r.roomId,
      name: r.roomName,
      phase: snap.phase,
      aliveCount: snap.aliveCount,
      totalPlayers: snap.totalPlayers,
      isHardcore: r.isHardcore,
    };
  });
  res.json({ rooms: roomSummaries });
});

// Vite Middleware Integration
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const PORT = process.env.PORT || 3000;

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`[LASER CLASH] Server running on port ${PORT}`);
  });
}

startServer();
