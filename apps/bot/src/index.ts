import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';

import { env } from './env';
import { logger } from './logger';

/**
 * Phase 0 stub. Connects to Discord, sets presence, logs ready state.
 * Slash commands, music, moderation are added in later phases.
 */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

client.once(Events.ClientReady, (c) => {
  logger.info(
    { user: c.user.tag, guilds: c.guilds.cache.size, nodeEnv: env.NODE_ENV },
    'bot ready',
  );
  void c.user.setPresence({
    activities: [{ name: 'wesbot v0 · scaffolding', type: 3 /* Watching */ }],
    status: 'online',
  });
});

client.on(Events.Error, (err) => {
  logger.error({ err }, 'client error');
});

client.on(Events.Warn, (msg) => {
  logger.warn(msg);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandled rejection');
});

process.on('SIGINT', () => {
  logger.info('SIGINT — shutting down');
  void client.destroy().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM — shutting down');
  void client.destroy().finally(() => process.exit(0));
});

await client.login(env.DISCORD_TOKEN);
