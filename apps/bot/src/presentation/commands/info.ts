import { APP_NAME, DEFAULT_LOCALE } from '@wesbot/shared';
import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../infrastructure/i18n';
import type { SlashCommand } from '../../types';
import { VERSION } from '../../version';

const ACCENT_CYAN = 0x22d3ee;

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

const info: SlashCommand = {
  category: 'general',
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.info.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.info.description')),
  async execute(interaction, ctx) {
    const client = interaction.client;
    const guilds = client.guilds.cache.size;
    const users = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
    const memoryMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    const uptimeMs = Date.now() - ctx.container.startedAt;
    const ws = Math.max(0, Math.round(client.ws.ping));

    const embed = new EmbedBuilder()
      .setColor(ACCENT_CYAN)
      .setTitle(ctx.t('commands.info.title'))
      .setDescription(`_${ctx.t('commands.info.subtitle')}_`)
      .addFields(
        {
          name: ctx.t('commands.info.fields.uptime'),
          value: formatUptime(uptimeMs),
          inline: true,
        },
        {
          name: ctx.t('commands.info.fields.guilds'),
          value: guilds.toLocaleString(ctx.locale),
          inline: true,
        },
        {
          name: ctx.t('commands.info.fields.users'),
          value: users.toLocaleString(ctx.locale),
          inline: true,
        },
        {
          name: ctx.t('commands.info.fields.memory'),
          value: `${memoryMb} MB`,
          inline: true,
        },
        {
          name: ctx.t('commands.info.fields.node'),
          value: process.version,
          inline: true,
        },
        {
          name: ctx.t('commands.info.fields.version'),
          value: `${APP_NAME} v${VERSION}`,
          inline: true,
        },
        {
          name: ctx.t('commands.info.fields.latency'),
          value: `${ws}ms`,
          inline: true,
        },
      )
      .setFooter({ text: ctx.t('commands.info.footerTip') });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default info;
