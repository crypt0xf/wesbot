# API — wesbot

> A API Fastify será documentada automaticamente via OpenAPI/Swagger gerado a partir dos schemas Zod. Este documento é um stub — a documentação viva será publicada em `/api/docs` a partir da Fase 4.

## Base

- **Dev:** `http://localhost:4000`
- **Auth:** cookie de sessão assinada (emitida via NextAuth após OAuth2 Discord). A API valida o cookie em cada request.

## Rotas atuais (Fase 0)

| Método | Path      | Descrição                                                                               |
| ------ | --------- | --------------------------------------------------------------------------------------- |
| GET    | `/health` | Liveness probe. Retorna `{ ok: true, service, timestamp }`                              |
| GET    | `/ready`  | Readiness probe. Retorna `{ ok: true }` após dependências subirem (DB, Redis, Lavalink) |

## WebSocket

Namespace primário: `/socket.io` (implementado na Fase 4).

Subscriptions por guild:

| Event            | Payload                   | Direção                |
| ---------------- | ------------------------- | ---------------------- |
| `music.state`    | `QueueState`              | server → client        |
| `music.position` | `{ guildId, positionMs }` | server → client (5 Hz) |
| `mod.action`     | `ModAction`               | server → client        |

## Contratos entre serviços

Ver `packages/shared/src/events/index.ts`. O mesmo schema Zod valida:

1. Publicação no Redis (bot → api).
2. Recepção no WS (api → dashboard).
3. Renderização no client (dashboard consome via `z.infer`).

Rotas REST completas (music, moderation, guild settings, welcome, levels, tickets, etc.) serão documentadas a partir da Fase 4 conforme forem implementadas.
