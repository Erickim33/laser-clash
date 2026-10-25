/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LogEntry } from '../types/game';

const MAX_LOG_ENTRIES = 100;
const STORAGE_KEY = 'laser_clash_logs';

class LoggerService {
  private logs: LogEntry[] = [];
  private sessionId: string;

  constructor() {
    this.sessionId = 'lc_sess_' + Math.random().toString(36).substring(2, 9);
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.logs = JSON.parse(raw);
      }
    } catch {
      this.logs = [];
    }
  }

  private saveToStorage() {
    try {
      if (this.logs.length > MAX_LOG_ENTRIES) {
        this.logs = this.logs.slice(-MAX_LOG_ENTRIES);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
    } catch {
      // Storage quota safe
    }
  }

  public log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    this.logs.push(entry);
    this.saveToStorage();
  }

  public info(message: string, data?: Record<string, unknown>) {
    this.log('info', message, data);
  }

  public warn(message: string, data?: Record<string, unknown>) {
    this.log('warn', message, data);
  }

  public error(message: string, data?: Record<string, unknown>) {
    this.log('error', message, data);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  public generateDiagnosticReport(): string {
    const report = {
      sessionId: this.sessionId,
      reportGenerated: new Date().toISOString(),
      platform: {
        userAgent: navigator.userAgent,
        screen: `${window.innerWidth}x${window.innerHeight} (pixelRatio: ${window.devicePixelRatio || 1})`,
        touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        standalone: (window.navigator as unknown as { standalone?: boolean }).standalone || false,
      },
      recentLogs: this.logs.slice(-30),
    };

    return JSON.stringify(report, null, 2);
  }
}

export const logger = new LoggerService();
