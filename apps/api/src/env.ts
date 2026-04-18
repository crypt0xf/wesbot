import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

import {
  apiEnvSchema,
  baseEnvSchema,
  databaseEnvSchema,
  parseEnv,
  redisEnvSchema,
} from '@wesbot/shared/env';

loadEnv();

const schema = baseEnvSchema
  .merge(apiEnvSchema)
  .merge(databaseEnvSchema)
  .merge(redisEnvSchema)
  .extend({
    DISCORD_CLIENT_ID: z.string().regex(/^\d{17,20}$/),
    DISCORD_CLIENT_SECRET: z.string().min(10).optional(),
  });

export const env: z.infer<typeof schema> = parseEnv(schema);
