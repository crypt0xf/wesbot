<div align="center">

<pre>
    ██╗    ██╗███████╗███████╗██████╗  ██████╗ ████████╗
    ██║    ██║██╔════╝██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝
 ██║ █╗ ██║█████╗  ███████╗██████╔╝██║   ██║   ██║
 ██║███╗██║██╔══╝  ╚════██║██╔══██╗██║   ██║   ██║
 ╚███╔███╔╝███████╗███████║██████╔╝╚██████╔╝   ██║
  ╚══╝╚══╝ ╚══════╝╚══════╝╚═════╝  ╚═════╝    ╚═╝
</pre>

**Bot de música profissional para Discord**

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)
![discord.py](https://img.shields.io/badge/discord.py-2.7+-5865F2?style=flat&logo=discord&logoColor=white)
![yt-dlp](https://img.shields.io/badge/yt--dlp-latest-FF0000?style=flat&logo=youtube&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat)

*Developed by **archwes***

</div>

---

## Funcionalidades

- **Reprodução completa** — tocar, pausar, continuar, pular, parar, loop e seek
- **Fila por servidor** — persistente por sessão, com remoção e limpeza
- **1000+ fontes** — YouTube, SoundCloud, Bandcamp e muito mais via yt-dlp
- **Capa de álbum** — Apple Music / iTunes API em 1500×1500 px
- **Slash commands** — todos os comandos principais disponíveis via `/`
- **Hot reload** — `run.py` reinicia automaticamente ao salvar qualquer `.py`

---

## Setup

### 1. Pré-requisitos

- **Python 3.10+** — [python.org](https://www.python.org/downloads/)
- **FFmpeg** no `PATH`

```bash
# Windows
winget install ffmpeg

# macOS
brew install ffmpeg

# Linux
sudo apt install ffmpeg
```

### 2. Clonar o repositório

```bash
git clone https://github.com/crypt0xf/wesbot.git
cd wesbot
```

### 3. Instalar dependências

```bash
pip install -r requirements.txt
```

### 4. Configurar o ambiente

```bash
cp .env.example .env
```

Abra o `.env` e preencha:

```env
DISCORD_TOKEN=seu_token_aqui
COMMAND_PREFIX=!
```

> Obtenha seu token em [discord.com/developers/applications](https://discord.com/developers/applications).
> Ative as **Privileged Gateway Intents**: `Message Content` e `Server Members`.

### 5. Executar

```bash
python run.py
```

> Use `python main.py` para execução direta sem hot reload.

---

## Comandos

### Reprodução

| Comando | Aliases | Descrição |
|---|---|---|
| `!tocar <url\|busca>` | `play` `p` `t` | Toca por URL ou busca no YouTube/SoundCloud |
| `!pausar` | `pause` | Pausa a reprodução |
| `!continuar` | `resume` `r` | Continua a reprodução |
| `!pular` | `skip` `s` | Pula para a próxima música |
| `!parar` | `stop` | Para e limpa a fila |
| `!loop` | `repetir` | Ativa/desativa loop da faixa atual |
| `!volume <0-200>` | `vol` | Define o volume |
| `!tocando` | `np` `atual` | Exibe a música em reprodução |
| `!seek <tempo>` | `ir` | Salta para um momento — ex: `1:30` ou `90` |

### Fila

| Comando | Aliases | Descrição |
|---|---|---|
| `!fila` | `queue` `q` `f` | Exibe a fila atual |
| `!buscar <termo>` | `search` | Busca e escolhe entre 5 resultados |
| `!remover <pos>` | `remove` `rm` | Remove uma música pela posição |
| `!limpar` | `clear` | Limpa a fila (mantém a atual) |

### Ferramentas

| Comando | Aliases | Descrição |
|---|---|---|
| `!capa <busca>` | `art` `cover` | Capa via Apple Music em 1500×1500 px |
| `!ajuda` | `help` `h` | Referência completa de comandos |
| `!info` | `sobre` | Informações e latência do bot |
| `!sair` | `leave` `dc` | Desconecta do canal de voz |

---

## Estrutura

```
wesbot/
├── main.py          — Ponto de entrada, bot, eventos e handlers
├── run.py           — Watcher com hot reload automático
├── core/
│   └── logger.py    — Logger ANSI, banner ASCII e painéis de startup
├── cogs/
│   ├── music.py     — Player, fila, MusicProvider e comandos de música
│   └── tools.py     — Capa de álbum, ajuda e info
├── requirements.txt
├── .env.example
└── .gitignore
```

---

## Licença

MIT — livre para uso e modificação.
