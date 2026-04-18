# PLAN.md — Reestruturação wesbot → Plataforma Discord

> **Status:** proposta aguardando aprovação.
> **Autor da proposta:** Claude (Opus 4.7) a partir do briefing de `crypt0xf`.
> **Data:** 2026-04-18.
> **Nenhum código novo será escrito até este documento ser aprovado.**

---

## 0. Sumário Executivo

O bot atual (`main.py` + 2 cogs + logger = ~1.800 LOC) é um tocador de música Python/discord.py razoável, mas não é base para a plataforma descrita no briefing. Estado atual, resumido:

| Área            | Atual                                          | Gap p/ objetivo                                                                                                    |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Áudio           | `yt-dlp` + `FFmpegPCMAudio` direto no processo | Requer Lavalink v4; `yt-dlp` já é o principal vetor de bugs do repo (últimos 5 commits são correções de extractor) |
| Estado          | `dict[int, GuildQueue]` em memória             | Precisa Postgres + Redis para persistência, multi-instância e dashboard                                            |
| Interface       | Prefixo + slash commands                       | Precisa componentes interativos (v2) + dashboard web                                                               |
| Backend web     | Inexistente                                    | Precisa API + WebSocket + OAuth2                                                                                   |
| Observabilidade | Logger ANSI custom                             | Precisa Pino + métricas + health checks                                                                            |
| Testes          | Nenhum                                         | Meta: ≥70% cobertura no domínio                                                                                    |

**Recomendação:** reescrever como monorepo TypeScript (Turborepo + pnpm), com bot em discord.js v14 + Lavalink v4 (shoukaku), API em Fastify, dashboard em Next.js 15 App Router, persistência Prisma/Postgres + Redis. O código Python atual servirá apenas como referência de funcionalidades e UX de mensagens.

---

## 1. Análise do Código Atual

### 1.1. Estrutura

```
wesbot/
├── main.py              # Bootstrap do bot, intents, event handlers
├── run.py               # Watcher de hot-reload manual
├── core/logger.py       # Logger ANSI + banner + startup panels
├── cogs/
│   ├── music.py   (1030 LOC) — Track, GuildQueue, MusicProvider (ABC),
│   │                            YtDlpProvider, MusicPlayer, MusicCog
│   └── tools.py   ( 356 LOC) — iTunes art search, help menu, info
└── requirements.txt     # discord.py, yt-dlp, aiohttp, dotenv, PyNaCl, davey
```

### 1.2. Pontos fortes a preservar conceitualmente

- **Abstração `MusicProvider`** já antecipa multi-fonte — o conceito será mantido na nova arquitetura (interface `IAudioSource`).
- **Separação `MusicPlayer` vs `MusicCog`** é boa; replicaremos com `PlayerService` (domain) vs `MusicController` (presentation).
- **Tratamento de casos especiais** (TikTok pipe, seek como requeue, loop de fila mutuamente exclusivo com loop de faixa) é maduro e informará requisitos da nova impl.
- **Mensagens em pt-BR** cuidadas — base para as strings de i18n.

### 1.3. Dívida técnica e riscos

1. **`yt-dlp` em-processo é instável em produção.** Os 5 últimos commits são correções de quebras do YouTube (EJS, n-challenge, format selector, cookies). Isso é exatamente o que Lavalink + LavaSrc/youtube-source resolvem: o plugin é atualizado pela comunidade de forma coordenada e o processo de áudio está isolado em uma JVM separada.
2. **Sem persistência.** Qualquer restart perde fila, volume, configurações por servidor.
3. **Estado singleton no processo.** Impossível escalar além de 1 instância; impossível sharding.
4. **Sem validação de input.** `parse_time` usa `try/except ValueError`; queries vão direto ao extractor.
5. **Seek via requeue + `is_seeking` flag.** Funciona, mas Lavalink tem seek nativo via protocolo.
6. **FFmpeg com TikTok pipe usando `subprocess.Popen` fora do loop de eventos** — fonte conhecida de leaks de FDs em Windows.
7. **`asyncio.run_coroutine_threadsafe` do callback do FFmpeg** é frágil e desaparece com Lavalink (tudo eventos WS).
8. **Zero testes.** Refatorar sem rede de segurança é impossível.

### 1.4. Conclusão

