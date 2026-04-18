import { REST, Routes } from 'discord.js';

import type { Logger } from '../logger';
import type { SlashCommand } from '../types';

export interface RegisterCommandsOptions {
  token: string;
  clientId: string;
  /** When set, commands sync to this guild only (instant); otherwise global (≤1h propagation). */
  devGuildId?: string | undefined;
  logger: Logger;
}

/**
 * Push the given slash commands to Discord. Guild-scoped in development
 * (instant refresh) and global in production. Uses PUT so the remote list
 * mirrors `commands` exactly — stale commands from previous deploys are removed.
 */
export async function registerCommands(
  commands: readonly SlashCommand[],
  { token, clientId, devGuildId, logger }: RegisterCommandsOptions,
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  const body = commands.map((c) => c.data.toJSON());
  const route = devGuildId
    ? Routes.applicationGuildCommands(clientId, devGuildId)
    : Routes.applicationCommands(clientId);
  const scope = devGuildId ? `guild:${devGuildId}` : 'global';

  const started = Date.now();
  logger.info({ scope, count: body.length }, 'syncing slash commands');
  const result = await rest.put(route, { body });
  const synced = Array.isArray(result) ? result.length : body.length;
  logger.info({ scope, count: synced, durationMs: Date.now() - started }, 'slash commands synced');
}
