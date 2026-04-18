import { ActivityType, Events } from 'discord.js';

import type { BotEvent } from '../../types';

/**
 * Fired once when the gateway is ready. Logs identity/scope and sets a
 * baseline presence. Music-related presence swaps in a later phase.
 */
export const ready: BotEvent<typeof Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  execute(client, container) {
    const guilds = client.guilds.cache.size;
    const users = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
    container.logger.info(
      {
        user: client.user.tag,
        id: client.user.id,
        guilds,
        users,
        commands: container.commands.size,
      },
      'bot ready',
    );

    client.user.setPresence({
      activities: [{ name: '/help', type: ActivityType.Listening }],
      status: 'online',
    });
  },
};