A base atual não é ponto de partida arquitetural. É ponto de referência de **o que o produto faz hoje** — a reescrita parte do zero, em outra stack, mantendo só as lições aprendidas.

---

## 2. Decisão de Stack — TypeScript vs Python

Você pediu para eu avaliar criticamente, não apenas confirmar. Aqui vai.

### 2.1. Critérios ponderados

| Critério                       | Peso         | Python (discord.py + FastAPI)                                                     | TypeScript (discord.js + Next.js)                                               |
| ------------------------------ | ------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Unificação bot ↔ dashboard     | Alto         | Baixo — duas linguagens, duplicação de types/DTOs via OpenAPI + geradores frágeis | **Alto** — mesma linguagem, types compartilhados via package no monorepo        |
| Qualidade de clientes Lavalink | Alto         | `lavalink.py` / `Pomice` — mantidos por 1–2 devs                                  | **`shoukaku` / `lavalink-client`** — mainstream, milhares de bots em prod       |
| Ecossistema web de classe A    | Alto         | FastAPI é bom, mas precisa de Next/Vite no front, logo duas linguagens            | **Next.js 15 (App Router, RSC, Suspense, streaming)** — gold standard           |
| discord.js vs discord.py       | Médio        | discord.py voltou em 2023 e é estável, mas ecossistema de terceiros é menor       | **discord.js** tem mais libs (sharding manager, builders, slash cmd frameworks) |
| Tempo de desenvolvimento       | Médio        | Aumenta — context switch de linguagem, serialização manual em todo boundary       | **Reduz** — tRPC ou contratos Zod compartilhados                                |
| Experiência em prod do time    | Desconhecido | —                                                                                 | —                                                                               |
| Código atual reaproveitável    | Baixo        | ~30% (lógica de UX de mensagens, estrutura de embeds)                             | ~30% (mesma lógica, reescrita) — mesma ordem                                    |
| Risco de `yt-dlp` quebrar      | —            | Igual em ambos (mesmo Lavalink no meio)                                           | Igual                                                                           |

### 2.2. Contrapontos honestos a favor de Python

- Manter discord.py preserva investimento mental em um paradigma já dominado pelo usuário (assumindo isso).
- `asyncio` é menos "armadilhoso" do que event loop do Node para quem já pensa em corrotinas.
- FastAPI + Pydantic é tão bom quanto Fastify + Zod em isolado.

### 2.3. Veredito

**TypeScript. Não por ser melhor linguagem, mas porque o produto descrito tem 50% do peso no front-end**, e ter front-end TS + back-end Python obrigaria:

- Duplicar tipos (DTOs, enums, schemas de validação) — ou adicionar pipeline de codegen OpenAPI, o que adiciona uma categoria inteira de bugs.
- Dois pipelines de CI, dois formatters, dois linters, dois gerenciadores de dependência.
- WebSocket com dois protocolos mentais (Python `asyncio` → Node `ws`).

A unificação paga sozinha a troca. Só recomendaria manter Python se o usuário tivesse forte preferência ou se o escopo fosse "bot-only, sem dashboard".

**Se você discordar, diga agora.** Refaço o plano em Python/FastAPI sem perda.

---

## 3. Arquitetura Proposta

### 3.1. Visão de alto nível

```
┌────────────────┐       ┌────────────────┐       ┌─────────────────┐
│  Dashboard     │◄─────►│     API        │◄─────►│      Bot        │
│  (Next.js 15)  │  WS   │   (Fastify)    │  Bus  │  (discord.js)   │
└────────────────┘       └───────┬────────┘       └────────┬────────┘
       ▲                         │                         │
       │ OAuth2 (NextAuth v5)    │                         │
       │                   ┌─────┴──────┐           ┌──────┴────────┐
       │                   │  Postgres  │           │  Lavalink v4  │
       │                   │  (Prisma)  │           │  (JVM + LavaSrc│
       │                   │            │           │   plugin)     │
       │                   └────────────┘           └───────────────┘
       │                         │                         │
       │                   ┌─────┴──────┐                  │
       └─────── Redis ─────┤  Cache /   │──────────────────┘
                           │  Pub-Sub   │
                           │  BullMQ    │
                           └────────────┘
```

