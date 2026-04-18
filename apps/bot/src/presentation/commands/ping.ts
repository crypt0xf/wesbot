import { DEFAULT_LOCALE } from '@wesbot/shared';
import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../infrastructure/i18n';
import type { SlashCommand } from '../../types';

const ping: SlashCommand = {
  category: 'general',
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.ping.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.ping.description')),
  async execute(interaction, ctx) {
    const sentAt = Date.now();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const rtt = Date.now() - sentAt;
    const ws = Math.max(0, Math.round(interaction.client.ws.ping));
    await interaction.editReply(ctx.t('commands.ping.reply', { ws, rtt }));
  },
};

export default ping;
