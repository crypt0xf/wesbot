import { DEFAULT_LOCALE } from '@wesbot/shared';
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';
import { PermissionError } from '../../../types';

const ban: SlashCommand = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.ban.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.ban.description'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.ban.userOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.ban.userOption'))
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.ban.reasonOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.ban.reasonOption'))
        .setMaxLength(512),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('days')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.ban.daysOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.ban.daysOption'))
        .setMinValue(0)
        .setMaxValue(7),
    ),
  async execute(interaction, ctx) {
    if (!interaction.guild) throw new PermissionError();
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const deleteMessageSeconds = (interaction.options.getInteger('days') ?? 0) * 86400;

    await interaction.deferReply();

    await interaction.guild.members.ban(target, { reason, deleteMessageSeconds });
    await ctx.container.moderation.logAction(
      interaction.guild.id,
      'ban',
      target.id,
      interaction.user.id,
      reason,
    );

    await interaction.editReply(ctx.t('commands.ban.success', { user: target.toString(), reason }));
  },
};

export default ban;
