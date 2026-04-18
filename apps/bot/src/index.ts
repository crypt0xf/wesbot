import { MusicController } from './application/music/music-controller';
import { createClient } from './client';
import { createContainer } from './container';
import { env } from './env';
import { registerCommands } from './infrastructure/command-registrar';
import { startHealthServer } from './infrastructure/health-server';
import { i18n } from './infrastructure/i18n';
import { createShoukaku } from './infrastructure/lavalink';
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
const music = new MusicController(shoukaku, logger);
const container = createContainer({
  logger,
  i18n,
  client,
  commands: registry,
  music,
});

registerEvents(client, container, registry);

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
  await client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
