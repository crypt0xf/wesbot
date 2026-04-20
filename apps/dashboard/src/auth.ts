import NextAuth, { type NextAuthConfig, type NextAuthResult } from 'next-auth';
import Discord from 'next-auth/providers/discord';

async function refreshDiscordToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const res = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`Discord token refresh failed: ${res.status}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}

const config: NextAuthConfig = {
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: 'identify email guilds' } },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: persist Discord tokens and the Discord user snowflake.
      if (account) {
        return {
          ...token,
          discordId: account.providerAccountId,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt:
            account.expires_at ??
            Math.floor(Date.now() / 1000) + (account.expires_in ?? 604800),
        };
      }

      const expiresAt = token.expiresAt as number | undefined;
      const refreshToken = token.refreshToken as string | undefined;

      // Token still valid — return as-is
      if (Date.now() < (expiresAt ?? 0) * 1000 - 60_000) {
        return token;
      }

      // Access token expired — attempt refresh
      if (!refreshToken) {
        return { ...token, error: 'RefreshTokenError' as const };
      }

      try {
        const refreshed = await refreshDiscordToken(refreshToken);
        return { ...token, ...refreshed, error: undefined };
      } catch {
        return { ...token, error: 'RefreshTokenError' as const };
      }
    },

    session({ session, token }) {
      session.user.id = token.sub!;
      session.accessToken = token.accessToken as string | undefined;
      const err = token.error as 'RefreshTokenError' | undefined;
      if (err) session.error = err;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};

const authResult: NextAuthResult = NextAuth(config);

export const { handlers, auth } = authResult;
export const signIn: NextAuthResult['signIn'] = authResult.signIn;
export const signOut: NextAuthResult['signOut'] = authResult.signOut;
