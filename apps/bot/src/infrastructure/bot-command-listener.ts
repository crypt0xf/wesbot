import { botCommandSchema } from '@wesbot/shared';
import type Redis from 'ioredis';

import type { MusicController } from '../application/music/music-controller';
import type { Logger } from '../logger';

type BotCommand = typeof botCommandSchema._type;

async function dispatch(cmd: BotCommand, music: MusicController): Promise<void> {
  switch (cmd.type) {
    case 'music.skip':
      await music.skip(cmd.guildId);
      break;
    case 'music.pause':
      if (cmd.paused) await music.pause(cmd.guildId);
      else await music.resume(cmd.guildId);
      break;
    case 'music.seek':
      await music.seek(cmd.guildId, cmd.positionMs);
      break;
    case 'music.volume':
      await music.setVolume(cmd.guildId, cmd.volume);
      break;
    case 'music.loop':
      music.setLoop(cmd.guildId, cmd.mode);
      break;
    case 'music.stop':
      await music.stop(cmd.guildId);
      break;
    case 'music.filter':
      await music.applyFilter(cmd.guildId, cmd.filter);
      break;
    case 'music.reorder':
      music.reorder(cmd.guildId, cmd.fromIndex, cmd.toIndex);
      break;
    case 'music.play':
      // play from dashboard requires voice channel — not yet implemented
      break;
  }
}

/**
 * Subscribes to Redis `commands:bot`, routes messages to MusicController,
 * and publishes replies to `replies:bot:{requestId}`.
 *
 * Returns the subscriber connection so the caller can disconnect it on shutdown.
 */
export function startBotCommandListener(
  redis: Redis,
  music: MusicController,
  logger: Logger,
): Redis {
  const sub = redis.duplicate();

  sub.on('error', (err) => logger.error({ err }, 'bot-command-listener redis error'));
  sub.on('ready', () => logger.info('bot-command-listener ready'));

  sub.subscribe('commands:bot', (err) => {
    if (err) logger.error({ err }, 'failed to subscribe to commands:bot');
  });

  sub.on('message', (_channel, raw) => {
    let cmd: BotCommand;
    try {
      cmd = botCommandSchema.parse(JSON.parse(raw));
    } catch (err) {
      logger.warn({ err }, 'invalid bot command received');
      return;
    }

    const { requestId } = cmd;
    void dispatch(cmd, music)
      .then(() => {
        redis.publish(
          `replies:bot:${requestId}`,
          JSON.stringify({ requestId, ok: true }),
        ).catch((e: unknown) => logger.warn({ e }, 'reply publish failed'));
      })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err.message : 'unknown';
        logger.warn({ err, requestId, type: cmd.type }, 'bot command failed');
        redis.publish(
          `replies:bot:${requestId}`,
          JSON.stringify({ requestId, ok: false, error }),
        ).catch((e: unknown) => logger.warn({ e }, 'reply publish failed'));
      });
  });

  return sub;
}
