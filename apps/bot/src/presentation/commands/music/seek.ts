import { DEFAULT_LOCALE } from '@wesbot/shared';
import { SlashCommandBuilder } from 'discord.js';

import { i18n } from '../../../infrastructure/i18n';
import type { SlashCommand } from '../../../types';
import { ValidationError } from '../../../types';
import { formatDuration } from '../../components/now-playing';

import { requireDj, requireVoiceContext } from './_guards';

/**
 * Accept either raw seconds (`90`), `mm:ss` (`1:30`), or `hh:mm:ss` (`1:02:03`).
 * Returns milliseconds. Throws ValidationError on anything else.
 */
function parsePosition(input: string): number {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new ValidationError('unparseable seek', 'errors.music.invalidSeek');
  }
  const [, hoursRaw, minutesRaw, secondsRaw] = match;
  const hours = hoursRaw ? Number(hoursRaw) : 0;
  const minutes = Number(minutesRaw);
  const seconds = Number(secondsRaw);
  if (seconds >= 60) {
    throw new ValidationError('seconds out of range', 'errors.music.invalidSeek');
  }
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

const seek: SlashCommand = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.seek.description'))
    .setDescriptionLocalizations(i18n.localizations('commands.seek.description'))
    .addStringOption((opt) =>
      opt
        .setName('position')
        .setDescription(i18n.t(DEFAULT_LOCALE, 'commands.seek.positionOption'))
        .setDescriptionLocalizations(i18n.localizations('commands.seek.positionOption'))
        .setRequired(true),
    ),
  async execute(interaction, ctx) {
    const { guild, member } = requireVoiceContext(interaction);
    await requireDj(ctx.container.settings, guild.id, member);
    const positionMs = parsePosition(interaction.options.getString('position', true));
    await ctx.container.music.seek(guild.id, positionMs);
    await interaction.reply(
      ctx.t('commands.seek.seeked', { position: formatDuration(positionMs) }),
    );
  },
};

export default seek;
