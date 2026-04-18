# Features

Lista canônica de features por módulo, marcada por fase. Legenda: ✅ pronto, 🚧 em desenvolvimento, ⏳ planejado.

## 🎵 Música

### Reprodução
- ⏳ Play por URL (YouTube, Spotify, Apple Music, Deezer, SoundCloud, Twitch, arquivos diretos) — Fase 2/3
- ⏳ Play por busca (resultado único + seleção com até 10 resultados) — Fase 2
- ⏳ Playlists completas das plataformas suportadas — Fase 3
- ⏳ Pause / Resume / Stop / Skip / Previous / Seek (timestamp) — Fase 2
- ⏳ Volume 0–200% com boost por servidor — Fase 2
- ⏳ Replay, Jump para posição N — Fase 2

### Fila
- ⏳ Adicionar no final / início / posição específica — Fase 2
- ⏳ Remover por índice ou range — Fase 2
- ⏳ Reordenar (move X para Y) — Fase 2
- ⏳ Shuffle — Fase 2
- ⏳ Clear (com confirmação) — Fase 2
- ⏳ Loop: off / track / queue / autoplay — Fase 2/3
- ⏳ Histórico das últimas N músicas — Fase 2
- ⏳ Persistência de fila entre reinícios (Redis) — Fase 3

### Recursos avançados
- ⏳ Filtros: bassboost (níveis), nightcore, vaporwave, 8D, karaoke, tremolo, vibrato, EQ 15 bandas, pitch, speed — Fase 3
- ⏳ Autoplay / Radio mode — Fase 3
- ⏳ 24/7 mode por servidor — Fase 3
- ⏳ Vote-skip com threshold configurável — Fase 3
- ⏳ DJ role — Fase 3
- ⏳ Playlists salvas (salvar/carregar/compartilhar) — Fase 3
- ⏳ Letras sincronizadas (lrclib + Genius fallback) — Fase 3
- ⏳ Now Playing card rico — Fase 2
- ⏳ Grouped announcements (canal configurável) — Fase 3
- ⏳ Smart disconnect — Fase 3

## 🛡️ Moderação
- ⏳ Kick / Ban (tempo opcional) / Unban / Timeout / Warn — Fase 7
- ⏳ Sistema de warns persistente + auto-ações — Fase 7
- ⏳ Automod: spam, caps, mentions, links, invites, wordlist (regex), anti-raid — Fase 7
- ⏳ Logs de moderação em canal + dashboard com filtros — Fase 7
- ⏳ Ações em lote — Fase 7

## 🏗️ Gerenciamento de servidor
- ⏳ Editor de canais (criar/renomear/mover/deletar/permissões) — Fase 8
- ⏳ Editor de roles (criar/editar/reordenar/deletar) — Fase 8
- ⏳ Permissões granulares canal × role — Fase 8
- ⏳ Lista de membros com filtros — Fase 8
- ⏳ Atribuir/remover roles em lote — Fase 8

## 🤝 Engajamento
- ⏳ Welcome / Leave com template + embed + imagem dinâmica — Fase 9
- ⏳ Reaction roles / Button roles — Fase 9
- ⏳ Auto-role (humanos e bots separados) — Fase 9
- ⏳ Sistema de níveis/XP + leaderboard + card de rank — Fase 9
- ⏳ Giveaways com requisitos — Fase 9
- ⏳ Polls (simples e múltipla escolha) — Fase 9
- ⏳ Tickets com transcript — Fase 9

## ⚡ Produtividade
- ⏳ Custom commands com variáveis e embeds — Fase 10
- ⏳ Tags — Fase 10
- ⏳ Scheduled messages (cron) — Fase 10
- ⏳ Embed builder WYSIWYG — Fase 10
- ⏳ Audit log enriquecido — Fase 10

## 🖥️ Dashboard
- ⏳ Landing page — Fase 5
- ⏳ Login OAuth2 Discord — Fase 4/5
- ⏳ Server selector — Fase 5
- ⏳ Overview (stats, uptime) — Fase 5
- ⏳ Player persistente (bottom bar) — Fase 6
- ⏳ Fila drag-and-drop — Fase 6
- ⏳ Filtros de áudio visuais — Fase 6
- ⏳ Command palette (Cmd+K) — Fase 5
- ⏳ Tema claro/escuro — Fase 5 (tokens já definidos)
- ⏳ Real-time via WS — Fase 4+
