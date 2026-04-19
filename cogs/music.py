# =============================================================================
# wesbot — Cog de Música
# Developed by: crypt0xf
# =============================================================================
"""
Cog de reprodução de áudio com gerenciamento de fila, suporte a loop e camada
de abstração de provedores. Suporta YouTube, SoundCloud e Bandcamp via yt-dlp.
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
import shlex
import subprocess
import time
from abc import ABC, abstractmethod
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, List, Optional

import discord
import yt_dlp
from discord import app_commands
from discord.ext import commands

logger = logging.getLogger("wesbot.music")

# ---------------------------------------------------------------------------
# Opções do FFmpeg
# ---------------------------------------------------------------------------
FFMPEG_BEFORE_OPTIONS: str = (
    "-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5"
    " -protocol_whitelist file,http,https,tcp,tls,crypto"
)
FFMPEG_OPTIONS: str = "-vn"

# ---------------------------------------------------------------------------
# Opções do yt-dlp
# ---------------------------------------------------------------------------
# Autenticação de cookies para evitar bloqueio do YouTube:
#   YTDL_COOKIES_BROWSER=chrome  (ou firefox, edge, brave, opera, chromium)
#   YTDL_COOKIES_FILE=/caminho/para/cookies.txt
_COOKIES_BROWSER = os.getenv("YTDL_COOKIES_BROWSER")
_COOKIES_FILE = os.getenv("YTDL_COOKIES_FILE")

YTDL_FORMAT_OPTIONS: dict[str, Any] = {
    "format": "bestaudio/bestaudio*/best",
    "outtmpl": "%(extractor)s-%(id)s-%(title)s.%(ext)s",
    "restrictfilenames": True,
    "noplaylist": True,
    "nocheckcertificate": True,
    "ignoreerrors": False,
    "logtostderr": False,
    "quiet": True,
    "no_warnings": True,
    "default_search": "ytsearch",
    "source_address": "0.0.0.0",
    "extract_flat": False,
    # Baixa o script EJS do GitHub para resolver o desafio JS (n challenge) do YouTube.
    # Requer Deno instalado: https://deno.com
    "remote_components": ["ejs:github"],
}

if _COOKIES_BROWSER:
    YTDL_FORMAT_OPTIONS["cookiesfrombrowser"] = (_COOKIES_BROWSER,)
elif _COOKIES_FILE:
    YTDL_FORMAT_OPTIONS["cookiefile"] = _COOKIES_FILE

# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------
def parse_time(value: str) -> Optional[int]:
    """Converte string de tempo (SS, MM:SS ou HH:MM:SS) em segundos inteiros."""
    parts = value.strip().split(":")
    try:
        if len(parts) == 1:
            return int(parts[0])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except ValueError:
        return None
    return None


def fmt_seconds(seconds: int) -> str:
    """Formata segundos como MM:SS ou HH:MM:SS."""
    mins, secs = divmod(seconds, 60)
    hrs, mins = divmod(mins, 60)
    if hrs:
        return f"{hrs:02d}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"


def build_progress_bar(position: int, duration: int, width: int = 18) -> str:
    """Constrói uma barra de progresso visual para exibir a posição na faixa."""
    if duration <= 0:
        return f"`{fmt_seconds(position)}`"
    ratio = min(position / duration, 1.0)
    filled = int(ratio * width)
    bar = "▬" * filled + "🔘" + "─" * (width - filled)
    return f"{bar}\n`{fmt_seconds(position)} / {fmt_seconds(duration)}`"


# ---------------------------------------------------------------------------
# Modelos de dados
# ---------------------------------------------------------------------------
@dataclass
class Track:
    """Representa uma faixa de áudio na fila."""

    title: str
    url: str                          # URL de reprodução direta (stream)
    webpage_url: str                  # URL da página original
    duration: int = 0                 # Duração em segundos
    thumbnail: Optional[str] = None
    uploader: Optional[str] = None
    requester: Optional[discord.Member] = None
    http_headers: dict = field(default_factory=dict)  # Headers HTTP exigidos pelo CDN (ex: TikTok)

    @property
    def duration_fmt(self) -> str:
        """Retorna a duração formatada como MM:SS ou HH:MM:SS."""
        mins, secs = divmod(self.duration, 60)
        hrs, mins = divmod(mins, 60)
        if hrs:
            return f"{hrs:02d}:{mins:02d}:{secs:02d}"
        return f"{mins:02d}:{secs:02d}"


@dataclass
class GuildQueue:
    """Estado de música por servidor: fila, loop e faixa atual."""

    tracks: Deque[Track] = field(default_factory=deque)
    current: Optional[Track] = None
    loop: bool = False
    loop_queue: bool = False           # Loop da fila completa (mutuamente exclusivo com loop)
    volume: float = 1.0
    voice_client: Optional[discord.VoiceClient] = None
    text_channel: Optional[discord.TextChannel] = None
    seek_offset: int = 0              # Segundos para passar ao FFmpeg via -ss
    is_seeking: bool = False          # Suprime requeue do loop durante seek
    # Rastreamento de posição
    start_time: Optional[float] = None    # time.time() quando a faixa atual iniciou
    pause_start: Optional[float] = None   # time.time() quando pausou
    paused_duration: float = 0.0          # Total de segundos em pausa na faixa atual
    # Histórico
    history: List[Track] = field(default_factory=list)  # Últimas faixas reproduzidas (máx 20)


# ---------------------------------------------------------------------------
# Camada de abstração de provedores
# ---------------------------------------------------------------------------
class MusicProvider(ABC):
    """
    Interface abstrata de provedor de música.

    Futuras integrações (Spotify, Tidal, Deezer) devem implementar:
    - ``search(query)`` → lista de objetos Track
    - ``resolve(url)``  → um único objeto Track
    """

    @abstractmethod
    async def search(self, query: str, limit: int = 1) -> list[Track]:
        """Busca faixas que correspondam a *query*."""

    @abstractmethod
    async def resolve(self, url: str) -> Track:
        """Resolve uma URL direta em um Track."""


class YtDlpProvider(MusicProvider):
    """
    Provedor padrão baseado em yt-dlp.
    Suporta nativamente YouTube, SoundCloud, Bandcamp e centenas de outros.
    """

    def __init__(self) -> None:
        self._ytdl = yt_dlp.YoutubeDL(YTDL_FORMAT_OPTIONS)

    async def _extract(self, query: str) -> dict[str, Any]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self._ytdl.extract_info(query, download=False),
        )

    def _build_track(
        self,
        data: dict[str, Any],
        requester: Optional[discord.Member] = None,
    ) -> Track:
        url = data.get("url") or data.get("webpage_url", "")
        return Track(
            title=data.get("title", "Desconhecido"),
            url=url,
            webpage_url=data.get("webpage_url", url),
            duration=int(data.get("duration") or 0),
            thumbnail=data.get("thumbnail"),
            uploader=data.get("uploader"),
            requester=requester,
            http_headers=data.get("http_headers", {}),
        )

    async def search(
        self,
        query: str,
        limit: int = 1,
        requester: Optional[discord.Member] = None,
    ) -> list[Track]:
        data = await self._extract(f"ytsearch{limit}:{query}")
        entries = data.get("entries", [data])
        return [self._build_track(e, requester) for e in entries if e]

    async def resolve(
        self,
        url: str,
        requester: Optional[discord.Member] = None,
    ) -> Track:
        data = await self._extract(url)
        if "entries" in data:
            data = data["entries"][0]
        return self._build_track(data, requester)


# ---------------------------------------------------------------------------
# Player de música
# ---------------------------------------------------------------------------
class MusicPlayer:
    """
    Gerencia o ciclo de vida de reprodução para um único servidor.
    Desacoplado do Cog para facilitar testes unitários.
    """

    def __init__(self, guild_queue: GuildQueue) -> None:
        self._q = guild_queue

    # ------------------------------------------------------------------
    # Métodos internos
    # ------------------------------------------------------------------
    def _after_playing(self, error: Optional[Exception]) -> None:
        """Callback chamado pelo discord.py quando uma faixa termina."""
        vc = self._q.voice_client
        if vc is None:
            return

        if error:
            logger.error("Erro de reprodução: %s", error)
            if self._q.text_channel:
                coro = self._q.text_channel.send(
                    f"❌ Erro ao reproduzir `{self._q.current.title if self._q.current else 'faixa'}`: "
                    f"`{type(error).__name__}: {error}`"
                )
                asyncio.run_coroutine_threadsafe(coro, vc.loop)

        if self._q.is_seeking:
            # Seek em andamento: o requeue já foi feito em seek(); não duplicar.
            self._q.is_seeking = False
        else:
            # Adiciona ao histórico antes de descartar
            if self._q.current:
                self._q.history.append(self._q.current)
                if len(self._q.history) > 20:
                    self._q.history.pop(0)

            if self._q.loop and self._q.current:
                # Loop de faixa: recoloca no início da fila
                self._q.tracks.appendleft(self._q.current)
            elif self._q.loop_queue and self._q.current:
                # Loop de fila: recoloca no final da fila
                self._q.tracks.append(self._q.current)

        coro = self._play_next()
        asyncio.run_coroutine_threadsafe(coro, vc.loop)

    async def _play_next(self) -> None:
        """Pega a próxima faixa da fila e inicia a reprodução."""
        if not self._q.tracks:
            self._q.current = None
            self._q.start_time = None
            if self._q.text_channel:
                await self._q.text_channel.send(
                    "✅ A fila acabou. Use `!tocar` para adicionar mais músicas."
                )
            return

        track = self._q.tracks.popleft()
        self._q.current = track

        seek_offset = self._q.seek_offset
        self._q.seek_offset = 0

        # Inicializa rastreamento de posição (ajustado pelo offset do seek)
        self._q.start_time = time.time() - seek_offset
        self._q.paused_duration = 0.0
        self._q.pause_start = None

        # TikTok exige Referer + User-Agent específicos para acessar o CDN.
        # Passar \r\n real em argumentos subprocess no Windows é instável,
        # então usamos yt-dlp como subprocesso fazendo pipe direto ao FFmpeg —
        # o yt-dlp cuida de toda autenticação (headers, cookies) internamente.
        use_pipe = "tiktok.com" in track.webpage_url.lower()

        if use_pipe:
            ytdlp_args = [
                "yt-dlp", "--quiet", "--no-playlist",
                "--format", "bestaudio/best",
                "--output", "-",
            ]
            if _COOKIES_FILE:
                ytdlp_args += ["--cookies", _COOKIES_FILE]
            elif _COOKIES_BROWSER:
                ytdlp_args += ["--cookies-from-browser", _COOKIES_BROWSER]
            ytdlp_args.append(track.webpage_url)

            logger.debug("TikTok pipe: yt-dlp → FFmpeg stdin, url=%s", track.webpage_url)
            yt_proc = subprocess.Popen(
                ytdlp_args,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
            )
            pipe_options = (
                f"-ss {seek_offset} {FFMPEG_OPTIONS}" if seek_offset > 0 else FFMPEG_OPTIONS
            )
            source = discord.FFmpegPCMAudio(
                yt_proc.stdout,
                pipe=True,
                options=pipe_options,
                stderr=subprocess.PIPE,
            )
        else:
            # Sites normais: URL pré-extraída pelo yt-dlp, passada direto ao FFmpeg
            extra_before = ""
            if track.http_headers:
                ua = (
                    track.http_headers.get("User-Agent")
                    or track.http_headers.get("user-agent")
                    or ""
                )
                if ua:
                    extra_before = f"-user_agent {shlex.quote(ua)} "

            base_options = f"{extra_before}{FFMPEG_BEFORE_OPTIONS}"
            before_options = (
                f"{base_options} -ss {seek_offset}"
                if seek_offset > 0
                else base_options
            )

            logger.debug(
                "FFmpeg direto → url=%s",
                track.url[:80] if track.url else "VAZIO",
            )
            source = discord.FFmpegPCMAudio(
                track.url,
                before_options=before_options,
                options=FFMPEG_OPTIONS,
                stderr=subprocess.PIPE,
            )
        volume_source = discord.PCMVolumeTransformer(source, volume=self._q.volume)

        if self._q.voice_client and self._q.voice_client.is_connected():
            self._q.voice_client.play(volume_source, after=self._after_playing)

        if self._q.text_channel and seek_offset == 0:
            embed = self._build_now_playing_embed(track)
            await self._q.text_channel.send(embed=embed)

    def _build_now_playing_embed(
        self, track: Track, position: Optional[int] = None
    ) -> discord.Embed:
        embed = discord.Embed(
            title="🎵 Tocando Agora",
            description=f"[{track.title}]({track.webpage_url})",
            color=discord.Color.blurple(),
        )
        if track.thumbnail:
            embed.set_thumbnail(url=track.thumbnail)

        # Barra de progresso (apenas no !tocando, não no auto-embed ao iniciar)
        if position is not None:
            bar = build_progress_bar(position, track.duration)
            embed.add_field(name="Progresso", value=bar, inline=False)
        else:
            embed.add_field(name="Duração", value=track.duration_fmt, inline=True)

        if track.uploader:
            embed.add_field(name="Canal", value=track.uploader, inline=True)
        if track.requester:
            embed.add_field(
                name="Pedido por",
                value=track.requester.display_name,
                inline=True,
            )

        # Indicadores de estado
        status_parts = []
        if self._q.loop:
            status_parts.append("🔁 Loop de faixa")
        if self._q.loop_queue:
            status_parts.append("🔁 Loop de fila")
        if self._q.voice_client and self._q.voice_client.is_paused():
            status_parts.append("⏸️ Pausado")

        footer_text = "wesbot · Developed by crypt0xf"
        if status_parts:
            footer_text = " · ".join(status_parts) + " · " + footer_text
        embed.set_footer(text=footer_text)
        return embed

    # ------------------------------------------------------------------
    # API pública
    # ------------------------------------------------------------------
    def get_position(self) -> int:
        """Retorna a posição atual de reprodução em segundos."""
        gq = self._q
        if gq.start_time is None:
            return 0
        elapsed = time.time() - gq.start_time - gq.paused_duration
        if gq.pause_start is not None:
            # Atualmente pausado: subtrai tempo de pausa em andamento
            elapsed -= (time.time() - gq.pause_start)
        return max(0, int(elapsed))

    async def start(self) -> None:
        """Inicia a reprodução se não estiver tocando."""
        vc = self._q.voice_client
        if vc and not vc.is_playing():
            await self._play_next()

    def pause(self) -> bool:
        vc = self._q.voice_client
        if vc and vc.is_playing():
            vc.pause()
            self._q.pause_start = time.time()
            return True
        return False

    def resume(self) -> bool:
        vc = self._q.voice_client
        if vc and vc.is_paused():
            vc.resume()
            if self._q.pause_start is not None:
                self._q.paused_duration += time.time() - self._q.pause_start
                self._q.pause_start = None
            return True
        return False

    def skip(self) -> bool:
        vc = self._q.voice_client
        if vc and (vc.is_playing() or vc.is_paused()):
            vc.stop()
            return True
        return False

    def stop(self) -> None:
        self._q.tracks.clear()
        self._q.current = None
        self._q.start_time = None
        vc = self._q.voice_client
        if vc:
            vc.stop()

    def toggle_loop(self) -> bool:
        self._q.loop = not self._q.loop
        if self._q.loop:
            self._q.loop_queue = False  # Mutuamente exclusivo
        return self._q.loop

    def toggle_loop_queue(self) -> bool:
        """Ativa/desativa o loop da fila completa (mutuamente exclusivo com loop de faixa)."""
        self._q.loop_queue = not self._q.loop_queue
        if self._q.loop_queue:
            self._q.loop = False  # Mutuamente exclusivo
        return self._q.loop_queue

    def set_volume(self, volume: float) -> None:
        """Define o volume no intervalo 0.0–2.0."""
        self._q.volume = max(0.0, min(volume, 2.0))
        vc = self._q.voice_client
        if vc and vc.source:
            if isinstance(vc.source, discord.PCMVolumeTransformer):
                vc.source.volume = self._q.volume

    def seek(self, seconds: int) -> bool:
        """Salta para *seconds* na faixa atual. Retorna False se nada estiver tocando."""
        vc = self._q.voice_client
        if not vc or not (vc.is_playing() or vc.is_paused()):
            return False
        if self._q.current is None:
            return False
        self._q.is_seeking = True
        self._q.seek_offset = seconds
        self._q.tracks.appendleft(self._q.current)
        vc.stop()
        return True

    def shuffle_queue(self) -> bool:
        """Embaralha a fila aleatoriamente. Retorna False se houver menos de 2 músicas."""
        if len(self._q.tracks) < 2:
            return False
        track_list = list(self._q.tracks)
        random.shuffle(track_list)
        self._q.tracks = deque(track_list)
        return True

    def move_track(self, origem: int, destino: int) -> Optional[str]:
        """
        Move uma faixa da posição *origem* para *destino* (1-indexado).
        Retorna o título da faixa movida, ou None se posições inválidas.
        """
        size = len(self._q.tracks)
        if size < 2:
            return None
        if not (1 <= origem <= size) or not (1 <= destino <= size):
            return None
        track_list = list(self._q.tracks)
        track = track_list.pop(origem - 1)
        track_list.insert(destino - 1, track)
        self._q.tracks = deque(track_list)
        return track.title


# ---------------------------------------------------------------------------
# Cog de Música
# ---------------------------------------------------------------------------
class MusicCog(commands.Cog, name="Música"):
    """🎵 Comandos de música: tocar, pausar, pular, fila, loop, parar e mais."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self._provider: MusicProvider = YtDlpProvider()
        # guild_id → GuildQueue
        self._queues: dict[int, GuildQueue] = {}

    # ------------------------------------------------------------------
    # Utilitários internos
    # ------------------------------------------------------------------
    def _get_queue(self, guild_id: int) -> GuildQueue:
        if guild_id not in self._queues:
            self._queues[guild_id] = GuildQueue()
        return self._queues[guild_id]

    def _get_player(self, guild_id: int) -> MusicPlayer:
        return MusicPlayer(self._get_queue(guild_id))

    async def _ensure_voice(
        self, ctx: commands.Context
    ) -> Optional[discord.VoiceClient]:
        """Garante que o bot entre (ou já esteja) no canal de voz do autor."""
        if not ctx.author.voice or not ctx.author.voice.channel:
            await ctx.send("❌ Você precisa estar em um canal de voz para usar este comando.")
            return None

        channel: discord.VoiceChannel = ctx.author.voice.channel
        gq = self._get_queue(ctx.guild.id)

        if ctx.voice_client is None:
            vc = await channel.connect()
        elif ctx.voice_client.channel != channel:
            await ctx.voice_client.move_to(channel)
            vc = ctx.voice_client
        else:
            vc = ctx.voice_client

        gq.voice_client = vc
        gq.text_channel = ctx.channel  # type: ignore[assignment]
        return vc

    # ------------------------------------------------------------------
    # Comandos de prefixo
    # ------------------------------------------------------------------
    @commands.command(name="tocar", aliases=["play", "p", "t"])
    async def play_cmd(self, ctx: commands.Context, *, query: str) -> None:
        """Toca uma música por URL ou termo de busca. Suporta YouTube, SoundCloud e Bandcamp."""
        vc = await self._ensure_voice(ctx)
        if not vc:
            return

        async with ctx.typing():
            try:
                is_url = query.startswith(("http://", "https://"))
                if is_url:
                    track = await self._provider.resolve(query, requester=ctx.author)
                else:
                    results = await self._provider.search(query, limit=1, requester=ctx.author)
                    if not results:
                        await ctx.send("❌ Nenhum resultado encontrado.")
                        return
                    track = results[0]
            except yt_dlp.utils.DownloadError as exc:
                logger.error("Erro de download yt-dlp: %s", exc)
                msg = str(exc)
                if "Sign in to confirm" in msg or "bot" in msg.lower():
                    await ctx.send(
                        "❌ O YouTube bloqueou a requisição.\n"
                        "Configure `YTDL_COOKIES_FILE=./cookies.txt` no `.env` e exporte seus cookies do YouTube. "
                        "Veja o README para instruções."
                    )
                elif "tiktok" in msg.lower() or "tiktok" in query.lower():
                    await ctx.send(
                        "❌ Não foi possível obter o áudio do TikTok.\n"
                        "O vídeo pode ser privado, ter restrição de região, ou o TikTok bloqueou a requisição."
                    )
                elif "cookie" in msg.lower() or "Could not copy" in msg:
                    await ctx.send(
                        "❌ Falha ao ler cookies do navegador (provavelmente está aberto e bloqueando o banco).\n"
                        "Use `YTDL_COOKIES_FILE=./cookies.txt` no `.env` em vez de `YTDL_COOKIES_BROWSER`. "
                        "Veja o README para instruções."
                    )
                else:
                    await ctx.send(
                        "❌ Falha ao obter o áudio. O link pode ser inválido ou não suportado."
                    )
                return
            except Exception as exc:
                logger.error("Erro inesperado ao buscar faixa: %s", exc)
                await ctx.send(f"❌ Ocorreu um erro: `{exc}`")
                return

        # Valida que yt-dlp extraiu uma URL de stream real (não a página original)
        if not track.url or track.url == track.webpage_url:
            logger.error(
                "URL de stream inválida para '%s': url=%s webpage_url=%s",
                track.title,
                track.url,
                track.webpage_url,
            )
            await ctx.send(
                f"❌ Não foi possível obter a URL de stream de `{track.title}`.\n"
                "O site pode não ser suportado ou o yt-dlp precisa ser atualizado."
            )
            return

        logger.info(
            "Stream resolvido: '%s' → %s (headers=%s)",
            track.title,
            track.url[:80],
            list(track.http_headers.keys()),
        )

        gq = self._get_queue(ctx.guild.id)
        gq.tracks.append(track)

        player = self._get_player(ctx.guild.id)

        if not vc.is_playing() and not vc.is_paused():
            await player.start()
        else:
            embed = discord.Embed(
                title="➕ Adicionado à Fila",
                description=f"[{track.title}]({track.webpage_url})",
                color=discord.Color.green(),
            )
            embed.add_field(name="Posição", value=str(len(gq.tracks)), inline=True)
            embed.add_field(name="Duração", value=track.duration_fmt, inline=True)
            if track.thumbnail:
                embed.set_thumbnail(url=track.thumbnail)
            embed.set_footer(text="wesbot · Developed by crypt0xf")
            await ctx.send(embed=embed)

    @commands.command(name="pausar", aliases=["pause"])
    async def pause_cmd(self, ctx: commands.Context) -> None:
        """Pausa a música atual."""
        if self._get_player(ctx.guild.id).pause():
            await ctx.send("⏸️ Pausado.")
        else:
            await ctx.send("⚠️ Nenhuma música está tocando agora.")

    @commands.command(name="continuar", aliases=["resume", "retomar", "r"])
    async def resume_cmd(self, ctx: commands.Context) -> None:
        """Continua uma música pausada."""
        if self._get_player(ctx.guild.id).resume():
            await ctx.send("▶️ Continuando.")
        else:
            await ctx.send("⚠️ A reprodução não está pausada.")

    @commands.command(name="pular", aliases=["skip", "s", "próximo", "proximo"])
    async def skip_cmd(self, ctx: commands.Context) -> None:
        """Pula para a próxima música da fila."""
        if self._get_player(ctx.guild.id).skip():
            await ctx.send("⏭️ Pulado.")
        else:
            await ctx.send("⚠️ Nenhuma música está tocando agora.")

    @commands.command(name="parar", aliases=["stop"])
    async def stop_cmd(self, ctx: commands.Context) -> None:
        """Para a reprodução e limpa a fila."""
        self._get_player(ctx.guild.id).stop()
        await ctx.send("⏹️ Parado e fila limpa.")

    @commands.command(name="loop", aliases=["repetir"])
    async def loop_cmd(self, ctx: commands.Context) -> None:
        """Ativa ou desativa o loop da música atual (mutuamente exclusivo com !loopfila)."""
        enabled = self._get_player(ctx.guild.id).toggle_loop()
        state = "🔁 Loop de faixa **ativado**." if enabled else "➡️ Loop de faixa **desativado**."
        await ctx.send(state)

    @commands.command(name="loopfila", aliases=["queueloop", "lf", "loopqueue"])
    async def loop_queue_cmd(self, ctx: commands.Context) -> None:
        """Ativa ou desativa o loop da fila completa (mutuamente exclusivo com !loop)."""
        enabled = self._get_player(ctx.guild.id).toggle_loop_queue()
        state = "🔁 Loop de fila **ativado**." if enabled else "➡️ Loop de fila **desativado**."
        await ctx.send(state)

    @commands.command(name="fila", aliases=["queue", "q", "f"])
    async def queue_cmd(self, ctx: commands.Context) -> None:
        """Exibe a fila de músicas atual."""
        gq = self._get_queue(ctx.guild.id)

        embed = discord.Embed(
            title="📋 Fila de Músicas",
            color=discord.Color.blurple(),
        )

        if gq.current:
            if gq.loop:
                status = "🔁 "
            elif gq.loop_queue:
                status = "🔄 "
            else:
                status = "🎵 "
            # Mostra posição atual na faixa se disponível
            player = self._get_player(ctx.guild.id)
            pos = player.get_position()
            pos_str = f"`{fmt_seconds(pos)} / {gq.current.duration_fmt}`" if pos > 0 else f"`{gq.current.duration_fmt}`"
            embed.add_field(
                name=f"{status}Tocando Agora",
                value=f"[{gq.current.title}]({gq.current.webpage_url}) {pos_str}",
                inline=False,
            )

        if not gq.tracks:
            embed.description = "A fila está vazia."
        else:
            lines = []
            total_duration = sum(t.duration for t in gq.tracks)
            for idx, track in enumerate(gq.tracks, start=1):
                lines.append(
                    f"`{idx}.` [{track.title}]({track.webpage_url}) `{track.duration_fmt}`"
                )
                if idx >= 10:
                    remaining = len(gq.tracks) - 10
                    if remaining:
                        lines.append(f"*…e mais {remaining} música(s)*")
                    break
            embed.description = "\n".join(lines)
            embed.add_field(
                name="Total na fila",
                value=f"`{len(gq.tracks)}` música(s) · `{fmt_seconds(total_duration)}`",
                inline=False,
            )

        loop_status = "faixa" if gq.loop else ("fila" if gq.loop_queue else "desativado")
        embed.set_footer(
            text=f"Loop: {loop_status} · wesbot · Developed by crypt0xf"
        )
        await ctx.send(embed=embed)

    @commands.command(name="tocando", aliases=["nowplaying", "np", "atual"])
    async def nowplaying_cmd(self, ctx: commands.Context) -> None:
        """Mostra a música que está tocando agora com barra de progresso."""
        gq = self._get_queue(ctx.guild.id)
        if not gq.current:
            await ctx.send("⚠️ Nenhuma música está tocando agora.")
            return

        player = self._get_player(ctx.guild.id)
        position = player.get_position()
        embed = player._build_now_playing_embed(gq.current, position=position)
        await ctx.send(embed=embed)

    @commands.command(name="volume", aliases=["vol"])
    async def volume_cmd(self, ctx: commands.Context, volume: int) -> None:
        """Define o volume de reprodução (0–200)."""
        if not 0 <= volume <= 200:
            await ctx.send("⚠️ O volume deve estar entre 0 e 200.")
            return
        self._get_player(ctx.guild.id).set_volume(volume / 100)
        await ctx.send(f"🔊 Volume definido para **{volume}%**.")

    @commands.command(name="seek", aliases=["ir"])
    async def seek_cmd(self, ctx: commands.Context, *, time_str: str) -> None:
        """Salta para um momento específico da música. Ex: 90, 1:30, 1:05:00"""
        gq = self._get_queue(ctx.guild.id)
        vc = ctx.voice_client

        if not gq.current or not vc or not (vc.is_playing() or vc.is_paused()):
            await ctx.send("⚠️ Nenhuma música está tocando agora.")
            return

        seconds = parse_time(time_str)
        if (
            seconds is None
            or seconds < 0
            or (gq.current.duration > 0 and seconds >= gq.current.duration)
        ):
            await ctx.send("⚠️ Tempo inválido ou maior que a música atual.")
            return

        if self._get_player(ctx.guild.id).seek(seconds):
            await ctx.send(f"⏩ Pulei para `{fmt_seconds(seconds)}`.")
        else:
            await ctx.send("⚠️ Nenhuma música está tocando agora.")

    @commands.command(name="remover", aliases=["remove", "rm"])
    async def remove_cmd(self, ctx: commands.Context, index: int) -> None:
        """Remove uma música da fila pela sua posição."""
        gq = self._get_queue(ctx.guild.id)
        if index < 1 or index > len(gq.tracks):
            await ctx.send("⚠️ Posição inválida na fila.")
            return
        removed = list(gq.tracks)[index - 1]
        del_list = list(gq.tracks)
        del_list.pop(index - 1)
        gq.tracks = deque(del_list)
        await ctx.send(f"🗑️ **{removed.title}** removido da fila.")

    @commands.command(name="limpar", aliases=["clear"])
    async def clear_cmd(self, ctx: commands.Context) -> None:
        """Limpa todas as músicas da fila (mantém a atual tocando)."""
        self._get_queue(ctx.guild.id).tracks.clear()
        await ctx.send("🗑️ Fila limpa.")

    @commands.command(name="sair", aliases=["leave", "dc", "desconectar", "disconnect"])
    async def leave_cmd(self, ctx: commands.Context) -> None:
        """Desconecta o bot do canal de voz."""
        if ctx.voice_client:
            self._get_player(ctx.guild.id).stop()
            await ctx.voice_client.disconnect()
            await ctx.send("👋 Desconectado.")
        else:
            await ctx.send("⚠️ Não estou em nenhum canal de voz.")

    @commands.command(name="embaralhar", aliases=["shuffle"])
    async def shuffle_cmd(self, ctx: commands.Context) -> None:
        """Embaralha aleatoriamente a ordem das músicas na fila."""
        if self._get_player(ctx.guild.id).shuffle_queue():
            await ctx.send("🔀 Fila embaralhada.")
        else:
            await ctx.send("⚠️ A fila precisa ter pelo menos 2 músicas para embaralhar.")

    @commands.command(name="mover", aliases=["move", "mv"])
    async def move_cmd(self, ctx: commands.Context, origem: int, destino: int) -> None:
        """Move uma música de uma posição para outra na fila. Ex: !mover 3 1"""
        gq = self._get_queue(ctx.guild.id)
        size = len(gq.tracks)
        if size < 2:
            await ctx.send("⚠️ A fila precisa ter pelo menos 2 músicas para mover.")
            return
        if not (1 <= origem <= size) or not (1 <= destino <= size):
            await ctx.send(f"⚠️ Posições inválidas. A fila tem **{size}** música(s).")
            return
        if origem == destino:
            await ctx.send("⚠️ As posições de origem e destino são iguais.")
            return
        title = self._get_player(ctx.guild.id).move_track(origem, destino)
        if title:
            await ctx.send(f"↕️ **{title}** movido da posição `{origem}` para `{destino}`.")
        else:
            await ctx.send("⚠️ Não foi possível mover a música.")

    @commands.command(name="historico", aliases=["history", "hist"])
    async def history_cmd(self, ctx: commands.Context) -> None:
        """Exibe as últimas músicas reproduzidas nesta sessão (máx 10)."""
        gq = self._get_queue(ctx.guild.id)
        if not gq.history:
            await ctx.send("⚠️ Nenhuma música foi reproduzida ainda nesta sessão.")
            return

        embed = discord.Embed(
            title="📜 Histórico de Reprodução",
            color=discord.Color.blurple(),
        )
        lines = []
        for idx, track in enumerate(reversed(gq.history[-10:]), start=1):
            requester_str = f" — pedido por {track.requester.display_name}" if track.requester else ""
            lines.append(
                f"`{idx}.` [{track.title}]({track.webpage_url}) `{track.duration_fmt}`{requester_str}"
            )
        embed.description = "\n".join(lines)
        embed.set_footer(text=f"Total reproduzidas nesta sessão: {len(gq.history)} · wesbot · Developed by crypt0xf")
        await ctx.send(embed=embed)

    @commands.command(name="buscar", aliases=["search", "procurar"])
    async def search_cmd(
        self, ctx: commands.Context, *, query: str
    ) -> None:
        """Busca no YouTube e exibe os 5 melhores resultados para seleção."""
        async with ctx.typing():
            try:
                results = await self._provider.search(
                    query, limit=5, requester=ctx.author
                )
            except Exception as exc:
                await ctx.send(f"❌ Falha na busca: `{exc}`")
                return

        if not results:
            await ctx.send("❌ Nenhum resultado encontrado.")
            return

        embed = discord.Embed(
            title=f"🔍 Resultados para: {query}",
            color=discord.Color.blurple(),
        )
        lines = []
        for idx, track in enumerate(results, start=1):
            lines.append(
                f"`{idx}.` [{track.title}]({track.webpage_url}) `{track.duration_fmt}`"
            )
        embed.description = "\n".join(lines)
        embed.set_footer(
            text="Responda com o número para tocar, ou ignore para cancelar. · wesbot"
        )
        msg = await ctx.send(embed=embed)

        def check(m: discord.Message) -> bool:
            return (
                m.author == ctx.author
                and m.channel == ctx.channel
                and m.content.isdigit()
                and 1 <= int(m.content) <= len(results)
            )

        try:
            reply = await self.bot.wait_for("message", timeout=30.0, check=check)
        except asyncio.TimeoutError:
            await msg.edit(content="⌛ Seleção expirou.", embed=None)
            return

        chosen = results[int(reply.content) - 1]
        gq = self._get_queue(ctx.guild.id)

        vc = await self._ensure_voice(ctx)
        if not vc:
            return

        gq.tracks.append(chosen)
        player = self._get_player(ctx.guild.id)
        if not vc.is_playing() and not vc.is_paused():
            await player.start()
        else:
            await ctx.send(f"➕ **{chosen.title}** adicionado à fila.")

    # ------------------------------------------------------------------
    # Slash commands (espelhos dos comandos de prefixo)
    # ------------------------------------------------------------------
    @app_commands.command(name="tocar", description="Toca uma música por URL ou busca.")
    @app_commands.describe(query="URL do YouTube/SoundCloud/Bandcamp ou termo de busca")
    async def play_slash(
        self, interaction: discord.Interaction, query: str
    ) -> None:
        ctx = await commands.Context.from_interaction(interaction)
        await self.play_cmd(ctx, query=query)

    @app_commands.command(name="pular", description="Pula a música atual.")
    async def skip_slash(self, interaction: discord.Interaction) -> None:
        ctx = await commands.Context.from_interaction(interaction)
        await self.skip_cmd(ctx)

    @app_commands.command(name="fila", description="Exibe a fila de músicas.")
    async def queue_slash(self, interaction: discord.Interaction) -> None:
        ctx = await commands.Context.from_interaction(interaction)
        await self.queue_cmd(ctx)

    @app_commands.command(name="parar", description="Para a reprodução e limpa a fila.")
    async def stop_slash(self, interaction: discord.Interaction) -> None:
        ctx = await commands.Context.from_interaction(interaction)
        await self.stop_cmd(ctx)

    @app_commands.command(name="loop", description="Ativa ou desativa o loop da música atual.")
    async def loop_slash(self, interaction: discord.Interaction) -> None:
        ctx = await commands.Context.from_interaction(interaction)
        await self.loop_cmd(ctx)

    @app_commands.command(name="tocando", description="Mostra a música que está tocando agora com progresso.")
    async def nowplaying_slash(self, interaction: discord.Interaction) -> None:
        ctx = await commands.Context.from_interaction(interaction)
        await self.nowplaying_cmd(ctx)

    @app_commands.command(name="embaralhar", description="Embaralha aleatoriamente a fila de músicas.")
    async def shuffle_slash(self, interaction: discord.Interaction) -> None:
        ctx = await commands.Context.from_interaction(interaction)
        await self.shuffle_cmd(ctx)

    @app_commands.command(name="historico", description="Exibe as últimas músicas reproduzidas nesta sessão.")
    async def history_slash(self, interaction: discord.Interaction) -> None:
        ctx = await commands.Context.from_interaction(interaction)
        await self.history_cmd(ctx)

    @app_commands.command(name="loopfila", description="Ativa ou desativa o loop da fila completa.")
    async def loop_queue_slash(self, interaction: discord.Interaction) -> None:
        ctx = await commands.Context.from_interaction(interaction)
        await self.loop_queue_cmd(ctx)

    # ------------------------------------------------------------------
    # Listener de estado de voz
    # ------------------------------------------------------------------
    @commands.Cog.listener()
    async def on_voice_state_update(
        self,
        member: discord.Member,
        before: discord.VoiceState,
        after: discord.VoiceState,
    ) -> None:
        """Desconecta automaticamente se todos saírem do canal de voz."""
        vc = member.guild.voice_client
        if vc is None:
            return
        channel = vc.channel
        humans = [m for m in channel.members if not m.bot]
        if not humans:
            self._get_player(member.guild.id).stop()
            await vc.disconnect()
            gq = self._get_queue(member.guild.id)
            if gq.text_channel:
                await gq.text_channel.send(
                    "👋 Desconectado — canal de voz ficou vazio."
                )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(MusicCog(bot))
    logger.info("MusicCog carregado com sucesso.")
