import { DEFAULT_LOCALE, MAX_VOLUME } from '@wesbot/shared';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';
import { UserFacingError } from '../../../types';

const ACCENT_CYAN = 0x22d3ee;

const settings: SlashCommand = {
  category: 'config',
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.settings.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.settings.description'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('show')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.settings.show.description'))
        .setDescriptionLocalizations(i18n.localizations('commands.settings.show.description')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('dj')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.settings.dj.description'))
        .setDescriptionLocalizations(i18n.localizations('commands.settings.dj.description'))
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.settings.dj.roleOption'))
            .setDescriptionLocalizations(i18n.localizations('commands.settings.dj.roleOption'))
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('247')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.settings.247.description'))
        .setDescriptionLocalizations(i18n.localizations('commands.settings.247.description'))
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.settings.247.enabledOption'))
            .setDescriptionLocalizations(i18n.localizations('commands.settings.247.enabledOption'))
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('volume')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.settings.volume.description'))
        .setDescriptionLocalizations(i18n.localizations('commands.settings.volume.description'))
        .addIntegerOption((opt) =>
          opt
            .setName('level')
            .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.settings.volume.levelOption'))
            .setDescriptionLocalizations(i18n.localizations('commands.settings.volume.levelOption'))
            .setMinValue(0)
            .setMaxValue(MAX_VOLUME)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('voteskip')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.settings.voteskip.description'))
        .setDescriptionLocalizations(i18n.localizations('commands.settings.voteskip.description'))
        .addIntegerOption((opt) =>
          opt
            .setName('percent')
            .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.settings.voteskip.thresholdOption'))
            .setDescriptionLocalizations(
              i18n.localizations('commands.settings.voteskip.thresholdOption'),
            )
            .setMinValue(10)
            .setMaxValue(100)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('autodisconnect')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.settings.autodisconnect.description'))
        .setDescriptionLocalizations(
          i18n.localizations('commands.settings.autodisconnect.description'),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('minutes')
            .setDescription(
              i18n.t(DEFAULT_LOCALE, 'commands.settings.autodisconnect.minutesOption'),
            )
            .setDescriptionLocalizations(
              i18n.localizations('commands.settings.autodisconnect.minutesOption'),
            )
            .setMinValue(0)
            .setMaxValue(240)
            .setRequired(true),
        ),
    ),
  async execute(interaction, ctx) {
    if (!interaction.inCachedGuild() || !interaction.guild) {
      throw new UserFacingError('guild only', 'errors.music.guildOnly');
    }
    const sub = interaction.options.getSubcommand(true);
    const guildId = interaction.guild.id;

    if (sub === 'show') {
      const cfg = await ctx.container.settings.get(guildId);
      const embed = new EmbedBuilder()
        .setColor(ACCENT_CYAN)
        .setTitle(ctx.t('commands.settings.show.title', { guild: interaction.guild.name }))
        .addFields(
          {
            name: ctx.t('commands.settings.show.fields.dj'),
            value: cfg.djRoleId ? `<@&${cfg.djRoleId}>` : ctx.t('commands.settings.show.none'),
            inline: true,
          },
          {
            name: ctx.t('commands.settings.show.fields.247'),
            value: cfg.twentyFourSeven
              ? ctx.t('commands.settings.enabled')
              : ctx.t('commands.settings.disabled'),
            inline: true,
          },
          {
            name: ctx.t('commands.settings.show.fields.volume'),
            value: `${cfg.defaultVolume}%`,
            inline: true,
          },
          {
            name: ctx.t('commands.settings.show.fields.voteSkip'),
            value: `${Math.round(cfg.voteSkipThreshold * 100)}%`,
            inline: true,
          },
          {
            name: ctx.t('commands.settings.show.fields.autoDisconnect'),
            value:
              cfg.autoDisconnectMinutes === null || cfg.autoDisconnectMinutes === 0
                ? ctx.t('commands.settings.show.none')
                : `${cfg.autoDisconnectMinutes} min`,
            inline: true,
          },
        );
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'dj') {
      const role = interaction.options.getRole('role', false);
      await ctx.container.settings.update(guildId, {
        djRoleId: role ? role.id : null,
      });
      await interaction.reply({
        content: role
          ? ctx.t('commands.settings.dj.set', { roleId: role.id })
          : ctx.t('commands.settings.dj.cleared'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === '247') {
      const enabled = interaction.options.getBoolean('enabled', true);
      await ctx.container.settings.update(guildId, { twentyFourSeven: enabled });
      await interaction.reply({
        content: ctx.t('commands.settings.247.set', {
          state: enabled ? ctx.t('commands.settings.enabled') : ctx.t('commands.settings.disabled'),
        }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'volume') {
      const level = interaction.options.getInteger('level', true);
      await ctx.container.settings.update(guildId, { defaultVolume: level });
      await interaction.reply({
        content: ctx.t('commands.settings.volume.set', { volume: level }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'voteskip') {
      const percent = interaction.options.getInteger('percent', true);
      await ctx.container.settings.update(guildId, {
        voteSkipThreshold: percent / 100,
      });
      await interaction.reply({
        content: ctx.t('commands.settings.voteskip.set', { percent }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'autodisconnect') {
      const minutes = interaction.options.getInteger('minutes', true);
      await ctx.container.settings.update(guildId, {
        autoDisconnectMinutes: minutes === 0 ? null : minutes,
      });
      await interaction.reply({
        content:
          minutes === 0
            ? ctx.t('commands.settings.autodisconnect.disabled')
            : ctx.t('commands.settings.autodisconnect.set', { minutes }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  },
};

export default settings;
