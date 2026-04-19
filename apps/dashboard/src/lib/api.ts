const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ApiGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  hasBot: boolean;
}

export interface ApiGuildSettings {
  id: string;
  prefix: string;
  locale: string;
  djRoleId: string | null;
  musicChannelId: string | null;
  announceNowPlaying: boolean;
  twentyFourSeven: boolean;
  autoDisconnectMinutes: number | null;
  defaultVolume: number;
  voteSkipThreshold: number;
}

async function apiFetch<T>(path: string, cookieHeader?: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

/** Server-side API call — pass the cookie header from `cookies().toString()`. */
export async function getMyGuildsSSR(cookieHeader: string): Promise<ApiGuild[]> {
  return apiFetch<ApiGuild[]>('/api/auth/guilds', cookieHeader);
}

export async function getGuildSettingsSSR(
  guildId: string,
  cookieHeader: string,
): Promise<ApiGuildSettings> {
  return apiFetch<ApiGuildSettings>(`/api/guilds/${guildId}`, cookieHeader);
}
