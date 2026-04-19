import type { SlashCommand } from '../../types';

import help from './help';
import info from './info';
import { moderationCommands } from './moderation';
import { musicCommands } from './music';
import ping from './ping';

/**
 * Authoritative list of slash commands. Adding a command: export it from its
 * own file and include it here — the registrar reads from this array and the
 * dispatcher looks up by `data.name`.
 */
export const commands: readonly SlashCommand[] = [
  ping,
  info,
  help,
  ...musicCommands,
  ...moderationCommands,
];

export function buildCommandRegistry(
  list: readonly SlashCommand[] = commands,
): ReadonlyMap<string, SlashCommand> {
  const map = new Map<string, SlashCommand>();
  for (const command of list) {
    if (map.has(command.data.name)) {
      throw new Error(`duplicate slash command: ${command.data.name}`);
    }
    map.set(command.data.name, command);
  }
  return map;
}
