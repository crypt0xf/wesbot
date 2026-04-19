import { DEFAULT_LOCALE } from '@wesbot/shared';
import { SlashCommandBuilder } from 'discord.js';

import type { FilterName } from '../../../application/music/filters';
import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';

import { requireDj, requireVoiceContext } from './_guards';

const PRESETS: readonly FilterName[] = ['off', 'bassboost', 'nightcore', 'eightd'];

const filter: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.filter.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.filter.description'))
    .addStringOption((opt) =>
      opt
        .setName('preset')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.filter.presetOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.filter.presetOption'))
        .setRequired(true)
        .addChoices(
          { name: 'off', value: 'off' },
          { name: 'bassboost', value: 'bassboost' },
          { name: 'nightcore', value: 'nightcore' },
          { name: '8D', value: 'eightd' },
        ),
    ),
  async execute(interaction, ctx) {
    const { guild, member } = requireVoiceContext(interaction);
    await requireDj(ctx.container.settings, guild.id, member);
    const raw = interaction.options.getString('preset', true);
    const preset: FilterName = PRESETS.find((p) => p === raw) ?? 'off';
    await ctx.container.music.applyFilter(guild.id, preset);
    if (preset === 'off') {
      await interaction.reply(ctx.t('commands.filter.cleared'));
      return;
    }
    await interaction.reply(
      ctx.t('commands.filter.applied', { name: ctx.t(`commands.filter.presets.${preset}`) }),
    );
  },
};

export default filter;
