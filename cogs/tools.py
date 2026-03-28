# =============================================================================
# wesbot — Cog de Ferramentas
# Developed by: crypt0xf
# =============================================================================
"""
Comandos utilitários: busca de capa via Apple Music API, menu de ajuda e info do bot.
"""

from __future__ import annotations

import logging
import os
import re
import urllib.parse
from typing import Optional

import aiohttp
import discord
from discord import app_commands
from discord.ext import commands

logger = logging.getLogger("wesbot.tools")

# ---------------------------------------------------------------------------
# Apple Music / iTunes Search API
# ---------------------------------------------------------------------------
ITUNES_SEARCH_URL = "https://itunes.apple.com/search"
# A API do iTunes retorna artwork em 100x100 por padrão.
# Substituímos o slug de resolução para obter a maior resolução disponível.
ARTWORK_SIZE_PATTERN = re.compile(r"\d+x\d+bb")
HIGH_RES_SIZE = "1500x1500bb"


async def fetch_apple_music_art(
    query: str,
    entity: str = "album",
    limit: int = 5,
) -> list[dict]:
    """
    Consulta a iTunes Search API e retorna uma lista de resultados.

    Args:
        query:  Termo de busca (artista + álbum, ou título da música).
        entity: ``album``, ``song``, ``musicArtist``, etc.
        limit:  Número máximo de resultados.

    Returns:
        Lista de dicionários de resultado do iTunes (pode ser vazia).
    """
    params = {
        "term": query,
        "entity": entity,
        "limit": limit,
        "media": "music",
    }
    url = f"{ITUNES_SEARCH_URL}?{urllib.parse.urlencode(params)}"

    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            resp.raise_for_status()
            data = await resp.json(content_type=None)

    return data.get("results", [])


def upgrade_artwork_url(raw_url: Optional[str]) -> Optional[str]:
    """Substitui o segmento de resolução na URL de artwork do iTunes."""
    if not raw_url:
        return None
    return ARTWORK_SIZE_PATTERN.sub(HIGH_RES_SIZE, raw_url)


def build_art_embed(result: dict, query: str) -> discord.Embed:
    """Constrói um embed rico a partir de um resultado do iTunes."""
    collection = result.get("collectionName", "Álbum Desconhecido")
    artist = result.get("artistName", "Artista Desconhecido")
    release = result.get("releaseDate", "")[:4]  # Somente o ano
    genre = result.get("primaryGenreName", "")
    collection_url = result.get("collectionViewUrl") or result.get("trackViewUrl", "")
    artwork_url = upgrade_artwork_url(result.get("artworkUrl100"))

    embed = discord.Embed(
        title=collection,
        url=collection_url,
        color=discord.Color.from_rgb(252, 60, 68),  # Vermelho Apple Music
    )
    embed.set_author(name=artist)

    details = []
    if release:
        details.append(f"📅 **Ano:** {release}")
    if genre:
        details.append(f"🎸 **Gênero:** {genre}")
    if details:
        embed.description = "\n".join(details)

    if artwork_url:
        embed.set_image(url=artwork_url)
        embed.set_footer(
            text=f"🔍 Busca: {query} · Resolução: 1500×1500 · wesbot · Developed by crypt0xf"
        )
    else:
        embed.set_footer(text="Nenhuma capa encontrada · wesbot · Developed by crypt0xf")

    return embed


