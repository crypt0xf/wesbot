# wesbot

Bot de música profissional para Discord, construído com `discord.py` e `yt-dlp`.
Developed by **archwes**.

---

## Funcionalidades

| Categoria | Detalhes |
|---|---|
| Reprodução | Tocar, Pausar, Continuar, Pular, Parar, Loop, Volume, Seek |
| Fila | Fila persistente por servidor com navegação e remoção |
| Fontes | YouTube, SoundCloud, Bandcamp e 1000+ via yt-dlp |
| Capa de Álbum | Apple Music / iTunes API em resolução 1500×1500 px |
| Slash Commands | Todos os comandos principais disponíveis via `/` |
| Hot Reload | `run.py` reinicia automaticamente ao detectar alterações |

---

## Instalação

**Pré-requisitos:** Python 3.10+ e [FFmpeg](https://ffmpeg.org/) no `PATH`.

```bash
git clone https://github.com/crypt0xf/wesbot.git
cd wesbot
pip install -r requirements.txt
cp .env.example .env
# Edite .env e defina DISCORD_TOKEN
```

**Executar:**
```bash
python run.py      # recomendado — com hot reload
python main.py     # execução direta
```

---

## Comandos

### Reprodução
| Comando | Aliases | Descrição |
|---|---|---|
| `!tocar <url\|busca>` | `play`, `p`, `t` | Toca por URL ou busca no YouTube/SoundCloud |
| `!pausar` | `pause` | Pausa a reprodução |
| `!continuar` | `resume`, `r` | Continua a reprodução |
| `!pular` | `skip`, `s` | Pula para a próxima música |
| `!parar` | `stop` | Para e limpa a fila |
| `!loop` | `repetir` | Ativa/desativa loop da música atual |
| `!volume <0-200>` | `vol` | Define o volume |
| `!tocando` | `np`, `atual` | Exibe a música em reprodução |
| `!seek <tempo>` | `ir` | Salta para um momento (ex: `1:30`, `90`) |

### Fila
| Comando | Aliases | Descrição |
|---|---|---|
| `!fila` | `queue`, `q`, `f` | Exibe a fila atual |
| `!buscar <termo>` | `search` | Busca e escolhe entre 5 resultados |
| `!remover <pos>` | `remove`, `rm` | Remove uma música pela posição |
| `!limpar` | `clear` | Limpa a fila (mantém a atual) |

### Voz
| Comando | Aliases | Descrição |
|---|---|---|
| `!sair` | `leave`, `dc` | Desconecta do canal de voz |

### Ferramentas
| Comando | Aliases | Descrição |
|---|---|---|
| `!capa <busca>` | `art`, `cover` | Capa de álbum via Apple Music (1500×1500) |
| `!ajuda` | `help`, `h` | Referência completa de comandos |
| `!info` | `sobre` | Informações e latência do bot |

---

## Estrutura

```
wesbot/
├── main.py          — Ponto de entrada, setup do bot, eventos
├── run.py           — Watcher com hot reload
├── core/
│   └── logger.py    — Logger ANSI, banner e painéis de startup
├── cogs/
│   ├── music.py     — Player, fila, provider e comandos de música
│   └── tools.py     — Capa de álbum, ajuda e info
├── requirements.txt
├── .env.example
└── .gitignore
```

### Adicionando um novo provider

Crie uma subclasse de `MusicProvider` em `cogs/music.py`:

```python
class SpotifyProvider(MusicProvider):
    async def search(self, query: str, limit: int = 1, **kw) -> list[Track]: ...
    async def resolve(self, url: str, **kw) -> Track: ...
```

E substitua no `MusicCog.__init__`:
```python
self._provider = SpotifyProvider()
```

---

## Licença

MIT — livre para uso e modificação.
