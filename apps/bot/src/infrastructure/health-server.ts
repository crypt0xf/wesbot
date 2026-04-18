import { createServer, type Server } from 'node:http';

import { Status } from 'discord.js';

import type { Container } from '../container';
import { VERSION } from '../version';

export interface HealthServerOptions {
  host: string;
  port: number;
  container: Container;
}

/**
 * Tiny HTTP server for liveness/readiness checks. Separate from the main API
 * so probes continue to work even if the main process misbehaves with Discord.
 *
 * - `/health` — liveness: process is up and responsive.
 * - `/ready`  — readiness: Discord gateway is connected (status 0 = READY).
 */
export function startHealthServer({ host, port, container }: HealthServerOptions): Server {
  const server = createServer((req, res) => {
    if (!req.url) {
      res.writeHead(400).end();
      return;
    }

    const url = req.url.split('?')[0];
    if (url === '/health') {
      const body = JSON.stringify({
        status: 'ok',
        version: VERSION,
        uptimeMs: Date.now() - container.startedAt,
      });
      res.writeHead(200, { 'content-type': 'application/json' }).end(body);
      return;
    }

    if (url === '/ready') {
      const client = container.client;
      const wsReady = client.ws.status === Status.Ready;
      const body = JSON.stringify({
        ready: wsReady,
        status: client.ws.status,
        ping: Math.max(0, Math.round(client.ws.ping)),
        guilds: client.guilds.cache.size,
        commands: container.commands.size,
      });
      res.writeHead(wsReady ? 200 : 503, { 'content-type': 'application/json' }).end(body);
      return;
    }

    res.writeHead(404).end();
  });

  server.listen(port, host, () => {
    container.logger.info({ host, port }, 'health server listening');
  });

  server.on('error', (err) => {
    container.logger.error({ err }, 'health server error');
  });

  return server;
}
