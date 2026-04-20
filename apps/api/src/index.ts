import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { prisma } from '@wesbot/database';
import Fastify from 'fastify';
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { env } from './env';
import { startPubSubBridge } from './gateway/pubsub';
import { createSocketGateway } from './gateway/socket';
import authPlugin from './plugins/auth';
import redisPlugin from './plugins/redis';
import { authRoutes } from './routes/auth';
import { guildRoutes } from './routes/guilds';
import { moderationRoutes } from './routes/moderation';
import { musicRoutes } from './routes/music';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      base: { service: 'api' },
      ...(env.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
            },
          }
        : {}),
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);
  await app.register(cors, { origin: env.API_CORS_ORIGINS, credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(redisPlugin, { url: env.REDIS_URL });
  await app.register(authPlugin, {
    secret: env.AUTH_SECRET,
    secureCookie: env.NODE_ENV === 'production',
  });

  app.get('/health', () => ({ ok: true, service: 'api', timestamp: Date.now() }));
  app.get('/ready', () => ({ ok: true }));

  authRoutes(app);
  guildRoutes(app, { prisma });
  moderationRoutes(app, { prisma });
  musicRoutes(app);

  // Socket.IO gateway is attached before listen; Redis bridge uses its own async connect
  const io = createSocketGateway(app, env.API_CORS_ORIGINS);
  const pubsubClient = startPubSubBridge(
    env.REDIS_URL,
    io,
    app.log as Parameters<typeof startPubSubBridge>[2],
  );

  app.addHook('onClose', async () => {
    await Promise.all([
      prisma.$disconnect(),
      pubsubClient.quit().catch(() => {
        pubsubClient.disconnect();
      }),
    ]);
  });

  return app;
}

const app = await buildServer();

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (err) {
  app.log.error(err, 'failed to start');
  process.exit(1);
}

process.on('SIGINT', () => void app.close().then(() => process.exit(0)));
process.on('SIGTERM', () => void app.close().then(() => process.exit(0)));
