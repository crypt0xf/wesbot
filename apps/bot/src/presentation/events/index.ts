import type { Client, ClientEvents } from 'discord.js';

import type { Container } from '../../container';
import type { BotEvent, SlashCommand } from '../../types';

import { errorEvent, warnEvent } from './error';
import { guildCreate, guildDelete, guildMemberAdd, guildMemberRemove } from './guild-lifecycle';
import { createInteractionCreateHandler } from './interaction-create';
import { ready } from './ready';
import { voiceStateUpdate } from './voice-state';

/**
 * Register every discord.js event handler we care about. Each BotEvent receives
 * the container as its last argument so handlers can reach logger / i18n.
 */
export function registerEvents(
  client: Client,
  container: Container,
  commands: ReadonlyMap<string, SlashCommand>,
): void {
  function attach<E extends keyof ClientEvents>(event: BotEvent<E>): void {
    const handler = (...args: ClientEvents[E]): void => {
      void Promise.resolve(event.execute(...args, container)).catch((err: unknown) => {
        container.logger.error({ err, event: event.name }, 'event handler threw');
      });
    };
    if (event.once) {
      client.once(event.name, handler);
    } else {
      client.on(event.name, handler);
    }
  }

  attach(ready);
  attach(errorEvent);
  attach(warnEvent);
  attach(guildCreate);
  attach(guildDelete);
  attach(guildMemberAdd);
  attach(guildMemberRemove);
  attach(voiceStateUpdate);
  attach(createInteractionCreateHandler(commands));
}
