import {
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  Events,
  MessageFlags,
  type RepliableInteraction,
} from 'discord.js';

import type { Container } from '../../container';
import type { BotEvent, CommandContext, SlashCommand } from '../../types';
import { UserFacingError } from '../../types';
import { handleMusicButton, isMusicButtonId } from '../components/music-buttons';

/**
 * Build the interactionCreate event handler. Routes chat input + autocomplete
 * + music buttons, builds a locale-bound CommandContext, and maps thrown
 * errors to user-friendly ephemeral replies.
 */
export function createInteractionCreateHandler(
  commands: ReadonlyMap<string, SlashCommand>,
): BotEvent<typeof Events.InteractionCreate> {
  return {
    name: Events.InteractionCreate,
    async execute(interaction, container) {
      if (interaction.isButton()) {
        if (isMusicButtonId(interaction.customId)) {
          await runButton(interaction, container);
        }
        return;
      }

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

      const ctx = buildContext(container, interaction);

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

async function runButton(interaction: ButtonInteraction, container: Container): Promise<void> {
  const ctx = buildContext(container, interaction);
  const started = Date.now();
  try {
    await handleMusicButton(interaction, ctx);
    ctx.logger.info(
      {
        user: interaction.user.id,
        guild: interaction.guildId,
        customId: interaction.customId,
        durationMs: Date.now() - started,
      },
      'button ok',
    );
  } catch (err) {
    const durationMs = Date.now() - started;
    if (err instanceof UserFacingError) {
      ctx.logger.warn(
        { err: { name: err.name, message: err.message }, durationMs },
        'button rejected',
      );
      const content = err.i18nKey ? ctx.t(err.i18nKey, err.vars) : err.message;
      await respond(interaction, content);
      return;
    }
    ctx.logger.error({ err, durationMs }, 'button threw');
    await respond(interaction, ctx.t('errors.generic'));
  }
}

function buildContext(
  container: Container,
  interaction: ChatInputCommandInteraction | AutocompleteInteraction | ButtonInteraction,
): CommandContext {
  const locale = container.i18n.resolve(interaction.locale);
  const scope = interaction.isButton()
    ? { button: interaction.customId }
    : { command: interaction.commandName };
  return {
    logger: container.logger.child(scope),
    container,
    i18n: container.i18n,
    t: (key, vars) => container.i18n.t(locale, key, vars),
    locale,
  };
}

async function respond(interaction: RepliableInteraction, content: string): Promise<void> {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  } catch {
    // Interaction token expired (3s) or already consumed elsewhere — nothing we
    // can do from here; the outer catch already logged the root cause.
  }
}
