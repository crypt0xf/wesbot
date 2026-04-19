import { DEFAULT_LOCALE, type Track } from '@wesbot/shared';
import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';
import { UserFacingError } from '../../../types';

import { requireVoiceContext } from './_guards';

const ACCENT_CYAN = 0x22d3ee;

const playlist: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.playlist.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.playlist.description'))
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('save')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.playlist.save.description'))
        .setDescriptionLocalizations(i18n.localizations('commands.playlist.save.description'))
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.playlist.save.nameOption'))
            .setDescriptionLocalizations(i18n.localizations('commands.playlist.save.nameOption'))
            .setRequired(true)
            .setMaxLength(64),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('play')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.playlist.play.description'))
        .setDescriptionLocalizations(i18n.localizations('commands.playlist.play.description'))
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.playlist.play.nameOption'))
            .setDescriptionLocalizations(i18n.localizations('commands.playlist.play.nameOption'))
            .setRequired(true)
            .setMaxLength(64),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.playlist.list.description'))
        .setDescriptionLocalizations(i18n.localizations('commands.playlist.list.description')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.playlist.delete.description'))
        .setDescriptionLocalizations(i18n.localizations('commands.playlist.delete.description'))
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.playlist.delete.nameOption'))
            .setDescriptionLocalizations(i18n.localizations('commands.playlist.delete.nameOption'))
            .setRequired(true)
            .setMaxLength(64),
        ),
    ),
  async execute(interaction, ctx) {
    const sub = interaction.options.getSubcommand(true);
    const ownerId = interaction.user.id;

    if (sub === 'list') {
      const items = await ctx.container.playlists.list(ownerId);
      const embed = new EmbedBuilder()
        .setColor(ACCENT_CYAN)
        .setTitle(ctx.t('commands.playlist.list.title'));
      if (items.length === 0) {
        embed.setDescription(ctx.t('commands.playlist.list.empty'));
      } else {
        embed.setDescription(
          items
            .map((item) =>
              ctx.t('commands.playlist.list.item', {
                name: item.name,
                count: item.trackCount,
              }),
            )
            .join('\n'),
        );
      }
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'save') {
      if (!interaction.inCachedGuild() || !interaction.guild) {
        throw new UserFacingError('guild only', 'errors.music.guildOnly');
      }
      const name = interaction.options.getString('name', true);
      const session = ctx.container.music.getSession(interaction.guild.id);
      const tracks: Track[] = [];
      if (session?.current) {
        tracks.push(session.current);
      }
      tracks.push(...(session?.queue ?? []));
      if (tracks.length === 0) {
        await interaction.reply({
          content: ctx.t('commands.playlist.save.emptyQueue'),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const saved = await ctx.container.playlists.save({
        ownerId,
        guildId: interaction.guild.id,
        name,
        tracks,
      });
      await interaction.reply({
        content: ctx.t('commands.playlist.save.saved', {
          name: saved.name,
          count: saved.trackCount,
        }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'delete') {
      const name = interaction.options.getString('name', true);
      await ctx.container.playlists.delete(ownerId, name);
      await interaction.reply({
        content: ctx.t('commands.playlist.delete.deleted', { name }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'play') {
      const { guild, voiceChannel } = requireVoiceContext(interaction);
      const name = interaction.options.getString('name', true);
      await interaction.deferReply();
      const detail = await ctx.container.playlists.load(ownerId, name);
      await ctx.container.music.enqueueTracks({
        guildId: guild.id,
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channelId,
        shardId: guild.shardId,
        tracks: detail.tracks,
      });
      await interaction.editReply(
        ctx.t('commands.playlist.play.loaded', {
          name: detail.name,
          count: detail.trackCount,
        }),
      );
      return;
    }
  },
};

export default playlist;
