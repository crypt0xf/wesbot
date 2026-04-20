'use client';

import { cn } from '@wesbot/ui';
import {
  Clock,
  Layers,
  Loader2,
  Music2,
  PhoneCall,
  PhoneMissed,
  Play,
  Plus,
  Sliders,
} from 'lucide-react';
import Image from 'next/image';

import { useEffect, useRef, useState } from 'react';

import { QueuePanel } from '../../../../components/player/queue-panel';
import { Button } from '../../../../components/ui/button';
import { usePlayer } from '../../../../hooks/use-player';

const FILTERS = [
  { value: 'off', label: 'Sem filtro' },
  { value: 'bassboost', label: 'Bass Boost' },
  { value: 'nightcore', label: 'Nightcore' },
  { value: 'eightd', label: '8D' },
] as const;

function msToTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

interface MusicClientProps {
  guildId: string;
}

export function MusicClient({ guildId }: MusicClientProps) {
  const { queue, positionMs, lastPositionAt, reorder, setFilter, play, joinVoice, stop } =
    usePlayer(guildId);
  const [tab, setTab] = useState<'queue' | 'filters' | 'history'>('queue');
  const [, setTick] = useState(0);
  const [optimisticFilter, setOptimisticFilter] = useState<string | null>(null);

  // Add music input state
  const [query, setQuery] = useState('');
  const [playLoading, setPlayLoading] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const queryRef = useRef<HTMLInputElement>(null);

  const isPaused = queue?.isPaused ?? true;
  const duration = queue?.current?.duration ?? 0;

  useEffect(() => {
    if (isPaused || !queue?.current) return;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [isPaused, queue?.current]);

  // Clear optimistic state once the server confirms the change
  useEffect(() => {
    if (optimisticFilter !== null && queue?.activeFilter === optimisticFilter) {
      setOptimisticFilter(null);
    }
  }, [queue?.activeFilter, optimisticFilter]);

  const livePositionMs =
    isPaused || !lastPositionAt
      ? positionMs
      : Math.min(duration || Infinity, positionMs + (Date.now() - lastPositionAt));

  const current = queue?.current ?? null;
  const tracks = queue?.tracks ?? [];
  const history = queue?.history ?? [];
  const activeFilter = optimisticFilter ?? queue?.activeFilter ?? 'off';

  async function handlePlay() {
    if (!query.trim()) return;
    setPlayLoading(true);
    setPlayError(null);
    try {
      const res = await play(query.trim());
      if (res.ok) {
        setQuery('');
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setPlayError(body.error ?? 'Falha ao adicionar música.');
      }
    } catch {
      setPlayError('Falha ao adicionar música.');
    } finally {
      setPlayLoading(false);
    }
  }

  async function handleJoin() {
    setJoinLoading(true);
    setJoinError(null);
    try {
      const res = await joinVoice();
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setJoinError(body.error ?? 'Falha ao entrar na chamada.');
      }
    } catch {
      setJoinError('Falha ao entrar na chamada.');
    } finally {
      setJoinLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Now playing banner */}
      {current ? (
        <div className="from-primary/10 border-border flex items-center gap-4 border-b bg-gradient-to-r to-transparent p-6">
          {current.artworkUrl ? (
            <Image
              src={current.artworkUrl}
              alt={current.title}
              width={64}
              height={64}
              className="rounded-lg shadow-lg"
              unoptimized
            />
          ) : (
            <div className="bg-muted flex h-16 w-16 shrink-0 items-center justify-center rounded-lg shadow-lg">
              <Music2 className="text-muted-foreground h-8 w-8" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-primary text-xs font-medium uppercase tracking-wider">
              Tocando agora
            </p>
            <h2 className="mt-0.5 truncate text-xl font-bold">{current.title}</h2>
            <p className="text-muted-foreground truncate text-sm">{current.author}</p>
          </div>
          <div className="text-muted-foreground ml-auto text-right text-sm">
            <p>{tracks.length} na fila</p>
            <p className="tabular-nums">{msToTime(livePositionMs)}</p>
          </div>
        </div>
      ) : (
        <div className="border-border border-b p-6">
          <div className="text-muted-foreground flex flex-col items-center gap-3 py-4">
            <Music2 className="h-12 w-12 opacity-20" />
            <p className="font-medium">Nenhuma música tocando</p>
          </div>
        </div>
      )}

      {/* Add music + join voice controls */}
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <input
          ref={queryRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPlayError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handlePlay();
          }}
          placeholder="Pesquisar ou colar URL..."
          className="border-border bg-background focus:ring-ring min-w-0 flex-1 rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1"
        />
        <Button
          size="sm"
          onClick={() => void handlePlay()}
          disabled={playLoading || !query.trim()}
          className="shrink-0"
        >
          {playLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          <span className="ml-1.5 hidden sm:inline">Adicionar</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleJoin()}
          disabled={joinLoading}
          className="shrink-0"
          title="Adicionar bot à sua chamada"
        >
          {joinLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PhoneCall className="h-4 w-4" />
          )}
          <span className="ml-1.5 hidden sm:inline">Entrar</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setLeaveLoading(true);
            void stop().finally(() => setLeaveLoading(false));
          }}
          disabled={leaveLoading}
          className="shrink-0 text-red-500 hover:text-red-500"
          title="Desconectar bot da chamada"
        >
          {leaveLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PhoneMissed className="h-4 w-4" />
          )}
          <span className="ml-1.5 hidden sm:inline">Sair</span>
        </Button>
      </div>
      {(playError ?? joinError) && (
        <p className="px-4 py-1.5 text-xs text-red-500">{playError ?? joinError}</p>
      )}

      {/* Tabs */}
      <div className="border-border flex border-b">
        <button
          onClick={() => setTab('queue')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors',
            tab === 'queue'
              ? 'border-primary text-foreground border-b-2'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Layers className="h-4 w-4" />
          Fila
          {tracks.length > 0 && (
            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
              {tracks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('filters')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors',
            tab === 'filters'
              ? 'border-primary text-foreground border-b-2'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Sliders className="h-4 w-4" />
          Filtros
        </button>
        <button
          onClick={() => setTab('history')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors',
            tab === 'history'
              ? 'border-primary text-foreground border-b-2'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Clock className="h-4 w-4" />
          Recentes
          {history.length > 0 && (
            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
              {history.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'queue' && (
          <QueuePanel tracks={tracks} onReorder={(from, to) => void reorder(from, to)} />
        )}

        {tab === 'filters' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {FILTERS.map(({ value, label }) => (
              <Button
                key={value}
                variant={activeFilter === value ? 'default' : 'outline'}
                className="h-20 flex-col gap-2"
                onClick={() => {
                  setOptimisticFilter(value);
                  void setFilter(value);
                }}
              >
                <Sliders className="h-5 w-5" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-1">
            {history.length === 0 && (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Nenhuma música recente.
              </p>
            )}
            {history.map((track, i) => (
              <div
                key={`${track.identifier}-${i}`}
                className="hover:bg-muted/40 flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
              >
                {track.artworkUrl ? (
                  <Image
                    src={track.artworkUrl}
                    alt={track.title}
                    width={36}
                    height={36}
                    className="shrink-0 rounded"
                    unoptimized
                  />
                ) : (
                  <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded">
                    <Music2 className="text-muted-foreground h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{track.title}</p>
                  <p className="text-muted-foreground truncate text-xs">{track.author}</p>
                </div>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {msToTime(track.duration)}
                </span>
                <button
                  onClick={() => {
                    setQuery(track.uri);
                    setTab('queue');
                    void handlePlay();
                  }}
                  className="text-muted-foreground hover:text-primary shrink-0 transition-colors"
                  title="Tocar novamente"
                >
                  <Play className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
