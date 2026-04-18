# Changelog

All notable changes to wesbot will be documented here, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [SemVer](https://semver.org/).

## [Unreleased]

## [0.0.1] — 2026-04-18

### Added — Phase 0: scaffolding

- Monorepo com pnpm workspaces + Turborepo.
- `packages/config` — presets compartilhados (tsconfig, eslint flat, tailwind).
- `packages/shared` — Zod schemas (env, track, guild, moderation, filters) + contratos de eventos.
- `packages/database` — schema Prisma completo (guild, music, moderation, engagement, productivity, audit log).
- `packages/ui` — skeleton com helper `cn()`.
- `apps/bot` — stub discord.js v14 com Pino + Zod env.
- `apps/api` — stub Fastify 5 com helmet/cors/rate-limit/Zod + endpoints `/health` e `/ready`.
- `apps/dashboard` — Next.js 15 App Router + Tailwind + tema dark padrão + landing placeholder.
- `docker-compose.yml` — Postgres 16, Redis 7, Lavalink v4 com plugins youtube-source + LavaSrc.
- CI GitHub Actions: format check → typecheck → lint → build → tests.
- Documentação: `README`, `ARCHITECTURE` com ADRs 001–008, `CONTRIBUTING`, `DEPLOYMENT` (Windows).

### Migrated

- Branch `legacy-python` preserva o bot Python anterior (último commit `2a71e4c`).

### Security

- `cookies.txt` adicionado ao `.gitignore` — antes estava fora.
