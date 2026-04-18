import { DEFAULT_LOCALE } from '@wesbot/shared';
import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';

import { requireVoiceContext } from './_guards';

const resume: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.resume.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.resume.description')),
  async execute(interaction, ctx) {
    const { guild } = requireVoiceContext(interaction);
    const player = ctx.container.music.getPlayer(guild.id);
    if (!player?.paused) {
      await interaction.reply({
        content: ctx.t('commands.resume.notPaused'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await ctx.container.music.resume(guild.id);
    await interaction.reply(ctx.t('commands.resume.resumed'));
  },
};

export default resume;
