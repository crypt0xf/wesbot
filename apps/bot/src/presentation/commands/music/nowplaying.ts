import { DEFAULT_LOCALE } from '@wesbot/shared';
import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';
import { buildNowPlayingEmbed, buildNowPlayingRow } from '../../components/now-playing';

import { requireVoiceContext } from './_guards';

const nowplaying: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.nowplaying.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.nowplaying.description')),
  async execute(interaction, ctx) {
    const { guild } = requireVoiceContext(interaction);
    const session = ctx.container.music.getSession(guild.id);
    const player = ctx.container.music.getPlayer(guild.id);
    if (!session?.current) {
      await interaction.reply({
        content: ctx.t('commands.nowplaying.nothing'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const embed = buildNowPlayingEmbed(session.current, session, ctx, player?.position);
    const row = buildNowPlayingRow(session, ctx, player?.paused ?? false);
    await interaction.reply({ embeds: [embed], components: [row] });
  },
};

export default nowplaying;
