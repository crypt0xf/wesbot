/**
 * Registers the current command list globally or to a specific guild.
 *
 * Global (no arg): propagates to all guilds within ~1 hour.
 * Guild (with arg): instant — guild commands override globals.
 *
 * Run: tsx src/scripts/sync-global-commands.ts [guildId]
 */
import { config as loadEnv } from 'dotenv';
import { REST, Routes } from 'discord.js';

import { commands } from '../presentation/commands/index.js';

loadEnv();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.argv[2];

if (!token || !clientId) {
  console.error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);
const body = commands.map((c) => c.data.toJSON());
const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);
const scope = guildId ? `guild:${guildId} (instant)` : 'global (~1h to propagate)';

console.log(`Syncing ${body.length} commands to ${scope}...`);
console.log('Commands:', body.map((c) => c.name).join(', '));

await rest.put(route, { body });
console.log('Done.');
