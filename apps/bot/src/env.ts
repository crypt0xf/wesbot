import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

import {
  baseEnvSchema,
  databaseEnvSchema,
  discordEnvSchema,
  lavalinkEnvSchema,
  parseEnv,
  redisEnvSchema,
} from '@wesbot/shared/env';

loadEnv();

const schema = baseEnvSchema
  .merge(discordEnvSchema)
  .merge(databaseEnvSchema)
  .merge(redisEnvSchema)
  .merge(lavalinkEnvSchema);

export const env: z.infer<typeof schema> = parseEnv(schema);
