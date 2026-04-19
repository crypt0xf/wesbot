import { REDIS_KEYS } from '@wesbot/shared';
import type { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';

interface PersistedQueue {
  v: 1;
  guildId: string;
  voiceChannelId: string | null;
  current: unknown;
  queue: unknown[];
  history: unknown[];
  loop: string;
  volume: number;
  autoplay: boolean;
}

export function createSocketGateway(app: FastifyInstance, corsOrigins: string[]): SocketIOServer {
  const io = new SocketIOServer(app.server, {
    cors: { origin: corsOrigins, credentials: true },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    app.log.debug({ socketId: socket.id }, 'ws connected');

    socket.on('join:guild', (guildId: unknown) => {
      if (typeof guildId !== 'string' || !/^\d{17,20}$/.test(guildId)) return;
      void socket.join(`guild:${guildId}`);
      app.log.debug({ socketId: socket.id, guildId }, 'ws joined guild');

      // Replay current queue state so the client doesn't see an empty player
      void app.redis.get(REDIS_KEYS.guildQueue(guildId)).then((raw) => {
        if (!raw) return;
        let parsed: PersistedQueue;
        try {
          parsed = JSON.parse(raw) as PersistedQueue;
          if (parsed.v !== 1) return;
        } catch {
          return;
        }
        socket.emit('music', {
          type: 'queue.updated',
          guildId,
          state: {
            guildId,
            voiceChannelId: parsed.voiceChannelId,
            current: parsed.current,
            tracks: parsed.queue,
            history: parsed.history,
            position: 0,
            isPaused: false,
            volume: parsed.volume,
            loop: parsed.loop,
            autoplay: parsed.autoplay,
          },
          timestamp: Date.now(),
        });
      });
    });

    socket.on('leave:guild', (guildId: unknown) => {
      if (typeof guildId !== 'string') return;
      void socket.leave(`guild:${guildId}`);
    });

    socket.on('disconnect', (reason) => {
      app.log.debug({ socketId: socket.id, reason }, 'ws disconnected');
    });
  });

  return io;
}
