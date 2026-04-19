import { REDIS_KEYS, type Track } from '@wesbot/shared';
import type Redis from 'ioredis';

import type { GuildMusicSession } from '../../domain/music/session';
import type { Logger } from '../../logger';

const TTL_SECONDS = 60 * 60 * 24; // drop stale queues after a day

interface PersistedQueue {
  v: 1;
  guildId: string;
  voiceChannelId: string | null;
  textChannelId: string | null;
  current: Track | null;
  queue: Track[];
  history: Track[];
  loop: 'off' | 'track' | 'queue';
  volume: number;
  autoplay: boolean;
}

/**
 * Mirrors each guild's session into Redis so a bot restart can resume the
 * queue from where it left off. We store the full session snapshot (not a
 * diff) — queues are small enough that one SET per mutation is cheap, and
 * simpler than tracking deltas.
 */
export class QueuePersistence {
  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  async save(session: GuildMusicSession): Promise<void> {
    const key = REDIS_KEYS.guildQueue(session.guildId);
    const snapshot: PersistedQueue = {
      v: 1,
      guildId: session.guildId,
      voiceChannelId: session.voiceChannelId,
      textChannelId: session.textChannelId,
      current: session.current,
      queue: [...session.queue],
      history: [...session.history],
      loop: session.loop,
      volume: session.volume,
      autoplay: session.autoplay,
    };
    try {
      await this.redis.set(key, JSON.stringify(snapshot), 'EX', TTL_SECONDS);
    } catch (err) {
      this.logger.warn({ err, guildId: session.guildId }, 'queue persist failed');
    }
  }

  async drop(guildId: string): Promise<void> {
    try {
      await this.redis.del(REDIS_KEYS.guildQueue(guildId));
    } catch (err) {
      this.logger.warn({ err, guildId }, 'queue drop failed');
    }
  }

  async load(guildId: string): Promise<PersistedQueue | null> {
    try {
      const raw = await this.redis.get(REDIS_KEYS.guildQueue(guildId));
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as PersistedQueue;
      if (parsed.v !== 1) {
        return null;
      }
      return parsed;
    } catch (err) {
      this.logger.warn({ err, guildId }, 'queue load failed');
      return null;
    }
  }

  async listGuilds(): Promise<string[]> {
    const guilds: string[] = [];
    const stream = this.redis.scanStream({ match: 'queue:*', count: 100 });
    for await (const batch of stream) {
      for (const key of batch as string[]) {
        const guildId = key.slice('queue:'.length);
        if (guildId) {
          guilds.push(guildId);
        }
      }
    }
    return guilds;
  }
}
