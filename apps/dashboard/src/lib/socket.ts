'use client';

import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Ref count per guildId — only the first join emits 'join:guild', last leave emits 'leave:guild'
const guildRefCounts = new Map<string, number>();

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000', {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });
  // Re-join all active guilds on reconnect
  socket.on('connect', () => {
    for (const guildId of guildRefCounts.keys()) {
      socket!.emit('join:guild', guildId);
    }
  });
  return socket;
}

export function joinGuild(guildId: string): void {
  const s = getSocket();
  if (!s.connected) s.connect();
  const count = (guildRefCounts.get(guildId) ?? 0) + 1;
  guildRefCounts.set(guildId, count);
  if (count === 1) {
    s.emit('join:guild', guildId);
  }
}

export function leaveGuild(guildId: string): void {
  const count = Math.max(0, (guildRefCounts.get(guildId) ?? 0) - 1);
  if (count === 0) {
    guildRefCounts.delete(guildId);
    socket?.emit('leave:guild', guildId);
  } else {
    guildRefCounts.set(guildId, count);
  }
}
