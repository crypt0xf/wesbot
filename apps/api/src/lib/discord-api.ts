const DISCORD_API = 'https://discord.com/api/v10';

export interface DiscordMember {
  user: { id: string; username: string; discriminator: string; global_name: string | null; avatar: string | null };
  nick: string | null;
  roles: string[];
  joined_at?: string | null;
}

export async function fetchGuildMembers(botToken: string, guildId: string, limit = 1000): Promise<DiscordMember[]> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members?limit=${limit}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!res.ok) throw new DiscordApiError(res.status);
  return (await res.json()) as DiscordMember[];
}

export async function fetchGuildMember(botToken: string, guildId: string, userId: string): Promise<DiscordMember> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!res.ok) throw new DiscordApiError(res.status);
  return (await res.json()) as DiscordMember;
}

export function memberAvatarUrl(guildId: string, userId: string, hash: string | null, userAvatar: string | null): string | null {
  if (hash) return `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${hash}.png`;
  if (userAvatar) return `https://cdn.discordapp.com/avatars/${userId}/${userAvatar}.png`;
  return null;
}

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
