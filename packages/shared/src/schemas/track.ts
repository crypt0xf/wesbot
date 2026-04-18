import { z } from 'zod';

export const audioSourceSchema = z.enum([
  'youtube',
  'youtube_music',
  'spotify',
  'apple_music',
  'deezer',
  'soundcloud',
  'bandcamp',
  'twitch',
  'http',
  'local',
  'unknown',
]);
export type AudioSource = z.infer<typeof audioSourceSchema>;

export const trackSchema = z.object({
  identifier: z.string().min(1),
  title: z.string(),
  author: z.string(),
  duration: z.number().int().nonnegative(),
  isStream: z.boolean().default(false),
  uri: z.string().url(),
  artworkUrl: z.string().url().nullable().optional(),
  isrc: z.string().nullable().optional(),
  source: audioSourceSchema.default('unknown'),
  requesterId: z
    .string()
    .regex(/^\d{17,20}$/)
    .nullable()
    .optional(),
  /** Lavalink-encoded track (base64). Needed to replay via Lavalink. */
  encoded: z.string().optional(),
});
export type Track = z.infer<typeof trackSchema>;

export const loopModeSchema = z.enum(['off', 'track', 'queue']);
export type LoopMode = z.infer<typeof loopModeSchema>;

export const queueStateSchema = z.object({
  guildId: z.string(),
  voiceChannelId: z.string().nullable(),
  current: trackSchema.nullable(),
  tracks: z.array(trackSchema),
  history: z.array(trackSchema).default([]),
  position: z.number().int().nonnegative().default(0),
  isPaused: z.boolean().default(false),
  volume: z.number().int().min(0).max(200).default(100),
  loop: loopModeSchema.default('off'),
  autoplay: z.boolean().default(false),
});
export type QueueState = z.infer<typeof queueStateSchema>;
