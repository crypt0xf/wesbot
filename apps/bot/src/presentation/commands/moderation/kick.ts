import { DEFAULT_LOCALE } from '@wesbot/shared';
import { GuildMember, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';
import { PermissionError } from '../../../types';

const kick: SlashCommand = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.kick.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.kick.description'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.kick.userOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.kick.userOption'))
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.kick.reasonOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.kick.reasonOption'))
        .setMaxLength(512),
    ),
  async execute(interaction, ctx) {
    if (!interaction.guild) throw new PermissionError();
    const target = interaction.options.getMember('user');
    if (!(target instanceof GuildMember)) return;
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    await interaction.deferReply();

    await target.kick(reason);
    await ctx.container.moderation.logAction(
      interaction.guild.id,
      'kick',
      target.id,
      interaction.user.id,
      reason,
    );

    await interaction.editReply(
      ctx.t('commands.kick.success', { user: target.toString(), reason }),
    );
  },
};

export default kick;
