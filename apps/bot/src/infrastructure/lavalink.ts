import type { Client } from 'discord.js';
import { Connectors, type NodeOption, Shoukaku } from 'shoukaku';

import type { Logger } from '../logger';

export interface LavalinkOptions {
  client: Client;
  logger: Logger;
  host: string;
  port: number;
  password: string;
  secure?: boolean;
}

/**
 * Build and wire the Shoukaku instance. One node for now (local Lavalink in
 * docker-compose); multi-node comes later when we scale out. Events are logged
 * so a disconnect is visible in prod logs, not silent.
 */
export function createShoukaku(opts: LavalinkOptions): Shoukaku {
  const node: NodeOption = {
    name: 'main',
    url: `${opts.host}:${opts.port}`,
    auth: opts.password,
    secure: opts.secure ?? false,
  };

  const shoukaku = new Shoukaku(new Connectors.DiscordJS(opts.client), [node], {
    resume: true,
    resumeTimeout: 30,
    resumeByLibrary: true,
    reconnectTries: 5,
    reconnectInterval: 5,
    restTimeout: 20,
    moveOnDisconnect: false,
    voiceConnectionTimeout: 15,
  });

  shoukaku.on('ready', (name, reconnected) => {
    opts.logger.info({ node: name, reconnected }, 'lavalink node ready');
  });
  shoukaku.on('error', (name, error) => {
    opts.logger.error({ node: name, err: error }, 'lavalink node error');
  });
  shoukaku.on('close', (name, code, reason) => {
    opts.logger.warn({ node: name, code, reason }, 'lavalink node closed');
  });
  shoukaku.on('disconnect', (name, count) => {
    opts.logger.warn({ node: name, playersMoved: count }, 'lavalink node disconnected');
  });
  shoukaku.on('reconnecting', (name, left, interval) => {
    opts.logger.info(
      { node: name, reconnectsLeft: left, intervalSec: interval },
      'lavalink node reconnecting',
    );
  });

  return shoukaku;
}
