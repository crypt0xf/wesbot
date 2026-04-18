import { z } from 'zod';

const snowflake = z.string().regex(/^\d{17,20}$/);

export const modActionTypeSchema = z.enum([
  'warn',
  'kick',
  'ban',
  'tempban',
  'unban',
  'timeout',
  'untimeout',
  'purge',
]);
export type ModActionType = z.infer<typeof modActionTypeSchema>;

export const modActionSchema = z.object({
  id: z.string().cuid2().optional(),
  guildId: snowflake,
  type: modActionTypeSchema,
  targetUserId: snowflake,
  moderatorId: snowflake,
  reason: z.string().max(512).nullable(),
  /** Duration in seconds. Only meaningful for tempban/timeout. */
  durationSec: z.number().int().positive().nullable().optional(),
  createdAt: z.coerce.date().optional(),
});
export type ModAction = z.infer<typeof modActionSchema>;

export const automodRuleTypeSchema = z.enum([
  'spam',
  'caps',
  'mentions',
  'links',
  'invites',
  'wordlist',
  'anti_raid',
]);
export type AutomodRuleType = z.infer<typeof automodRuleTypeSchema>;

export const automodActionSchema = z.enum(['delete', 'warn', 'timeout', 'kick', 'ban']);
export type AutomodAction = z.infer<typeof automodActionSchema>;

export const automodRuleSchema = z.object({
  id: z.string().cuid2().optional(),
  guildId: snowflake,
  type: automodRuleTypeSchema,
  enabled: z.boolean().default(true),
  action: automodActionSchema,
  /** Rule-specific config (e.g. { threshold: 5, intervalSec: 10 } for spam). */
  config: z.record(z.unknown()).default({}),
  exemptRoleIds: z.array(snowflake).default([]),
  exemptChannelIds: z.array(snowflake).default([]),
});
export type AutomodRule = z.infer<typeof automodRuleSchema>;
