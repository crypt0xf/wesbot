'use client';

import { LayoutDashboard, Music, Shield, Settings, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import * as React from 'react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './ui/command';
import { Dialog, DialogContent } from './ui/dialog';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guildId?: string;
}

export function CommandPalette({ open, onOpenChange, guildId }: CommandPaletteProps) {
  const router = useRouter();

  const navigate = (href: string) => {
    router.push(href);
    onOpenChange(false);
  };

  const guildPrefix = guildId ? `/dashboard/${guildId}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl">
        <Command>
          <CommandInput placeholder="Buscar páginas, ações..." />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

            {guildPrefix && (
              <CommandGroup heading="Navegação">
                <CommandItem onSelect={() => navigate(guildPrefix)}>
                  <LayoutDashboard className="h-4 w-4" />
                  Overview
                  <CommandShortcut>G O</CommandShortcut>
                </CommandItem>
                <CommandItem onSelect={() => navigate(`${guildPrefix}/music`)}>
                  <Music className="h-4 w-4" />
                  Música
                  <CommandShortcut>G M</CommandShortcut>
                </CommandItem>
                <CommandItem onSelect={() => navigate(`${guildPrefix}/moderation`)}>
                  <Shield className="h-4 w-4" />
                  Moderação
                  <CommandShortcut>G D</CommandShortcut>
                </CommandItem>
                <CommandItem onSelect={() => navigate(`${guildPrefix}/settings`)}>
                  <Settings className="h-4 w-4" />
                  Configurações
                  <CommandShortcut>G S</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup heading="Servidor">
              <CommandItem onSelect={() => navigate('/dashboard')}>
                <LayoutDashboard className="h-4 w-4" />
                Trocar servidor
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Conta">
              <CommandItem
                onSelect={() => {
                  onOpenChange(false);
                  void signOut({ callbackUrl: '/' });
                }}
                className="text-destructive data-[selected=true]:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
