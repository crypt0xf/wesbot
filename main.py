# =============================================================================
# wesbot — Ponto de Entrada Principal
# Developed by: crypt0xf
# =============================================================================

import asyncio
import logging
import os
import sys

import discord
from discord.ext import commands
from dotenv import load_dotenv

from core.logger import setup_logging, print_banner, print_ready

# ---------------------------------------------------------------------------
# Logging (arquivo completo + console apenas para avisos/erros)
# ---------------------------------------------------------------------------
logger = setup_logging(log_file="wesbot.log")

# ---------------------------------------------------------------------------
# Variáveis de ambiente
# ---------------------------------------------------------------------------
load_dotenv()
TOKEN: str  = os.getenv("DISCORD_TOKEN", "")
PREFIX: str = os.getenv("COMMAND_PREFIX", "!")

# ---------------------------------------------------------------------------
# Intents e bot
# ---------------------------------------------------------------------------
intents = discord.Intents.default()
intents.message_content = True
intents.voice_states    = True
intents.guilds          = True

bot = commands.Bot(
    command_prefix=PREFIX,
    intents=intents,
    help_command=None,
    case_insensitive=True,
    description="🎵 wesbot — Developed by crypt0xf",
)

# ---------------------------------------------------------------------------
# Lista de Cogs
# ---------------------------------------------------------------------------
INITIAL_COGS: list[str] = [
    "cogs.music",
    "cogs.tools",
]


# ---------------------------------------------------------------------------
# Eventos do bot
# ---------------------------------------------------------------------------
@bot.event
async def on_ready() -> None:
    """Disparado quando o bot conecta e todos os servidores estão em cache."""
    await bot.change_presence(
        activity=discord.Activity(
            type=discord.ActivityType.listening,
            name=f"{PREFIX}tocar | crypt0xf",
        )
    )

    try:
        synced = await bot.tree.sync()
        logger.info("Slash commands sincronizados — %d registrados.", len(synced))
    except Exception as exc:
        logger.warning("Falha ao sincronizar slash commands: %s", exc)
        synced = []

    print_banner()
    print_ready(
        username=str(bot.user),
        user_id=bot.user.id,
        guild_count=len(bot.guilds),
        prefix=PREFIX,
        slash_count=len(synced),
        latency_ms=bot.latency * 1000,
    )
    logger.info("Aguardando comandos com prefixo '%s'", PREFIX)


@bot.event
async def on_command_error(
    ctx: commands.Context, error: commands.CommandError
) -> None:
    """Handler global de erros para comandos de prefixo."""
    if isinstance(error, commands.CommandNotFound):
        return
    if isinstance(error, commands.MissingRequiredArgument):
        await ctx.send(
            f"⚠️ Argumento ausente: `{error.param.name}`. "
            f"Use `{PREFIX}ajuda` para mais informações.",
            delete_after=15,
        )
    elif isinstance(error, commands.NoPrivateMessage):
        await ctx.send("❌ Este comando não pode ser usado em mensagens privadas.")
    elif isinstance(error, commands.CheckFailure):
        await ctx.send("❌ Você não tem permissão para usar este comando.")
    else:
        logger.error("Erro não tratado no comando '%s': %s", ctx.command, error)
        await ctx.send(
            f"❌ Ocorreu um erro inesperado: `{error}`", delete_after=15
        )


@bot.event
async def on_guild_join(guild: discord.Guild) -> None:
    logger.info(
        "Entrou no servidor — %s (ID: %s, membros: %d)",
        guild.name, guild.id, guild.member_count,
    )


@bot.event
async def on_guild_remove(guild: discord.Guild) -> None:
    logger.warning("Saiu do servidor — %s (ID: %s)", guild.name, guild.id)


# ---------------------------------------------------------------------------
# Inicialização
# ---------------------------------------------------------------------------
async def main() -> None:
    if not TOKEN:
        print("[Bot] Erro: DISCORD_TOKEN não definido no arquivo .env")
        logger.critical("DISCORD_TOKEN ausente — configure o .env e reinicie.")
        sys.exit(1)

    os.system("cls" if os.name == "nt" else "clear")

    async with bot:
        for cog in INITIAL_COGS:
            try:
                await bot.load_extension(cog)
                logger.info("Cog carregada: %s", cog)
            except Exception as exc:
                logger.error("Falha ao carregar '%s': %s", cog, exc)

        logger.info("Conectando ao gateway do Discord…")
        await bot.start(TOKEN)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    print("\n[wesbot] Encerrado.")
