import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '../../auth';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { getMyGuildsSSR } from '../../lib/api';

export const metadata: Metadata = { title: 'Selecionar servidor' };

function GuildCard({
  id,
  name,
  icon,
  owner,
  hasBot,
}: {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  hasBot: boolean;
}) {
  return (
    <Link
      href={`/dashboard/${id}`}
      className="bg-card border-border hover:border-primary/40 hover:bg-card/80 group flex flex-col items-center gap-3 rounded-xl border p-6 transition-all hover:shadow-lg"
    >
      <div className="relative">
        <Avatar className="h-16 w-16">
          {icon && <AvatarImage src={icon} alt={name} />}
          <AvatarFallback className="text-lg font-bold">
            {name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {hasBot && (
          <span className="bg-success border-card absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2" />
        )}
      </div>
      <div className="text-center">
        <p className="group-hover:text-primary line-clamp-2 text-sm font-semibold transition-colors">
          {name}
        </p>
        <div className="mt-1 flex items-center justify-center gap-1">
          {owner && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Dono
            </Badge>
          )}
          {hasBot && (
            <Badge variant="success" className="text-[10px] px-1.5 py-0">
              Bot ativo
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}

export default async function ServerSelectorPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const guilds = await getMyGuildsSSR(cookieHeader).catch(() => null);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight">Selecionar servidor</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Escolha o servidor que você quer gerenciar.
        </p>
      </div>

      {!guilds ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : guilds.length === 0 ? (
        <div className="border-border rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Nenhum servidor encontrado onde você tenha permissão de gerenciar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {guilds.map((guild) => (
            <GuildCard key={guild.id} {...guild} />
          ))}
        </div>
      )}
    </main>
  );
}
