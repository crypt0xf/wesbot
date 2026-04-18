import { DEFAULT_LOCALE } from '@wesbot/shared';
import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';

import { requireVoiceContext } from './_guards';

const play: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.play.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.play.description'))
    .addStringOption((opt) =>
      opt
        .setName('query')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.play.queryOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.play.queryOption'))
        .setRequired(true),
    ),
  async execute(interaction, ctx) {
    const { guild, voiceChannel } = requireVoiceContext(interaction);
    const query = interaction.options.getString('query', true);

    await interaction.deferReply();

    const result = await ctx.container.music.play({
      guildId: guild.id,
      voiceChannelId: voiceChannel.id,
      textChannelId: interaction.channelId,
      shardId: guild.shardId,
      query,
      requesterId: interaction.user.id,
    });

    const first = result.added[0];
    if (!first) {
      await interaction.editReply({
        content: ctx.t('errors.music.noResults'),
        flags: MessageFlags.SuppressEmbeds,
      });
      return;
    }

    if (result.kind === 'playlist') {
      await interaction.editReply(
        ctx.t('commands.play.addedPlaylist', {
          name: result.playlistName ?? '',
          count: result.added.length,
        }),
      );
      return;
    }

    if (result.startedImmediately) {
      await interaction.editReply(ctx.t('commands.play.startedPlaying', { title: first.title }));
      return;
    }

    await interaction.editReply(ctx.t('commands.play.added', { title: first.title }));
  },
};

export default play;
