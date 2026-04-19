import type { Guild, PrismaClient } from '@wesbot/database';

import type { Logger } from '../../logger';

/**
 * Shape exposed to the rest of the bot. `id` is kept as string for ease of
 * comparison against discord.js snowflakes; Prisma stores it as BigInt.
 */
export interface GuildConfig {
  id: string;
  djRoleId: string | null;
  musicChannelId: string | null;
  announceNowPlaying: boolean;
  twentyFourSeven: boolean;
  autoDisconnectMinutes: number | null;
  defaultVolume: number;
  voteSkipThreshold: number;
  locale: string;
}

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  value: GuildConfig;
  expiresAt: number;
}

/**
 * Reads/writes per-guild configuration rows and serves them through a short
 * in-memory TTL cache so hot paths (voice gate, voteskip, smart disconnect)
 * don't hit Postgres on every interaction.
 *
 * Rows are lazily upserted the first time a guild asks for its config — so
 * the bot never fails because a row doesn't exist yet.
 */
export class GuildConfigService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  async get(guildId: string): Promise<GuildConfig> {
    const cached = this.cache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    const row = await this.prisma.guild.upsert({
      where: { id: BigInt(guildId) },
      create: { id: BigInt(guildId) },
      update: {},
    });
    const value = toConfig(row);
    this.cache.set(guildId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  async update(guildId: string, patch: Partial<Omit<GuildConfig, 'id'>>): Promise<GuildConfig> {
    const data: Record<string, unknown> = {};
    if ('djRoleId' in patch) {
      data.djRoleId = patch.djRoleId === null ? null : BigInt(patch.djRoleId!);
    }
    if ('musicChannelId' in patch) {
      data.musicChannelId = patch.musicChannelId === null ? null : BigInt(patch.musicChannelId!);
    }
    if (patch.announceNowPlaying !== undefined) {
      data.announceNowPlaying = patch.announceNowPlaying;
    }
    if (patch.twentyFourSeven !== undefined) {
      data.twentyFourSeven = patch.twentyFourSeven;
    }
    if ('autoDisconnectMinutes' in patch) {
      data.autoDisconnectMinutes = patch.autoDisconnectMinutes ?? null;
    }
    if (patch.defaultVolume !== undefined) {
      data.defaultVolume = patch.defaultVolume;
    }
    if (patch.voteSkipThreshold !== undefined) {
      data.voteSkipThreshold = patch.voteSkipThreshold;
    }
    if (patch.locale !== undefined) {
      data.locale = patch.locale;
    }

    const row = await this.prisma.guild.upsert({
      where: { id: BigInt(guildId) },
      create: { id: BigInt(guildId), ...data },
      update: data,
    });
    const value = toConfig(row);
    this.cache.set(guildId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    this.logger.debug({ guildId, keys: Object.keys(data) }, 'guild settings updated');
    return value;
  }

  /** Drop the cached entry (e.g. when the guild leaves). */
  invalidate(guildId: string): void {
    this.cache.delete(guildId);
  }
}

function toConfig(row: Guild): GuildConfig {
  return {
    id: row.id.toString(),
    djRoleId: row.djRoleId?.toString() ?? null,
    musicChannelId: row.musicChannelId?.toString() ?? null,
    announceNowPlaying: row.announceNowPlaying,
    twentyFourSeven: row.twentyFourSeven,
    autoDisconnectMinutes: row.autoDisconnectMinutes,
    defaultVolume: row.defaultVolume,
    voteSkipThreshold: row.voteSkipThreshold,
    locale: row.locale,
  };
}
