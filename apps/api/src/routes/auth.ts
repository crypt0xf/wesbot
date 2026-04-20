import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { DiscordApiError, fetchUserGuilds, guildIconUrl, hasManageGuild } from '../lib/discord-api';

const meResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
});

const guildItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  owner: z.boolean(),
  hasBot: z.boolean(),
});

type GuildItem = z.infer<typeof guildItemSchema>;

// Coalesces concurrent requests for the same user — only one Discord API call
// in-flight at a time per user, regardless of how many requests arrive simultaneously.
const inFlight = new Map<string, Promise<GuildItem[]>>();

export function authRoutes(app: FastifyInstance): void {
  app.get(
    '/api/auth/me',
    {
      preHandler: app.authenticate,
      schema: { response: { 200: meResponseSchema } },
    },
    (request) => {
      const u = request.user!;
      return { id: u.id, name: u.name, email: u.email, image: u.image ?? null };
    },
  );

  app.get(
    '/api/auth/guilds',
    {
      preHandler: app.authenticate,
      schema: { response: { 200: z.array(guildItemSchema) } },
    },
    async (request, reply) => {
      const u = request.user!;
      if (!u.accessToken) return reply.unauthorized('No Discord access token in session');

      const cacheKey = `guilds:${u.id}`;

      const cached = await app.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as GuildItem[];

      const existing = inFlight.get(cacheKey);
      if (existing) return existing;

      const promise = (async (): Promise<GuildItem[]> => {
        let all: Awaited<ReturnType<typeof fetchUserGuilds>>;
        try {
          all = await fetchUserGuilds(u.accessToken!);
        } catch (e) {
          if (e instanceof DiscordApiError && e.status === 401) {
            throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
          }
          throw e;
        }
        const result = all
          .filter((g) => g.owner || hasManageGuild(g.permissions))
          .map((g) => ({
            id: g.id,
            name: g.name,
            icon: guildIconUrl(g.id, g.icon),
            owner: g.owner,
            hasBot: false,
          }));
        await app.redis.set(cacheKey, JSON.stringify(result), 'EX', 30);
        return result;
      })();

      inFlight.set(cacheKey, promise);
      promise.finally(() => inFlight.delete(cacheKey));

      try {
        return await promise;
      } catch (e) {
        if (e instanceof Error && 'statusCode' in e && e.statusCode === 401) {
          return reply.unauthorized('Discord token expired');
        }
        throw e;
      }
    },
  );
}
