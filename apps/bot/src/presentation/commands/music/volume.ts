import { DEFAULT_LOCALE, MAX_VOLUME } from '@wesbot/shared';
import { SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';

import { requireVoiceContext } from './_guards';

const volume: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.volume.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.volume.description'))
    .addIntegerOption((opt) =>
      opt
        .setName('level')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.volume.levelOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.volume.levelOption'))
        .setMinValue(0)
        .setMaxValue(MAX_VOLUME)
        .setRequired(false),
    ),
  async execute(interaction, ctx) {
    const { guild } = requireVoiceContext(interaction);
    const level = interaction.options.getInteger('level', false);
    if (level === null) {
      const session = ctx.container.music.getSession(guild.id);
      const current = session?.volume ?? 100;
      await interaction.reply(ctx.t('commands.volume.current', { volume: current }));
      return;
    }
    const applied = await ctx.container.music.setVolume(guild.id, level);
    await interaction.reply(ctx.t('commands.volume.changed', { volume: applied }));
  },
};

export default volume;
