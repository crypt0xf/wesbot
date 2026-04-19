'use client';

import { cn } from '@wesbot/ui';
import { RefreshCw, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '../../../../components/ui/button';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type ModActionType =
  | 'warn'
  | 'kick'
  | 'ban'
  | 'tempban'
  | 'unban'
  | 'timeout'
  | 'untimeout'
  | 'purge';

interface ModLog {
  id: string;
  type: ModActionType;
  targetUserId: string;
  moderatorId: string;
  reason: string | null;
  durationSec: number | null;
  createdAt: string;
}

interface Warn {
  id: string;
  userId: string;
  moderatorId: string;
  reason: string;
  createdAt: string;
}

interface AutomodRule {
  id: string;
  type: string;
  enabled: boolean;
  action: string;
  config: Record<string, unknown>;
  exemptRoleIds: string[];
  exemptChannelIds: string[];
}

type AutomodAction = 'delete' | 'warn' | 'timeout' | 'kick' | 'ban';

const ACTION_LABELS: Record<ModActionType, string> = {
  warn: 'Aviso',
  kick: 'Expulsão',
  ban: 'Banimento',
  tempban: 'Ban Temporário',
  unban: 'Desbanimento',
  timeout: 'Silenciamento',
  untimeout: 'Des-silenciamento',
  purge: 'Limpeza',
};

const ACTION_COLORS: Record<ModActionType, string> = {
  warn: 'text-yellow-500',
  kick: 'text-orange-500',
  ban: 'text-red-500',
  tempban: 'text-red-400',
  unban: 'text-green-500',
  timeout: 'text-blue-500',
  untimeout: 'text-blue-300',
  purge: 'text-purple-500',
};

const AUTOMOD_RULES = [
  { type: 'spam', label: 'Spam', description: 'Mensagens repetidas rapidamente' },
  { type: 'caps', label: 'CAPS excessivo', description: 'Mensagens em maiúsculas excessivas' },
  { type: 'mentions', label: 'Menções em massa', description: 'Muitas menções em uma mensagem' },
  { type: 'links', label: 'Links', description: 'Bloqueia links externos' },
  { type: 'invites', label: 'Convites Discord', description: 'Bloqueia links de convite' },
  { type: 'wordlist', label: 'Lista de palavras', description: 'Palavras proibidas' },
  { type: 'anti_raid', label: 'Anti-Raid', description: 'Detecta entrada em massa' },
] as const;

const AUTOMOD_ACTIONS: { value: AutomodAction; label: string }[] = [
  { value: 'delete', label: 'Apagar' },
  { value: 'warn', label: 'Avisar' },
  { value: 'timeout', label: 'Silenciar' },
  { value: 'kick', label: 'Expulsar' },
  { value: 'ban', label: 'Banir' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDuration(secs: number | null): string {
  if (!secs) return '';
  if (secs >= 86400) return ` (${Math.floor(secs / 86400)}d)`;
  if (secs >= 3600) return ` (${Math.floor(secs / 3600)}h)`;
  return ` (${Math.floor(secs / 60)}m)`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

interface ModerationClientProps {
  guildId: string;
}

type Tab = 'actions' | 'logs' | 'warns' | 'automod';

const ACTION_TYPES = [
  { value: 'warn', label: 'Avisar', needsDuration: false },
  { value: 'kick', label: 'Expulsar', needsDuration: false },
  { value: 'ban', label: 'Banir', needsDuration: false },
  { value: 'unban', label: 'Desbanir', needsDuration: false },
  { value: 'timeout', label: 'Silenciar', needsDuration: true },
  { value: 'untimeout', label: 'Des-silenciar', needsDuration: false },
] as const;

type ActionType = (typeof ACTION_TYPES)[number]['value'];

export function ModerationClient({ guildId }: ModerationClientProps) {
  const [tab, setTab] = useState<Tab>('actions');

  // Action form state
  const [actionType, setActionType] = useState<ActionType>('warn');
  const [actionTargetId, setActionTargetId] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [actionDuration, setActionDuration] = useState('10m');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Mod logs state
  const [logs, setLogs] = useState<ModLog[]>([]);
  const [logFilter, setLogFilter] = useState<ModActionType | ''>('');
  const [logLoading, setLogLoading] = useState(false);
  const [logCursor, setLogCursor] = useState<string | undefined>();
  const [logHasMore, setLogHasMore] = useState(false);

  // Warns state
  const [warnUserId, setWarnUserId] = useState('');
  const [warns, setWarns] = useState<Warn[]>([]);
  const [warnLoading, setWarnLoading] = useState(false);

  // Automod state
  const [automodRules, setAutomodRules] = useState<AutomodRule[]>([]);
  const [automodLoading, setAutomodLoading] = useState(false);
  const [automodSaving, setAutomodSaving] = useState<string | null>(null);

  const loadLogs = useCallback(
    async (cursor?: string) => {
      setLogLoading(true);
      try {
        const params = new URLSearchParams({ limit: '20' });
        if (logFilter) params.set('type', logFilter);
        if (cursor) params.set('cursor', cursor);
        const data = await apiFetch<{ items: ModLog[]; nextCursor?: string }>(
          `/api/guilds/${guildId}/mod/logs?${params.toString()}`,
        );
        setLogs((prev) => (cursor ? [...prev, ...data.items] : data.items));
        setLogCursor(data.nextCursor);
        setLogHasMore(!!data.nextCursor);
      } catch {
        // ignore
      } finally {
        setLogLoading(false);
      }
    },
    [guildId, logFilter],
  );

  const loadAutomod = useCallback(async () => {
    setAutomodLoading(true);
    try {
      const rules = await apiFetch<AutomodRule[]>(`/api/guilds/${guildId}/mod/automod`);
      setAutomodRules(rules);
    } catch {
      // ignore
    } finally {
      setAutomodLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    if (tab === 'logs') void loadLogs();
  }, [tab, loadLogs]);

  useEffect(() => {
    if (tab === 'automod') void loadAutomod();
  }, [tab, loadAutomod]);

  async function executeAction() {
    if (!/^\d{17,20}$/.test(actionTargetId) || !actionReason.trim()) return;
    setActionLoading(true);
    setActionResult(null);
    try {
      const needsDuration = ACTION_TYPES.find((a) => a.value === actionType)?.needsDuration;
      const durationMatch = /^(\d+)(s|m|h|d)$/i.exec(actionDuration.trim());
      const durationUnits: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
      const durationSec = durationMatch
        ? parseInt(durationMatch[1]!, 10) * (durationUnits[durationMatch[2]!.toLowerCase()] ?? 1)
        : 600;

      await apiFetch(`/api/guilds/${guildId}/mod/actions`, {
        method: 'POST',
        body: JSON.stringify({
          type: actionType,
          targetUserId: actionTargetId,
          reason: actionReason.trim(),
          ...(needsDuration ? { durationSec } : {}),
        }),
      });
      setActionResult({ ok: true, msg: 'Ação enviada ao bot com sucesso.' });
      setActionTargetId('');
      setActionReason('');
    } catch {
      setActionResult({ ok: false, msg: 'Falha ao executar a ação.' });
    } finally {
      setActionLoading(false);
    }
  }

  async function searchWarns() {
    if (!/^\d{17,20}$/.test(warnUserId)) return;
    setWarnLoading(true);
    try {
      const data = await apiFetch<Warn[]>(
        `/api/guilds/${guildId}/mod/warns?userId=${warnUserId}`,
      );
      setWarns(data);
    } catch {
      // ignore
    } finally {
      setWarnLoading(false);
    }
  }

  async function removeWarn(warnId: string) {
    await apiFetch(`/api/guilds/${guildId}/mod/warns/${warnId}`, { method: 'DELETE' });
    setWarns((prev) => prev.filter((w) => w.id !== warnId));
  }

  function getRuleForType(type: string): AutomodRule | undefined {
    return automodRules.find((r) => r.type === type);
  }

  async function toggleRule(type: string, current: AutomodRule | undefined) {
    const newEnabled = !(current?.enabled ?? false);
    const action: AutomodAction = (current?.action as AutomodAction) ?? 'delete';
    setAutomodSaving(type);
    try {
      const updated = await apiFetch<AutomodRule>(
        `/api/guilds/${guildId}/mod/automod/${type}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            enabled: newEnabled,
            action,
            config: current?.config ?? {},
            exemptRoleIds: current?.exemptRoleIds ?? [],
            exemptChannelIds: current?.exemptChannelIds ?? [],
          }),
        },
      );
      setAutomodRules((prev) => {
        const idx = prev.findIndex((r) => r.type === type);
        if (idx === -1) return [...prev, updated];
        return prev.map((r, i) => (i === idx ? updated : r));
      });
    } catch {
      // ignore
    } finally {
      setAutomodSaving(null);
    }
  }

  async function changeAction(type: string, action: AutomodAction) {
    const current = getRuleForType(type);
    setAutomodSaving(type);
    try {
      const updated = await apiFetch<AutomodRule>(
        `/api/guilds/${guildId}/mod/automod/${type}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            enabled: current?.enabled ?? false,
            action,
            config: current?.config ?? {},
            exemptRoleIds: current?.exemptRoleIds ?? [],
            exemptChannelIds: current?.exemptChannelIds ?? [],
          }),
        },
      );
      setAutomodRules((prev) => {
        const idx = prev.findIndex((r) => r.type === type);
        if (idx === -1) return [...prev, updated];
        return prev.map((r, i) => (i === idx ? updated : r));
      });
    } catch {
      // ignore
    } finally {
      setAutomodSaving(null);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'actions', label: 'Executar Ação' },
    { id: 'logs', label: 'Registro' },
    { id: 'warns', label: 'Avisos' },
    { id: 'automod', label: 'Automod' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Moderação</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie ações de moderação, avisos e regras automáticas.
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-border flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Execute Action */}
      {tab === 'actions' && (
        <div className="max-w-md space-y-4">
          <p className="text-muted-foreground text-sm">
            Execute ações de moderação. O bot realizará a ação no Discord.
          </p>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Ação</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as ActionType)}
                className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
              >
                {ACTION_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">ID do Usuário</label>
              <input
                type="text"
                value={actionTargetId}
                onChange={(e) => setActionTargetId(e.target.value)}
                placeholder="Ex: 1234567890123456789"
                className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm font-mono"
              />
            </div>

            {ACTION_TYPES.find((a) => a.value === actionType)?.needsDuration && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Duração (ex: 10m, 1h, 1d)</label>
                <input
                  type="text"
                  value={actionDuration}
                  onChange={(e) => setActionDuration(e.target.value)}
                  className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm font-mono"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Motivo</label>
              <input
                type="text"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Motivo da ação"
                className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
                maxLength={512}
              />
            </div>

            <Button
              onClick={() => void executeAction()}
              disabled={actionLoading || !/^\d{17,20}$/.test(actionTargetId) || !actionReason.trim()}
            >
              {actionLoading ? 'Enviando...' : 'Executar'}
            </Button>

            {actionResult && (
              <p className={cn('text-sm', actionResult.ok ? 'text-green-500' : 'text-red-500')}>
                {actionResult.msg}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Mod Logs */}
      {tab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select
              value={logFilter}
              onChange={(e) => {
                setLogFilter(e.target.value as ModActionType | '');
                setLogs([]);
                setLogCursor(undefined);
              }}
              className="border-border bg-background rounded-md border px-3 py-1.5 text-sm"
            >
              <option value="">Todos os tipos</option>
              {Object.entries(ACTION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setLogs([]); setLogCursor(undefined); void loadLogs(); }}
              disabled={logLoading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', logLoading && 'animate-spin')} />
            </Button>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Ação</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Alvo</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Moderador</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Motivo</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Data</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && !logLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma ação registrada.
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={cn('font-medium', ACTION_COLORS[log.type])}>
                        {ACTION_LABELS[log.type]}
                        {formatDuration(log.durationSec)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {log.targetUserId}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {log.moderatorId}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">
                      {log.reason ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {logHasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadLogs(logCursor)}
                disabled={logLoading}
              >
                Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Warns */}
      {tab === 'warns' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={warnUserId}
              onChange={(e) => setWarnUserId(e.target.value)}
              placeholder="ID do usuário Discord"
              className="border-border bg-background flex-1 rounded-md border px-3 py-1.5 text-sm font-mono"
            />
            <Button
              size="sm"
              onClick={() => void searchWarns()}
              disabled={warnLoading || !/^\d{17,20}$/.test(warnUserId)}
            >
              <Search className="h-4 w-4 mr-1.5" />
              Buscar
            </Button>
          </div>

          {warns.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">ID</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Motivo</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Moderador</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Data</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {warns.map((w) => (
                    <tr key={w.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {w.id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-2.5 max-w-xs truncate">{w.reason}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {w.moderatorId}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(w.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => void removeWarn(w.id)}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                          title="Remover aviso"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {warns.length === 0 && warnUserId && !warnLoading && (
            <p className="text-muted-foreground text-sm text-center py-4">
              Nenhum aviso ativo encontrado.
            </p>
          )}
        </div>
      )}

      {/* Automod */}
      {tab === 'automod' && (
        <div className="space-y-3">
          {automodLoading && (
            <p className="text-muted-foreground text-sm text-center py-4">Carregando...</p>
          )}
          {!automodLoading &&
            AUTOMOD_RULES.map(({ type, label, description }) => {
              const rule = getRuleForType(type);
              const enabled = rule?.enabled ?? false;
              const saving = automodSaving === type;

              return (
                <div
                  key={type}
                  className="border-border bg-card flex items-center gap-4 rounded-lg border p-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{description}</p>
                  </div>

                  {/* Action selector */}
                  <select
                    value={(rule?.action as AutomodAction) ?? 'delete'}
                    onChange={(e) => void changeAction(type, e.target.value as AutomodAction)}
                    disabled={saving || !enabled}
                    className="border-border bg-background rounded-md border px-2 py-1 text-xs disabled:opacity-50"
                  >
                    {AUTOMOD_ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>

                  {/* Toggle */}
                  <button
                    onClick={() => void toggleRule(type, rule)}
                    disabled={saving}
                    className={cn(
                      'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50',
                      enabled ? 'bg-primary' : 'bg-muted',
                    )}
                    role="switch"
                    aria-checked={enabled}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200 ease-in-out',
                        enabled ? 'translate-x-4' : 'translate-x-0',
                      )}
                    />
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
