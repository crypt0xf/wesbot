import type { Client, Guild, VoiceBasedChannel } from 'discord.js';

import type { Logger } from '../../logger';
import type { GuildConfigService } from '../settings/guild-config-service';

import type { MusicController } from './music-controller';

/**
 * Reacts to `voiceStateUpdate` to auto-disconnect the bot when it's alone in a
 * voice channel. Respects the per-guild `twentyFourSeven` flag and the
 * configurable `autoDisconnectMinutes` delay. Timers are cancelled as soon as
 * a human rejoins or the bot leaves voice.
 */
export class VoiceActivityWatcher {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly client: Client,
    private readonly music: MusicController,
    private readonly settings: GuildConfigService,
    private readonly logger: Logger,
  ) {}

  /** Called for every voiceStateUpdate; cheap no-op when the bot isn't involved. */
  async onVoiceStateUpdate(guildId: string): Promise<void> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      return;
    }
    const botChannel = guild.members.me?.voice.channel;
    if (!botChannel) {
      this.cancel(guildId);
      return;
    }
    if (countHumans(botChannel) > 0) {
      this.cancel(guildId);
      return;
    }
    await this.scheduleIfNeeded(guild, botChannel.id);
  }

  private async scheduleIfNeeded(guild: Guild, channelId: string): Promise<void> {
    if (this.timers.has(guild.id)) {
      return;
    }
    const cfg = await this.settings.get(guild.id).catch((err: unknown) => {
      this.logger.warn({ err, guildId: guild.id }, 'voice watcher settings lookup failed');
      return null;
    });
    if (!cfg) {
      return;
    }
    if (cfg.twentyFourSeven) {
      return;
    }
    const minutes = cfg.autoDisconnectMinutes;
    if (minutes === null || minutes <= 0) {
      return;
    }
    const delayMs = minutes * 60_000;
    const timer = setTimeout(() => {
      this.timers.delete(guild.id);
      void this.fire(guild.id, channelId).catch((err: unknown) => {
        this.logger.warn({ err, guildId: guild.id }, 'auto-disconnect failed');
      });
    }, delayMs);
    this.timers.set(guild.id, timer);
    this.logger.debug({ guildId: guild.id, minutes, channelId }, 'auto-disconnect scheduled');
  }

  private async fire(guildId: string, channelId: string): Promise<void> {
    const guild = this.client.guilds.cache.get(guildId);
    const botChannel = guild?.members.me?.voice.channel;
    if (botChannel?.id !== channelId) {
      return;
    }
    if (countHumans(botChannel) > 0) {
      return;
    }
    this.logger.info({ guildId, channelId }, 'auto-disconnecting empty channel');
    await this.music.stop(guildId);
  }

  private cancel(guildId: string): void {
    const existing = this.timers.get(guildId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(guildId);
    }
  }

  disposeAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

function countHumans(channel: VoiceBasedChannel): number {
  return channel.members.filter((m) => !m.user.bot).size;
}
