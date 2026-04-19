import type { Track } from '@wesbot/shared';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

import type { GuildMusicSession } from '../../domain/music/session';
import type { CommandContext } from '../../types';

const ACCENT_CYAN = 0x22d3ee;

export const MUSIC_BUTTON_IDS = {
  pause: 'music:pause',
  resume: 'music:resume',
  skip: 'music:skip',
  stop: 'music:stop',
  loop: 'music:loop',
  voteskip: 'music:voteskip',
} as const;

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0:00';
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = minutes.toString().padStart(hours > 0 ? 2 : 1, '0');
  const ss = seconds.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function buildNowPlayingEmbed(
  track: Track,
  session: GuildMusicSession,
  ctx: CommandContext,
  positionMs?: number,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(ACCENT_CYAN)
    .setTitle(ctx.t('commands.nowplaying.title'))
    .setDescription(`**[${track.title}](${track.uri})**\n${ctx.t('common.by')} ${track.author}`);

  if (track.artworkUrl) {
    embed.setThumbnail(track.artworkUrl);
  }

  if (!track.isStream) {
    const pos = typeof positionMs === 'number' ? formatDuration(positionMs) : '0:00';
    const dur = formatDuration(track.duration);
    embed.addFields({
      name: ctx.t('commands.nowplaying.position'),
      value: `${pos} / ${dur}`,
      inline: true,
    });
  }

  if (track.requesterId) {
    embed.addFields({
      name: ctx.t('commands.nowplaying.requestedBy'),
      value: `<@${track.requesterId}>`,
      inline: true,
    });
  }

  const loopLabel = ctx.t(`commands.loop.modes.${session.loop}`);
  embed.setFooter({
    text: ctx.t('commands.queue.footer', { count: session.queue.length, loop: loopLabel }),
  });

  return embed;
}

export function buildNowPlayingRow(
  session: GuildMusicSession,
  ctx: CommandContext,
  paused: boolean,
): ActionRowBuilder<ButtonBuilder> {
  const toggle = paused
    ? new ButtonBuilder()
        .setCustomId(MUSIC_BUTTON_IDS.resume)
        .setLabel(ctx.t('music.buttons.resume'))
        .setStyle(ButtonStyle.Success)
    : new ButtonBuilder()
        .setCustomId(MUSIC_BUTTON_IDS.pause)
        .setLabel(ctx.t('music.buttons.pause'))
        .setStyle(ButtonStyle.Secondary);

  const skip = new ButtonBuilder()
    .setCustomId(MUSIC_BUTTON_IDS.skip)
    .setLabel(ctx.t('music.buttons.skip'))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(session.queue.length === 0 && session.loop === 'off');

  const stop = new ButtonBuilder()
    .setCustomId(MUSIC_BUTTON_IDS.stop)
    .setLabel(ctx.t('music.buttons.stop'))
    .setStyle(ButtonStyle.Danger);

  const loop = new ButtonBuilder()
    .setCustomId(MUSIC_BUTTON_IDS.loop)
    .setLabel(`${ctx.t('music.buttons.loop')} · ${ctx.t(`commands.loop.modes.${session.loop}`)}`)
    .setStyle(session.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Primary);

  const voteskip = new ButtonBuilder()
    .setCustomId(MUSIC_BUTTON_IDS.voteskip)
    .setLabel(ctx.t('music.buttons.voteskip'))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(session.queue.length === 0 && session.loop === 'off');

  return new ActionRowBuilder<ButtonBuilder>().addComponents(toggle, skip, stop, loop, voteskip);
}

export function formatTrackLine(track: Track): string {
  const duration = track.isStream ? 'LIVE' : formatDuration(track.duration);
  return `**[${track.title}](${track.uri})** · ${duration}`;
}

export { formatDuration };
