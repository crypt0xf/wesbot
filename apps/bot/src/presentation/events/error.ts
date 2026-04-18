import { Events } from 'discord.js';

import type { BotEvent } from '../../types';

export const errorEvent: BotEvent<typeof Events.Error> = {
  name: Events.Error,
  execute(err, container) {
    container.logger.error({ err }, 'discord client error');
  },
};

export const warnEvent: BotEvent<typeof Events.Warn> = {
  name: Events.Warn,
  execute(message, container) {
    container.logger.warn({ message }, 'discord client warning');
  },
};
