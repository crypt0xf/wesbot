import { DEFAULT_LOCALE } from '@wesbot/shared';
import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';

import { requireDj, requireVoiceContext } from './_guards';

const pause: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.pause.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.pause.description')),
  async execute(interaction, ctx) {
    const { guild, member } = requireVoiceContext(interaction);
    await requireDj(ctx.container.settings, guild.id, member);
    const player = ctx.container.music.getPlayer(guild.id);
    if (player?.paused) {
      await interaction.reply({
        content: ctx.t('commands.pause.alreadyPaused'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await ctx.container.music.pause(guild.id);
    await interaction.reply(ctx.t('commands.pause.paused'));
  },
};

export default pause;
