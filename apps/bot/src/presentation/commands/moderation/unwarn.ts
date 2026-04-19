import { DEFAULT_LOCALE } from '@wesbot/shared';
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';
import { PermissionError } from '../../../types';

const unwarn: SlashCommand = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.unwarn.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.unwarn.description'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption((opt) =>
      opt
        .setName('id')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.unwarn.idOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.unwarn.idOption'))
        .setRequired(true),
    ),
  async execute(interaction, ctx) {
    if (!interaction.guild) throw new PermissionError();
    const warnId = interaction.options.getString('id', true);

    await interaction.deferReply();

    const removed = await ctx.container.moderation.removeWarn(warnId, interaction.guild.id);

    if (!removed) {
      await interaction.editReply(ctx.t('commands.unwarn.notFound'));
      return;
    }

    await interaction.editReply(ctx.t('commands.unwarn.success', { id: warnId }));
  },
};

export default unwarn;
