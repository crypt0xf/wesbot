'use client';

import { useEffect, useRef, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface GuildMember {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
}

interface MemberPickerProps {
  guildId: string;
  value: string;
  onChange: (id: string) => void;
  onMemberSelect?: (member: GuildMember | null) => void;
  placeholder?: string;
}

export function MemberPicker({
  guildId,
  value,
  onChange,
  onMemberSelect,
  placeholder = 'Buscar membro...',
}: MemberPickerProps) {
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/guilds/${guildId}/members`, { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<GuildMember[]>) : []))
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [guildId]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = members.find((m) => m.id === value);
  const filtered = query.trim()
    ? members.filter(
        (m) =>
          m.displayName.toLowerCase().includes(query.toLowerCase()) ||
          m.username.toLowerCase().includes(query.toLowerCase()) ||
          m.id.includes(query),
      )
    : members;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border-input bg-background focus:ring-ring flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1"
      >
        {selected ? (
          <>
            {selected.avatar ? (
              <img src={selected.avatar} alt="" className="h-5 w-5 rounded-full" />
            ) : (
              <span className="bg-muted flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold">
                {selected.displayName[0]?.toUpperCase()}
              </span>
            )}
            <span className="min-w-0 truncate">{selected.displayName}</span>
            <span className="text-muted-foreground ml-auto text-xs">{selected.id}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{loading ? 'Carregando...' : placeholder}</span>
        )}
      </button>

      {open && (
        <div className="bg-popover border-border absolute z-50 mt-1 w-full rounded-md border shadow-lg">
          <div className="p-2">
            <input
              autoFocus
              className="border-input bg-background focus:ring-ring w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1"
              placeholder="Buscar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="text-muted-foreground px-3 py-2 text-sm">Nenhum membro encontrado</li>
            )}
            {filtered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
                  onClick={() => {
                    onChange(m.id);
                    onMemberSelect?.(m);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  {m.avatar ? (
                    <img src={m.avatar} alt="" className="h-6 w-6 rounded-full" />
                  ) : (
                    <span className="bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                      {m.displayName[0]?.toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{m.displayName}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">{m.username}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
