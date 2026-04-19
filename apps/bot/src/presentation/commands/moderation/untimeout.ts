import { DEFAULT_LOCALE } from '@wesbot/shared';
import { GuildMember, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';
import { PermissionError } from '../../../types';

const untimeout: SlashCommand = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.untimeout.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.untimeout.description'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.untimeout.userOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.untimeout.userOption'))
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.untimeout.reasonOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.untimeout.reasonOption'))
        .setMaxLength(512),
    ),
  async execute(interaction, ctx) {
    if (!interaction.guild) throw new PermissionError();
    const target = interaction.options.getMember('user');
    if (!(target instanceof GuildMember)) return;
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    await interaction.deferReply();

    await target.timeout(null, reason);
    await ctx.container.moderation.logAction(
      interaction.guild.id,
      'untimeout',
      target.id,
      interaction.user.id,
      reason,
    );

    await interaction.editReply(ctx.t('commands.untimeout.success', { user: target.toString() }));
  },
};

export default untimeout;
