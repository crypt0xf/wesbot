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

/**
 * True if the caller may run destructive music actions (skip/stop/seek/volume/
 * filter/autoplay). Rules:
 * - Manage Guild bypasses everything.
 * - If the guild has a DJ role configured, the caller must hold it.
 * - If no DJ role is configured, anyone in voice may run the command.
 */
export function isDj(member: GuildMember, djRoleId: string | null): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }
  if (!djRoleId) {
    return true;
  }
  return member.roles.cache.has(djRoleId);
}

export async function requireDj(
  settings: GuildConfigService,
  guildId: string,
  member: GuildMember,
): Promise<void> {
  const cfg = await settings.get(guildId);
  if (!isDj(member, cfg.djRoleId)) {
    throw new UserFacingError('dj only', 'errors.music.djOnly');
  }
}
