import type { LoopMode } from '@wesbot/shared';
import { type ButtonInteraction, GuildMember, MessageFlags } from 'discord.js';

import type { CommandContext } from '../../types';
import { UserFacingError } from '../../types';

import { buildNowPlayingEmbed, buildNowPlayingRow, MUSIC_BUTTON_IDS } from './now-playing';

const LOOP_CYCLE: Record<LoopMode, LoopMode> = {
  off: 'track',
  track: 'queue',
  queue: 'off',
};

export function isMusicButtonId(customId: string): boolean {
  return customId.startsWith('music:');
}

/**
 * Handle a `music:*` button press. Performs the action, then refreshes the
 * originating Now Playing message via `interaction.update`. Throws
 * UserFacingError on voice/permission problems so the dispatcher renders them
 * the same way it renders slash command errors.
 */
export async function handleMusicButton(
  interaction: ButtonInteraction,
  ctx: CommandContext,
): Promise<void> {
  if (!interaction.inCachedGuild() || !interaction.guild) {
    throw new UserFacingError('guild only', 'errors.music.guildOnly');
  }
  const member = interaction.member;
  if (!(member instanceof GuildMember)) {
    throw new UserFacingError('guild only', 'errors.music.guildOnly');
  }
  const userVoice = member.voice.channel;
  if (!userVoice) {
    throw new UserFacingError('not in voice', 'errors.music.notInVoice');
  }
  const botVoice = interaction.guild.members.me?.voice.channel;
  if (botVoice && botVoice.id !== userVoice.id) {
    throw new UserFacingError('wrong voice', 'errors.music.sameVoice');
  }

  const guildId = interaction.guild.id;
  const music = ctx.container.music;

  switch (interaction.customId) {
    case MUSIC_BUTTON_IDS.pause:
      await music.pause(guildId);
      break;
    case MUSIC_BUTTON_IDS.resume:
      await music.resume(guildId);
      break;
    case MUSIC_BUTTON_IDS.skip:
      await music.skip(guildId);
      break;
    case MUSIC_BUTTON_IDS.stop:
      await music.stop(guildId);
      await interaction.update({
        content: ctx.t('commands.stop.stopped'),
        embeds: [],
        components: [],
      });
      return;
    case MUSIC_BUTTON_IDS.loop: {
      const session = music.getSession(guildId);
      const current: LoopMode = session?.loop ?? 'off';
      music.setLoop(guildId, LOOP_CYCLE[current]);
      break;
    }
    default:
      await interaction.reply({
        content: ctx.t('errors.generic'),
        flags: MessageFlags.Ephemeral,
      });
      return;
  }

  const session = music.getSession(guildId);
  const player = music.getPlayer(guildId);
  if (!session?.current) {
    await interaction.update({
      content: ctx.t('commands.nowplaying.nothing'),
      embeds: [],
      components: [],
    });
    return;
  }

  const embed = buildNowPlayingEmbed(session.current, session, ctx, player?.position);
  const row = buildNowPlayingRow(session, ctx, player?.paused ?? false);
  await interaction.update({ embeds: [embed], components: [row] });
}
