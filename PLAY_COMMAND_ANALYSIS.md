# Play Command Implementation Analysis - wesbot

## 1. ENTRY POINT: Slash Command Handler

**File:** [apps/bot/src/presentation/commands/music/play.ts](apps/bot/src/presentation/commands/music/play.ts)

```typescript
import { DEFAULT_LOCALE } from '@wesbot/shared';
import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';

import { requireVoiceContext } from './_guards';

const play: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.play.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.play.description'))
    .addStringOption((opt) =>
      opt
        .setName('query')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.play.queryOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.play.queryOption'))
        .setRequired(true),
    ),
  async execute(interaction, ctx) {
    // 1. Validate voice context (user in voice, bot in same or no voice)
    const { guild, voiceChannel } = requireVoiceContext(interaction);
    
    // 2. Get the search query/URL from the user
    const query = interaction.options.getString('query', true);

    // 3. Defer the response (this can take a while)
    await interaction.deferReply();

    // 4. CRITICAL: Call the MusicController.play() method
    // This is where the Lavalink resolution happens
    const result = await ctx.container.music.play({
      guildId: guild.id,
      voiceChannelId: voiceChannel.id,
      textChannelId: interaction.channelId,
      shardId: guild.shardId,
      query,
      requesterId: interaction.user.id,
    });

    // 5. Handle response
    const first = result.added[0];
    if (!first) {
      await interaction.editReply({
        content: ctx.t('errors.music.noResults'),
        flags: MessageFlags.SuppressEmbeds,
      });
      return;
    }

    if (result.kind === 'playlist') {
      await interaction.editReply(
        ctx.t('commands.play.addedPlaylist', {
          name: result.playlistName ?? '',
          count: result.added.length,
        }),
      );
      return;
    }

    if (result.startedImmediately) {
      await interaction.editReply(ctx.t('commands.play.startedPlaying', { title: first.title }));
      return;
    }

    await interaction.editReply(ctx.t('commands.play.added', { title: first.title }));
  },
};

export default play;
```

### Voice Context Guard

**File:** [apps/bot/src/presentation/commands/music/_guards.ts](apps/bot/src/presentation/commands/music/_guards.ts)

```typescript
import {
  type ChatInputCommandInteraction,
  type Guild,
  GuildMember,
  PermissionFlagsBits,
  type VoiceBasedChannel,
} from 'discord.js';

import type { GuildConfigService } from '../../../application/settings/guild-config-service';
import { UserFacingError } from '../../../types';

export interface VoiceContext {
  guild: Guild;
  member: GuildMember;
  voiceChannel: VoiceBasedChannel;
}

/**
 * Assert the interaction comes from a guild and the caller sits in a voice
 * channel compatible with any existing player. Throws UserFacingError so the
 * dispatcher renders the i18n reply automatically.
 */
export function requireVoiceContext(interaction: ChatInputCommandInteraction): VoiceContext {
  if (!interaction.inCachedGuild() || !interaction.guild) {
    throw new UserFacingError('guild only', 'errors.music.guildOnly');
  }
  const member = interaction.member;
  if (!(member instanceof GuildMember)) {
    throw new UserFacingError('guild only', 'errors.music.guildOnly');
  }
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    throw new UserFacingError('not in voice', 'errors.music.notInVoice');
  }

  const botVoice = interaction.guild.members.me?.voice.channel;
  if (botVoice && botVoice.id !== voiceChannel.id) {
    throw new UserFacingError('wrong voice', 'errors.music.sameVoice');
  }

  return { guild: interaction.guild, member, voiceChannel };
}

export function requireGuildId(interaction: ChatInputCommandInteraction): string {
  if (!interaction.guildId) {
    throw new UserFacingError('guild only', 'errors.music.guildOnly');
  }
  return interaction.guildId;
}
```

---

## 2. CORE LOGIC: MusicController

**File:** [apps/bot/src/application/music/music-controller.ts](apps/bot/src/application/music/music-controller.ts)

### Interfaces

```typescript
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
```

### Main Play Method

This is the CRITICAL method where AbortError occurs:

