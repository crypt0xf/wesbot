import { DEFAULT_LOCALE } from '@wesbot/shared';
import { SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';

import { requireVoiceContext } from './_guards';

const stop: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.stop.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.stop.description')),
  async execute(interaction, ctx) {
    const { guild } = requireVoiceContext(interaction);
    await ctx.container.music.stop(guild.id);
    await interaction.reply(ctx.t('commands.stop.stopped'));
  },
};

export default stop;
