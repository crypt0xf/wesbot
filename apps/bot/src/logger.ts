import pino from 'pino';

import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'bot' },
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname,service',
          },
        },
      }
    : {}),
});

export type Logger = typeof logger;