- **Bot** e **API** são processos separados que se comunicam via Redis Pub/Sub (canal `bot-api`) + WebSocket direto para real-time ao dashboard.
- **Dashboard** consome a API via HTTP (tRPC-style com Zod) e WS (Socket.IO sobre adapter Redis).
- **Lavalink** recebe comandos via shoukaku do bot; áudio nunca toca no processo Node.
- **Postgres** é fonte de verdade; **Redis** é cache + fila + pub/sub efêmero.

### 3.2. Camadas (Clean Architecture por app)

```
apps/bot/src/
├── domain/            # Entities (Track, Queue, ModAction), value objects, events
├── application/       # Use cases (PlayTrack, SkipTrack, BanUser) — sem side-effects diretos
├── infrastructure/    # Adapters (LavalinkAdapter, PrismaRepo, RedisPubSub, DiscordAPI)
└── presentation/      # Discord handlers (slash commands, components, autocompletes)

apps/api/src/
├── domain/            # Tipos do negócio (mesmos do bot via @wesbot/shared)
├── application/       # Use cases da API (mesmos do bot onde aplicável)
├── infrastructure/    # Fastify plugins, Prisma, Redis
└── presentation/      # Routes (REST), WS gateways, middleware (auth, rate-limit)

apps/dashboard/src/
├── app/               # Next.js App Router (RSC + client components)
├── components/        # shadcn/ui + composições próprias
├── lib/               # Client API, utils, hooks
└── features/          # Slices por feature (music, moderation, levels, ...)
```

### 3.3. Decisões arquiteturais-chave (ADRs embutidos)

- **Monólito modular, não microsserviços.** 3 apps (bot, api, dashboard) + packages. Não vale a complexidade de K8s/Kafka para este escopo.
- **Event-driven interno, request-response externo.** Dentro de cada app, events tipados (`mitt`+types ou EventEmitter tipado). Entre apps, REST/WS + Redis pub/sub.
- **Zero lógica de domínio no `presentation/`.** Controllers e handlers só traduzem.
- **Zero acesso direto a ORMs fora de `infrastructure/`.** Repositórios interfaceiam o domínio.
- **Validação nas bordas** (`env`, `API in/out`, interaction options, payloads WS) sempre com Zod. Dentro do domínio os tipos já são confiáveis.
- **DI por container simples** (`tsyringe`). Evita o barulho do NestJS e mantém compatibilidade com Fastify.
- **Shared types em `packages/shared`** — schemas Zod únicos, DTOs inferidos com `z.infer`, enums compartilhados (`ModActionType`, `LoopMode`, etc.).

### 3.4. Persistência — esboço Prisma

```prisma
model Guild { id BigInt @id; prefix String @default("!"); locale String @default("pt-BR"); djRoleId BigInt?; musicChannelId BigInt?; twentyFourSeven Boolean @default(false); autoDisconnectMin Int? @default(5); volume Int @default(100); ... }
model GuildConfig { guildId BigInt; key String; value Json; @@id([guildId, key]) } // feature-flags dinâmicas
model Playlist { id String @id @default(cuid()); ownerId BigInt; name String; tracks Json; isPublic Boolean @default(false); ... }
model Warn { id String @id @default(cuid()); guildId BigInt; userId BigInt; moderatorId BigInt; reason String; createdAt DateTime @default(now()) }
model ModLog { ... }       // Kick, ban, timeout, unban
model AutomodRule { ... }  // Rules com regex/wordlist, actions, thresholds
model ReactionRole { ... }
model AutoRole { ... }
model LevelUser { guildId BigInt; userId BigInt; xp Int; level Int; @@id([guildId, userId]) }
model Giveaway { ... }
model Ticket { ... }       // com transcript em Json
model CustomCommand { ... }
model Tag { ... }
model ScheduledMessage { ... }  // cron expression
model DashboardAuditLog { ... } // quem fez o quê no painel
```

Detalhamento completo no `packages/database/schema.prisma` durante a Fase 4.

### 3.5. Contrato de comunicação Bot ↔ API ↔ Dashboard

- **Bot → API:** via Redis pub/sub em canais tipados (`events:music:{guildId}`, `events:mod:{guildId}`). Payload validado por Zod nas duas pontas.
- **API → Bot:** comandos via lista Redis (`commands:bot`) ou RPC simples com correlation IDs. Commands idempotentes por `requestId`.
- **Dashboard ↔ API:** HTTP para mutações (auditáveis), WS (Socket.IO) para subscriptions (now playing, queue changes, novas entradas em mod log).