```typescript
async play(input: PlayInput): Promise<PlayResult> {
  // 1. Get or create the guild session
  const session = this.getOrCreateSession(input.guildId);
  session.voiceChannelId = input.voiceChannelId;
  session.textChannelId = input.textChannelId;

  // 2. CRITICAL: Resolve the query via Lavalink
  // ⚠️ THIS IS WHERE AbortError HAPPENS (20 second timeout)
  const result = await this.resolve(input.query);

  let added: Track[] = [];
  let kind: PlayResult['kind'] = 'track';
  let playlistName: string | undefined;

  // 3. Parse the response based on LoadType
  switch (result.loadType) {
    case LoadType.TRACK:
      // Direct track URL matched
      added = [fromLavalinkTrack(result.data, input.requesterId)];
      kind = 'track';
      break;

    case LoadType.SEARCH: {
      // YouTube search or other search
      const first = result.data[0];
      if (!first) {
        throw new NotFoundError('no results', 'errors.music.noResults');
      }
      added = [fromLavalinkTrack(first, input.requesterId)];
      kind = 'search';
      break;
    }

    case LoadType.PLAYLIST:
      // Playlist URL matched
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

  // 4. Enqueue the tracks
  const accepted = session.enqueueMany(added);
  if (accepted === 0) {
    throw new UserFacingError('queue full', 'errors.music.queueFull');
  }

  // 5. Ensure a player is connected to the voice channel
  const player = await this.ensurePlayer(input);
  
  // 6. If no track is playing, start playing immediately
  const startedImmediately = session.current === null;
  if (startedImmediately) {
    const first = session.advance();
    if (first?.encoded) {
      await player.playTrack({ track: { encoded: first.encoded } });
    }
  }

  // 7. Persist the session state
  this.persist(session);

  return {
    kind,
    added: added.slice(0, accepted),
    startedImmediately,
    ...(playlistName !== undefined ? { playlistName } : {}),
  };
}
```

### THE CRITICAL METHOD: resolve()

This is where Lavalink REST API is called and AbortError can occur:

```typescript
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
  // 1. Pick an available Lavalink node
  const node = this.pickNode();
  
  // 2. Convert the query to a Lavalink identifier
  const identifier = this.toIdentifier(query);
  
  // 3. CRITICAL: Call Lavalink REST API
  // ⚠️ AbortError happens here if timeout (restTimeout: 20 seconds)
  const res = await node.rest.resolve(identifier);
  
  if (!res) {
    throw new UserFacingError('lavalink no response', 'errors.music.loadFailed', {
      message: 'empty response',
    });
  }
  
  return res;
}
```

### Query Identifier Processing

```typescript
/**
 * If the query looks like a URL, pass it through; otherwise prefix with
 * `ytsearch:` so Lavalink runs a YouTube search. Callers can override by
 * sending an explicit prefix like `scsearch:lofi` or `spsearch:`.
 */
private toIdentifier(query: string): string {
  const trimmed = query.trim();
  
  // If it's already a URL, pass through unchanged
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  
  // If it has an explicit search prefix, pass through
  if (/^[a-z]{2,}search:/i.test(trimmed)) {
    return trimmed;
  }
  
  // Otherwise, add YouTube search prefix
  return `ytsearch:${trimmed}`;
}
```

### Helper Methods

```typescript
private getOrCreateSession(guildId: string): GuildMusicSession {
  let session = this.sessions.get(guildId);
  if (!session) {
    session = new GuildMusicSession(guildId);
    this.sessions.set(guildId, session);
  }
  return session;
}

private async ensurePlayer(input: PlayInput): Promise<Player> {
  // Check if a player already exists
  const existing = this.shoukaku.players.get(input.guildId);
  if (existing) {
    return existing;
  }
  
  // Create a new player by joining the voice channel
  const player = await this.shoukaku.joinVoiceChannel({
    guildId: input.guildId,
    channelId: input.voiceChannelId,
    shardId: input.shardId,
    deaf: true,
  });
  
  // Attach event listeners for track completion
  this.attachPlayerEvents(player);
  
  return player;
}

private attachPlayerEvents(player: Player): void {
  const guildId = player.guildId;

  // When a track ends
  player.on('end', (event) => {
    if (event.reason === 'replaced' || event.reason === 'stopped') {
      return;
    }
    void this.autoAdvance(guildId, event.reason).catch((err: unknown) => {
      this.logger.error({ err, guildId }, 'auto-advance failed');
    });
  });

  // When there's an exception during playback
  player.on('exception', (event) => {
    this.logger.warn({ guildId, exception: event.exception }, 'lavalink track exception');
    void this.autoAdvance(guildId, 'loadFailed').catch((err: unknown) => {
      this.logger.error({ err, guildId }, 'auto-advance after exception failed');
    });
  });

  // When a track gets stuck
  player.on('stuck', (event) => {
    this.logger.warn({ guildId, thresholdMs: event.thresholdMs }, 'lavalink track stuck');
    void this.autoAdvance(guildId, 'stuck').catch((err: unknown) => {
      this.logger.error({ err, guildId }, 'auto-advance after stuck failed');
    });
  });

  // When the voice websocket closes
  player.on('closed', (event) => {
    this.logger.warn(
      { guildId, code: event.code, reason: event.reason },
      'voice websocket closed',
    );
  });
}

private pickNode() {
  for (const node of this.shoukaku.nodes.values()) {
    return node;
  }
  throw new UserFacingError('no lavalink nodes', 'errors.music.noNodes');
}

private persist(session: GuildMusicSession): void {
  if (!this.persistence) {
    return;
  }
  void this.persistence.save(session);
}
```

