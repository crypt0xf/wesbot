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
    else if (e instanceof Error && e.message === 'TokenExpired') reply.unauthorized('Discord token expired');
    else throw e;
  };
}

function publishCommand(
  redis: FastifyInstance['redis'],
  payload: Record<string, unknown>,
): void {
  void redis.publish('commands:bot', JSON.stringify(payload));
}

export function musicRoutes(app: FastifyInstance): void {
  const baseOpts = {
    preHandler: app.authenticate,
    schema: { params: guildIdParamSchema },
  };

  // POST /api/guilds/:guildId/music/pause   body: { paused: boolean }
  app.post(
    '/api/guilds/:guildId/music/pause',
    { ...baseOpts, schema: { ...baseOpts.schema, body: z.object({ paused: z.boolean() }) } },
    async (request, reply) => {
      const { guildId } = guildIdParamSchema.parse(request.params);
      const { paused } = z.object({ paused: z.boolean() }).parse(request.body);
      const u = request.user!;
      if (!u.accessToken) return reply.unauthorized();
      await assertGuildAccess(u.accessToken, guildId).catch(guardAccess(reply));
      if (reply.sent) return;
      publishCommand(app.redis, {
        type: 'music.pause',
        requestId: crypto.randomUUID(),
        guildId,
        userId: u.id,
        paused,
      });
      return reply.status(202).send({ ok: true });
    },
  );

  // POST /api/guilds/:guildId/music/skip
  app.post('/api/guilds/:guildId/music/skip', baseOpts, async (request, reply) => {
    const { guildId } = guildIdParamSchema.parse(request.params);
    const u = request.user!;
    if (!u.accessToken) return reply.unauthorized();
    await assertGuildAccess(u.accessToken, guildId).catch(guardAccess(reply));
    if (reply.sent) return;
    publishCommand(app.redis, {
      type: 'music.skip',
      requestId: crypto.randomUUID(),
      guildId,
      userId: u.id,
    });
    return reply.status(202).send({ ok: true });
  });

  // POST /api/guilds/:guildId/music/seek   body: { positionMs: number }
  app.post(
    '/api/guilds/:guildId/music/seek',
    { ...baseOpts, schema: { ...baseOpts.schema, body: z.object({ positionMs: z.number().int().nonnegative() }) } },
    async (request, reply) => {
      const { guildId } = guildIdParamSchema.parse(request.params);
      const { positionMs } = z.object({ positionMs: z.number().int().nonnegative() }).parse(request.body);
      const u = request.user!;
      if (!u.accessToken) return reply.unauthorized();
      await assertGuildAccess(u.accessToken, guildId).catch(guardAccess(reply));
      if (reply.sent) return;
      publishCommand(app.redis, {
        type: 'music.seek',
        requestId: crypto.randomUUID(),
        guildId,
        userId: u.id,
        positionMs,
      });
      return reply.status(202).send({ ok: true });
    },
  );

  // POST /api/guilds/:guildId/music/volume  body: { volume: number }
  app.post(
    '/api/guilds/:guildId/music/volume',
    { ...baseOpts, schema: { ...baseOpts.schema, body: z.object({ volume: z.number().int().min(0).max(200) }) } },
    async (request, reply) => {
      const { guildId } = guildIdParamSchema.parse(request.params);
      const { volume } = z.object({ volume: z.number().int().min(0).max(200) }).parse(request.body);
      const u = request.user!;
      if (!u.accessToken) return reply.unauthorized();
      await assertGuildAccess(u.accessToken, guildId).catch(guardAccess(reply));
      if (reply.sent) return;
      publishCommand(app.redis, {
        type: 'music.volume',
        requestId: crypto.randomUUID(),
        guildId,
        userId: u.id,
        volume,
      });
      return reply.status(202).send({ ok: true });
    },
  );

  // POST /api/guilds/:guildId/music/loop   body: { mode: 'off'|'track'|'queue' }
  app.post(
    '/api/guilds/:guildId/music/loop',
    { ...baseOpts, schema: { ...baseOpts.schema, body: z.object({ mode: z.enum(['off', 'track', 'queue']) }) } },
    async (request, reply) => {
      const { guildId } = guildIdParamSchema.parse(request.params);
      const { mode } = z.object({ mode: z.enum(['off', 'track', 'queue']) }).parse(request.body);
      const u = request.user!;
      if (!u.accessToken) return reply.unauthorized();
      await assertGuildAccess(u.accessToken, guildId).catch(guardAccess(reply));
      if (reply.sent) return;
      publishCommand(app.redis, {
        type: 'music.loop',
        requestId: crypto.randomUUID(),
        guildId,
        userId: u.id,
        mode,
      });
      return reply.status(202).send({ ok: true });
    },
  );

  // POST /api/guilds/:guildId/music/stop
  app.post('/api/guilds/:guildId/music/stop', baseOpts, async (request, reply) => {
    const { guildId } = guildIdParamSchema.parse(request.params);
    const u = request.user!;
    if (!u.accessToken) return reply.unauthorized();
    await assertGuildAccess(u.accessToken, guildId).catch(guardAccess(reply));
    if (reply.sent) return;
    publishCommand(app.redis, {
      type: 'music.stop',
      requestId: crypto.randomUUID(),
      guildId,
      userId: u.id,
    });
    return reply.status(202).send({ ok: true });
  });

  // POST /api/guilds/:guildId/music/filter  body: { filter: FilterName }
  app.post(
    '/api/guilds/:guildId/music/filter',
    { ...baseOpts, schema: { ...baseOpts.schema, body: z.object({ filter: z.enum(['off', 'bassboost', 'nightcore', 'eightd']) }) } },
    async (request, reply) => {
      const { guildId } = guildIdParamSchema.parse(request.params);
      const { filter } = z.object({ filter: z.enum(['off', 'bassboost', 'nightcore', 'eightd']) }).parse(request.body);
      const u = request.user!;
      if (!u.accessToken) return reply.unauthorized();
      await assertGuildAccess(u.accessToken, guildId).catch(guardAccess(reply));
      if (reply.sent) return;
      publishCommand(app.redis, {
        type: 'music.filter',
        requestId: crypto.randomUUID(),
        guildId,
        userId: u.id,
        filter,
      });
      return reply.status(202).send({ ok: true });
    },
  );

  // POST /api/guilds/:guildId/music/reorder  body: { fromIndex, toIndex }
  app.post(
    '/api/guilds/:guildId/music/reorder',
    {
      ...baseOpts,
      schema: {
        ...baseOpts.schema,
        body: z.object({
          fromIndex: z.number().int().nonnegative(),
          toIndex: z.number().int().nonnegative(),
        }),
      },
    },
    async (request, reply) => {
      const { guildId } = guildIdParamSchema.parse(request.params);
      const { fromIndex, toIndex } = z
        .object({ fromIndex: z.number().int().nonnegative(), toIndex: z.number().int().nonnegative() })
        .parse(request.body);
      const u = request.user!;
      if (!u.accessToken) return reply.unauthorized();
      await assertGuildAccess(u.accessToken, guildId).catch(guardAccess(reply));
      if (reply.sent) return;
      publishCommand(app.redis, {
        type: 'music.reorder',
        requestId: crypto.randomUUID(),
        guildId,
        userId: u.id,
        fromIndex,
        toIndex,
      });
      return reply.status(202).send({ ok: true });
    },
  );
}
