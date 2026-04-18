import { z } from 'zod';

import { SUPPORTED_LOCALES } from '../constants';

const snowflake = z.string().regex(/^\d{17,20}$/);

export const guildSettingsSchema = z.object({
  id: snowflake,
  prefix: z.string().min(1).max(5).default('!'),
  locale: z.enum(SUPPORTED_LOCALES).default('pt-BR'),
  djRoleId: snowflake.nullable().default(null),
  musicChannelId: snowflake.nullable().default(null),
  announceNowPlaying: z.boolean().default(true),
  twentyFourSeven: z.boolean().default(false),
  autoDisconnectMinutes: z.number().int().min(1).max(120).nullable().default(5),
  defaultVolume: z.number().int().min(0).max(200).default(100),
  voteSkipThreshold: z.number().min(0).max(1).default(0.5),
});
export type GuildSettings = z.infer<typeof guildSettingsSchema>;

export const welcomeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  channelId: snowflake.nullable().default(null),
  message: z.string().max(2000).default('Bem-vindo(a) ao servidor, {user}! 🎉'),
  embed: z
    .object({
      title: z.string().max(256).optional(),
      description: z.string().max(4096).optional(),
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
      image: z.string().url().optional(),
    })
    .optional(),
});
export type WelcomeConfig = z.infer<typeof welcomeConfigSchema>;

export const leaveConfigSchema = welcomeConfigSchema.extend({
  message: z.string().max(2000).default('{user} saiu do servidor.'),
});
export type LeaveConfig = z.infer<typeof leaveConfigSchema>;
