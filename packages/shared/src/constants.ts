export const APP_NAME = 'wesbot';
export const DEFAULT_LOCALE = 'pt-BR';
export const SUPPORTED_LOCALES = ['pt-BR', 'en-US'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_VOLUME = 100;
export const MAX_VOLUME = 200;
export const DEFAULT_AUTO_DISCONNECT_MINUTES = 5;
export const MAX_QUEUE_SIZE = 1000;
export const MAX_HISTORY_SIZE = 50;
export const MAX_PLAYLISTS_PER_USER = 50;
export const MAX_SEARCH_RESULTS = 10;

export const REDIS_CHANNELS = {
  musicEvents: (guildId: string) => `events:music:${guildId}`,
  modEvents: (guildId: string) => `events:mod:${guildId}`,
  botCommands: 'commands:bot',
  botReplies: (requestId: string) => `replies:bot:${requestId}`,
} as const;

export const REDIS_KEYS = {
  guildQueue: (guildId: string) => `queue:${guildId}`,
  playerState: (guildId: string) => `player:${guildId}`,
  session: (sessionId: string) => `session:${sessionId}`,
  rateLimit: (scope: string, id: string) => `ratelimit:${scope}:${id}`,
} as const;
