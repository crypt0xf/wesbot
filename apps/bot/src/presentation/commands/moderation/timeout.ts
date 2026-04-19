import { DEFAULT_LOCALE } from '@wesbot/shared';
import { GuildMember, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';
import { PermissionError, ValidationError } from '../../../types';

const DURATION_RE = /^(\d+)(s|m|h|d)$/i;
const UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
const MAX_SEC = 28 * 86400;

function parseDuration(raw: string): number | null {
  const m = DURATION_RE.exec(raw.trim());
  if (!m) return null;
  const secs = parseInt(m[1]!, 10) * (UNITS[m[2]!.toLowerCase()] ?? 1);
  return secs > 0 && secs <= MAX_SEC ? secs : null;
}

function formatDuration(secs: number): string {
  if (secs >= 86400) return `${Math.floor(secs / 86400)}d`;
  if (secs >= 3600) return `${Math.floor(secs / 3600)}h`;
  if (secs >= 60) return `${Math.floor(secs / 60)}m`;
  return `${secs}s`;
}

const timeout: SlashCommand = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.timeout.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.timeout.description'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.timeout.userOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.timeout.userOption'))
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('duration')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.timeout.durationOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.timeout.durationOption'))
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.timeout.reasonOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.timeout.reasonOption'))
        .setMaxLength(512),
    ),
  async execute(interaction, ctx) {
    if (!interaction.guild) throw new PermissionError();
    const target = interaction.options.getMember('user');
    if (!(target instanceof GuildMember)) return;
    const raw = interaction.options.getString('duration', true);
    const secs = parseDuration(raw);
    if (!secs) throw new ValidationError(ctx.t('commands.timeout.invalidDuration'));
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    await interaction.deferReply();

    await target.timeout(secs * 1000, reason);
    await ctx.container.moderation.logAction(
      interaction.guild.id,
      'timeout',
      target.id,
      interaction.user.id,
      reason,
      secs,
    );

    await interaction.editReply(
      ctx.t('commands.timeout.success', {
        user: target.toString(),
        duration: formatDuration(secs),
        reason,
      }),
    );
  },
};

export default timeout;
