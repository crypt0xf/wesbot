import { Events } from 'discord.js';

import type { BotEvent } from '../../types';

export const voiceStateUpdate: BotEvent<typeof Events.VoiceStateUpdate> = {
  name: Events.VoiceStateUpdate,
  execute(_oldState, newState, container) {
    const guildId = newState.guild.id;
    void container.voiceWatcher.onVoiceStateUpdate(guildId).catch((err: unknown) => {
      container.logger.warn({ err, guildId }, 'voiceStateUpdate handler failed');
    });
  },
};
