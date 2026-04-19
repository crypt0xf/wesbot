import { DEFAULT_LOCALE } from '@wesbot/shared';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';
import { NotFoundError, UserFacingError } from '../../../types';

const ACCENT_CYAN = 0x22d3ee;
const MAX_DESCRIPTION = 4000;

const lyrics: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.lyrics.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.lyrics.description'))
    .addStringOption((opt) =>
      opt
        .setName('query')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.lyrics.queryOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.lyrics.queryOption'))
        .setRequired(false),
    ),
  async execute(interaction, ctx) {
    const raw = interaction.options.getString('query', false)?.trim();
    await interaction.deferReply();

    let result;
    if (raw && raw.length > 0) {
      result = await ctx.container.lyrics.search(raw);
    } else {
      if (!interaction.inCachedGuild() || !interaction.guild) {
        throw new UserFacingError('guild only', 'errors.music.guildOnly');
      }
      const session = ctx.container.music.getSession(interaction.guild.id);
      const track = session?.current;
      if (!track) {
        throw new UserFacingError('not playing', 'errors.music.notPlaying');
      }
      result = await ctx.container.lyrics.lookup({
        title: track.title,
        artist: track.author,
        durationMs: track.duration,
      });
    }

    if (!result) {
      throw new NotFoundError('no lyrics', 'commands.lyrics.notFound');
    }

    const body =
      result.plainLyrics.length > MAX_DESCRIPTION
        ? `${result.plainLyrics.slice(0, MAX_DESCRIPTION - 1)}…`
        : result.plainLyrics;

    const embed = new EmbedBuilder()
      .setColor(ACCENT_CYAN)
      .setTitle(ctx.t('commands.lyrics.header', { title: result.title, artist: result.artist }))
      .setDescription(body);

    await interaction.editReply({ embeds: [embed] });
  },
};

export default lyrics;
