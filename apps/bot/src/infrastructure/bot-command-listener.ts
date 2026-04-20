import { botCommandSchema } from '@wesbot/shared';
import type { Client } from 'discord.js';
import type Redis from 'ioredis';

import type { ModerationService } from '../application/moderation/moderation-service';
import type { MusicController } from '../application/music/music-controller';
import type { Logger } from '../logger';

type BotCommand = typeof botCommandSchema._type;

async function dispatch(
  cmd: BotCommand,
  music: MusicController,
  moderation: ModerationService,
  client: Client,
): Promise<void> {
  switch (cmd.type) {
    case 'music.skip':
      await music.skip(cmd.guildId);
      break;
    case 'music.pause':
      if (cmd.paused) await music.pause(cmd.guildId);
      else await music.resume(cmd.guildId);
      break;
    case 'music.seek':
      await music.seek(cmd.guildId, cmd.positionMs);
      break;
    case 'music.volume':
      await music.setVolume(cmd.guildId, cmd.volume);
      break;
    case 'music.loop':
      music.setLoop(cmd.guildId, cmd.mode);
      break;
    case 'music.stop':
      await music.stop(cmd.guildId);
      break;
    case 'music.filter':
      await music.applyFilter(cmd.guildId, cmd.filter);
      break;
    case 'music.reorder':
      music.reorder(cmd.guildId, cmd.fromIndex, cmd.toIndex);
      break;
    case 'music.play': {
      const guild = await client.guilds.fetch(cmd.guildId);
      let voiceChannelId = cmd.voiceChannelId;
      if (!voiceChannelId) {
        const existingSession = music.getSession(cmd.guildId);
        voiceChannelId = existingSession?.voiceChannelId ?? undefined;
      }
      if (!voiceChannelId) {
        const member = await guild.members.fetch(cmd.userId);
        voiceChannelId = member.voice.channelId ?? undefined;
      }
      if (!voiceChannelId) throw new Error('Você não está em uma chamada de voz.');
      await music.play({
        guildId: cmd.guildId,
        voiceChannelId,
        textChannelId: voiceChannelId,
        shardId: guild.shardId,
        query: cmd.query,
        requesterId: cmd.userId,
      });
      break;
    }
    case 'music.join': {
      const guild = await client.guilds.fetch(cmd.guildId);
      const member = await guild.members.fetch(cmd.userId);
      const channelId = member.voice.channelId;
      if (!channelId) throw new Error('Você não está em uma chamada de voz.');
      await music.joinVoice(cmd.guildId, channelId, guild.shardId);
      break;
    }

    case 'mod.warn': {
      const guild = await client.guilds.fetch(cmd.guildId);
      const target = await guild.members.fetch(cmd.targetUserId);
      const moderator = await client.users.fetch(cmd.moderatorId);
      await moderation.warn(guild, target, moderator, cmd.reason);
      break;
    }
    case 'mod.kick': {
      const guild = await client.guilds.fetch(cmd.guildId);
      const target = await guild.members.fetch(cmd.targetUserId);
      await target.kick(cmd.reason);
      await moderation.logAction(
        cmd.guildId,
        'kick',
        cmd.targetUserId,
        cmd.moderatorId,
        cmd.reason,
      );
      break;
    }
    case 'mod.ban': {
      const guild = await client.guilds.fetch(cmd.guildId);
      await guild.members.ban(cmd.targetUserId, {
        reason: cmd.reason,
        deleteMessageSeconds: cmd.deleteMessageDays * 86400,
      });
      await moderation.logAction(cmd.guildId, 'ban', cmd.targetUserId, cmd.moderatorId, cmd.reason);
      break;
    }
    case 'mod.unban': {
      const guild = await client.guilds.fetch(cmd.guildId);
      await guild.members.unban(cmd.targetUserId, cmd.reason);
      await moderation.logAction(
        cmd.guildId,
        'unban',
        cmd.targetUserId,
        cmd.moderatorId,
        cmd.reason,
      );
      break;
    }
    case 'mod.timeout': {
      const guild = await client.guilds.fetch(cmd.guildId);
      const target = await guild.members.fetch(cmd.targetUserId);
      await target.timeout(cmd.durationSec * 1000, cmd.reason);
      await moderation.logAction(
        cmd.guildId,
        'timeout',
        cmd.targetUserId,
        cmd.moderatorId,
        cmd.reason,
        cmd.durationSec,
      );
      break;
    }
    case 'mod.untimeout': {
      const guild = await client.guilds.fetch(cmd.guildId);
      const target = await guild.members.fetch(cmd.targetUserId);
      await target.timeout(null, cmd.reason);
      await moderation.logAction(
        cmd.guildId,
        'untimeout',
        cmd.targetUserId,
        cmd.moderatorId,
        cmd.reason,
      );
      break;
    }
  }
}

export function startBotCommandListener(
  redis: Redis,
  music: MusicController,
  moderation: ModerationService,
  client: Client,
  logger: Logger,
): Redis {
  const sub = redis.duplicate({ maxRetriesPerRequest: null });

  sub.on('error', (err) => logger.error({ err }, 'bot-command-listener redis error'));
  sub.on('ready', () => {
    logger.info('bot-command-listener ready');
    sub.subscribe('commands:bot', (err) => {
      if (err) logger.error({ err }, 'failed to subscribe to commands:bot');
    });
  });

  sub.on('message', (_channel, raw) => {
    let cmd: BotCommand;
    try {
      cmd = botCommandSchema.parse(JSON.parse(raw));
    } catch (err) {
      logger.warn({ err }, 'invalid bot command received');
      return;
    }

    const { requestId } = cmd;
    void dispatch(cmd, music, moderation, client)
      .then(() => {
        redis
          .publish(`replies:bot:${requestId}`, JSON.stringify({ requestId, ok: true }))
          .catch((e: unknown) => logger.warn({ e }, 'reply publish failed'));
      })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err.message : 'unknown';
        logger.warn({ err, requestId, type: cmd.type }, 'bot command failed');
        redis
          .publish(`replies:bot:${requestId}`, JSON.stringify({ requestId, ok: false, error }))
          .catch((e: unknown) => logger.warn({ e }, 'reply publish failed'));
      });
  });

  return sub;
}
