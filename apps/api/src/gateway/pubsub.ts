import { moderationEventSchema, musicEventSchema } from '@wesbot/shared';
import Redis from 'ioredis';
import type { Server as SocketIOServer } from 'socket.io';


interface Logger {
  info: (msg: string) => void;
  warn: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
}

export function startPubSubBridge(
  redisUrl: string,
  io: SocketIOServer,
  logger: Logger,
): Redis {
  const sub = new Redis(redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: null, // subscriber connections must never exhaust retries
    enableReadyCheck: true,
  });

  sub.on('error', (err) => logger.error({ err }, 'pubsub redis error'));
  sub.on('ready', () => {
    logger.info('pubsub redis ready');
    sub.psubscribe('events:music:*', 'events:mod:*').catch((err: unknown) => {
      logger.error({ err }, 'pubsub psubscribe failed');
    });
  });

  sub.on('pmessage', (_pattern: string, channel: string, message: string) => {
    try {
      const raw = JSON.parse(message) as unknown;

      if (channel.startsWith('events:music:')) {
        const parsed = musicEventSchema.safeParse(raw);
        if (!parsed.success) {
          logger.warn({ channel }, 'invalid music event');
          return;
        }
        io.to(`guild:${parsed.data.guildId}`).emit('music', parsed.data);
      } else if (channel.startsWith('events:mod:')) {
        const parsed = moderationEventSchema.safeParse(raw);
        if (!parsed.success) {
          logger.warn({ channel }, 'invalid mod event');
          return;
        }
        io.to(`guild:${parsed.data.action.guildId}`).emit('moderation', parsed.data);
      }
    } catch {
      logger.warn({ channel }, 'failed to parse pubsub message');
    }
  });

  return sub;
}
