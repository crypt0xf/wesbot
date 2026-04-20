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

      // Replay active queue state (only when bot is playing), then merge persisted history
      void Promise.all([
        app.redis.get(REDIS_KEYS.guildQueue(guildId)),
        app.redis.get(`track_history:${guildId}`),
      ]).then(([queueRaw, historyRaw]) => {
        let queue: PersistedQueue | null = null;
        try {
          const p = JSON.parse(queueRaw ?? 'null') as PersistedQueue | null;
          if (p?.v === 1 && p.current) queue = p;
        } catch {
          /* ignore */
        }

        let persistedHistory: unknown[] = [];
        try {
          const h = JSON.parse(historyRaw ?? '[]') as unknown[];
          if (Array.isArray(h)) persistedHistory = h;
        } catch {
          /* ignore */
        }

        if (!queue && persistedHistory.length === 0) return;

        socket.emit('music', {
          type: 'queue.updated',
          guildId,
          state: {
            guildId,
            voiceChannelId: queue?.voiceChannelId ?? null,
            current: queue?.current ?? null,
            tracks: queue?.queue ?? [],
            history: queue?.history?.length ? queue.history : persistedHistory,
            position: 0,
            isPaused: false,
            volume: queue?.volume ?? 100,
            loop: queue?.loop ?? 'off',
            autoplay: queue?.autoplay ?? false,
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
