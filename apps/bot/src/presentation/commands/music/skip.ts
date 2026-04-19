import { DEFAULT_LOCALE } from '@wesbot/shared';
import { SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';

import { requireDj, requireVoiceContext } from './_guards';

const skip: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.skip.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.skip.description')),
  async execute(interaction, ctx) {
    const { guild, member } = requireVoiceContext(interaction);
    await requireDj(ctx.container.settings, guild.id, member);
    const session = ctx.container.music.getSession(guild.id);
    const skipped = session?.current;
    const next = await ctx.container.music.skip(guild.id);
    if (!next) {
      await interaction.reply(ctx.t('commands.skip.skippedNoNext'));
      return;
    }
    await interaction.reply(ctx.t('commands.skip.skipped', { title: skipped?.title ?? '' }));
  },
};

export default skip;
