import { type LoopMode, MAX_VOLUME, type Track } from '@wesbot/shared';
import {
  type FilterOptions,
  LoadType,
  type Player,
  type Shoukaku,
  type Track as LavalinkTrack,
} from 'shoukaku';

import { GuildMusicSession } from '../../domain/music/session';
import type { Logger } from '../../logger';
import { NotFoundError, UserFacingError, ValidationError } from '../../types';

import type { FilterName } from './filters';
import { FILTER_PRESETS } from './filters';
import type { QueuePersistence } from './queue-persistence';
import { fromLavalinkTrack } from './track-mapper';

export interface PlayInput {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  shardId: number;
  query: string;
  requesterId: string;
}

export interface PlayResult {
  kind: 'track' | 'playlist' | 'search';
  added: Track[];
  startedImmediately: boolean;
  playlistName?: string;
}

export interface ResolvedIdentifier {
  /** Raw Lavalink Track objects — needed when callers want to enqueue all results. */
  tracks: LavalinkTrack[];
  loadType: LoadType;
  playlistName?: string;
}

type PublishFn = (channel: string, payload: unknown) => void;

/**
 * Orchestrates per-guild music playback on top of Shoukaku. Holds the domain
 * session, resolves queries via Lavalink REST, wires player events to advance
 * the queue, and exposes transport controls for slash/button commands.
 */
export class MusicController {
  private readonly sessions = new Map<string, GuildMusicSession>();

  constructor(
    private readonly shoukaku: Shoukaku,
    private readonly logger: Logger,
    private readonly persistence?: QueuePersistence,
    private readonly publish?: PublishFn,
  ) {}

  private publishQueueState(guildId: string): void {
    if (!this.publish) return;
    const session = this.sessions.get(guildId);
    if (!session) return;
    const player = this.shoukaku.players.get(guildId);
    this.publish(`events:music:${guildId}`, {
      type: 'queue.updated',
      guildId,
      state: {
        guildId,
        voiceChannelId: session.voiceChannelId,
        current: session.current,
        tracks: [...session.queue],
        history: [...session.history],
        position: player?.position ?? 0,
        isPaused: player?.paused ?? false,
        volume: session.volume,
        loop: session.loop,
        autoplay: session.autoplay,
      },
      timestamp: Date.now(),
    });
  }

  getSession(guildId: string): GuildMusicSession | undefined {
    return this.sessions.get(guildId);
  }

  private getOrCreateSession(guildId: string): GuildMusicSession {
    let session = this.sessions.get(guildId);
    if (!session) {
      session = new GuildMusicSession(guildId);
      this.sessions.set(guildId, session);
    }
    return session;
  }

  getPlayer(guildId: string): Player | undefined {
    return this.shoukaku.players.get(guildId);
  }

  async play(input: PlayInput): Promise<PlayResult> {
    const session = this.getOrCreateSession(input.guildId);
    session.voiceChannelId = input.voiceChannelId;
    session.textChannelId = input.textChannelId;

    const result = await this.resolve(input.query);

    let added: Track[] = [];
    let kind: PlayResult['kind'] = 'track';
    let playlistName: string | undefined;

    switch (result.loadType) {
      case LoadType.TRACK:
        added = [fromLavalinkTrack(result.data, input.requesterId)];
        kind = 'track';
        break;
      case LoadType.SEARCH: {
        const first = result.data[0];
        if (!first) {
          throw new NotFoundError('no results', 'errors.music.noResults');
        }
        added = [fromLavalinkTrack(first, input.requesterId)];
        kind = 'search';
        break;
      }
      case LoadType.PLAYLIST:
        added = result.data.tracks.map((t) => fromLavalinkTrack(t, input.requesterId));
        kind = 'playlist';
        playlistName = result.data.info.name;
        break;
      case LoadType.EMPTY:
        throw new NotFoundError('no results', 'errors.music.noResults');
      case LoadType.ERROR:
        throw new UserFacingError(result.data.message, 'errors.music.loadFailed', {
          message: result.data.message,
        });
    }

    const accepted = session.enqueueMany(added);
    if (accepted === 0) {
      throw new UserFacingError('queue full', 'errors.music.queueFull');
    }

    const player = await this.ensurePlayer(input);
    const startedImmediately = session.current === null;
    if (startedImmediately) {
      const first = session.advance();
      if (first?.encoded) {
        await player.playTrack({ track: { encoded: first.encoded } });
      }
    }

    this.persist(session);
    this.publishQueueState(input.guildId);

    return {
      kind,
      added: added.slice(0, accepted),
      startedImmediately,
      ...(playlistName !== undefined ? { playlistName } : {}),
    };
  }

