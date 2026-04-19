import type { PrismaClient } from '@wesbot/database';

interface AuditOptions {
  prisma: PrismaClient;
  guildId?: string;
  actorId: string;
  action: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(opts: AuditOptions): Promise<void> {
  await opts.prisma.dashboardAuditLog.create({
    data: {
      guildId: opts.guildId ? BigInt(opts.guildId) : null,
      actorId: BigInt(opts.actorId),
      action: opts.action,
      targetId: opts.targetId,
      metadata: (opts.metadata ?? undefined) as object | undefined,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    },
  });
}
