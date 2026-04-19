import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { auth } from '../../../auth';
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

  // Discord guild info is not available here without an extra API call;
  // we use the settings ID as the guild name placeholder until Phase 6
  // adds a proper guild-info endpoint.
  const guildDisplayName = settings.id;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        guildId={guildId}
        guildName={guildDisplayName}
        guildIcon={null}
        user={{
          name: session.user.name ?? 'Usuário',
          email: session.user.email ?? '',
          image: session.user.image,
        }}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
