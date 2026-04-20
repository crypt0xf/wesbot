import {
  apiEnvSchema,
  baseEnvSchema,
  databaseEnvSchema,
  parseEnv,
  redisEnvSchema,
} from '@wesbot/shared/env';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const schema = baseEnvSchema
  .merge(apiEnvSchema)
  .merge(databaseEnvSchema)
  .merge(redisEnvSchema)
  .extend({
    DISCORD_TOKEN: z.string().min(50).optional(),
    DISCORD_CLIENT_ID: z.string().regex(/^\d{17,20}$/),
    DISCORD_CLIENT_SECRET: z.string().min(10).optional(),
    /** Shared secret with the dashboard — used to decode NextAuth JWTs. */
    AUTH_SECRET: z
      .string()
      .min(32, 'AUTH_SECRET must be at least 32 chars')
      .default(process.env.NEXTAUTH_SECRET ?? ''),
  });

export const env: z.infer<typeof schema> = parseEnv(schema);
