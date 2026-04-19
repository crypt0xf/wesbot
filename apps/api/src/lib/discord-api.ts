const DISCORD_API = 'https://discord.com/api/v10';

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
  if (!res.ok) throw new Error(`Discord API error: ${res.status}`);
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
