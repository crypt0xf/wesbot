import type { PrismaClient } from '@wesbot/database';
import type { Guild, GuildMember, User } from 'discord.js';

export interface WarnResult {
  warnId: string;
  totalActive: number;
}

export class ModerationService {
  constructor(private readonly prisma: PrismaClient) {}

  async warn(
    guild: Guild,
    target: GuildMember | User,
    moderator: GuildMember | User,
    reason: string,
  ): Promise<WarnResult> {
    const guildId = BigInt(guild.id);
    const userId = BigInt(target.id);
    const moderatorId = BigInt(moderator.id);

    const [warn, totalActive] = await Promise.all([
      this.prisma.warn.create({
        data: { guildId, userId, moderatorId, reason },
      }),
      this.prisma.warn.count({ where: { guildId, userId, active: true } }).then((n) => n + 1),
    ]);

    await this.prisma.modLog.create({
      data: { guildId, type: 'warn', targetUserId: userId, moderatorId, reason },
    });

    return { warnId: warn.id, totalActive };
  }

  async removeWarn(warnId: string, guildId: string): Promise<boolean> {
    const updated = await this.prisma.warn.updateMany({
      where: { id: warnId, guildId: BigInt(guildId), active: true },
      data: { active: false },
    });
    return updated.count > 0;
  }

  async listWarns(guildId: string, userId: string) {
    return this.prisma.warn.findMany({
      where: { guildId: BigInt(guildId), userId: BigInt(userId), active: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async logAction(
    guildId: string,
    type: 'kick' | 'ban' | 'tempban' | 'unban' | 'timeout' | 'untimeout' | 'purge',
    targetUserId: string,
    moderatorId: string,
    reason?: string,
    durationSec?: number,
  ): Promise<void> {
    const isSnowflake = (id: string) => /^\d{17,20}$/.test(id);
    if (!isSnowflake(moderatorId) || !isSnowflake(targetUserId) || !isSnowflake(guildId)) {
      return; // stale session token — action succeeded, skip log
    }
    await this.prisma.modLog.create({
      data: {
        guildId: BigInt(guildId),
        type,
        targetUserId: BigInt(targetUserId),
        moderatorId: BigInt(moderatorId),
        reason,
        durationSec,
      },
    });
  }
}
