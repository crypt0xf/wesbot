import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin: FastifyPluginCallback<{ url: string }> = (app, { url }, done) => {
  const redis = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

  redis.on('error', (err) => app.log.error({ err }, 'redis error'));
  redis.on('ready', () => app.log.info('redis ready'));

  app.decorate('redis', redis);
  app.addHook('onClose', (_instance, next) => {
    redis.quit().then(() => next()).catch(() => {
      redis.disconnect();
      next();
    });
  });

  done();
};

export default fp(redisPlugin, { name: 'redis' });
