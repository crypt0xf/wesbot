import { Music, Settings, Shield } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { Badge } from '../../../components/ui/badge';
import { OverviewStats } from './overview-stats';

export const metadata: Metadata = { title: 'Overview' };

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

interface GuildOverviewPageProps {
  params: Promise<{ guildId: string }>;
}

export default async function GuildOverviewPage({ params }: GuildOverviewPageProps) {
  const { guildId } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const stats = await fetch(`${API_URL}/api/guilds/${guildId}/stats`, {
    headers: { Cookie: cookieHeader },
    cache: 'no-store',
  })
    .then((r) =>
      r.ok
        ? (r.json() as Promise<{
            modActionsToday: number;
            songsPlayedToday: number;
            commandsToday: number;
            totalMembers: number;
            botMembers: number;
          }>)
        : null,
    )
    .catch(() => null);

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Visão geral do servidor e status do bot.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <span className="bg-success h-2 w-2 rounded-full" />
          Bot online
        </Badge>
      </div>

      {/* Stats grid — client component, polls every 30s */}
      <OverviewStats guildId={guildId} initial={stats} />

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="text-muted-foreground mb-4 text-sm font-semibold uppercase tracking-wider">
          Ações rápidas
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Gerenciar música', icon: <Music className="h-3.5 w-3.5" />, href: 'music' },
            { label: 'Moderação', icon: <Shield className="h-3.5 w-3.5" />, href: 'moderation' },
            {
              label: 'Configurações',
              icon: <Settings className="h-3.5 w-3.5" />,
              href: 'settings',
            },
          ].map(({ label, icon, href }) => (
            <Link
              key={href}
              href={`/dashboard/${guildId}/${href}`}
              className="border-border hover:border-primary/40 hover:text-primary inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors"
            >
              {icon}
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
