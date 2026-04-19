import { DEFAULT_LOCALE } from '@wesbot/shared';
import { SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';

import { requireDj, requireVoiceContext } from './_guards';

const autoplay: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.autoplay.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.autoplay.description'))
    .addBooleanOption((opt) =>
      opt
        .setName('enabled')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.autoplay.enabledOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.autoplay.enabledOption'))
        .setRequired(true),
    ),
  async execute(interaction, ctx) {
    const { guild, member } = requireVoiceContext(interaction);
    await requireDj(ctx.container.settings, guild.id, member);
    const enabled = interaction.options.getBoolean('enabled', true);
    ctx.container.music.setAutoplay(guild.id, enabled);
    await interaction.reply(
      ctx.t('commands.autoplay.set', {
        state: enabled ? ctx.t('commands.settings.enabled') : ctx.t('commands.settings.disabled'),
      }),
    );
  },
};

export default autoplay;
