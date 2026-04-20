import type { PrismaClient } from '@wesbot/database';
import { guildSettingsSchema } from '@wesbot/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { writeAuditLog } from '../lib/audit-log';
import {
  DiscordApiError,
  fetchGuildMember,
  fetchGuildMembers,
  fetchUserGuilds,
  guildIconUrl,
  hasManageGuild,
  memberAvatarUrl,
} from '../lib/discord-api';
import { env } from '../env';

const guildIdParamSchema = z.object({
  guildId: z.string().regex(/^\d{17,20}$/),
});

async function assertGuildAccess(
  prisma: PrismaClient,
  accessToken: string,
  guildId: string,
): Promise<{ name: string; icon: string | null }> {
  let guilds: Awaited<ReturnType<typeof fetchUserGuilds>>;
  try {
    guilds = await fetchUserGuilds(accessToken);
  } catch (e) {
    if (e instanceof DiscordApiError && e.status === 401) {
      throw Object.assign(new Error('TokenExpired'), { code: 'TOKEN_EXPIRED' });
    }
    if (e instanceof DiscordApiError && e.status === 429) {
      throw Object.assign(new Error('RateLimited'), { code: 'RATE_LIMITED' });
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
  return { name: guild.name, icon: guildIconUrl(guild.id, guild.icon) };
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

export function guildRoutes(app: FastifyInstance, { prisma }: { prisma: PrismaClient }): void {
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

      let discordGuild: { name: string; icon: string | null } | undefined;
      await assertGuildAccess(prisma, u.accessToken, guildId)
        .then((g) => {
          discordGuild = g;
        })
        .catch((e: unknown) => {
          if (e instanceof Error && e.message === 'Forbidden') reply.forbidden();
          else if (e instanceof Error && e.message === 'TokenExpired')
            reply.unauthorized('Discord token expired');
          else if (e instanceof Error && e.message === 'RateLimited')
            reply.tooManyRequests('Discord rate limit — try again in a moment');
          else throw e;
        });
      if (reply.sent) return;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [guild, modActionsToday] = await Promise.all([
        prisma.guild.findUnique({ where: { id: BigInt(guildId) } }),
        prisma.modLog.count({
          where: { guildId: BigInt(guildId), createdAt: { gte: todayStart } },
        }),
      ]);
      if (!guild) return reply.notFound();

      return {
        ...serializeGuild(guild),
        name: discordGuild?.name ?? guildId,
        icon: discordGuild?.icon ?? null,
        stats: { modActionsToday },
      };
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
        else if (e instanceof Error && e.message === 'TokenExpired')
          reply.unauthorized('Discord token expired');
        else if (e instanceof Error && e.message === 'RateLimited')
          reply.tooManyRequests('Discord rate limit — try again in a moment');
        else throw e;
      });
      if (reply.sent) return;

      const update = guildSettingsSchema.partial().omit({ id: true }).parse(request.body);

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

  // GET /api/guilds/:guildId/members — list members for moderation picker
  app.get(
    '/api/guilds/:guildId/members',
    { preHandler: app.authenticate, schema: { params: guildIdParamSchema } },
    async (request, reply) => {
      const { guildId } = guildIdParamSchema.parse(request.params);
      if (!env.DISCORD_TOKEN)
        return reply.status(503).send({ error: 'DISCORD_TOKEN not configured' });
      try {
        const members = await fetchGuildMembers(env.DISCORD_TOKEN, guildId);
        return members
          .filter((m) => !m.user.id.startsWith('0'))
          .map((m) => ({
            id: m.user.id,
            username: m.user.username,
            displayName: m.nick ?? m.user.global_name ?? m.user.username,
            avatar: memberAvatarUrl(guildId, m.user.id, null, m.user.avatar),
            isBot: false,
          }));
      } catch (e) {
        if (e instanceof DiscordApiError)
          return reply.status(e.status).send({ error: 'Discord API error' });
        throw e;
      }
    },
  );

  // GET /api/guilds/:guildId/members/:userId — single member detail
  app.get(
    '/api/guilds/:guildId/members/:userId',
    {
      preHandler: app.authenticate,
      schema: {
        params: z.object({
          guildId: z.string().regex(/^\d{17,20}$/),
          userId: z.string().regex(/^\d{17,20}$/),
        }),
      },
    },
    async (request, reply) => {
      const { guildId, userId } = z
        .object({
          guildId: z.string().regex(/^\d{17,20}$/),
          userId: z.string().regex(/^\d{17,20}$/),
        })
        .parse(request.params);
      if (!env.DISCORD_TOKEN)
        return reply.status(503).send({ error: 'DISCORD_TOKEN not configured' });
      try {
        const m = await fetchGuildMember(env.DISCORD_TOKEN, guildId, userId);
        return {
          id: m.user.id,
          username: m.user.username,
          displayName: m.nick ?? m.user.global_name ?? m.user.username,
          avatar: memberAvatarUrl(guildId, m.user.id, null, m.user.avatar),
          joinedAt: m.joined_at ?? null,
          roles: m.roles,
        };
      } catch (e) {
        if (e instanceof DiscordApiError)
          return reply.status(e.status).send({ error: 'Discord API error' });
        throw e;
      }
    },
  );

  // Lightweight stats endpoint — DB aggregates + Redis counters
  app.get(
    '/api/guilds/:guildId/stats',
    {
      preHandler: app.authenticate,
      schema: { params: guildIdParamSchema },
    },
    async (request, reply) => {
      const { guildId } = guildIdParamSchema.parse(request.params);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const guild = await prisma.guild.findUnique({ where: { id: BigInt(guildId) } });
      if (!guild) return reply.notFound();

      const date = new Date().toISOString().slice(0, 10);
      const [modActionsToday, songsRaw, commandsRaw, memberStats] = await Promise.all([
        prisma.modLog.count({
          where: { guildId: BigInt(guildId), createdAt: { gte: todayStart } },
        }),
        app.redis.get(`stats:songs:${guildId}:${date}`),
        app.redis.get(`stats:commands:${guildId}:${date}`),
        app.redis.hgetall(`stats:members:${guildId}`),
      ]);

      const totalMembers = parseInt(memberStats?.total ?? '0', 10);
      const botMembers = parseInt(memberStats?.bots ?? '0', 10);

      return {
        modActionsToday,
        songsPlayedToday: parseInt(songsRaw ?? '0', 10),
        commandsToday: parseInt(commandsRaw ?? '0', 10),
        totalMembers,
        botMembers,
      };
    },
  );
}
