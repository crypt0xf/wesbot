import {
  type ChatInputCommandInteraction,
  type Guild,
  GuildMember,
  type VoiceBasedChannel,
} from 'discord.js';

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