  /** Enqueue pre-resolved tracks (e.g. from a saved playlist). */
  async enqueueTracks(input: {
    guildId: string;
    voiceChannelId: string;
    textChannelId: string;
    shardId: number;
    tracks: Track[];
  }): Promise<{ accepted: number; startedImmediately: boolean }> {
    if (input.tracks.length === 0) {
      throw new NotFoundError('empty playlist', 'errors.music.noResults');
    }
    const session = this.getOrCreateSession(input.guildId);
    session.voiceChannelId = input.voiceChannelId;
    session.textChannelId = input.textChannelId;

    const accepted = session.enqueueMany(input.tracks);
    if (accepted === 0) {
      throw new UserFacingError('queue full', 'errors.music.queueFull');
    }

    const player = await this.ensurePlayer({
      guildId: input.guildId,
      voiceChannelId: input.voiceChannelId,
      textChannelId: input.textChannelId,
      shardId: input.shardId,
      query: '',
      requesterId: '',
    });
    const startedImmediately = session.current === null;
    if (startedImmediately) {
      const first = session.advance();
      if (first?.encoded) {
        await player.playTrack({ track: { encoded: first.encoded } });
      }
    }

    this.persist(session);
    this.publishQueueState(input.guildId);
    return { accepted, startedImmediately };
  }

  async pause(guildId: string): Promise<void> {
    const player = this.requirePlayer(guildId);
    if (player.paused) return;
    await player.setPaused(true);
    this.publish?.(`events:music:${guildId}`, {
      type: 'player.paused',
      guildId,
      paused: true,
      timestamp: Date.now(),
    });
  }

  async resume(guildId: string): Promise<void> {
    const player = this.requirePlayer(guildId);
    if (!player.paused) return;
    await player.setPaused(false);
    this.publish?.(`events:music:${guildId}`, {
      type: 'player.paused',
      guildId,
      paused: false,
      timestamp: Date.now(),
    });
  }

  async skip(guildId: string): Promise<Track | null> {
    const session = this.requireSession(guildId);
    const player = this.requirePlayer(guildId);
    const next = session.advance();
    if (next?.encoded) {
      await player.playTrack({ track: { encoded: next.encoded } });
      this.persist(session);
      return next;
    }
    await this.stop(guildId);
    return null;
  }

  async stop(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    session?.reset();
    const player = this.shoukaku.players.get(guildId);
    if (player) {
      await player.destroy().catch((err: unknown) => {
        this.logger.warn({ err, guildId }, 'destroy player failed');
      });
    }
    await this.shoukaku.leaveVoiceChannel(guildId).catch((err: unknown) => {
      this.logger.warn({ err, guildId }, 'leaveVoiceChannel failed');
    });
    this.sessions.delete(guildId);
    if (this.persistence) {
      void this.persistence.drop(guildId);
    }
  }

  async seek(guildId: string, positionMs: number): Promise<void> {
    if (!Number.isFinite(positionMs) || positionMs < 0) {
      throw new ValidationError('negative position', 'errors.music.invalidSeek');
    }
    const player = this.requirePlayer(guildId);
    const session = this.requireSession(guildId);
    if (!session.current || session.current.isStream) {
      throw new UserFacingError('cannot seek', 'errors.music.notSeekable');
    }
    await player.seekTo(Math.min(positionMs, session.current.duration));
  }