---

## 3. DOMAIN LAYER: Queue Management

**File:** [apps/bot/src/domain/music/session.ts](apps/bot/src/domain/music/session.ts)

```typescript
import { type LoopMode, MAX_HISTORY_SIZE, MAX_QUEUE_SIZE, type Track } from '@wesbot/shared';

export type ActiveFilter = 'off' | 'bassboost' | 'nightcore' | 'eightd';

/**
 * Per-guild music session state. Pure data + queue invariants — no discord.js
 * or shoukaku types leak in here. State may be mirrored to Redis by
 * QueuePersistence at the controller layer.
 */
export class GuildMusicSession {
  readonly guildId: string;
  voiceChannelId: string | null = null;
  textChannelId: string | null = null;
  current: Track | null = null;
  readonly queue: Track[] = [];
  readonly history: Track[] = [];
  loop: LoopMode = 'off';
  volume = 100;
  autoplay = false;
  activeFilter: ActiveFilter = 'off';
  /** User IDs that have voted to skip the current track. Reset on track change. */
  readonly skipVotes = new Set<string>();

  constructor(guildId: string) {
    this.guildId = guildId;
  }

  /** Enqueue one track. Returns false if the queue is at capacity. */
  enqueue(track: Track): boolean {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      return false;
    }
    this.queue.push(track);
    return true;
  }

  /** Enqueue many; drops the overflow and returns how many were accepted. */
  enqueueMany(tracks: readonly Track[]): number {
    let accepted = 0;
    for (const t of tracks) {
      if (!this.enqueue(t)) {
        break;
      }
      accepted += 1;
    }
    return accepted;
  }

  /**
   * Advance past `current`, honoring the loop mode. Returns the next track to
   * play, or null if the queue is exhausted and the session should stop.
   *
   * - `track`: replay `current`
   * - `queue`: push `current` to the end, dequeue the head
   * - `off`:   dequeue the head (or return null if empty)
   */
  advance(): Track | null {
    if (this.current && this.loop === 'track') {
      return this.current;
    }

    if (this.current) {
      this.history.push(this.current);
      if (this.history.length > MAX_HISTORY_SIZE) {
        this.history.shift();
      }
      if (this.loop === 'queue') {
        this.queue.push(this.current);
      }
    }

    const next = this.queue.shift() ?? null;
    this.current = next;
    this.skipVotes.clear();
    return next;
  }

  /** Drop everything except the active track (kept so caller can stop cleanly). */
  clearQueue(): void {
    this.queue.length = 0;
  }

  /** Fully reset playback state — caller is expected to stop the player first. */
  reset(): void {
    this.queue.length = 0;
    this.history.length = 0;
    this.current = null;
    this.loop = 'off';
    this.autoplay = false;
    this.voiceChannelId = null;
    this.activeFilter = 'off';
    this.skipVotes.clear();
  }

  setLoop(mode: LoopMode): void {
    this.loop = mode;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(200, Math.round(volume)));
  }
}
```

---

## 4. TRACK MAPPING

**File:** [apps/bot/src/application/music/track-mapper.ts](apps/bot/src/application/music/track-mapper.ts)

