import type { PrismaClient } from '@wesbot/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { DiscordApiError, fetchUserGuilds, hasManageGuild } from '../lib/discord-api';

const guildIdParamSchema = z.object({
  guildId: z.string().regex(/^\d{17,20}$/),
});

async function assertGuildAccess(accessToken: string, guildId: string): Promise<void> {
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
}

function guardAccess(reply: { forbidden: () => unknown; unauthorized: (msg: string) => unknown }) {
  return (e: unknown) => {
    if (e instanceof Error && e.message === 'Forbidden') reply.forbidden();
    else if (e instanceof Error && e.message === 'TokenExpired')
      reply.unauthorized('Discord token expired');
    else throw e;
  };
}

export function moderationRoutes(app: FastifyInstance, { prisma }: { prisma: PrismaClient }): void {
  const baseOpts = {
    preHandler: app.authenticate,
    schema: { params: guildIdParamSchema },
  };

  // GET /api/guilds/:guildId/mod/logs
  app.get(
    '/api/guilds/:guildId/mod/logs',
    {
      ...baseOpts,
      schema: {
        ...baseOpts.schema,
        querystring: z.object({
          type: z
            .enum(['warn', 'kick', 'ban', 'tempban', 'unban', 'timeout', 'untimeout', 'purge'])
            .optional(),
          userId: z.string().regex(/^\d{17,20}$/).optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
          cursor: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { guildId } = guildIdParamSchema.parse(request.params);
      const u = request.user!;
      if (!u.accessToken) return reply.unauthorized();
      await assertGuildAccess(u.accessToken, guildId).catch(guardAccess(reply));
      if (reply.sent) return;

      const { type, userId, limit, cursor } = z
        .object({
          type: z
            .enum(['warn', 'kick', 'ban', 'tempban', 'unban', 'timeout', 'untimeout', 'purge'])
            .optional(),
          userId: z.string().regex(/^\d{17,20}$/).optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
          cursor: z.string().optional(),
        })
        .parse(request.query);

      const logs = await prisma.modLog.findMany({
        where: {
          guildId: BigInt(guildId),
          ...(type ? { type } : {}),
          ...(userId ? { targetUserId: BigInt(userId) } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = logs.length > limit;
      const items = hasMore ? logs.slice(0, limit) : logs;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return reply.send({
        items: items.map((l) => ({
          id: l.id,
          type: l.type,
          targetUserId: l.targetUserId.toString(),
          moderatorId: l.moderatorId.toString(),
          reason: l.reason,
          durationSec: l.durationSec,
          createdAt: l.createdAt.toISOString(),
        })),
        nextCursor,
      });
    },
  );

  // GET /api/guilds/:guildId/mod/warns
  app.get(
    '/api/guilds/:guildId/mod/warns',
    {
      ...baseOpts,
      schema: {
        ...baseOpts.schema,
        querystring: z.object({
          userId: z.string().regex(/^\d{17,20}$/),
        }),
      },
    },
    async (request, reply) => {
      const { guildId } = guildIdParamSchema.parse(request.params);
      const u = request.user!;
      if (!u.accessToken) return reply.unauthorized();
      await assertGuildAccess(u.accessToken, guildId).catch(guardAccess(reply));
      if (reply.sent) return;

      const { userId } = z
        .object({ userId: z.string().regex(/^\d{17,20}$/) })
        .parse(request.query);

      const warns = await prisma.warn.findMany({
        where: { guildId: BigInt(guildId), userId: BigInt(userId), active: true },
        orderBy: { createdAt: 'asc' },
      });

      return reply.send(
        warns.map((w) => ({
          id: w.id,
          userId: w.userId.toString(),
          moderatorId: w.moderatorId.toString(),
          reason: w.reason,
          createdAt: w.createdAt.toISOString(),
        })),
      );
    },
  );

  // DELETE /api/guilds/:guildId/mod/warns/:warnId
  app.delete(
    '/api/guilds/:guildId/mod/warns/:warnId',
    {
      preHandler: app.authenticate,
      schema: {
        params: z.object({
          guildId: z.string().regex(/^\d{17,20}$/),
          warnId: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { guildId, warnId } = z
        .object({ guildId: z.string().regex(/^\d{17,20}$/), warnId: z.string() })
        .parse(request.params);
      const u = request.user!;
      if (!u.accessToken) return reply.unauthorized();
      await assertGuildAccess(u.accessToken, guildId).catch(guardAccess(reply));
      if (reply.sent) return;

      const updated = await prisma.warn.updateMany({
        where: { id: warnId, guildId: BigInt(guildId), active: true },
        data: { active: false },
      });

      if (updated.count === 0) return reply.notFound();
      return reply.send({ ok: true });
    },
  );

  // GET /api/guilds/:guildId/mod/automod
  app.get('/api/guilds/:guildId/mod/automod', baseOpts, async (request, reply) => {
    const { guildId } = guildIdParamSchema.parse(request.params);
    const u = request.user!;
    if (!u.accessToken) return reply.unauthorized();
    await assertGuildAccess(u.accessToken, guildId).catch(guardAccess(reply));
    if (reply.sent) return;

    const rules = await prisma.automodRule.findMany({
      where: { guildId: BigInt(guildId) },
    });

    return reply.send(
      rules.map((r) => ({
        id: r.id,
        type: r.type,
        enabled: r.enabled,
        action: r.action,
        config: r.config,
        exemptRoleIds: r.exemptRoleIds.map(String),
        exemptChannelIds: r.exemptChannelIds.map(String),
      })),
    );
  });

  // PUT /api/guilds/:guildId/mod/automod/:type
  const automodRuleTypeEnum = z.enum([
    'spam',
    'caps',
    'mentions',
    'links',
    'invites',
    'wordlist',
    'anti_raid',
  ]);
  const automodActionEnum = z.enum(['delete', 'warn', 'timeout', 'kick', 'ban']);

  app.put(
    '/api/guilds/:guildId/mod/automod/:type',
    {
      preHandler: app.authenticate,
      schema: {
        params: z.object({
          guildId: z.string().regex(/^\d{17,20}$/),
          type: automodRuleTypeEnum,
        }),
        body: z.object({
          enabled: z.boolean(),
          action: automodActionEnum,
          config: z.record(z.unknown()).optional().default({}),
          exemptRoleIds: z.array(z.string().regex(/^\d{17,20}$/)).optional().default([]),
          exemptChannelIds: z.array(z.string().regex(/^\d{17,20}$/)).optional().default([]),
        }),
      },
    },
    async (request, reply) => {
      const { guildId, type } = z
        .object({ guildId: z.string().regex(/^\d{17,20}$/), type: automodRuleTypeEnum })
        .parse(request.params);
      const body = z
        .object({
          enabled: z.boolean(),
          action: automodActionEnum,
          config: z.record(z.unknown()).optional().default({}),
          exemptRoleIds: z.array(z.string().regex(/^\d{17,20}$/)).optional().default([]),
          exemptChannelIds: z.array(z.string().regex(/^\d{17,20}$/)).optional().default([]),
        })
        .parse(request.body);
      const u = request.user!;
      if (!u.accessToken) return reply.unauthorized();
      await assertGuildAccess(u.accessToken, guildId).catch(guardAccess(reply));
      if (reply.sent) return;

      const configJson = body.config as Parameters<typeof prisma.automodRule.create>[0]['data']['config'];
      const rule = await prisma.automodRule.upsert({
        where: { guildId_type: { guildId: BigInt(guildId), type } },
        update: {
          enabled: body.enabled,
          action: body.action,
          config: configJson,
          exemptRoleIds: body.exemptRoleIds.map(BigInt),
          exemptChannelIds: body.exemptChannelIds.map(BigInt),
        },
        create: {
          guildId: BigInt(guildId),
          type,
          enabled: body.enabled,
          action: body.action,
          config: configJson,
          exemptRoleIds: body.exemptRoleIds.map(BigInt),
          exemptChannelIds: body.exemptChannelIds.map(BigInt),
        },
      });

      return reply.send({
        id: rule.id,
        type: rule.type,
        enabled: rule.enabled,
        action: rule.action,
        config: rule.config,
        exemptRoleIds: rule.exemptRoleIds.map(String),
        exemptChannelIds: rule.exemptChannelIds.map(String),
      });
    },
  );
}
