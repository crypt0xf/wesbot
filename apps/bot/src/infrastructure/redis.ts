import Redis from 'ioredis';

import type { Logger } from '../logger';

export function createRedis(url: string, logger: Logger): Redis {
  const client = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

  client.on('ready', () => {
    logger.info('redis ready');
  });
  client.on('error', (err) => {
    logger.error({ err }, 'redis error');
  });
  client.on('close', () => {
    logger.warn('redis connection closed');
  });
  client.on('reconnecting', (delay: number) => {
    logger.info({ delay }, 'redis reconnecting');
  });

  return client;
}
