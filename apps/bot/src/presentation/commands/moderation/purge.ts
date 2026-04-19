import { DEFAULT_LOCALE } from '@wesbot/shared';
import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
  MessageFlags,
} from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';
import { PermissionError } from '../../../types';

const purge: SlashCommand = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.purge.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.purge.description'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.purge.amountOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.purge.amountOption'))
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.purge.userOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.purge.userOption')),
    ),
  async execute(interaction, ctx) {
    if (!interaction.guild || !(interaction.channel instanceof TextChannel)) {
      throw new PermissionError();
    }
    const amount = interaction.options.getInteger('amount', true);
    const filterUser = interaction.options.getUser('user');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const messages = await interaction.channel.messages.fetch({ limit: amount });
    const toDelete = filterUser
      ? messages.filter((m) => m.author.id === filterUser.id)
      : messages;

    const deleted = await interaction.channel.bulkDelete(toDelete, true);

    if (deleted.size === 0) {
      await interaction.editReply(ctx.t('commands.purge.noneDeleted'));
      return;
    }

    await ctx.container.moderation.logAction(
      interaction.guild.id,
      'purge',
      filterUser?.id ?? interaction.user.id,
      interaction.user.id,
      `Purged ${deleted.size} messages`,
    );

    await interaction.editReply(ctx.t('commands.purge.success', { count: deleted.size }));
  },
};

export default purge;
