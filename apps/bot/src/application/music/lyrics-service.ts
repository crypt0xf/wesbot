import type { Logger } from '../../logger';
import { UserFacingError } from '../../types';

const LRCLIB_BASE = 'https://lrclib.net/api';
const USER_AGENT = 'wesbot (https://github.com/archwes96/wesbot)';

export interface LyricsResult {
  title: string;
  artist: string;
  plainLyrics: string;
}

interface LrclibRecord {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string | null;
  duration?: number | null;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
  instrumental?: boolean;
}

/**
 * Thin client for https://lrclib.net — public, key-less lyrics index. Handles
 * both the targeted `/api/get` lookup (exact track match) and `/api/search`
 * fallback when the caller only has a free-text query.
 */
export class LyricsService {
  constructor(private readonly logger: Logger) {}

  async lookup(input: {
    title: string;
    artist: string;
    durationMs?: number;
  }): Promise<LyricsResult | null> {
    const params = new URLSearchParams({
      artist_name: input.artist,
      track_name: input.title,
    });
    if (typeof input.durationMs === 'number' && input.durationMs > 0) {
      params.set('duration', String(Math.round(input.durationMs / 1000)));
    }
    const record = await this.fetchJson<LrclibRecord | null>(
      `${LRCLIB_BASE}/get?${params.toString()}`,
    );
    if (!record) {
      return this.searchFallback(`${input.artist} ${input.title}`);
    }
    return recordToResult(record);
  }

  async search(query: string): Promise<LyricsResult | null> {
    return this.searchFallback(query);
  }

  private async searchFallback(query: string): Promise<LyricsResult | null> {
    const params = new URLSearchParams({ q: query });
    const results = await this.fetchJson<LrclibRecord[] | null>(
      `${LRCLIB_BASE}/search?${params.toString()}`,
    );
    if (!results || results.length === 0) {
      return null;
    }
    for (const record of results) {
      const mapped = recordToResult(record);
      if (mapped) {
        return mapped;
      }
    }
    return null;
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, accept: 'application/json' },
      });
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new UserFacingError(`lrclib ${res.status}`, 'errors.music.lyricsError', {
          message: res.statusText,
        });
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof UserFacingError) {
        throw err;
      }
      this.logger.warn({ err, url }, 'lrclib fetch failed');
      throw new UserFacingError('lrclib fetch failed', 'errors.music.lyricsError', {
        message: (err as Error).message ?? 'network',
      });
    }
  }
}

function recordToResult(record: LrclibRecord): LyricsResult | null {
  if (record.instrumental) {
    return null;
  }
  const plain = record.plainLyrics?.trim();
  if (!plain) {
    return null;
  }
  return { title: record.trackName, artist: record.artistName, plainLyrics: plain };
}
