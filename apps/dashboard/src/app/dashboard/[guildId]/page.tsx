import {
  Music,
  Shield,
  Users,
  Activity,
  Settings,
} from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';


import { auth } from '../../../auth';
import { Badge } from '../../../components/ui/badge';
import { getGuildSettingsSSR } from '../../../lib/api';

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
  const session = await auth();
  if (!session) redirect('/login');

  const { guildId } = await params;
  const cookieStore = await cookies();
  const settings = await getGuildSettingsSSR(guildId, cookieStore.toString()).catch(() => null);

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

      {/* Settings summary */}
      {settings && (
        <div className="mt-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Configurações ativas
          </h2>
          <div className="bg-card border-border grid grid-cols-2 divide-x divide-y rounded-xl border lg:grid-cols-3">
            {[
              { label: 'Prefixo', value: settings.prefix },
              { label: 'Idioma', value: settings.locale },
              { label: 'Volume padrão', value: `${settings.defaultVolume}%` },
              { label: 'Vote skip', value: `${Math.round(settings.voteSkipThreshold * 100)}%` },
              { label: '24/7', value: settings.twentyFourSeven ? 'Ativado' : 'Desativado' },
              {
                label: 'Auto-desconexão',
                value: settings.autoDisconnectMinutes
                  ? `${settings.autoDisconnectMinutes} min`
                  : 'Desativado',
              },
            ].map(({ label, value }) => (
              <div key={label} className="divide-border p-4">
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="mt-0.5 text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <a
              key={href}
              href={`/dashboard/${guildId}/${href}`}
              className="border-border hover:border-primary/40 hover:text-primary inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors"
            >
              {icon}
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