# ---------------------------------------------------------------------------
# Cog de Ferramentas
# ---------------------------------------------------------------------------
class ToolsCog(commands.Cog, name="Ferramentas"):
    """🛠️ Comandos utilitários: capa de álbum, ajuda e informações do bot."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    # ------------------------------------------------------------------
    # !capa / !art
    # ------------------------------------------------------------------
    @commands.command(name="capa", aliases=["art", "cover", "artwork"])
    async def art_cmd(self, ctx: commands.Context, *, query: str) -> None:
        """
        Busca a capa de álbum na Apple Music na resolução máxima (1500×1500).

        Uso:
            !capa <artista> <álbum>
            !capa <título da música>

        Exemplos:
            !capa Pink Floyd The Dark Side of the Moon
            !capa Kendrick Lamar DAMN
        """
        async with ctx.typing():
            try:
                # Tenta como álbum primeiro, depois como música
                results = await fetch_apple_music_art(query, entity="album", limit=5)
                if not results:
                    results = await fetch_apple_music_art(query, entity="song", limit=5)
            except aiohttp.ClientError as exc:
                logger.error("Erro de rede na API Apple Music: %s", exc)
                await ctx.send(
                    "❌ Não foi possível acessar a API da Apple Music. Tente novamente mais tarde."
                )
                return
            except Exception as exc:
                logger.error("Erro inesperado ao buscar capa: %s", exc)
                await ctx.send(f"❌ Ocorreu um erro inesperado: `{exc}`")
                return

        if not results:
            await ctx.send(
                f"❌ Nenhum resultado encontrado para **{query}** na Apple Music."
            )
            return

        # Exibe o primeiro resultado imediatamente
        top = results[0]
        embed = build_art_embed(top, query)
        msg = await ctx.send(embed=embed)

        # Se houver múltiplos resultados, oferece navegação por reações
        if len(results) > 1:
            await msg.add_reaction("⬅️")
            await msg.add_reaction("➡️")
            await msg.add_reaction("❌")

            current_idx = 0

            def reaction_check(reaction: discord.Reaction, user: discord.User) -> bool:
                return (
                    user == ctx.author
                    and reaction.message.id == msg.id
                    and str(reaction.emoji) in ("⬅️", "➡️", "❌")
                )

            while True:
                try:
                    reaction, user = await self.bot.wait_for(
                        "reaction_add", timeout=60.0, check=reaction_check
                    )
                except Exception:
                    try:
                        await msg.clear_reactions()
                    except discord.Forbidden:
                        pass
                    break

                emoji = str(reaction.emoji)

                if emoji == "❌":
                    try:
                        await msg.clear_reactions()
                    except discord.Forbidden:
                        pass
                    break
                elif emoji == "➡️":
                    current_idx = min(current_idx + 1, len(results) - 1)
                elif emoji == "⬅️":
                    current_idx = max(current_idx - 1, 0)

                try:
                    await reaction.remove(user)
                except discord.Forbidden:
                    pass

                new_embed = build_art_embed(results[current_idx], query)
                new_embed.set_footer(
                    text=(
                        f"Resultado {current_idx + 1}/{len(results)} · "
                        f"Resolução: 1500×1500 · wesbot · Developed by crypt0xf"
                    )
                )
                await msg.edit(embed=new_embed)

    # ------------------------------------------------------------------
    # Slash command espelho
    # ------------------------------------------------------------------
    @app_commands.command(
        name="capa",
        description="Busca a capa de álbum na Apple Music em resolução máxima.",
    )
    @app_commands.describe(query="Artista + nome do álbum, ou título da música")
    async def art_slash(
        self, interaction: discord.Interaction, query: str
    ) -> None:
        await interaction.response.defer()
        try:
            results = await fetch_apple_music_art(query, entity="album", limit=1)
            if not results:
                results = await fetch_apple_music_art(query, entity="song", limit=1)
        except Exception as exc:
            await interaction.followup.send(f"❌ Erro: `{exc}`")
            return

        if not results:
            await interaction.followup.send(
                f"❌ Nenhum resultado encontrado para **{query}** na Apple Music."
            )
            return

        embed = build_art_embed(results[0], query)
        await interaction.followup.send(embed=embed)

    # ------------------------------------------------------------------
    # Comando de ajuda
    # ------------------------------------------------------------------
    @commands.command(name="ajuda", aliases=["help", "h", "comandos"])
    async def help_cmd(self, ctx: commands.Context) -> None:
        """Exibe a referência completa de comandos."""
        prefix = ctx.prefix or "!"

        embed = discord.Embed(
            title="🎵 wesbot — Referência de Comandos",
            description=(
                f"Prefixo: `{prefix}` · Slash commands também suportados\n"
                "Developed by **crypt0xf**"
            ),
            color=discord.Color.blurple(),
        )

        embed.add_field(
            name="🎵 Reprodução",
            value=(
                f"`{prefix}tocar <url|busca>` — Toca ou enfileira uma música\n"
                f"`{prefix}pausar` — Pausa a reprodução\n"
                f"`{prefix}continuar` — Continua a reprodução\n"
                f"`{prefix}pular` — Pula a música atual\n"
                f"`{prefix}parar` — Para e limpa a fila\n"
                f"`{prefix}loop` — Ativa/desativa o loop\n"
                f"`{prefix}volume <0-200>` — Define o volume\n"
                f"`{prefix}tocando` — Exibe a música atual\n"
            ),
            inline=False,
        )

        embed.add_field(
            name="📋 Fila",
            value=(
                f"`{prefix}fila` — Exibe a fila\n"
                f"`{prefix}remover <pos>` — Remove uma música da fila\n"
                f"`{prefix}limpar` — Limpa a fila\n"
                f"`{prefix}buscar <termo>` — Busca e escolhe uma música\n"
            ),
            inline=False,
        )

        embed.add_field(
            name="🔌 Voz",
            value=f"`{prefix}sair` — Desconecta do canal de voz\n",
            inline=False,
        )

        embed.add_field(
            name="🛠️ Ferramentas",
            value=(
                f"`{prefix}capa <busca>` — Busca capa via Apple Music (1500×1500)\n"
                f"`{prefix}ajuda` — Exibe este menu\n"
                f"`{prefix}info` — Informações do bot\n"
                f"`{prefix}reset` — [Dono] Força o reinício do bot\n"
            ),
            inline=False,
        )

        embed.add_field(
            name="🌐 Fontes Suportadas",
            value="YouTube · SoundCloud · Bandcamp · e mais de 1000 via yt-dlp",
            inline=False,
        )

        embed.set_footer(text="wesbot · Developed by crypt0xf")
        await ctx.send(embed=embed)

    @commands.command(name="reset", aliases=["rs"])
    @commands.is_owner()
    async def reset_cmd(self, ctx: commands.Context) -> None:
        """[Dono] Força o reinício do processo do bot."""
        await ctx.send("🔄 Reiniciando...")
        logger.info("Reinício manual solicitado por %s.", ctx.author)
        os._exit(3)

    @commands.command(name="info", aliases=["sobre", "about"])
    async def info_cmd(self, ctx: commands.Context) -> None:
        """Exibe informações sobre o bot."""
        embed = discord.Embed(
            title="🤖 wesbot",
            description=(
                "Um bot de música profissional para Discord construído com **discord.py** e **yt-dlp**.\n"
                "Suporta YouTube, SoundCloud, Bandcamp e muito mais."
            ),
            color=discord.Color.blurple(),
        )
        embed.add_field(name="👨‍💻 Autor", value="crypt0xf", inline=True)
        embed.add_field(name="📦 Biblioteca", value="discord.py", inline=True)
        embed.add_field(name="🎵 Backend", value="yt-dlp + FFmpeg", inline=True)
        embed.add_field(
            name="🖼️ Capas",
            value="Apple Music / iTunes Search API",
            inline=True,
        )
        embed.add_field(
            name="🏓 Latência",
            value=f"{round(self.bot.latency * 1000)}ms",
            inline=True,
        )
        embed.set_footer(text="wesbot · Developed by crypt0xf")
        await ctx.send(embed=embed)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(ToolsCog(bot))
    logger.info("ToolsCog carregado com sucesso.")