  async setVolume(guildId: string, volume: number): Promise<number> {
    if (!Number.isFinite(volume)) {
      throw new ValidationError('invalid volume', 'errors.music.invalidVolume');
    }
    const clamped = Math.max(0, Math.min(MAX_VOLUME, Math.round(volume)));
    const session = this.requireSession(guildId);
    const player = this.requirePlayer(guildId);
    session.setVolume(clamped);
    await player.setGlobalVolume(clamped);
    this.persist(session);
    return clamped;
  }

  setLoop(guildId: string, mode: LoopMode): void {
    const session = this.requireSession(guildId);
    session.setLoop(mode);
    this.persist(session);
    this.publishQueueState(guildId);
  }

  /**
   * Record a skip vote for `userId` on the active track. Returns the current
   * tally vs. the required number. Caller decides whether to call `skip` when
   * `count >= required`. `required` is expected to already be clamped to >= 1.
   */
  registerSkipVote(
    guildId: string,
    userId: string,
    required: number,
  ): { count: number; required: number; alreadyVoted: boolean } {
    const session = this.requireSession(guildId);
    const alreadyVoted = session.skipVotes.has(userId);
    session.skipVotes.add(userId);
    return { count: session.skipVotes.size, required, alreadyVoted };
  }

  setAutoplay(guildId: string, enabled: boolean): void {
    const session = this.requireSession(guildId);
    session.autoplay = enabled;
    this.persist(session);
    this.publishQueueState(guildId);
  }

  async applyFilter(guildId: string, name: FilterName): Promise<void> {
    const player = this.requirePlayer(guildId);
    const session = this.requireSession(guildId);
    const preset: FilterOptions | null = name === 'off' ? null : FILTER_PRESETS[name];
    await player.setFilters(preset ?? {});
    session.activeFilter = name;
    this.persist(session);
  }

  private requireSession(guildId: string): GuildMusicSession {
    const session = this.sessions.get(guildId);
    if (!session) {
      throw new UserFacingError('no session', 'errors.music.notPlaying');
    }
    return session;
  }

  private requirePlayer(guildId: string): Player {
    const player = this.shoukaku.players.get(guildId);
    if (!player) {
      throw new UserFacingError('no player', 'errors.music.notPlaying');
    }
    return player;
  }

  private async ensurePlayer(input: PlayInput): Promise<Player> {
    const existing = this.shoukaku.players.get(input.guildId);
    if (existing) {
      return existing;
    }
    const player = await this.shoukaku.joinVoiceChannel({
      guildId: input.guildId,
      channelId: input.voiceChannelId,
      shardId: input.shardId,
      deaf: true,
    });
    this.attachPlayerEvents(player);
    return player;
  }

  private attachPlayerEvents(player: Player): void {
    const guildId = player.guildId;

    player.on('start', () => {
      const session = this.sessions.get(guildId);
      if (session?.current && this.publish) {
        this.publish(`events:music:${guildId}`, {
          type: 'track.started',
          guildId,
          track: session.current,
          timestamp: Date.now(),
        });
      }
    });

    player.on('end', (event) => {
      if (event.reason === 'replaced' || event.reason === 'stopped') {
        return;
      }
      const session = this.sessions.get(guildId);
      if (session?.current && this.publish) {
        this.publish(`events:music:${guildId}`, {
          type: 'track.ended',
          guildId,
          track: session.current,
          reason: 'finished',
          timestamp: Date.now(),
        });
      }
      void this.autoAdvance(guildId, event.reason).catch((err: unknown) => {
        this.logger.error({ err, guildId }, 'auto-advance failed');
      });
    });

    player.on('update', (update) => {
      if (update.state.position !== undefined && this.publish) {
        this.publish(`events:music:${guildId}`, {
          type: 'player.position',
          guildId,
          positionMs: update.state.position,
          timestamp: Date.now(),
        });
      }
    });

    player.on('exception', (event) => {
      this.logger.warn({ guildId, exception: event.exception }, 'lavalink track exception');
      void this.autoAdvance(guildId, 'loadFailed').catch((err: unknown) => {
        this.logger.error({ err, guildId }, 'auto-advance after exception failed');
      });
    });

    player.on('stuck', (event) => {
      this.logger.warn({ guildId, thresholdMs: event.thresholdMs }, 'lavalink track stuck');
      void this.autoAdvance(guildId, 'stuck').catch((err: unknown) => {
        this.logger.error({ err, guildId }, 'auto-advance after stuck failed');
      });
    });

    player.on('closed', (event) => {
      this.logger.warn(
        { guildId, code: event.code, reason: event.reason },
        'voice websocket closed',
      );
    });
  }

