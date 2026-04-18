import { DEFAULT_LOCALE } from '@wesbot/shared';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';
import { formatTrackLine } from '../../components/now-playing';

import { requireVoiceContext } from './_guards';

const ACCENT_CYAN = 0x22d3ee;
const PAGE_SIZE = 10;

const queue: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.queue.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.queue.description')),
  async execute(interaction, ctx) {
    const { guild } = requireVoiceContext(interaction);
    const session = ctx.container.music.getSession(guild.id);

    if (!session || (!session.current && session.queue.length === 0)) {
      await interaction.reply(ctx.t('commands.queue.empty'));
      return;
    }

    const embed = new EmbedBuilder().setColor(ACCENT_CYAN).setTitle(ctx.t('commands.queue.title'));

    if (session.current) {
      embed.addFields({
        name: ctx.t('commands.queue.currentTrack'),
        value: formatTrackLine(session.current),
      });
    }

    if (session.queue.length > 0) {
      const upcoming = session.queue
        .slice(0, PAGE_SIZE)
        .map((track, idx) => `\`${idx + 1}.\` ${formatTrackLine(track)}`)
        .join('\n');
      const overflow = session.queue.length - PAGE_SIZE;
      const value =
        overflow > 0
          ? `${upcoming}\n${ctx.t('commands.queue.more', { count: overflow })}`
          : upcoming;
      embed.addFields({
        name: ctx.t('commands.queue.upcoming'),
        value,
      });
    }

    const loopLabel = ctx.t(`commands.loop.modes.${session.loop}`);
    embed.setFooter({
      text: ctx.t('commands.queue.footer', {
        count: session.queue.length,
        loop: loopLabel,
      }),
    });

    await interaction.reply({ embeds: [embed] });
  },
};

export default queue;
