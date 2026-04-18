import {
  type ChatInputCommandInteraction,
  Events,
  MessageFlags,
  type RepliableInteraction,
} from 'discord.js';

import type { BotEvent, CommandContext, SlashCommand } from '../../types';
import { UserFacingError } from '../../types';

/**
 * Build the interactionCreate event handler. Routes chat input + autocomplete
 * to the corresponding SlashCommand, builds a locale-bound CommandContext,
 * and maps thrown errors to user-friendly ephemeral replies.
 */
export function createInteractionCreateHandler(
  commands: ReadonlyMap<string, SlashCommand>,
): BotEvent<typeof Events.InteractionCreate> {
  return {
    name: Events.InteractionCreate,
    async execute(interaction, container) {
      if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) {
        return;
      }

      const command = commands.get(interaction.commandName);
      if (!command) {
        container.logger.warn(
          { command: interaction.commandName },
          'received interaction for unknown command',
        );
        return;
      }

      const locale = container.i18n.resolve(interaction.locale);
      const ctx: CommandContext = {
        logger: container.logger.child({ command: interaction.commandName }),
        container,
        i18n: container.i18n,
        t: (key, vars) => container.i18n.t(locale, key, vars),
        locale,
      };

      if (interaction.isAutocomplete()) {
        if (!command.autocomplete) {
          return;
        }
        try {
          await command.autocomplete(interaction, ctx);
        } catch (err) {
          ctx.logger.error({ err }, 'autocomplete handler threw');
        }
        return;
      }

      const started = Date.now();
      try {
        await command.execute(interaction, ctx);
        ctx.logger.info(
          {
            user: interaction.user.id,
            guild: interaction.guildId,
            durationMs: Date.now() - started,
          },
          'command ok',
        );
      } catch (err) {
        const durationMs = Date.now() - started;
        if (err instanceof UserFacingError) {
          ctx.logger.warn(
            { err: { name: err.name, message: err.message }, durationMs },
            'command rejected',
          );
          const content = err.i18nKey ? ctx.t(err.i18nKey, err.vars) : err.message;
          await respond(interaction, content);
          return;
        }
        ctx.logger.error({ err, durationMs }, 'command threw');
        await respond(interaction, ctx.t('errors.generic'));
      }
    },
  };
}

async function respond(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
  const target: RepliableInteraction = interaction;
  try {
    if (target.replied || target.deferred) {
      await target.followUp({ content, flags: MessageFlags.Ephemeral });
    } else {
      await target.reply({ content, flags: MessageFlags.Ephemeral });
    }
  } catch {
    // Interaction token expired (3s) or already consumed elsewhere — nothing we
    // can do from here; the outer catch already logged the root cause.
  }
}
