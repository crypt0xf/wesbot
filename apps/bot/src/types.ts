import type { SupportedLocale } from '@wesbot/shared';
import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ClientEvents,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

import type { Container } from './container';
import type { I18n } from './infrastructure/i18n';
import type { Logger } from './logger';

export type CommandBuilder =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface CommandContext {
  logger: Logger;
  container: Container;
  i18n: I18n;
  /** Bound to the interaction's locale. */
  t: (key: string, vars?: Record<string, unknown>) => string;
  locale: SupportedLocale;
}

export interface SlashCommand {
  data: CommandBuilder;
  /** Optional — only for commands that expose an autocomplete option. */
  autocomplete?: (interaction: AutocompleteInteraction, ctx: CommandContext) => Promise<void>;
  execute: (interaction: ChatInputCommandInteraction, ctx: CommandContext) => Promise<void>;
  /** Show in /help. Defaults to true. */
  listed?: boolean;
  /** Category for /help grouping. */
  category?: 'general' | 'music' | 'moderation' | 'config' | 'fun';
}

export interface BotEvent<E extends keyof ClientEvents = keyof ClientEvents> {
  name: E;
  once?: boolean;
  execute: (...args: [...ClientEvents[E], Container]) => Promise<void> | void;
}

/**
 * Classes of known errors that the dispatcher knows how to render to the user.
 * Unknown errors become a generic "something broke" message.
 */
export class UserFacingError extends Error {
  constructor(
    message: string,
    public readonly i18nKey?: string,
    public readonly vars?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'UserFacingError';
  }
}

export class PermissionError extends UserFacingError {
  constructor(message = 'missing permission', i18nKey = 'errors.permission') {
    super(message, i18nKey);
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends UserFacingError {
  constructor(message = 'not found', i18nKey = 'errors.notFound') {
    super(message, i18nKey);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends UserFacingError {
  constructor(message: string, i18nKey = 'errors.validation', vars?: Record<string, unknown>) {
    super(message, i18nKey, vars);
    this.name = 'ValidationError';
  }
}
