'use client';

import { cn } from '@wesbot/ui';
import { LayoutDashboard, Music, Shield, Settings, Search, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { CommandPalette } from '../command-palette';
import { TooltipProvider } from '../ui/tooltip';
import { UserMenu } from '../user-menu';

interface SidebarProps {
  guildId: string;
  guildName: string;
  guildIcon?: string | null;
  user: { name: string; email: string; image?: string | null };
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function GuildIcon({ icon, name }: { icon?: string | null; name: string }) {
  if (icon) {
    return <img src={icon} alt={name} className="h-8 w-8 rounded-full object-cover" />;
  }
  return (
    <div className="bg-primary/20 text-primary flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function Sidebar({ guildId, guildName, guildIcon, user }: SidebarProps) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const base = `/dashboard/${guildId}`;

  const navItems: NavItem[] = [
    { href: base, label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: `${base}/music`, label: 'Música', icon: <Music className="h-4 w-4" /> },
    { href: `${base}/moderation`, label: 'Moderação', icon: <Shield className="h-4 w-4" /> },
    { href: `${base}/settings`, label: 'Configurações', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="bg-card border-border flex h-full w-60 flex-col border-r">
        {/* Guild header */}
        <div className="border-border flex items-center gap-2.5 border-b px-4 py-3">
          <GuildIcon icon={guildIcon} name={guildName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{guildName}</p>
            <p className="text-muted-foreground text-xs">Painel de controle</p>
          </div>
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Trocar servidor</span>
          </Link>
        </div>

        {/* Search / cmd palette trigger */}
        <div className="px-3 py-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground flex w-full items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors"
          >
            <Search className="h-3 w-3" />
            <span className="flex-1 text-left">Buscar...</span>
            <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-2 py-1">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-border mt-auto border-t px-3 py-3">
          <UserMenu name={user.name} email={user.email} image={user.image} guildId={guildId} />
        </div>
      </aside>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} guildId={guildId} />
    </TooltipProvider>
  );
}
