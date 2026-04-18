import { Events } from 'discord.js';

import type { BotEvent } from '../../types';

export const guildCreate: BotEvent<typeof Events.GuildCreate> = {
  name: Events.GuildCreate,
  execute(guild, container) {
    container.logger.info(
      {
        guild: guild.id,
        name: guild.name,
        members: guild.memberCount,
        owner: guild.ownerId,
      },
      'joined guild',
    );
  },
};

export const guildDelete: BotEvent<typeof Events.GuildDelete> = {
  name: Events.GuildDelete,
  execute(guild, container) {
    // `available: false` means an outage, not a real leave — skip those.
    if (!guild.available) {
      return;
    }
    container.logger.info({ guild: guild.id, name: guild.name }, 'left guild');
  },
};
