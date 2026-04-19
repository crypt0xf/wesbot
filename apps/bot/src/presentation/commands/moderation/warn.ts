import { DEFAULT_LOCALE } from '@wesbot/shared';
import { GuildMember, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';
import { PermissionError } from '../../../types';

const warn: SlashCommand = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.warn.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.warn.description'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.warn.userOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.warn.userOption'))
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.warn.reasonOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.warn.reasonOption'))
        .setRequired(true)
        .setMaxLength(512),
    ),
  async execute(interaction, ctx) {
    if (!interaction.guild) throw new PermissionError();
    const target = interaction.options.getMember('user');
    if (!(target instanceof GuildMember)) return;
    const reason = interaction.options.getString('reason', true);

    await interaction.deferReply();

    const result = await ctx.container.moderation.warn(
      interaction.guild,
      target,
      interaction.user,
      reason,
    );

    await interaction.editReply(
      ctx.t('commands.warn.success', {
        user: target.toString(),
        total: result.totalActive,
        reason,
      }),
    );
  },
};

export default warn;
