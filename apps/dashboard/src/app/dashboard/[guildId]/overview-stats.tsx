'use client';

import { Activity, Music, Shield, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Stats {
  modActionsToday: number;
  songsPlayedToday: number;
  commandsToday: number;
  totalMembers: number;
  botMembers: number;
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card border-border rounded-xl border p-5">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {sub && <p className="text-muted-foreground mt-1 text-xs">{sub}</p>}
    </div>
  );
}

export function OverviewStats({ guildId, initial }: { guildId: string; initial: Stats | null }) {
  const [stats, setStats] = useState<Stats | null>(initial);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/guilds/${guildId}/stats`, {
          credentials: 'include',
        });
        if (res.ok && !cancelled) setStats((await res.json()) as Stats);
      } catch {
        /* ignore */
      }
    }

    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [guildId]);

  const fmt = (n: number | undefined) => (n !== undefined ? String(n) : '—');

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Músicas tocadas hoje"
        value={fmt(stats?.songsPlayedToday)}
        sub="Hoje"
        icon={<Music className="h-4 w-4" />}
      />
      <StatCard
        label="Ações de moderação"
        value={fmt(stats?.modActionsToday)}
        sub="Hoje"
        icon={<Shield className="h-4 w-4" />}
      />
      <StatCard
        label="Membros do servidor"
        value={fmt(stats?.totalMembers)}
        sub={
          stats
            ? `${stats.botMembers} bots · ${stats.totalMembers - stats.botMembers} humanos`
            : undefined
        }
        icon={<Users className="h-4 w-4" />}
      />
      <StatCard
        label="Comandos executados"
        value={fmt(stats?.commandsToday)}
        sub="Hoje"
        icon={<Activity className="h-4 w-4" />}
      />
    </div>
  );
}
