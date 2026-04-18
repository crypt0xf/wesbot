import type { Client } from 'discord.js';

import type { I18n } from './infrastructure/i18n';
import type { Logger } from './logger';
import type { SlashCommand } from './types';

/**
 * Minimal service locator. No decorators, no reflect-metadata — a typed object
 * that carries long-lived singletons through the app. Construction order is
 * explicit in index.ts, so lifetimes are obvious at a glance.
 */
export interface Container {
  logger: Logger;
  i18n: I18n;
  client: Client;
  /** All registered slash commands, keyed by command name. Used by /help. */
  commands: ReadonlyMap<string, SlashCommand>;
  readonly startedAt: number;
}

export function createContainer(input: Omit<Container, 'startedAt'>): Container {
  return Object.freeze({ ...input, startedAt: Date.now() });
}
