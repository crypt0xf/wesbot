import { decode } from '@auth/core/jwt';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  accessToken?: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateOptional: (request: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    user?: AuthUser;
  }
}

const authPlugin: FastifyPluginCallback<{ secret: string; secureCookie: boolean }> = (
  app,
  { secret, secureCookie },
  done,
) => {
  const cookieName = secureCookie
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';

  async function extractUser(request: FastifyRequest): Promise<AuthUser | null> {
    const cookies = request.cookies as Record<string, string | undefined>;
    const token = cookies[cookieName] ?? cookies['next-auth.session-token'];
    if (!token) return null;

    const payload = await decode({ token, secret, salt: cookieName }).catch(() => null);
    if (!payload?.sub) return null;

    return {
      id: payload.sub,
      name: (payload.name as string | undefined) ?? '',
      email: (payload.email as string | undefined) ?? '',
      image: payload.picture as string | undefined,
      accessToken: payload.accessToken as string | undefined,
    };
  }

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await extractUser(request).catch(() => null);
    if (!user) return reply.unauthorized('Not authenticated');
    request.user = user;
  });

  app.decorate('authenticateOptional', async (request: FastifyRequest) => {
    request.user = (await extractUser(request).catch(() => null)) ?? undefined;
  });

  done();
};

export default fp(authPlugin, { name: 'auth', dependencies: ['@fastify/cookie'] });
