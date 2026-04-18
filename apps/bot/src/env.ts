import {
  baseEnvSchema,
  botEnvSchema,
  databaseEnvSchema,
  discordEnvSchema,
  lavalinkEnvSchema,
  parseEnv,
  redisEnvSchema,
} from '@wesbot/shared/env';
import { config as loadEnv } from 'dotenv';
import { type z } from 'zod';

loadEnv();

const schema = baseEnvSchema
  .merge(discordEnvSchema)
  .merge(databaseEnvSchema)
  .merge(redisEnvSchema)
  .merge(lavalinkEnvSchema)
  .merge(botEnvSchema);

export const env: z.infer<typeof schema> = parseEnv(schema);
