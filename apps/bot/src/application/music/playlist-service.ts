import type { Prisma, PrismaClient } from '@wesbot/database';
import { MAX_PLAYLISTS_PER_USER, type Track, trackSchema } from '@wesbot/shared';
import { z } from 'zod';

import type { Logger } from '../../logger';
import { NotFoundError, UserFacingError, ValidationError } from '../../types';

const MAX_NAME_LENGTH = 64;
const persistedTracksSchema = z.array(trackSchema);

export interface PlaylistSummary {
  id: string;
  name: string;
  trackCount: number;
  updatedAt: Date;
}

export interface PlaylistDetail extends PlaylistSummary {
  tracks: Track[];
}

/**
 * User-scoped saved playlists. A playlist is identified by `(ownerId, name)` —
 * guildId is stored for auditing but does not scope reads. Tracks are
 * validated on load so we never hand corrupt rows back to the player.
 */
export class PlaylistService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  async save(input: {
    ownerId: string;
    guildId: string | null;
    name: string;
    tracks: Track[];
  }): Promise<PlaylistDetail> {
    const name = normalizeName(input.name);
    if (input.tracks.length === 0) {
      throw new UserFacingError('empty playlist', 'commands.playlist.save.emptyQueue');
    }

    const ownerId = BigInt(input.ownerId);
    const total = await this.prisma.playlist.count({ where: { ownerId } });
    if (total >= MAX_PLAYLISTS_PER_USER) {
      throw new UserFacingError('playlist limit', 'commands.playlist.save.limitReached');
    }

    const existing = await this.prisma.playlist.findFirst({
      where: { ownerId, name },
      select: { id: true },
    });
    if (existing) {
      throw new UserFacingError('duplicate playlist', 'commands.playlist.save.duplicate');
    }

    const row = await this.prisma.playlist.create({
      data: {
        ownerId,
        guildId: input.guildId === null ? null : BigInt(input.guildId),
        name,
        tracks: input.tracks as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.info(
      { playlistId: row.id, ownerId: input.ownerId, tracks: input.tracks.length },
      'playlist saved',
    );

    return {
      id: row.id,
      name: row.name,
      trackCount: input.tracks.length,
      tracks: input.tracks,
      updatedAt: row.updatedAt,
    };
  }

  async list(ownerId: string): Promise<PlaylistSummary[]> {
    const rows = await this.prisma.playlist.findMany({
      where: { ownerId: BigInt(ownerId) },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, tracks: true, updatedAt: true },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      trackCount: Array.isArray(row.tracks) ? row.tracks.length : 0,
      updatedAt: row.updatedAt,
    }));
  }

  async load(ownerId: string, name: string): Promise<PlaylistDetail> {
    const normalized = normalizeName(name);
    const row = await this.prisma.playlist.findFirst({
      where: { ownerId: BigInt(ownerId), name: normalized },
    });
    if (!row) {
      throw new NotFoundError('playlist not found', 'errors.music.playlistNotFound');
    }
    const parsed = persistedTracksSchema.safeParse(row.tracks);
    if (!parsed.success) {
      this.logger.warn({ playlistId: row.id }, 'playlist contains invalid tracks');
      throw new UserFacingError('corrupt playlist', 'errors.music.playlistNotFound');
    }
    return {
      id: row.id,
      name: row.name,
      trackCount: parsed.data.length,
      tracks: parsed.data,
      updatedAt: row.updatedAt,
    };
  }

  async delete(ownerId: string, name: string): Promise<void> {
    const normalized = normalizeName(name);
    const row = await this.prisma.playlist.findFirst({
      where: { ownerId: BigInt(ownerId), name: normalized },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundError('playlist not found', 'errors.music.playlistNotFound');
    }
    await this.prisma.playlist.delete({ where: { id: row.id } });
  }
}

function normalizeName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) {
    throw new ValidationError('invalid playlist name', 'errors.validation', {
      message: `1..${MAX_NAME_LENGTH} chars`,
    });
  }
  return trimmed;
}
