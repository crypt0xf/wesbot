import { DEFAULT_LOCALE, type LoopMode } from '@wesbot/shared';
import { SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';

import { requireVoiceContext } from './_guards';

const LOOP_MODES: readonly LoopMode[] = ['off', 'track', 'queue'];

const loop: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.loop.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.loop.description'))
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.loop.modeOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.loop.modeOption'))
        .setRequired(true)
        .addChoices(
          { name: 'off', value: 'off' },
          { name: 'track', value: 'track' },
          { name: 'queue', value: 'queue' },
        ),
    ),
  async execute(interaction, ctx) {
    const { guild } = requireVoiceContext(interaction);
    const raw = interaction.options.getString('mode', true);
    const mode = LOOP_MODES.find((m) => m === raw) ?? 'off';
    ctx.container.music.setLoop(guild.id, mode);
    await interaction.reply(
      ctx.t('commands.loop.set', { mode: ctx.t(`commands.loop.modes.${mode}`) }),
    );
  },
};

export default loop;
