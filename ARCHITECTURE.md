# ARCHITECTURE.md

> Documento vivo de decisões arquiteturais. Toda mudança de stack, layout de camadas ou contrato entre apps deve ser refletida aqui **antes** do código.

## 1. Visão de alto nível

```
┌────────────────┐       ┌────────────────┐       ┌─────────────────┐
│  Dashboard     │◄─────►│     API        │◄─────►│      Bot        │
│  (Next.js 15)  │  WS   │   (Fastify)    │  Bus  │  (discord.js)   │
└────────────────┘       └───────┬────────┘       └────────┬────────┘
                                 │                         │
                           ┌─────┴──────┐           ┌──────┴────────┐
                           │  Postgres  │           │  Lavalink v4  │
                           │  (Prisma)  │           │  + LavaSrc    │
                           └────────────┘           └───────────────┘
                                 │                         │
                           ┌─────┴─────────────────────────┘
                           │       Redis (cache, pub/sub, BullMQ)
                           └───────
```

- **Bot** e **API** são processos distintos que se comunicam via **Redis Pub/Sub** (canais tipados por Zod) + **RPC simples** com correlation IDs.
- **Dashboard** consome a API via **HTTP** (mutações auditáveis) e **WebSocket** (subscriptions real-time).
- **Áudio nunca toca no Node** — tudo via Lavalink (JVM).

## 2. ADRs

### ADR-001 — Stack: TypeScript em monorepo

- **Contexto:** ~50% do peso do produto é front-end. Manter Python/discord.py implicaria duplicar tipos, manter dois pipelines de CI, dois lint/format, e uma geração de cliente OpenAPI para o front.
- **Decisão:** TypeScript unificado. Monorepo com pnpm workspaces + Turborepo.
- **Consequências:**
  - ✅ `packages/shared` publica schemas Zod únicos consumidos por bot/api/dashboard.
  - ✅ Ecossistema Next.js + Fastify + Prisma é gold standard para o escopo.
  - ❌ Ninguém consegue aproveitar o código Python existente literalmente — foi arquivado em `legacy-python`.

### ADR-002 — Áudio via Lavalink v4

- **Contexto:** o repo Python tinha 5 commits consecutivos corrigindo quebras do `yt-dlp` em processo. Isso é uma classe de problema resolvida pela comunidade Lavalink via plugins versionados (`youtube-source`, LavaSrc).
- **Decisão:** Lavalink v4 em JVM separada (container). Cliente Node via **shoukaku v4** (mainstream, battle-tested).
- **Consequências:**
  - ✅ O processo Node nunca carrega streams de áudio, elimina leaks de FD e travas do loop.
  - ✅ Filtros (EQ, bassboost, nightcore) são um POST ao Lavalink; zero DSP no Node.
  - ✅ Seek é nativo via protocolo, não um hack de requeue.
  - ❌ Adiciona uma JVM ao docker-compose e ~256 MB de RAM no dev.

### ADR-003 — Persistência: Postgres + Prisma; cache: Redis

- **Decisão:** Postgres 16 como fonte de verdade (relacional, ACID, JSON para configs flexíveis). Redis 7 como cache + fila + pub/sub.
- **Consequências:** BullMQ sobre Redis cobre jobs agendados (scheduled messages, giveaway winners, unban temporário) sem precisar de um worker service separado.

### ADR-004 — Monólito modular, não microsserviços

- **Contexto:** escopo do briefing cabe em três processos. Kafka/K8s/gRPC seria overengineering.
- **Decisão:** 3 apps + 4 packages, comunicando por Redis pub/sub + HTTP.
- **Consequências:** Deploy é `docker compose up` (dev) ou 3 containers com systemd (prod). Observabilidade via Prometheus endpoints em cada app.

### ADR-005 — Validação Zod nas bordas, tipos confiáveis no domínio

- **Decisão:** Zod em `env`, `API request/response`, `Discord interaction options`, `WS payload`, `Redis pub/sub payload`. Dentro das camadas de `domain/` e `application/` os tipos já são inferidos — nunca revalidar.
- **Motivação:** manter hot paths rápidos sem abrir mão da segurança de dados externos.

### ADR-006 — Separação Clean Architecture por app

Cada app segue `domain / application / infrastructure / presentation`:

- `domain/` — entidades e eventos, sem dependências externas.
- `application/` — use cases que orquestram repositórios e serviços. Independente de Discord/HTTP.
- `infrastructure/` — adapters (Lavalink, Prisma, Redis, Discord REST).
- `presentation/` — slash command handlers, REST routes, WS gateways.

Regra: `domain/` não importa nada de fora. `application/` só importa de `domain/`. `infrastructure/` e `presentation/` podem importar de qualquer camada acima.

### ADR-007 — i18n desde a Fase 1

- **Decisão:** strings em arquivos JSON versionados (`locales/pt-BR.json`, `locales/en-US.json`). `pt-BR` é default. Bot usa `discord.js` localizations nativas em slash commands. Dashboard usa `next-intl`.
- **Consequência:** nenhum literal em português hardcoded no código; novos idiomas são só um arquivo JSON.

### ADR-008 — Observabilidade

- **Logs:** Pino (JSON em prod, pretty em dev) com correlation IDs propagados (dashboard → API → bot).
- **Métricas:** Prometheus endpoints (`/metrics` em API, `/metrics` em bot via `prom-client`). Lavalink já expõe nativamente.
- **Erros:** Sentry opcional (DSN via env). Desabilitado por padrão no dev.

## 3. Contrato bot ↔ API

```
Bot publica (Redis):
  events:music:{guildId}   ← MusicEvent (track.started, queue.updated, ...)
  events:mod:{guildId}     ← ModerationEvent
  replies:bot:{requestId}  ← BotReply (correlacionado ao comando)

API publica (Redis):
  commands:bot             ← BotCommand (discriminated union por "type")

Ambos validam com @wesbot/shared/events antes de processar.
```

## 4. Branching e versionamento

- `master` — sempre verde, deployável.
- `legacy-python` — snapshot do bot Python antes da reescrita.
- Feature branches: `feat/<escopo>`, `fix/<escopo>`, `chore/<escopo>`.
- Tags de fase: `v0.X` ao final de cada fase do `PLAN.md`.
- Commits: **Conventional Commits** (`feat(bot): ...`, `fix(api): ...`).

## 5. O que não fazemos (guardrails)

- ❌ Nenhum `any` sem `// eslint-disable-next-line` e justificativa de 1 linha.
- ❌ Nenhum acesso direto a `PrismaClient` fora de `infrastructure/repositories/`.
- ❌ Nenhum `console.log` em código de produção — sempre via Pino.
- ❌ Nenhum segredo em código — tudo via `@wesbot/shared/env`.
- ❌ Nenhum comentário que narra o código; apenas **por quê**.
