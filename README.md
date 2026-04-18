# wesbot

> Plataforma Discord: bot de música + painel de gerenciamento completo.

[![CI](https://github.com/crypt0xf/wesbot/actions/workflows/ci.yml/badge.svg)](https://github.com/crypt0xf/wesbot/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-20.18+-43853d?logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-22c55e)

**Developed by [crypt0xf](https://github.com/crypt0xf)**

---

## 🧭 Visão geral

Monorepo TypeScript com três aplicações e quatro packages compartilhados:

| App              | Stack                             | Responsabilidade                                             |
| ---------------- | --------------------------------- | ------------------------------------------------------------ |
| `apps/bot`       | discord.js · shoukaku             | Conexão com Discord, slash commands, reprodução via Lavalink |
| `apps/api`       | Fastify · Zod · Socket.IO         | API REST + WebSocket consumidos pelo dashboard               |
| `apps/dashboard` | Next.js 15 · Tailwind · shadcn/ui | Painel web de controle                                       |

| Package            | Propósito                                                                           |
| ------------------ | ----------------------------------------------------------------------------------- |
| `@wesbot/shared`   | Schemas Zod, enums, contratos de eventos (fonte da verdade entre bot/api/dashboard) |
| `@wesbot/database` | Prisma schema + client singleton                                                    |
| `@wesbot/ui`       | Componentes React reutilizáveis (populado a partir da Fase 5)                       |
| `@wesbot/config`   | Presets compartilhados (tsconfig, eslint, tailwind)                                 |

Detalhes arquiteturais em [`ARCHITECTURE.md`](./ARCHITECTURE.md). Roadmap em [`PLAN.md`](./PLAN.md).

---

## ⚡ Quick start (Windows/macOS/Linux)

### Pré-requisitos

- **Node.js 20.18+** — [nodejs.org](https://nodejs.org/) ou `nvm install 20.18.1`
- **pnpm 9** — `npm install -g pnpm@9.15.0`
- **Docker Desktop** (para Postgres + Redis + Lavalink) — [docker.com](https://www.docker.com/)

### Setup

```bash
git clone https://github.com/crypt0xf/wesbot.git
cd wesbot

# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis
cp .env.example .env
# → preencha DISCORD_TOKEN, NEXTAUTH_SECRET, SESSION_SECRET

# 3. Subir infra (Postgres, Redis, Lavalink)
pnpm docker:up

# 4. Gerar o Prisma client + rodar migrações
pnpm db:generate
pnpm db:migrate

# 5. Rodar tudo em dev (bot + api + dashboard)
pnpm dev
```

Dashboard em `http://localhost:3000`. API em `http://localhost:4000`.

> Como rodar **apenas** um app: `pnpm --filter @wesbot/bot dev` (ou `@wesbot/api`, `@wesbot/dashboard`).

### Gerando segredos

```bash
# Linux/macOS
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

---

## 🗂️ Estrutura

```
wesbot/
├── apps/
│   ├── bot/              # discord.js + shoukaku
│   ├── api/              # Fastify
│   └── dashboard/        # Next.js 15
├── packages/
│   ├── config/           # Presets compartilhados
│   ├── shared/           # Zod schemas + contratos
│   ├── database/         # Prisma
│   └── ui/               # Componentes React
├── docker/
│   └── lavalink/         # application.yml + plugins
├── docs/                 # features.md, api.md
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

---

## 🎵 Features (em construção)

Lista completa em [`docs/features.md`](./docs/features.md). Progresso em fases:

- ✅ **Fase 0** — Scaffolding + infra
- ⏳ **Fase 1** — Bot fundamentos (discord.js, Pino, DI, `/ping`, health)
- ⏳ **Fase 2** — Música core (Lavalink, `/play`, fila, loop, seek)
- ⏳ **Fase 3** — Música avançada (Spotify, filtros, autoplay, lyrics)
- ⏳ **Fase 4** — DB + API backbone (OAuth2, guards, WS)
- ⏳ **Fase 5** — Dashboard base (design system, sidebar, overview)
- ⏳ **Fase 6** — Dashboard música (player persistente, fila DnD)
- ⏳ **Fase 7** — Moderação (warns, automod, logs)
- ⏳ **Fase 8** — Gerenciamento (canais, roles, permissões)
- ⏳ **Fase 9** — Engajamento (welcome, levels, giveaways, tickets)
- ⏳ **Fase 10** — Produtividade (custom commands, scheduled messages)
- ⏳ **Fase 11** — Polish + QA (i18n, Lighthouse, E2E)

---

## 🧪 Scripts

| Comando            | Descrição                            |
| ------------------ | ------------------------------------ |
| `pnpm dev`         | Bot + API + Dashboard em modo watch  |
| `pnpm build`       | Build de produção de todos os apps   |
| `pnpm lint`        | ESLint em todo o monorepo            |
| `pnpm typecheck`   | TypeScript strict em todo o monorepo |
| `pnpm test`        | Vitest em todos os packages          |
| `pnpm format`      | Prettier em todos os arquivos        |
| `pnpm docker:up`   | Sobe Postgres + Redis + Lavalink     |
| `pnpm docker:down` | Desliga infra                        |
| `pnpm db:studio`   | Prisma Studio (GUI do banco)         |

---

## 🔒 Segurança

- OAuth2 Discord com PKCE · sessões `httpOnly` / `sameSite=lax` / `secure` em prod
- Validação server-side de permissões Discord em **toda** rota da API
- Rate limiting por usuário e IP (Redis)
- CSRF protection · sanitização de embeds / custom commands
- Audit log interno (quem fez o quê no painel)

---

## 📄 Licença

MIT — ver [`LICENSE`](./LICENSE).

> O código Python original foi preservado na branch [`legacy-python`](https://github.com/crypt0xf/wesbot/tree/legacy-python) para referência histórica.