  private async autoAdvance(guildId: string, reason: string): Promise<void> {
    const session = this.sessions.get(guildId);
    const player = this.shoukaku.players.get(guildId);
    if (!session || !player) {
      return;
    }
    const next = session.advance();
    if (next?.encoded) {
      await player.playTrack({ track: { encoded: next.encoded } });
      this.persist(session);
      return;
    }

    if (session.autoplay) {
      const related = await this.findRelatedTrack(session).catch((err: unknown) => {
        this.logger.warn({ err, guildId }, 'autoplay lookup failed');
        return null;
      });
      if (related) {
        session.enqueue(related);
        const picked = session.advance();
        if (picked?.encoded) {
          await player.playTrack({ track: { encoded: picked.encoded } });
          this.persist(session);
          return;
        }
      }
    }

    this.logger.info({ guildId, reason }, 'queue exhausted, leaving voice');
    await this.stop(guildId);
  }

  private async findRelatedTrack(session: GuildMusicSession): Promise<Track | null> {
    const seed = session.history[session.history.length - 1] ?? session.current;
    if (!seed) {
      return null;
    }
    const query = `ytmsearch:${seed.author} ${seed.title}`;
    const node = this.pickNode();
    const res = await node.rest.resolve(query);
    if (!res || (res.loadType !== LoadType.SEARCH && res.loadType !== LoadType.TRACK)) {
      return null;
    }
    const candidates = res.loadType === LoadType.SEARCH ? res.data : [res.data];
    const seenIds = new Set(
      [...session.history, ...(session.current ? [session.current] : [])].map((t) => t.identifier),
    );
    for (const candidate of candidates) {
      const mapped = fromLavalinkTrack(candidate, seed.requesterId ?? null);
      if (!seenIds.has(mapped.identifier)) {
        return mapped;
      }
    }
    return null;
  }

  private async resolve(query: string): Promise<
    | { loadType: LoadType.TRACK; data: LavalinkTrack }
    | { loadType: LoadType.SEARCH; data: LavalinkTrack[] }
    | {
        loadType: LoadType.PLAYLIST;
        data: {
          info: { name: string; selectedTrack: number };
          tracks: LavalinkTrack[];
          pluginInfo: unknown;
          encoded: string;
        };
      }
    | { loadType: LoadType.EMPTY; data: Record<string, never> }
    | { loadType: LoadType.ERROR; data: { message: string; severity: string; cause: string } }
  > {
    const node = this.pickNode();
    const identifier = this.toIdentifier(query);
    const res = await node.rest.resolve(identifier);
    if (!res) {
      throw new UserFacingError('lavalink no response', 'errors.music.loadFailed', {
        message: 'empty response',
      });
    }
    return res;
  }

  private pickNode() {
    for (const node of this.shoukaku.nodes.values()) {
      return node;
    }
    throw new UserFacingError('no lavalink nodes', 'errors.music.noNodes');
  }

  /**
   * If the query looks like a URL, pass it through; otherwise prefix with
   * `ytsearch:` so Lavalink runs a YouTube search. Callers can override by
   * sending an explicit prefix like `scsearch:lofi` or `spsearch:`.
   */
  private toIdentifier(query: string): string {
    const trimmed = query.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    if (/^[a-z]{2,}search:/i.test(trimmed)) {
      return trimmed;
    }
    return `ytsearch:${trimmed}`;
  }

  private persist(session: GuildMusicSession): void {
    if (!this.persistence) {
      return;
    }
    void this.persistence.save(session);
  }
}
