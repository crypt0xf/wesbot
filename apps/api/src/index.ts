import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import Fastify from 'fastify';
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { env } from './env';

/**
 * Phase 0 stub. Real routes (auth, music, moderation) land in Phase 4.
 */

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
  await app.register(cors, {
    origin: env.API_CORS_ORIGINS,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  app.get('/health', () => ({ ok: true, service: 'api', timestamp: Date.now() }));

  app.get('/ready', () => ({ ok: true }));

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