---

## 4. Estrutura do Monorepo

```
wesbot/
├── apps/
│   ├── bot/                     # discord.js + shoukaku
│   ├── api/                     # Fastify
│   └── dashboard/               # Next.js 15
├── packages/
│   ├── database/                # Prisma schema + generated client
│   ├── shared/                  # Zod schemas, DTOs, enums, events
│   ├── ui/                      # shadcn primitives + componentes próprios
│   └── config/                  # tsconfig, eslint, prettier, tailwind presets
├── docker/
│   ├── lavalink/                # application.yml + plugins
│   └── Dockerfile.*             # Um por app
├── docker-compose.yml           # dev full-stack em 1 comando
├── docker-compose.prod.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── ARCHITECTURE.md
├── CONTRIBUTING.md
├── DEPLOYMENT.md
├── CHANGELOG.md
├── README.md
└── docs/
    ├── features.md
    └── api.md
```

---

## 5. Roadmap — Fases incrementais

Cada fase é testável isoladamente e termina com um commit/tag. Estimativas são ranges honestos de tempo ativo (não calendar time); assumo trabalho focado.

| #      | Fase                      | Entrega                                                                                                                                                                                                                                 | Estimativa |
| ------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **0**  | Scaffolding + infra       | Monorepo pnpm/Turbo, configs, docker-compose sobe Postgres + Redis + Lavalink vazio, CI verde (lint + typecheck + build)                                                                                                                | 0.5–1 dia  |
| **1**  | Bot fundamentos           | discord.js conectado, sharding manager, logger Pino, DI, error boundary, comandos `/ping` `/info`, health check, Zod nas bordas                                                                                                         | 1–2 dias   |
| **2**  | Música core (Lavalink)    | shoukaku integrado, `/play` `/pause` `/resume` `/skip` `/stop` `/seek` `/volume` `/queue` `/loop`, Now Playing embed com botões (Components v2), YouTube + SoundCloud via plugin youtube-source/LavaSrc                                 | 2–3 dias   |
| **3**  | Música avançada           | Spotify/Apple/Deezer via LavaSrc, filtros (bassboost, nightcore, 8D, EQ 15 bandas), autoplay/radio, 24/7, vote-skip, DJ role, playlists salvas (DB), lyrics (lrclib + Genius fallback), smart disconnect, persistência de fila em Redis | 2–3 dias   |
| **4**  | DB + API backbone         | Prisma migrations, Fastify com Zod, Discord OAuth2 (NextAuth v5), guards de permissão, rate limit Redis, audit log interno, WS gateway                                                                                                  | 1–2 dias   |
| **5**  | Dashboard base            | Next.js 15, Tailwind + shadcn, design tokens, tema claro/escuro, landing, login, server selector, layout com sidebar persistente, cmd palette (Cmd+K), página de overview                                                               | 2–3 dias   |
| **6**  | Dashboard música          | Player persistente (bottom bar), fila drag-and-drop (dnd-kit), controles, filtros com sliders, gerenciador de playlists, real-time via WS                                                                                               | 2 dias     |
| **7**  | Moderação                 | Kick/ban/timeout/unban/warn, sistema de warns com auto-ações, automod (spam, caps, mentions, links, invites, wordlist regex, anti-raid), mod logs com filtros                                                                           | 2–3 dias   |
| **8**  | Gerenciamento de servidor | Editor de canais, roles, permissões granulares; lista de membros com filtros + ações em lote                                                                                                                                            | 2–3 dias   |
| **9**  | Engajamento               | Welcome/leave com preview live + geração dinâmica de imagem (sharp), reaction/button roles, auto-role, sistema de níveis/XP com card de rank, giveaways, polls, tickets com transcript                                                  | 3–4 dias   |
| **10** | Produtividade             | Custom commands, tags, scheduled messages (BullMQ + cron), embed builder WYSIWYG, audit log enriquecido                                                                                                                                 | 2 dias     |
| **11** | Polish + QA               | i18n (pt-BR default + en-US), next-intl, discord.js localizations, otimização Lighthouse, Playwright E2E (login → tocar música → banir usuário), cobertura ≥70% no domínio, docs completas, CHANGELOG                                   | 2–3 dias   |

