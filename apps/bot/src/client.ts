import { Client, GatewayIntentBits, Options, Partials } from 'discord.js';

export function createClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
    // Bound cache — we only care about live members/messages from the dashboard-visible window.
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      MessageManager: 100,
      GuildMessageManager: 100,
      PresenceManager: 0,
      ThreadManager: 50,
    }),
    sweepers: {
      ...Options.DefaultSweeperSettings,
      messages: { interval: 3600, lifetime: 1800 },
    },
    allowedMentions: { parse: ['users'], repliedUser: false },
  });
}
