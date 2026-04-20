import { DEFAULT_LOCALE } from '@wesbot/shared';
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';
import { PermissionError } from '../../../types';

const unban: SlashCommand = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.unban.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.unban.description'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((opt) =>
      opt
        .setName('user')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.unban.userOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.unban.userOption'))
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.unban.reasonOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.unban.reasonOption'))
        .setMaxLength(512),
    ),
  async execute(interaction, ctx) {
    if (!interaction.guild) throw new PermissionError();
    const userId = interaction.options.getString('user', true).trim();
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    await interaction.deferReply();

    const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!ban) {
      await interaction.editReply(ctx.t('commands.unban.notBanned'));
      return;
    }

    await interaction.guild.members.unban(userId, reason);
    await ctx.container.moderation.logAction(
      interaction.guild.id,
      'unban',
      userId,
      interaction.user.id,
      reason,
    );

    await interaction.editReply(ctx.t('commands.unban.success', { user: `<@${userId}>` }));
  },
};

export default unban;
