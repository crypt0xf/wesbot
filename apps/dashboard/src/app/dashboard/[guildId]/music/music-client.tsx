'use client';

import { cn } from '@wesbot/ui';
import { Layers, Music2, Sliders } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { QueuePanel } from '../../../../components/player/queue-panel';
import { Button } from '../../../../components/ui/button';
import { usePlayer } from '../../../../hooks/use-player';

const FILTERS = [
  { value: 'off', label: 'Sem filtro' },
  { value: 'bassboost', label: 'Bass Boost' },
  { value: 'nightcore', label: 'Nightcore' },
  { value: 'eightd', label: '8D' },
] as const;

interface MusicClientProps {
  guildId: string;
}

export function MusicClient({ guildId }: MusicClientProps) {
  const { queue, positionMs, reorder, setFilter } = usePlayer(guildId);
  const [tab, setTab] = useState<'queue' | 'filters'>('queue');

  const current = queue?.current ?? null;
  const tracks = queue?.tracks ?? [];
  const activeFilter =
    (queue as Record<string, unknown> | null)?.activeFilter as string ?? 'off';

  return (
    <div className="flex h-full flex-col pb-[72px]">
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
            <p className="text-xs font-medium uppercase tracking-wider text-primary">
              Tocando agora
            </p>
            <h2 className="mt-0.5 truncate text-xl font-bold">{current.title}</h2>
            <p className="text-muted-foreground truncate text-sm">{current.author}</p>
          </div>
          <div className="text-muted-foreground ml-auto text-right text-sm">
            <p>{tracks.length} na fila</p>
            <p className="tabular-nums">{Math.floor(positionMs / 1000)}s</p>
          </div>
        </div>
      ) : (
        <div className="border-border border-b p-6">
          <div className="text-muted-foreground flex flex-col items-center gap-3 py-8">
            <Music2 className="h-12 w-12 opacity-20" />
            <p className="font-medium">Nenhuma música tocando</p>
            <p className="text-sm">Use os comandos do Discord para iniciar a reprodução.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-border flex border-b">
        <button
          onClick={() => setTab('queue')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors',
            tab === 'queue'
              ? 'border-b-2 border-primary text-foreground'
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
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Sliders className="h-4 w-4" />
          Filtros
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'queue' && (
          <QueuePanel
            tracks={tracks}
            onReorder={(from, to) => void reorder(from, to)}
          />
        )}

        {tab === 'filters' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {FILTERS.map(({ value, label }) => (
              <Button
                key={value}
                variant={activeFilter === value ? 'default' : 'outline'}
                className="h-20 flex-col gap-2"
                onClick={() => void setFilter(value)}
              >
                <Sliders className="h-5 w-5" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
