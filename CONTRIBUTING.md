# Contributing

## Setup de desenvolvimento

Siga o [Quick start](./README.md#-quick-start-windowsmacoslinux). Após isso:

```bash
# Rodar apenas um app
pnpm --filter @wesbot/bot dev
pnpm --filter @wesbot/api dev
pnpm --filter @wesbot/dashboard dev

# Checks locais antes de commitar
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

## Convenções

### Git

- Commits seguem **[Conventional Commits](https://www.conventionalcommits.org/)**:
  - `feat(bot): add /play slash command`
  - `fix(api): reject invalid snowflakes`
  - `chore(deps): bump discord.js to 14.17`
  - `docs(arch): ADR-009 rate limiting strategy`
- Um commit = uma unidade lógica. Não misture refactor + feature no mesmo commit.
- Branches: `feat/<escopo>`, `fix/<escopo>`, `chore/<escopo>`, `docs/<escopo>`.

### Código

- **TypeScript strict**. `noUncheckedIndexedAccess` ligado. `any` proibido sem justificativa comentada.
- **Zero `console.*`** em código de prod — sempre via Pino (`logger.info(obj, msg)`).
- **Validação Zod** em todas as bordas: env, interaction options, API req/res, Redis payloads, WS messages.
- **Comentários** explicam **por quê**, nunca **o quê**. Se o nome do código não diz o que ele faz, renomeie.
- **Sem `// TODO` em PR** — se não dá pra terminar, não mergeia.

### Arquitetura

Cada app segue Clean Architecture (`domain/`, `application/`, `infrastructure/`, `presentation/`). Ver `ARCHITECTURE.md` §2 ADR-006.

- `domain/` não importa NADA de `node_modules` exceto utilitários puros.
- `application/` orquestra, mas não sabe sobre Discord, HTTP ou Prisma.
- `infrastructure/` tem o IO.
- `presentation/` só traduz.

Quebrar a camada? Abra um PR justificando em um ADR novo.

## Pull requests

Antes de abrir:

1. Rebase em `master`.
2. `pnpm lint && pnpm typecheck && pnpm test` verde localmente.
3. Atualizou docs? (README se mudou DX, ARCHITECTURE se mudou camada, CHANGELOG sempre).
4. Adicionou testes para código de domínio?

Descrição do PR deve conter:

- **Motivação** (por que, não o quê)
- **Como testar** (passos manuais reproduzíveis)
- **Screenshot/gif** se mudou UI
- **Breaking changes** em seção separada

## Testes

- **Unit:** Vitest. Coverage alvo ≥70% em `domain/` e `application/`.
- **Integration:** Vitest com `testcontainers` para Postgres/Redis.
- **E2E:** Playwright, rodando em CI com matriz (chromium, firefox, webkit).

Testes de UI fazem snapshot apenas de estruturas estáveis — nada de snapshot gigante de JSX.

## Segurança

Vulnerabilidades: contactar via e-mail (não abrir issue pública).
