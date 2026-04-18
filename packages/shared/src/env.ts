import { z } from 'zod';

/**
 * Base env schema shared by all services (runtime + logging).
 * Each app extends this with its own required variables.
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export const discordEnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(50, 'DISCORD_TOKEN missing or invalid'),
  DISCORD_CLIENT_ID: z.string().regex(/^\d{17,20}$/, 'DISCORD_CLIENT_ID must be a snowflake'),
  DISCORD_CLIENT_SECRET: z.string().min(10).optional(),
  DISCORD_PUBLIC_KEY: z.string().min(10).optional(),
  DISCORD_DEV_GUILD_ID: z
    .string()
    .regex(/^\d{17,20}$/, 'DISCORD_DEV_GUILD_ID must be a snowflake')
    .optional(),
});

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
});

export const redisEnvSchema = z.object({
  REDIS_URL: z.string().url().startsWith('redis://'),
});

export const lavalinkEnvSchema = z.object({
  LAVALINK_HOST: z.string().min(1),
  LAVALINK_PORT: z.coerce.number().int().positive().max(65535),
  LAVALINK_PASSWORD: z.string().min(1),
  LAVALINK_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export const botEnvSchema = z.object({
  BOT_HEALTH_HOST: z.string().default('127.0.0.1'),
  BOT_HEALTH_PORT: z.coerce.number().int().positive().max(65535).default(4100),
});

export const apiEnvSchema = z.object({
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().max(65535).default(4000),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 chars'),
  API_CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type DiscordEnv = z.infer<typeof discordEnvSchema>;
export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type RedisEnv = z.infer<typeof redisEnvSchema>;
export type LavalinkEnv = z.infer<typeof lavalinkEnvSchema>;
export type BotEnv = z.infer<typeof botEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;

/**
 * Parse an env schema and print a helpful message on failure before exiting.
 * Call at the top of each app entrypoint.
 */
export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: NodeJS.ProcessEnv = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`\nEnvironment validation failed:\n${issues}\n`);
    process.exit(1);
  }
  return result.data as z.infer<T>;
}
