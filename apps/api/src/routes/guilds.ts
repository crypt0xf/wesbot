import type { PrismaClient } from '@wesbot/database';
import { guildSettingsSchema } from '@wesbot/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { writeAuditLog } from '../lib/audit-log';
import { DiscordApiError, fetchUserGuilds, hasManageGuild } from '../lib/discord-api';

const guildIdParamSchema = z.object({
  guildId: z.string().regex(/^\d{17,20}$/),
});

async function assertGuildAccess(
  prisma: PrismaClient,
  accessToken: string,
  guildId: string,
): Promise<void> {
  let guilds: Awaited<ReturnType<typeof fetchUserGuilds>>;
  try {
    guilds = await fetchUserGuilds(accessToken);
  } catch (e) {
    if (e instanceof DiscordApiError && e.status === 401) {
      throw Object.assign(new Error('TokenExpired'), { code: 'TOKEN_EXPIRED' });
    }
    throw e;
  }
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild || (!guild.owner && !hasManageGuild(guild.permissions))) {
    throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });
  }
  await prisma.guild.upsert({
    where: { id: BigInt(guildId) },
    update: {},
    create: { id: BigInt(guildId) },
  });
}

function serializeGuild(guild: {
  id: bigint;
  prefix: string;
  locale: string;
  djRoleId: bigint | null;
  musicChannelId: bigint | null;
  announceNowPlaying: boolean;
  twentyFourSeven: boolean;
  autoDisconnectMinutes: number | null;
  defaultVolume: number;
  voteSkipThreshold: number;
}) {
  return guildSettingsSchema.parse({
    id: guild.id.toString(),
    prefix: guild.prefix,
    locale: guild.locale,
    djRoleId: guild.djRoleId?.toString() ?? null,
    musicChannelId: guild.musicChannelId?.toString() ?? null,
    announceNowPlaying: guild.announceNowPlaying,
    twentyFourSeven: guild.twentyFourSeven,
    autoDisconnectMinutes: guild.autoDisconnectMinutes,
    defaultVolume: guild.defaultVolume,
    voteSkipThreshold: guild.voteSkipThreshold,
  });
}

export function guildRoutes(
  app: FastifyInstance,
  { prisma }: { prisma: PrismaClient },
): void {
  app.get(
    '/api/guilds/:guildId',
    {
      preHandler: app.authenticate,
      schema: { params: guildIdParamSchema },
    },
    async (request, reply) => {
      const { guildId } = guildIdParamSchema.parse(request.params);
      const u = request.user!;
      if (!u.accessToken) return reply.unauthorized('No Discord access token in session');

      await assertGuildAccess(prisma, u.accessToken, guildId).catch((e: unknown) => {
        if (e instanceof Error && e.message === 'Forbidden') reply.forbidden();
        else if (e instanceof Error && e.message === 'TokenExpired') reply.unauthorized('Discord token expired');
        else throw e;
      });
      if (reply.sent) return;

      const guild = await prisma.guild.findUnique({ where: { id: BigInt(guildId) } });
      if (!guild) return reply.notFound();

      return serializeGuild(guild);
    },
  );

  app.patch(
    '/api/guilds/:guildId',
    {
      preHandler: app.authenticate,
      schema: { params: guildIdParamSchema },
    },
    async (request, reply) => {
      const { guildId } = guildIdParamSchema.parse(request.params);
      const u = request.user!;
      if (!u.accessToken) return reply.unauthorized('No Discord access token in session');

      await assertGuildAccess(prisma, u.accessToken, guildId).catch((e: unknown) => {
        if (e instanceof Error && e.message === 'Forbidden') reply.forbidden();
        else if (e instanceof Error && e.message === 'TokenExpired') reply.unauthorized('Discord token expired');
        else throw e;
      });
      if (reply.sent) return;

      const update = guildSettingsSchema
        .partial()
        .omit({ id: true })
        .parse(request.body);

      const updated = await prisma.guild.update({
        where: { id: BigInt(guildId) },
        data: {
          ...(update.prefix !== undefined && { prefix: update.prefix }),
          ...(update.locale !== undefined && { locale: update.locale }),
          ...(update.djRoleId !== undefined && {
            djRoleId: update.djRoleId ? BigInt(update.djRoleId) : null,
          }),
          ...(update.musicChannelId !== undefined && {
            musicChannelId: update.musicChannelId ? BigInt(update.musicChannelId) : null,
          }),
          ...(update.announceNowPlaying !== undefined && {
            announceNowPlaying: update.announceNowPlaying,
          }),
          ...(update.twentyFourSeven !== undefined && {
            twentyFourSeven: update.twentyFourSeven,
          }),
          ...(update.autoDisconnectMinutes !== undefined && {
            autoDisconnectMinutes: update.autoDisconnectMinutes,
          }),
          ...(update.defaultVolume !== undefined && { defaultVolume: update.defaultVolume }),
          ...(update.voteSkipThreshold !== undefined && {
            voteSkipThreshold: update.voteSkipThreshold,
          }),
        },
      });

      await writeAuditLog({
        prisma,
        guildId,
        actorId: u.id,
        action: 'settings.update',
        metadata: update as Record<string, unknown>,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return serializeGuild(updated);
    },
  );
}
