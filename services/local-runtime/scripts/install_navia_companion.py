#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shlex
import stat
import sys
from pathlib import Path


SCRIPT = Path(__file__).resolve()
RUNTIME_ROOT = SCRIPT.parents[1]
PROJECT_ROOT = SCRIPT.parents[2]
sys.path.insert(0, str(RUNTIME_ROOT))

from navia_runtime.companion import default_config_path, write_config  # noqa: E402


def write_launcher(path: Path, project_root: Path, config_path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    command = (
        f"cd {shlex.quote(str(project_root))} && "
        f"PYTHONPATH=services/local-runtime python3 -m navia_runtime.companion "
        f"--config {shlex.quote(str(config_path))}"
    )
    if path.suffix.lower() == ".cmd":
        path.write_text(
            "@echo off\r\n"
            f"wsl.exe bash -lc {subprocess_cmd_quote(command)}\r\n"
            "if errorlevel 1 pause\r\n",
            encoding="utf-8",
        )
    else:
        path.write_text(f"#!/usr/bin/env bash\nset -euo pipefail\nexec bash -lc {shlex.quote(command)}\n", encoding="utf-8")
        path.chmod(path.stat().st_mode | stat.S_IXUSR)


def subprocess_cmd_quote(value: str) -> str:
    return '"' + value.replace('"', '\\"') + '"'


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Install a manual Navia Companion launcher.")
    parser.add_argument("--extension-id", required=True)
    parser.add_argument("--config", type=Path, default=default_config_path())
    parser.add_argument("--launcher", type=Path, required=True, help="Target .sh or Windows .cmd launcher path")
    parser.add_argument("--project-root", type=Path, default=PROJECT_ROOT)
    parser.add_argument("--port", type=int, default=17861)
    args = parser.parse_args(argv)
    write_config(args.config, args.extension_id, args.port)
    write_launcher(args.launcher, args.project_root.resolve(), args.config.resolve())
    print(f"Navia Companion launcher installed: {args.launcher}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
