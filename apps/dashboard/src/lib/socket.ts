'use client';

import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  socket ??= io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000', {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });
  return socket;
}
