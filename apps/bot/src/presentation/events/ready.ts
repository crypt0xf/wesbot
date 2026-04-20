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

    // Clear all persisted queues on startup — stale Redis state must not bleed into a fresh session
    void (async () => {
      const stream = container.redis.scanStream({ match: 'queue:*', count: 100 });
      for await (const batch of stream) {
        if ((batch as string[]).length) {
          await container.redis.del(...(batch as string[]));
        }
      }
    })().catch(() => undefined);

    // Seed member counts for all cached guilds (fetch full member list for accurate bot count)
    for (const guild of client.guilds.cache.values()) {
      guild.members
        .fetch()
        .then((members) => {
          const bots = members.filter((m) => m.user.bot).size;
          return container.redis.hset(
            `stats:members:${guild.id}`,
            'total',
            guild.memberCount,
            'bots',
            bots,
          );
        })
        .catch(() => undefined);
    }
  },
};
