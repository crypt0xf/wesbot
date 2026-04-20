import { Events } from 'discord.js';

import type { BotEvent } from '../../types';

function publishMemberStats(
  guildId: string,
  total: number,
  bots: number,
  container: Parameters<BotEvent<typeof Events.GuildCreate>['execute']>[1],
): void {
  void container.redis
    .hset(`stats:members:${guildId}`, 'total', total, 'bots', bots)
    .catch(() => undefined);
}

export const guildCreate: BotEvent<typeof Events.GuildCreate> = {
  name: Events.GuildCreate,
  execute(guild, container) {
    container.logger.info(
      { guild: guild.id, name: guild.name, members: guild.memberCount, owner: guild.ownerId },
      'joined guild',
    );
    const bots = guild.members.cache.filter((m) => m.user.bot).size;
    publishMemberStats(guild.id, guild.memberCount, bots, container);
  },
};

export const guildDelete: BotEvent<typeof Events.GuildDelete> = {
  name: Events.GuildDelete,
  execute(guild, container) {
    if (!guild.available) return;
    container.logger.info({ guild: guild.id, name: guild.name }, 'left guild');
    void container.redis.del(`stats:members:${guild.id}`).catch(() => undefined);
  },
};

export const guildMemberAdd: BotEvent<typeof Events.GuildMemberAdd> = {
  name: Events.GuildMemberAdd,
  execute(member, container) {
    const guild = member.guild;
    const bots = guild.members.cache.filter((m) => m.user.bot).size;
    publishMemberStats(guild.id, guild.memberCount, bots, container);
  },
};

export const guildMemberRemove: BotEvent<typeof Events.GuildMemberRemove> = {
  name: Events.GuildMemberRemove,
  execute(member, container) {
    const guild = member.guild;
    const bots = guild.members.cache.filter((m) => m.user.bot).size;
    publishMemberStats(guild.id, guild.memberCount, bots, container);
  },
};
