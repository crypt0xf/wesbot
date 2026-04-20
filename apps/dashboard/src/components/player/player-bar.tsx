'use client';

import { cn } from '@wesbot/ui';
import { Pause, Play, Repeat, Repeat1, SkipForward, Square, Volume2, VolumeX } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

import { usePlayer } from '../../hooks/use-player';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

interface PlayerBarProps {
  guildId: string;
}

export function PlayerBar({ guildId }: PlayerBarProps) {
  const { queue, positionMs, lastPositionAt, pause, skip, stop, seek, setVolume, setLoop } =
    usePlayer(guildId);

  const [localVolume, setLocalVolume] = useState(100);
  const [draggingSeek, setDraggingSeek] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [, setTick] = useState(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (queue) setLocalVolume(queue.volume);
  }, [queue?.volume]);

  const current = queue?.current ?? null;
  const isPaused = queue?.isPaused ?? true;
  const loopMode = queue?.loop ?? 'off';
  const duration = current?.duration ?? 0;

  // Advance the displayed position locally so the bar moves between WebSocket events.
  useEffect(() => {
    if (isPaused || !current) return;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [isPaused, current]);

  const livePositionMs =
    isPaused || !lastPositionAt
      ? positionMs
      : Math.min(duration || Infinity, positionMs + (Date.now() - lastPositionAt));

  const displayPosition = draggingSeek ? seekValue : livePositionMs;
  const progress = duration > 0 ? Math.min(100, (displayPosition / duration) * 100) : 0;

  const handleSeekCommit = useCallback(
    (vals: number[]) => {
      setDraggingSeek(false);
      void seek(((vals[0] ?? 0) / 100) * duration);
    },
    [seek, duration],
  );

  const cycleLoop = useCallback(() => {
    const next = loopMode === 'off' ? 'track' : loopMode === 'track' ? 'queue' : 'off';
    void setLoop(next);
  }, [loopMode, setLoop]);

  if (!current) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="border-border bg-card/95 shrink-0 border-t backdrop-blur-sm">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-4 py-2">
          {/* Track info */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {current.artworkUrl ? (
              <Image
                src={current.artworkUrl}
                alt={current.title}
                width={40}
                height={40}
                className="rounded"
                unoptimized
              />
            ) : (
              <div className="bg-muted h-10 w-10 rounded" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{current.title}</p>
              <p className="text-muted-foreground truncate text-xs">{current.author}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-1 flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-7 w-7', loopMode !== 'off' && 'text-primary')}
                    onClick={cycleLoop}
                  >
                    {loopMode === 'track' ? (
                      <Repeat1 className="h-4 w-4" />
                    ) : (
                      <Repeat className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Loop: {loopMode}</TooltipContent>
              </Tooltip>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => void pause(!isPaused)}
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>

              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void skip()}>
                <SkipForward className="h-4 w-4" />
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => void stop()}
                  >
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Stop</TooltipContent>
              </Tooltip>
            </div>

            {/* Seek bar */}
            <div className="flex w-full max-w-md items-center gap-2">
              <span className="text-muted-foreground w-8 text-right text-xs tabular-nums">
                {formatMs(displayPosition)}
              </span>
              <Slider
                className="flex-1"
                min={0}
                max={100}
                step={0.1}
                value={[progress]}
                onValueChange={(vals) => {
                  setDraggingSeek(true);
                  setSeekValue(((vals[0] ?? 0) / 100) * duration);
                }}
                onValueCommit={handleSeekCommit}
                disabled={current.isStream || duration === 0}
              />
              <span className="text-muted-foreground w-8 text-xs tabular-nums">
                {current.isStream ? '∞' : formatMs(duration)}
              </span>
            </div>
          </div>

          {/* Volume */}
          <div className="flex flex-1 items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => void setVolume(localVolume > 0 ? 0 : 100)}
            >
              {localVolume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              className="w-24"
              min={0}
              max={200}
              step={1}
              value={[localVolume]}
              onValueChange={([v]) => setLocalVolume(v ?? 0)}
              onValueCommit={([v]) => void setVolume(v ?? 0)}
            />
            <span className="text-muted-foreground w-8 text-xs tabular-nums">{localVolume}%</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
