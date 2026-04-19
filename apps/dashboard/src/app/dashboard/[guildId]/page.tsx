import {
  Music,
  Shield,
  Users,
  Activity,
  Settings,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge } from '../../../components/ui/badge';

export const metadata: Metadata = { title: 'Overview' };

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
}

function StatCard({ label, value, icon, description }: StatCardProps) {
  return (
    <div className="bg-card border-border rounded-xl border p-5">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {description && (
        <p className="text-muted-foreground mt-1 text-xs">{description}</p>
      )}
    </div>
  );
}

interface GuildOverviewPageProps {
  params: Promise<{ guildId: string }>;
}

export default async function GuildOverviewPage({ params }: GuildOverviewPageProps) {
  const { guildId } = await params;

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

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Músicas tocadas hoje"
          value="—"
          icon={<Music className="h-4 w-4" />}
          description="Disponível na Fase 6"
        />
        <StatCard
          label="Ações de moderação"
          value="—"
          icon={<Shield className="h-4 w-4" />}
          description="Disponível na Fase 7"
        />
        <StatCard
          label="Membros ativos"
          value="—"
          icon={<Users className="h-4 w-4" />}
          description="Disponível na Fase 9"
        />
        <StatCard
          label="Comandos executados"
          value="—"
          icon={<Activity className="h-4 w-4" />}
          description="Disponível na Fase 10"
        />
      </div>

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Ações rápidas
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Gerenciar música', icon: <Music className="h-3.5 w-3.5" />, href: 'music' },
            { label: 'Moderação', icon: <Shield className="h-3.5 w-3.5" />, href: 'moderation' },
            { label: 'Configurações', icon: <Settings className="h-3.5 w-3.5" />, href: 'settings' },
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
