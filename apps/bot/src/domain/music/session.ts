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

  /** Reset playback state but preserve history (used when queue exhausts naturally). */
  idleReset(): void {
    this.queue.length = 0;
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

  reorder(fromIndex: number, toIndex: number): boolean {
    if (
      fromIndex < 0 ||
      fromIndex >= this.queue.length ||
      toIndex < 0 ||
      toIndex >= this.queue.length ||
      fromIndex === toIndex
    )
      return false;
    const [track] = this.queue.splice(fromIndex, 1);
    if (track) this.queue.splice(toIndex, 0, track);
    return true;
  }
}
