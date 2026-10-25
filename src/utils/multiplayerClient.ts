/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientMessage, GameStateSnapshot, PlayerInput, ServerMessage } from '../types/multiplayer';

export type StateListener = (snapshot: GameStateSnapshot) => void;
export type EliminatedListener = (data: { killerName?: string; rank: number; stats: { kills: number; damage: number; time: number } }) => void;
export type InitListener = (playerId: string, isHost: boolean) => void;
export type ErrorListener = (error: string) => void;

class MultiplayerClient {
  private ws: WebSocket | null = null;
  public playerId: string | null = null;
  public isHost: boolean = false;
  public ping: number = 0;

  private stateListeners: Set<StateListener> = new Set();
  private eliminatedListeners: Set<EliminatedListener> = new Set();
  private initListeners: Set<InitListener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();

  private pingInterval: NodeJS.Timeout | null = null;

  public connect(
    name: string,
    color: string,
    roomId = 'nexus-arena',
    fillBots = false,
    targetCount = 8
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.disconnect();

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        this.ws = ws;

        ws.onopen = () => {
          const joinMsg: ClientMessage = {
            type: 'join',
            name,
            color,
            roomId,
            fillBots,
            targetCount,
          };
          this.send(joinMsg);

          // Start ping cycle
          this.startPing();
        };

        ws.onmessage = (event) => {
          try {
            const msg: ServerMessage = JSON.parse(event.data);

            if (msg.type === 'init') {
              this.playerId = msg.playerId;
              this.isHost = msg.isHost;
              this.initListeners.forEach((cb) => cb(msg.playerId, msg.isHost));
              resolve(msg.playerId);
            } else if (msg.type === 'state') {
              this.stateListeners.forEach((cb) => cb(msg.snapshot));
            } else if (msg.type === 'eliminated') {
              this.eliminatedListeners.forEach((cb) => cb(msg));
            } else if (msg.type === 'pong') {
              this.ping = Math.max(1, Math.round(Date.now() - msg.clientTime));
            } else if (msg.type === 'error') {
              this.errorListeners.forEach((cb) => cb(msg.message));
            }
          } catch {
            // Safe JSON parse error handling
          }
        };

        ws.onerror = () => {
          this.errorListeners.forEach((cb) => cb('Failed to connect to multiplayer server'));
          reject(new Error('Failed to connect to multiplayer server'));
        };

        ws.onclose = () => {
          this.stopPing();
        };
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Connection failed'));
      }
    });
  }

  public sendInput(input: PlayerInput) {
    this.send({ type: 'input', input });
  }

  public startMatch() {
    this.send({ type: 'start_match' });
  }

  private send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping', clientTime: Date.now() });
    }, 2000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public disconnect() {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.playerId = null;
    this.isHost = false;
  }

  public onState(cb: StateListener) {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  public onEliminated(cb: EliminatedListener) {
    this.eliminatedListeners.add(cb);
    return () => this.eliminatedListeners.delete(cb);
  }

  public onInit(cb: InitListener) {
    this.initListeners.add(cb);
    return () => this.initListeners.delete(cb);
  }

  public onError(cb: ErrorListener) {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }
}

export const multiplayerClient = new MultiplayerClient();
