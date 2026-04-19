'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Track } from '@wesbot/shared';
import { GripVertical, Music2, X } from 'lucide-react';
import Image from 'next/image';
import { useOptimistic, useTransition } from 'react';

import { Button } from '../ui/button';

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

interface QueueRowProps {
  track: Track;
  index: number;
  onRemove?: (index: number) => void;
}

function QueueRow({ track, index, onRemove }: QueueRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: track.identifier + index });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="hover:bg-accent/5 group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab touch-none active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="text-muted-foreground w-5 text-center text-xs tabular-nums">
        {index + 1}
      </span>

      {track.artworkUrl ? (
        <Image
          src={track.artworkUrl}
          alt={track.title}
          width={36}
          height={36}
          className="rounded"
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

      <span className="text-muted-foreground text-xs tabular-nums">
        {track.isStream ? '∞' : formatMs(track.duration)}
      </span>

      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground/40 hover:text-destructive h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => onRemove(index)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

interface QueuePanelProps {
  tracks: Track[];
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function QueuePanel({ tracks, onReorder }: QueuePanelProps) {
  const [, startTransition] = useTransition();
  const [optimisticTracks, setOptimisticTracks] = useOptimistic(tracks);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = optimisticTracks.map((t, i) => t.identifier + i);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    startTransition(() => {
      setOptimisticTracks(arrayMove(optimisticTracks, oldIndex, newIndex));
    });
    onReorder(oldIndex, newIndex);
  }

  if (optimisticTracks.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 py-12">
        <Music2 className="h-8 w-8 opacity-30" />
        <p className="text-sm">Fila vazia</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-0.5">
          {optimisticTracks.map((track, i) => (
            <QueueRow key={track.identifier + i} track={track} index={i} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
