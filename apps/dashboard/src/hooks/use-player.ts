'use client';

import type { MusicEvent } from '@wesbot/shared';
import { useCallback, useEffect } from 'react';

import { getSocket } from '../lib/socket';
import { usePlayerStore } from '../store/player-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function musicPost(
  guildId: string,
  action: string,
  body?: Record<string, unknown>,
): Promise<void> {
  await fetch(`${API_URL}/api/guilds/${guildId}/music/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function usePlayer(guildId: string) {
  const store = usePlayerStore();

  useEffect(() => {
    const socket = getSocket();
    store.setGuildId(guildId);

    if (!socket.connected) socket.connect();

    socket.emit('join:guild', guildId);

    const onMusic = (event: MusicEvent) => {
      if (event.guildId !== guildId) return;
      switch (event.type) {
        case 'queue.updated':
          store.setQueueState(event.state);
          break;
        case 'player.position':
          store.setPosition(event.positionMs);
          break;
        case 'player.paused':
          store.setPaused(event.paused);
          break;
        case 'track.started':
          // queue.updated always follows; no-op here
          break;
        case 'track.ended':
          break;
      }
    };

    socket.on('music', onMusic);

    return () => {
      socket.off('music', onMusic);
      socket.emit('leave:guild', guildId);
      // Don't clear store here — player bar and other pages still need it.
      // The store resets naturally when a new guildId is set.
    };
  }, [guildId]);

  const pause = useCallback(
    (paused: boolean) => musicPost(guildId, 'pause', { paused }),
    [guildId],
  );
  const skip = useCallback(() => musicPost(guildId, 'skip'), [guildId]);
  const stop = useCallback(() => musicPost(guildId, 'stop'), [guildId]);
  const seek = useCallback(
    (positionMs: number) => musicPost(guildId, 'seek', { positionMs }),
    [guildId],
  );
  const setVolume = useCallback(
    (volume: number) => musicPost(guildId, 'volume', { volume }),
    [guildId],
  );
  const setLoop = useCallback(
    (mode: 'off' | 'track' | 'queue') => musicPost(guildId, 'loop', { mode }),
    [guildId],
  );
  const setFilter = useCallback(
    (filter: 'off' | 'bassboost' | 'nightcore' | 'eightd') =>
      musicPost(guildId, 'filter', { filter }),
    [guildId],
  );
  const reorder = useCallback(
    (fromIndex: number, toIndex: number) =>
      musicPost(guildId, 'reorder', { fromIndex, toIndex }),
    [guildId],
  );

  return {
    queue: store.queue,
    positionMs: store.positionMs,
    pause,
    skip,
    stop,
    seek,
    setVolume,
    setLoop,
    setFilter,
    reorder,
  };
}
