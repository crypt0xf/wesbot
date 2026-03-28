# =============================================================================
# wesbot — Logger de Terminal Profissional
# Developed by: crypt0xf
# =============================================================================
"""
Saída de terminal rica com cores ANSI, painéis estruturados, banner ASCII
e um logging.Formatter customizado — sem dependências externas.
"""

from __future__ import annotations

import logging
import os
import sys
import time
from datetime import datetime
from typing import ClassVar


# ---------------------------------------------------------------------------
# ANSI colour palette
# ---------------------------------------------------------------------------
class C:
    """Terminal colour / style escape codes."""

    RESET       = "\033[0m"
    BOLD        = "\033[1m"
    DIM         = "\033[2m"
    ITALIC      = "\033[3m"
    UNDERLINE   = "\033[4m"

    # Foreground colours
    BLACK       = "\033[30m"
    RED         = "\033[31m"
    GREEN       = "\033[32m"
    YELLOW      = "\033[33m"
    BLUE        = "\033[34m"
    MAGENTA     = "\033[35m"
    CYAN        = "\033[36m"
    WHITE       = "\033[37m"

    # Bright foreground
    BRIGHT_RED      = "\033[91m"
    BRIGHT_GREEN    = "\033[92m"
    BRIGHT_YELLOW   = "\033[93m"
    BRIGHT_BLUE     = "\033[94m"
    BRIGHT_MAGENTA  = "\033[95m"
    BRIGHT_CYAN     = "\033[96m"
    BRIGHT_WHITE    = "\033[97m"

    # Background
    BG_RED      = "\033[41m"
    BG_GREEN    = "\033[42m"
    BG_YELLOW   = "\033[43m"
    BG_BLUE     = "\033[44m"
    BG_MAGENTA  = "\033[45m"
    BG_CYAN     = "\033[46m"

    @staticmethod
    def strip(text: str) -> str:
        """Remove all ANSI codes from *text* (for file output)."""
        import re
        return re.sub(r"\033\[[0-9;]*m", "", text)

    @staticmethod
    def supported() -> bool:
        """Return True if the current terminal supports ANSI colours."""
        return (
            hasattr(sys.stdout, "isatty")
            and sys.stdout.isatty()
            and os.name != "nt"  # Windows cmd fallback
            or os.environ.get("FORCE_COLOR") == "1"
        )


# ---------------------------------------------------------------------------
# Level metadata
# ---------------------------------------------------------------------------
_LEVEL_META: dict[int, tuple[str, str, str]] = {
    # level : (label, bracket_color, icon)
    logging.DEBUG:    ("DEBUG",    C.DIM + C.CYAN,          "·"),
    logging.INFO:     ("INFO ",    C.BRIGHT_BLUE,            "▸"),
    logging.WARNING:  ("WARN ",    C.BRIGHT_YELLOW,          "▲"),
    logging.ERROR:    ("ERROR",    C.BRIGHT_RED,             "✖"),
    logging.CRITICAL: ("CRIT ",    C.BOLD + C.BG_RED + C.WHITE, "☠"),
}


# ---------------------------------------------------------------------------
# Custom formatter
# ---------------------------------------------------------------------------
class BotFormatter(logging.Formatter):
    """
    Multi-column formatter:

    HH:MM:SS  [LEVEL]  logger.name   message
    ────────  ───────  ───────────   ─────────────────────────
    12:34:56  [ INFO]  MusicBot      Logged in as Aria#0001
    """

    # Fixed column widths
    _NAME_WIDTH: ClassVar[int] = 18
    _ansi: bool

    def __init__(self, *, use_ansi: bool = True) -> None:
        super().__init__()
        self._ansi = use_ansi and C.supported()

    # ------------------------------------------------------------------
    def _col(self, text: str, color: str, width: int = 0) -> str:
        """Return *text* padded to *width*, wrapped in *color* if ANSI on."""
        padded = text.ljust(width) if width else text
        if self._ansi:
            return f"{color}{padded}{C.RESET}"
        return padded

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        label, color, icon = _LEVEL_META.get(
            record.levelno,
            ("?????", C.WHITE, "?"),
        )

        ts = datetime.fromtimestamp(record.created).strftime("%H:%M:%S")

        if self._ansi:
            time_col  = f"{C.DIM}{ts}{C.RESET}"
            badge     = f"{color}{icon} {label}{C.RESET}"
            bracket   = f"{C.DIM}[{C.RESET}{badge}{C.DIM}]{C.RESET}"
            name_col  = self._col(record.name, C.BRIGHT_CYAN, self._NAME_WIDTH)
            sep       = f"{C.DIM}│{C.RESET}"
            msg       = self._colorise_msg(record)
        else:
            time_col  = ts
            bracket   = f"[{label}]"
            name_col  = record.name.ljust(self._NAME_WIDTH)
            sep       = "│"
            msg       = record.getMessage()

        line = f" {time_col}  {bracket}  {name_col} {sep} {msg}"

        if record.exc_info:
            line += "\n" + self.formatException(record.exc_info)

        return line

    def _colorise_msg(self, record: logging.LogRecord) -> str:
        msg = record.getMessage()
        if record.levelno >= logging.CRITICAL:
            return f"{C.BOLD}{C.BRIGHT_RED}{msg}{C.RESET}"
        if record.levelno >= logging.ERROR:
            return f"{C.BRIGHT_RED}{msg}{C.RESET}"
        if record.levelno >= logging.WARNING:
            return f"{C.BRIGHT_YELLOW}{msg}{C.RESET}"
        return msg


