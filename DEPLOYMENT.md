# Deployment — wesbot

> Atualmente otimizado para **hospedagem local em Windows** (ambiente do dono do projeto). Referências para VPS Linux na §4.

## 1. Windows — máquina de desenvolvimento / produção doméstica

### 1.1. Pré-requisitos

| Software | Versão | Obs |
|---|---|---|
| Windows 10/11 | — | — |
| Node.js | 20.18+ | [nodejs.org](https://nodejs.org/) ou `nvm-windows` |
| pnpm | 9.15+ | `npm i -g pnpm@9.15.0` |
| Docker Desktop | last | WSL2 backend recomendado |
| Git | last | para hooks |

### 1.2. Setup único

```powershell
git clone https://github.com/crypt0xf/wesbot.git
cd wesbot
pnpm install

# Configurar segredos
copy .env.example .env
# editar .env com DISCORD_TOKEN, NEXTAUTH_SECRET, SESSION_SECRET

# Subir infra (Postgres, Redis, Lavalink)
pnpm docker:up

# Migrar banco
pnpm db:generate
pnpm db:migrate
```

### 1.3. Rodar em produção local

Dois caminhos — escolha um:

**Opção A — via `pnpm` em foreground (desenvolvimento / teste de produção):**

```powershell
pnpm build
pnpm --filter @wesbot/bot start
# em terminais separados:
pnpm --filter @wesbot/api start
pnpm --filter @wesbot/dashboard start
```

**Opção B — como serviços Windows com [NSSM](https://nssm.cc/) (para manter rodando após logoff):**

```powershell
# Exemplo para o bot. Repita para api e dashboard.
nssm install wesbot-bot "C:\Program Files\nodejs\node.exe" `
  "C:\Users\wes\Documents\wesbot\apps\bot\dist\index.js"
nssm set wesbot-bot AppDirectory "C:\Users\wes\Documents\wesbot\apps\bot"
nssm set wesbot-bot AppStdout "C:\Users\wes\Documents\wesbot\logs\bot.out.log"
nssm set wesbot-bot AppStderr "C:\Users\wes\Documents\wesbot\logs\bot.err.log"
nssm start wesbot-bot
```

### 1.4. Portas expostas

| Serviço | Porta | Uso |
|---|---|---|
| Postgres | 5432 | banco (Docker) |
| Redis | 6379 | cache/fila (Docker) |
| Lavalink | 2333 | áudio (Docker) |
| Bot | — | processo Node, não escuta |
| API | 4000 | HTTP + WS |
| Dashboard | 3000 | Next.js |

Para acesso externo (amigos de fora da LAN), use **Cloudflare Tunnel** ou **Tailscale Funnel**:

```powershell
# Cloudflare Tunnel — simples e grátis
cloudflared tunnel --url http://localhost:3000
```

### 1.5. Backups

Volume do Postgres fica em um Docker volume. Dump via cron semanal:

```powershell
docker exec wesbot-postgres pg_dump -U wesbot wesbot > backup_$(Get-Date -Format yyyy-MM-dd).sql
```

## 2. Discord OAuth2 redirect

No portal Discord (Applications → OAuth2 → Redirects), adicione:

- `http://localhost:3000/api/auth/callback/discord` (dev local)
- `https://<seu-tunnel>.trycloudflare.com/api/auth/callback/discord` (prod via tunnel)

`DISCORD_CLIENT_ID` já preenchido no `.env.example`: `1487161034979409971`.

## 3. Lavalink

O container `wesbot-lavalink` inicia automaticamente via docker-compose com as configs em `docker/lavalink/application.yml`.

- Primeira subida baixa os plugins (`youtube-source` + `LavaSrc`) automaticamente — aguarde ~30s.
- Healthcheck em `http://localhost:2333/v4/info` (requer header `Authorization: youshallnotpass`).
- Métricas Prometheus em `http://localhost:2333/metrics`.

Se hit throttling do YouTube, vincule uma conta via `oauth.enabled: true` em `application.yml` e rode o flow de refresh token (ver README do plugin `youtube-source`).

## 4. Produção em VPS Linux (referência futura)

Quando migrar:

1. Instalar Docker + Docker Compose.
2. Clonar o repo, copiar `.env` de produção.
3. `docker compose -f docker-compose.prod.yml up -d --build` (a criar).
4. Expor apenas 80/443 via Caddy ou Nginx com Let's Encrypt.
5. Configurar backup automático do volume Postgres para S3/R2.
6. Habilitar Sentry (`SENTRY_DSN` no `.env`).

Não há `docker-compose.prod.yml` ainda — será criado na Fase 11 se houver demanda.