```typescript
import type { AudioSource, Track } from '@wesbot/shared';
import type { Track as LavalinkTrack } from 'shoukaku';

const SOURCE_MAP: Record<string, AudioSource> = {
  youtube: 'youtube',
  ytsearch: 'youtube',
  youtubemusic: 'youtube_music',
  ytmsearch: 'youtube_music',
  soundcloud: 'soundcloud',
  scsearch: 'soundcloud',
  spotify: 'spotify',
  spsearch: 'spotify',
  applemusic: 'apple_music',
  amsearch: 'apple_music',
  deezer: 'deezer',
  dzsearch: 'deezer',
  bandcamp: 'bandcamp',
  twitch: 'twitch',
  http: 'http',
  local: 'local',
};

function mapSource(sourceName: string): AudioSource {
  return SOURCE_MAP[sourceName.toLowerCase()] ?? 'unknown';
}

/**
 * Convert a Lavalink-emitted Track into our shared domain Track. We use the
 * encoded payload as the identity string so replays stay round-trippable, and
 * tolerate missing URIs by falling back to a data-URI-style identifier.
 */
export function fromLavalinkTrack(raw: LavalinkTrack, requesterId: string | null): Track {
  const info = raw.info;
  return {
    identifier: info.identifier,
    title: info.title || 'Unknown title',
    author: info.author || 'Unknown artist',
    duration: Math.max(0, info.length),
    isStream: info.isStream,
    uri: info.uri ?? `lavalink://${info.identifier}`,
    artworkUrl: info.artworkUrl ?? null,
    isrc: info.isrc ?? null,
    source: mapSource(info.sourceName),
    requesterId,
    encoded: raw.encoded,
  };
}
```

---

## 5. LAVALINK CONFIGURATION

**File:** [apps/bot/src/infrastructure/lavalink.ts](apps/bot/src/infrastructure/lavalink.ts)

```typescript
import type { Client } from 'discord.js';
import { Connectors, type NodeOption, Shoukaku } from 'shoukaku';

import type { Logger } from '../logger';

export interface LavalinkOptions {
  client: Client;
  logger: Logger;
  host: string;
  port: number;
  password: string;
  secure?: boolean;
}

/**
 * Build and wire the Shoukaku instance. One node for now (local Lavalink in
 * docker-compose); multi-node comes later when we scale out. Events are logged
 * so a disconnect is visible in prod logs, not silent.
 */
export function createShoukaku(opts: LavalinkOptions): Shoukaku {
  const node: NodeOption = {
    name: 'main',
    url: `${opts.host}:${opts.port}`,
    auth: opts.password,
    secure: opts.secure ?? false,
  };

  const shoukaku = new Shoukaku(new Connectors.DiscordJS(opts.client), [node], {
    resume: true,
    resumeTimeout: 30,
    resumeByLibrary: true,
    reconnectTries: 5,
    reconnectInterval: 5,
    restTimeout: 20,                    // ⚠️ 20 SECOND REST API TIMEOUT
    moveOnDisconnect: false,
    voiceConnectionTimeout: 15,         // 15 second voice connection timeout
  });

  shoukaku.on('ready', (name, reconnected) => {
    opts.logger.info({ node: name, reconnected }, 'lavalink node ready');
  });
  shoukaku.on('error', (name, error) => {
    opts.logger.error({ node: name, err: error }, 'lavalink node error');
  });
  shoukaku.on('close', (name, code, reason) => {
    opts.logger.warn({ node: name, code, reason }, 'lavalink node closed');
  });
  shoukaku.on('disconnect', (name, count) => {
    opts.logger.warn({ node: name, playersMoved: count }, 'lavalink node disconnected');
  });
  shoukaku.on('reconnecting', (name, left, interval) => {
    opts.logger.info(
      { node: name, reconnectsLeft: left, intervalSec: interval },
      'lavalink node reconnecting',
    );
  });

  return shoukaku;
}
```

---

## 6. ERROR FLOW & ABORT ERROR SOURCE

### Where AbortError Occurs

```typescript
// In MusicController.resolve():
const res = await node.rest.resolve(identifier);  // ⚠️ AbortError happens here
```

### Root Cause

The `node.rest.resolve()` call is a method from Shoukaku that:
1. Internally uses `fetch()` with an AbortController
2. The AbortController timeout is set to `restTimeout: 20` seconds
3. If the request doesn't complete within 20 seconds, the AbortController aborts
4. The fetch throws `AbortError: The operation was aborted`

### Why It Happens with YouTube Music URLs

1. **Rate Limiting**: YouTube (especially YouTube Music URLs) gets rate-limited
2. **Lavalink Plugin Overhead**: LavaLink's plugin for YouTube has overhead
3. **Network Latency**: High latency between bot and Lavalink server
4. **Complex Metadata**: Extracting metadata for YouTube Music takes longer
5. **Concurrent Requests**: Multiple concurrent track resolutions hitting the 20s timeout

### Stack Trace Example

```
AbortError: The operation was aborted
  at async node.rest.resolve(identifier)
  at async MusicController.resolve(query)
  at async MusicController.play(input)
  at async play command execute()