# ---------------------------------------------------------------------------
# Colourless formatter (for log file)
# ---------------------------------------------------------------------------
class PlainFormatter(BotFormatter):
    def __init__(self) -> None:
        super().__init__(use_ansi=False)


# ---------------------------------------------------------------------------
# Logger factory
# ---------------------------------------------------------------------------
def setup_logging(log_file: str = "wesbot.log") -> logging.Logger:
    """
    Configura e retorna o logger raiz 'wesbot'.
    - Handler de console → somente WARNING e acima (terminal limpo)
    - Handler de arquivo  → DEBUG completo em texto simples
    - Bibliotecas externas → silenciadas no console
    """
    root = logging.getLogger("wesbot")
    root.setLevel(logging.DEBUG)

    # Silencia todas as bibliotecas externas
    for noisy in (
        "discord", "discord.http", "discord.gateway", "discord.client",
        "discord.voice_client", "discord.player",
        "asyncio", "yt_dlp", "aiohttp", "aiohttp.access",
        "urllib3", "urllib3.connectionpool",
    ):
        logging.getLogger(noisy).setLevel(logging.ERROR)

    # Console — apenas avisos e erros do próprio bot
    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.WARNING)
    ch.setFormatter(BotFormatter())
    root.addHandler(ch)

    # Arquivo — log completo em texto simples (UTF-8)
    fh = logging.FileHandler(log_file, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(PlainFormatter())
    root.addHandler(fh)

    return root


# ---------------------------------------------------------------------------
# Visual helpers
# ---------------------------------------------------------------------------
_W = 68   # Panel total width


def _ansi(enabled: bool = True) -> bool:
    return enabled and C.supported()


def _line(char: str = "─", width: int = _W, color: str = C.DIM) -> str:
    bar = char * width
    return f"{color}{bar}{C.RESET}" if _ansi() else bar


def print_banner() -> None:
    """Print the ASCII art startup banner."""
    use = _ansi()

    accent  = C.BRIGHT_MAGENTA if use else ""
    sub     = C.BRIGHT_CYAN    if use else ""
    dim     = C.DIM            if use else ""
    bold    = C.BOLD           if use else ""
    rst     = C.RESET          if use else ""

    banner_lines = [
        f"{accent} ██╗    ██╗███████╗███████╗██████╗  ██████╗ ████████╗{rst}",
        f"{accent} ██║    ██║██╔════╝██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝{rst}",
        f"{accent} ██║ █╗ ██║█████╗  ███████╗██████╔╝██║   ██║   ██║{rst}",
        f"{accent} ██║███╗██║██╔══╝  ╚════██║██╔══██╗██║   ██║   ██║{rst}",
        f"{accent} ╚███╔███╔╝███████╗███████║██████╔╝╚██████╔╝   ██║{rst}",
        f"{accent}  ╚══╝╚══╝ ╚══════╝╚══════╝╚═════╝  ╚═════╝    ╚═╝{rst}",
        "",
        f"{sub}{bold}         🎵  B O T   D E   M Ú S I C A   P A R A   D I S C O R D{rst}",
        f"{dim}                  Developed by crypt0xf  ·  v1.0.0{rst}",
    ]

    print()
    print(_line("═", _W, C.BRIGHT_MAGENTA if use else ""))
    for line in banner_lines:
        print(f"  {line}")
    print(_line("═", _W, C.BRIGHT_MAGENTA if use else ""))
    print()


def print_panel(title: str, rows: list[tuple[str, str]]) -> None:
    """
    Print a labelled info panel:

    ╭─ TITLE ──────────────────────────────────────╮
    │  Key            Value                        │
    │  Key            Value                        │
    ╰──────────────────────────────────────────────╯
    """
    use = _ansi()
    bdr   = C.BRIGHT_BLUE if use else ""
    ttl   = C.BOLD + C.BRIGHT_WHITE if use else ""
    key_c = C.BRIGHT_CYAN if use else ""
    val_c = C.BRIGHT_WHITE if use else ""
    rst   = C.RESET if use else ""

    inner = _W - 2  # width inside border chars

    header_text = f" {title} "
    dashes = "─" * (inner - len(header_text) - 1)
    top    = f"{bdr}╭─{ttl}{header_text}{rst}{bdr}{dashes}╮{rst}"
    bot    = f"{bdr}╰{'─' * inner}╯{rst}"
    empty  = f"{bdr}│{rst}{'': <{inner}}{bdr}│{rst}"

    print(top)
    print(empty)
    for key, val in rows:
        key_str = f"  {key_c}{key:<16}{rst}"
        val_str = f"{val_c}{val}{rst}"
        content = f"{key_str}  {val_str}"
        # Strip ANSI for width calculation
        raw_len = len(C.strip(content))
        pad = " " * max(0, inner - raw_len - 1)
        print(f"{bdr}│{rst}{content}{pad}{bdr} │{rst}")
    print(empty)
    print(bot)
    print()


def print_ready(
    username: str,
    user_id: int,
    guild_count: int,
    prefix: str,
    slash_count: int,
    latency_ms: float,
) -> None:

    print_panel(
        "Informações da Sessão",
        [
            ("Usuário",      username),
            ("ID",           str(user_id)),
            ("Servidores",   str(guild_count)),
            ("Prefixo",      prefix),
            ("Slash cmds",   str(slash_count)),
            ("Latência",     f"{latency_ms:.1f} ms"),
            ("Iniciado em",  datetime.now().strftime("%d/%m/%Y  %H:%M:%S")),
        ],
    )


def print_separator() -> None:
    print(_line("─", _W, C.DIM))
    print()
