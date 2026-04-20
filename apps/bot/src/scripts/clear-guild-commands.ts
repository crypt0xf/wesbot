/**
 * Clears guild-scoped commands from a specific guild.
 * Run: tsx src/scripts/clear-guild-commands.ts <guildId>
 */
import { config as loadEnv } from 'dotenv';
import { REST, Routes } from 'discord.js';

loadEnv();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.argv[2];

if (!token || !clientId) {
  console.error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set');
  process.exit(1);
}
if (!guildId) {
  console.error('Usage: tsx src/scripts/clear-guild-commands.ts <guildId>');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);
console.log(`Clearing guild commands for guild ${guildId}...`);
await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
console.log('Done.');
