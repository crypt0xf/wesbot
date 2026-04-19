import type { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';

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
