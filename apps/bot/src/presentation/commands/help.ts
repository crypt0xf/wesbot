import { DEFAULT_LOCALE } from '@wesbot/shared';
import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../infrastructure/i18n';
import type { SlashCommand } from '../../types';

const ACCENT_CYAN = 0x22d3ee;

const CATEGORY_ORDER = ['general', 'music', 'moderation', 'config', 'fun'] as const;
type Category = (typeof CATEGORY_ORDER)[number];

const help: SlashCommand = {
  category: 'general',
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.help.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.help.description')),
  async execute(interaction, ctx) {
    const groups = new Map<Category, SlashCommand[]>();
    for (const cmd of ctx.container.commands.values()) {
      if (cmd.listed === false) continue;
      const category = cmd.category ?? 'general';
      const bucket = groups.get(category) ?? [];
      bucket.push(cmd);
      groups.set(category, bucket);
    }

    const embed = new EmbedBuilder()
      .setColor(ACCENT_CYAN)
      .setTitle(ctx.t('commands.help.title'))
      .setFooter({ text: ctx.t('commands.help.footerTip') });

    if (groups.size === 0) {
      embed.setDescription(ctx.t('commands.help.emptyState'));
    } else {
      for (const category of CATEGORY_ORDER) {
        const bucket = groups.get(category);
        if (!bucket || bucket.length === 0) continue;
        const lines = bucket
          .slice()
          .sort((a, b) => a.data.name.localeCompare(b.data.name))
          .map((cmd) => {
            const key = `commands.${cmd.data.name}.description`;
            const localized = ctx.t(key);
            const description = localized === key ? cmd.data.description : localized;
            return `\`/${cmd.data.name}\` — ${description}`;
          });
        embed.addFields({
          name: ctx.t(`commands.help.categories.${category}`),
          value: lines.join('\n'),
        });
      }
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default help;
