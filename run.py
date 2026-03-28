# =============================================================================
# wesbot — Watcher de Hot Reload
# Developed by: archwes
# =============================================================================
"""
Executa main.py como subprocesso e reinicia automaticamente ao detectar
alterações em arquivos .py. Use este script como ponto de entrada principal.

    python run.py

Códigos de saída do subprocesso:
    0  → encerramento limpo (não reinicia)
    3  → reinício solicitado via !reset (reinicia)
    *  → crash / erro (reinicia)
"""

import os
import pathlib
import subprocess
import sys
import time

POLL_INTERVAL: float = 1.0   # segundos entre verificações de arquivo
RESTART_CODE: int    = 3     # exit code que sinaliza reinício intencional


def _get_mtimes() -> dict[str, float]:
    mtimes: dict[str, float] = {}
    for p in pathlib.Path(".").rglob("*.py"):
        if "__pycache__" not in str(p):
            try:
                mtimes[str(p)] = p.stat().st_mtime
            except OSError:
                pass
    return mtimes


def _start() -> subprocess.Popen:
    return subprocess.Popen([sys.executable, "main.py"])


def _stop(proc: subprocess.Popen) -> None:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


def main() -> None:
    print("[wesbot] Iniciando...")

    proc   = _start()
    mtimes = _get_mtimes()

    try:
        while True:
            time.sleep(POLL_INTERVAL)

            rc = proc.poll()
            if rc is not None:
                if rc == 0:
                    return
                label = "Reinício solicitado" if rc == RESTART_CODE else f"Encerrado inesperadamente (código {rc})"
                print(f"[wesbot] {label} — reiniciando...")
                proc   = _start()
                mtimes = _get_mtimes()
                continue

            new_mtimes = _get_mtimes()
            changed = [p for p, t in new_mtimes.items() if mtimes.get(p) != t]
            if changed:
                print(f"[wesbot] Alteração detectada em: {', '.join(changed)} — reiniciando...")
                _stop(proc)
                proc   = _start()
                mtimes = new_mtimes

    except KeyboardInterrupt:
        _stop(proc)

    print("[wesbot] Encerrado.")


if __name__ == "__main__":
    main()
