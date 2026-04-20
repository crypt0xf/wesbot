import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { auth } from '../../../auth';
import { PlayerBar } from '../../../components/player/player-bar';
import { Sidebar } from '../../../components/sidebar/index';
import { getGuildSettingsSSR } from '../../../lib/api';

interface GuildLayoutProps {
  children: React.ReactNode;
  params: Promise<{ guildId: string }>;
}

export default async function GuildLayout({ children, params }: GuildLayoutProps) {
  const session = await auth();
  if (!session) redirect('/login');

  const { guildId } = await params;

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const settings = await getGuildSettingsSSR(guildId, cookieHeader).catch(() => null);
  if (!settings) notFound();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        guildId={guildId}
        guildName={settings.name}
        guildIcon={settings.icon}
        user={{
          name: session.user.name ?? 'Usuário',
          email: session.user.email ?? '',
          image: session.user.image,
        }}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
        <PlayerBar guildId={guildId} />
      </div>
    </div>
  );
}
