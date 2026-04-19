import { prisma } from '@wesbot/database';

import { ModerationService } from './application/moderation/moderation-service';
import { LyricsService } from './application/music/lyrics-service';
import { MusicController } from './application/music/music-controller';
import { PlaylistService } from './application/music/playlist-service';
import { QueuePersistence } from './application/music/queue-persistence';
import { VoiceActivityWatcher } from './application/music/voice-activity-watcher';
import { GuildConfigService } from './application/settings/guild-config-service';
import { createClient } from './client';
import { createContainer } from './container';
import { env } from './env';
import { startBotCommandListener } from './infrastructure/bot-command-listener';
import { registerCommands } from './infrastructure/command-registrar';
import { startHealthServer } from './infrastructure/health-server';
import { i18n } from './infrastructure/i18n';
import { createShoukaku } from './infrastructure/lavalink';
import { createRedis } from './infrastructure/redis';
import { logger } from './logger';
import { buildCommandRegistry, commands } from './presentation/commands/index';
import { registerEvents } from './presentation/events/index';

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandled rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception');
  process.exit(1);
});

const client = createClient();
const registry = buildCommandRegistry(commands);
const shoukaku = createShoukaku({
  client,
  logger,
  host: env.LAVALINK_HOST,
  port: env.LAVALINK_PORT,
  password: env.LAVALINK_PASSWORD,
  secure: env.LAVALINK_SECURE,
});
const redis = createRedis(env.REDIS_URL, logger);
const persistence = new QueuePersistence(redis, logger);
const music = new MusicController(shoukaku, logger, persistence, (channel, payload) => {
  redis.publish(channel, JSON.stringify(payload)).catch((err: unknown) => {
    logger.warn({ err, channel }, 'redis publish failed');
  });
});
const settings = new GuildConfigService(prisma, logger);
const playlists = new PlaylistService(prisma, logger);
const lyrics = new LyricsService(logger);
const moderation = new ModerationService(prisma);
const voiceWatcher = new VoiceActivityWatcher(client, music, settings, logger);
const container = createContainer({
  logger,
  i18n,
  client,
  commands: registry,
  lyrics,
  moderation,
  music,
  playlists,
  prisma,
  redis,
  settings,
  voiceWatcher,
});

registerEvents(client, container, registry);

const commandListener = startBotCommandListener(redis, music, moderation, client, logger);

const healthServer = startHealthServer({
  host: env.BOT_HEALTH_HOST,
  port: env.BOT_HEALTH_PORT,
  container,
});

await registerCommands(commands, {
  token: env.DISCORD_TOKEN,
  clientId: env.DISCORD_CLIENT_ID,
  devGuildId: env.DISCORD_DEV_GUILD_ID,
  logger,
});

await client.login(env.DISCORD_TOKEN);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');
  healthServer.close();
  voiceWatcher.disposeAll();
  commandListener.disconnect();
  await client.destroy();
  await prisma.$disconnect().catch((err: unknown) => {
    logger.warn({ err }, 'prisma disconnect failed');
  });
  redis.disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
