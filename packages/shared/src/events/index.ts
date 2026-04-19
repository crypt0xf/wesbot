import { z } from 'zod';

import { modActionSchema } from '../schemas/moderation';
import { queueStateSchema, trackSchema } from '../schemas/track';

/**
 * Contracts for cross-service events flowing over Redis pub/sub and
 * the dashboard WebSocket. Both producer and consumer MUST validate.
 */

export const musicEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('track.started'),
    guildId: z.string(),
    track: trackSchema,
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('track.ended'),
    guildId: z.string(),
    track: trackSchema,
    reason: z.enum(['finished', 'replaced', 'stopped', 'load_failed', 'cleanup']),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('queue.updated'),
    guildId: z.string(),
    state: queueStateSchema,
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('player.position'),
    guildId: z.string(),
    positionMs: z.number(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('player.paused'),
    guildId: z.string(),
    paused: z.boolean(),
    timestamp: z.number(),
  }),
]);
export type MusicEvent = z.infer<typeof musicEventSchema>;

export const moderationEventSchema = z.object({
  type: z.literal('moderation.action'),
  action: modActionSchema,
  timestamp: z.number(),
});
export type ModerationEvent = z.infer<typeof moderationEventSchema>;

/** Commands sent from API → Bot. Replies use a correlation requestId. */
export const botCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('music.play'),
    requestId: z.string(),
    guildId: z.string(),
    voiceChannelId: z.string(),
    userId: z.string(),
    query: z.string(),
  }),
  z.object({
    type: z.literal('music.skip'),
    requestId: z.string(),
    guildId: z.string(),
    userId: z.string(),
  }),
  z.object({
    type: z.literal('music.pause'),
    requestId: z.string(),
    guildId: z.string(),
    userId: z.string(),
    paused: z.boolean(),
  }),
  z.object({
    type: z.literal('music.seek'),
    requestId: z.string(),
    guildId: z.string(),
    userId: z.string(),
    positionMs: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('music.volume'),
    requestId: z.string(),
    guildId: z.string(),
    userId: z.string(),
    volume: z.number().int().min(0).max(200),
  }),
  z.object({
    type: z.literal('music.loop'),
    requestId: z.string(),
    guildId: z.string(),
    userId: z.string(),
    mode: z.enum(['off', 'track', 'queue']),
  }),
  z.object({
    type: z.literal('music.stop'),
    requestId: z.string(),
    guildId: z.string(),
    userId: z.string(),
  }),
  z.object({
    type: z.literal('music.filter'),
    requestId: z.string(),
    guildId: z.string(),
    userId: z.string(),
    filter: z.enum(['off', 'bassboost', 'nightcore', 'eightd']),
  }),
  z.object({
    type: z.literal('music.reorder'),
    requestId: z.string(),
    guildId: z.string(),
    userId: z.string(),
    fromIndex: z.number().int().nonnegative(),
    toIndex: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('mod.warn'),
    requestId: z.string(),
    guildId: z.string(),
    moderatorId: z.string(),
    targetUserId: z.string(),
    reason: z.string(),
  }),
  z.object({
    type: z.literal('mod.kick'),
    requestId: z.string(),
    guildId: z.string(),
    moderatorId: z.string(),
    targetUserId: z.string(),
    reason: z.string(),
  }),
  z.object({
    type: z.literal('mod.ban'),
    requestId: z.string(),
    guildId: z.string(),
    moderatorId: z.string(),
    targetUserId: z.string(),
    reason: z.string(),
    deleteMessageDays: z.number().int().min(0).max(7).default(0),
  }),
  z.object({
    type: z.literal('mod.unban'),
    requestId: z.string(),
    guildId: z.string(),
    moderatorId: z.string(),
    targetUserId: z.string(),
    reason: z.string(),
  }),
  z.object({
    type: z.literal('mod.timeout'),
    requestId: z.string(),
    guildId: z.string(),
    moderatorId: z.string(),
    targetUserId: z.string(),
    reason: z.string(),
    durationSec: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('mod.untimeout'),
    requestId: z.string(),
    guildId: z.string(),
    moderatorId: z.string(),
    targetUserId: z.string(),
    reason: z.string(),
  }),
]);
export type BotCommand = z.infer<typeof botCommandSchema>;

export const botReplySchema = z.object({
  requestId: z.string(),
  ok: z.boolean(),
  error: z.string().optional(),
  data: z.unknown().optional(),
});
export type BotReply = z.infer<typeof botReplySchema>;