```

---

## 7. ERROR HANDLING

Currently, there is **NO explicit error handling** for AbortError in the play command. The error propagates uncaught.

**Current behavior:**
- AbortError is NOT caught
- It propagates to the interaction handler
- User sees an error response from the bot

**Recommended fix:** Add try-catch around `this.resolve()` to handle AbortError specifically:

```typescript
async play(input: PlayInput): Promise<PlayResult> {
  const session = this.getOrCreateSession(input.guildId);
  session.voiceChannelId = input.voiceChannelId;
  session.textChannelId = input.textChannelId;

  let result;
  try {
    result = await this.resolve(input.query);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new UserFacingError(
        'lavalink timeout',
        'errors.music.lavalinikTimeout',
        { message: 'The request took too long. YouTube Music URLs are frequently rate-limited.' }
      );
    }
    throw err;
  }
  // ... rest of method
}
```

---

## 8. QUEUE LIMITS

From `packages/shared/src/`:
- `MAX_QUEUE_SIZE` - Maximum tracks in the queue (typically 100-1000)
- `MAX_HISTORY_SIZE` - Maximum tracks kept in history for autoplay

---

## 9. DATA FLOW DIAGRAM

```
User: /play <query>
    ↓
play.ts (requireVoiceContext + defer)
    ↓
MusicController.play(input)
    ├─→ getOrCreateSession(guildId)
    ├─→ resolve(query)  [⚠️ ABORT ERROR CAN OCCUR HERE]
    │   ├─→ toIdentifier(query)
    │   └─→ node.rest.resolve(identifier) [20s timeout]
    ├─→ Switch on LoadType
    │   ├─ TRACK: Single track
    │   ├─ SEARCH: First of search results
    │   ├─ PLAYLIST: All tracks in playlist
    │   ├─ EMPTY: Error
    │   └─ ERROR: Lavalink error
    ├─→ session.enqueueMany(added)
    ├─→ ensurePlayer(input)
    │   ├─→ shoukaku.joinVoiceChannel()
    │   └─→ attachPlayerEvents(player)
    ├─→ if (startedImmediately):
    │   ├─→ session.advance()
    │   └─→ player.playTrack({ track })
    ├─→ persist(session)
    └─→ return PlayResult
        
Player handles track end via event listeners:
    ↓
player.on('end') → autoAdvance(guildId, reason)
    ├─→ session.advance()
    ├─→ player.playTrack() [next track]
    └─→ persist(session)
```

---

## 10. SUMMARY

### The Play Command Flow

1. **User** sends `/play <query>` command
2. **Command handler** validates voice context and defers response
3. **MusicController.play()** is called with the query
4. **Query resolution** happens via Lavalink REST API (20s timeout)
5. **Track(s) are mapped** from Lavalink format to domain format
6. **Tracks are enqueued** to the guild session
7. **Voice player** is created if needed
8. **If queue was empty**, the first track is played immediately
9. **Response** is sent to user with track info

### Critical Points for AbortError

- **Location**: `MusicController.resolve()` → `node.rest.resolve(identifier)`
- **Timeout**: 20 seconds (configurable in `lavalink.ts`)
- **Trigger**: YouTube Music URLs often exceed this timeout due to rate limiting
- **Fix**: Increase `restTimeout` or add explicit AbortError handling

### Supported URL Types

Via Lavalink plugins:
- YouTube & YouTube Music
- Spotify  
- Apple Music
- Deezer
- SoundCloud
- Bandcamp
- Twitch
- Direct HTTP URLs
- Local files

### Next Steps for Debugging

1. Check Lavalink logs for rate limiting errors
2. Increase `restTimeout` from 20 to 30-40 seconds
3. Add AbortError-specific error handling
4. Monitor Lavalink response times for YouTube Music URLs
5. Consider adding user feedback about slow requests
