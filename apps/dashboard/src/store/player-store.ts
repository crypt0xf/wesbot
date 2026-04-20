import type { QueueState } from '@wesbot/shared';
import { create } from 'zustand';

interface PlayerStore {
  guildId: string | null;
  queue: QueueState | null;
  positionMs: number;
  lastPositionAt: number;

  setGuildId: (guildId: string | null) => void;
  setQueueState: (state: QueueState) => void;
  setPosition: (positionMs: number) => void;
  setPaused: (paused: boolean) => void;
  clear: () => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  guildId: null,
  queue: null,
  positionMs: 0,
  lastPositionAt: 0,

  setGuildId: (guildId) => set({ guildId }),

  setQueueState: (state) =>
    set({
      queue: state,
      positionMs: state.position,
      lastPositionAt: Date.now(),
    }),

  setPosition: (positionMs) => set({ positionMs, lastPositionAt: Date.now() }),

  setPaused: (paused) => set((s) => ({ queue: s.queue ? { ...s.queue, isPaused: paused } : null })),

  clear: () => set({ queue: null, positionMs: 0, lastPositionAt: 0 }),
}));