**Total honesto:** 22–32 dias de trabalho focado. Se quiser acelerar, cortamos Fase 10 parcialmente (tags + scheduled podem ir depois) e entregamos o produto em ~18 dias com "v1.1" planejada.

### 5.1. Gates de aprovação entre fases

- Ao final de cada fase, faço um commit de tag (`v0.X`) e uma mensagem curta com **o que está testável** e **um gif/screenshot** do que foi entregue.
- Se alguma fase revelar necessidade de decisão arquitetural (ex: BullMQ vs cron nativo para scheduled messages), paro e pergunto.

---

## 6. Riscos conhecidos e mitigação

| Risco                                                     | Probabilidade | Impacto | Mitigação                                                                                                                                        |
| --------------------------------------------------------- | ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lavalink + youtube-source quebra com mudança do YouTube   | Média         | Alto    | Fixar versão; script de smoke test no CI que toca 5 URLs conhecidas; comunidade Lavalink atualiza rápido                                         |
| Spotify API mudar tier grátis                             | Baixa         | Médio   | LavaSrc usa Client Credentials (grátis indefinido pela política atual); se mudar, fallback para busca YT via ISRC                                |
| Discord rate limit em bots grandes                        | Média         | Alto    | discord.js já gerencia; sharding desde o início previne                                                                                          |
| Latência WS dashboard↔API↔bot                             | Baixa         | Médio   | Redis pub/sub é sub-ms em localhost; em prod exigir Redis na mesma VPC                                                                           |
| OAuth2 tokens vazando                                     | Baixa         | Crítico | Tokens só server-side, `httpOnly`/`sameSite=lax`/`secure`, rotação e revogação                                                                   |
| Geração de imagens (welcome card, rank) travar event loop | Média         | Médio   | Worker thread dedicado com `sharp`; fallback para imagem estática                                                                                |
| Escopo da Fase 9 crescer                                  | Alta          | Médio   | Definir "v1" mínimo (welcome, reaction roles, levels, tickets) e empurrar (giveaways complexos, polls com ranked-choice) para v1.1 se necessário |

---

## 7. O que preciso de você antes de começar

Peço respostas (podem ser curtas) para destravar a Fase 0:

1. **Stack confirmada?** TypeScript / Node LTS / Next.js 15 / Fastify / Lavalink v4. Ou prefere Python?
2. **Gestor de pacotes:** pnpm (recomendo) ou npm/yarn?
3. **Host alvo de produção** já decidido? (VPS própria, Railway, Fly.io, Hetzner) — afeta Dockerfiles e DEPLOYMENT.md, mas não é bloqueante agora.
4. **Preferência de paleta para o dashboard?** Minha proposta: base neutra fria tipo Linear (cinza-azulado) + um acento vibrante (proponho verde ácido `#A3E635` ou ciano `#22D3EE`). Se você tem cor de marca, me diga.
5. **Nome do produto/dashboard.** "wesbot" continua? Há subdomínio alvo?
6. **Discord OAuth2:** tem app já criado? Se sim, me diga o `client_id` e adiciono redirect URI nas docs.
7. **Lavalink hospedado por nós ou usar provedor público** (ex: `lavalink.clxud.dev`)? Recomendo próprio no docker-compose para dev e dedicado em prod.
8. **Idiomas na v1:** pt-BR + en-US como combinado, ou só pt-BR para v1 e en-US depois?
9. **Alguma fase que você quer priorizar/adiar?** Ex: alguém querendo ver "música completa + dashboard tocando" antes de moderação — posso reordenar Fases 7–10 sem custo.
10. **Preferência de commit style:** Conventional Commits (proposto), gitmoji, ou livre?

---

## 8. Próximos passos após aprovação

1. Arquivar `cogs/`, `core/`, `main.py`, `run.py` em branch `legacy-python` para referência.
2. Limpar `master` e iniciar Fase 0 (scaffolding) em commit único.
3. Publicar `ARCHITECTURE.md` v1 com os ADRs formais (com base nas seções 2–3 deste plano).
4. Abrir issue/board para tracking das fases (GitHub Projects, se você usar).

---

**Aguardo seu retorno nos 10 pontos acima antes de tocar em qualquer código.** Se algum item estiver claro e você quiser que eu decida, diga "use default" que assumo a recomendação desta proposta.
