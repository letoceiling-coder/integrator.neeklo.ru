import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { OAuthApiLogEntry } from '@neeklo/contracts';

/** In-memory ring buffer of recent OAuth-related API calls (debug console). */
@Injectable()
export class OAuthApiConsoleService {
  private readonly entries: OAuthApiLogEntry[] = [];
  private readonly maxEntries = 200;

  log(entry: Omit<OAuthApiLogEntry, 'id' | 'at'>): OAuthApiLogEntry {
    const row: OAuthApiLogEntry = {
      id: uuid(),
      at: new Date().toISOString(),
      ...entry,
    };
    this.entries.unshift(row);
    if (this.entries.length > this.maxEntries) this.entries.pop();
    return row;
  }

  list(limit = 50): OAuthApiLogEntry[] {
    return this.entries.slice(0, limit);
  }

  clear(): void {
    this.entries.length = 0;
  }

  errorCountSince(sinceMs: number): number {
    const since = Date.now() - sinceMs;
    return this.entries.filter((e) => e.status >= 400 && new Date(e.at).getTime() >= since).length;
  }
}
