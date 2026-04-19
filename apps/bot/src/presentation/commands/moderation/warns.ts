import { DEFAULT_LOCALE } from '@wesbot/shared';
import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';
import { PermissionError } from '../../../types';

const warns: SlashCommand = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('warns')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.warns.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.warns.description'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.warns.userOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.warns.userOption'))
        .setRequired(true),
    ),
  async execute(interaction, ctx) {
    if (!interaction.guild) throw new PermissionError();
    const target = interaction.options.getUser('user', true);

    await interaction.deferReply();

    const warnList = await ctx.container.moderation.listWarns(interaction.guild.id, target.id);

    if (warnList.length === 0) {
      await interaction.editReply(ctx.t('commands.warns.empty'));
      return;
    }

    const lines = warnList.map((w) =>
      ctx.t('commands.warns.entry', {
        id: w.id.slice(0, 8),
        reason: w.reason,
        date: w.createdAt.toLocaleDateString('pt-BR'),
      }),
    );

    const embed = new EmbedBuilder()
      .setTitle(ctx.t('commands.warns.title', { user: target.username }))
      .setDescription(lines.join('\n'))
      .setColor(0xf59e0b);

    await interaction.editReply({ embeds: [embed] });
  },
};

export default warns;
