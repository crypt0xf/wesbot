import { DEFAULT_LOCALE } from '@wesbot/shared';
import { SlashCommandBuilder, type VoiceBasedChannel } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';

import { isDj, requireVoiceContext } from './_guards';

function humanCount(channel: VoiceBasedChannel): number {
  return channel.members.filter((m) => !m.user.bot).size;
}

function requiredVotes(humans: number, threshold: number): number {
  return Math.max(1, Math.ceil(humans * threshold));
}

const voteskip: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('voteskip')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.voteskip.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.voteskip.description')),
  async execute(interaction, ctx) {
    const { guild, member, voiceChannel } = requireVoiceContext(interaction);
    const cfg = await ctx.container.settings.get(guild.id);

    if (isDj(member, cfg.djRoleId)) {
      await ctx.container.music.skip(guild.id);
      await interaction.reply(ctx.t('commands.voteskip.bypass'));
      return;
    }

    const humans = humanCount(voiceChannel);
    if (humans <= 1) {
      await ctx.container.music.skip(guild.id);
      await interaction.reply(ctx.t('errors.music.noVoteNeeded'));
      return;
    }

    const needed = requiredVotes(humans, cfg.voteSkipThreshold);
    const { count, alreadyVoted } = ctx.container.music.registerSkipVote(
      guild.id,
      member.id,
      needed,
    );

    if (alreadyVoted) {
      await interaction.reply(ctx.t('commands.voteskip.alreadyVoted'));
      return;
    }

    if (count >= needed) {
      await ctx.container.music.skip(guild.id);
      await interaction.reply(ctx.t('commands.voteskip.passed'));
      return;
    }

    await interaction.reply(ctx.t('commands.voteskip.counted', { current: count, needed }));
  },
};

export default voteskip;
