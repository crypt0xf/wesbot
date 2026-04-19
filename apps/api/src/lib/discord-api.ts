const DISCORD_API = 'https://discord.com/api/v10';

export class DiscordApiError extends Error {
  constructor(public readonly status: number) {
    super(`Discord API error: ${status}`);
    this.name = 'DiscordApiError';
  }
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
  owner: boolean;
}

export async function fetchUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new DiscordApiError(res.status);
  return (await res.json()) as DiscordGuild[];
}

export function hasManageGuild(permissions: string): boolean {
  return (BigInt(permissions) & 0x20n) === 0x20n;
}

export function guildIconUrl(id: string, hash: string | null): string | null {
  if (!hash) return null;
  const ext = hash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${id}/${hash}.${ext}`;
}
