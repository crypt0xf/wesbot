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

      let all: Awaited<ReturnType<typeof fetchUserGuilds>>;
      try {
        all = await fetchUserGuilds(u.accessToken);
      } catch (e) {
        if (e instanceof DiscordApiError && e.status === 401) return reply.unauthorized('Discord token expired');
        throw e;
      }
      const manageable = all.filter((g) => g.owner || hasManageGuild(g.permissions));

      return manageable.map((g) => ({
        id: g.id,
        name: g.name,
        icon: guildIconUrl(g.id, g.icon),
        owner: g.owner,
        hasBot: false,
      }));
    },
  );
}
