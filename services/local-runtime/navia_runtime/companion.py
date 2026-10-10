from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


_EXTENSION_ID = re.compile(r"^[a-p]{32}$")


def default_config_path() -> Path:
    configured = os.environ.get("NAVIA_COMPANION_CONFIG")
    return Path(configured) if configured else Path.home() / ".navia" / "companion.json"


def write_config(path: Path, extension_id: str, port: int) -> None:
    if not _EXTENSION_ID.fullmatch(extension_id):
        raise ValueError("extension id must contain exactly 32 characters from a-p")
    if not 1024 <= port <= 65535:
        raise ValueError("port must be between 1024 and 65535")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "schemaVersion": "navia-companion-config/v1",
        "extensionId": extension_id,
        "host": "127.0.0.1",
        "port": port,
    }, indent=2) + "\n", encoding="utf-8")
    if os.name == "posix":
        path.chmod(0o600)


def read_config(path: Path) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if set(value) != {"schemaVersion", "extensionId", "host", "port"}:
        raise ValueError("companion config fields are invalid")
    if value["schemaVersion"] != "navia-companion-config/v1":
        raise ValueError("companion config version is unsupported")
    if not isinstance(value["extensionId"], str) or not _EXTENSION_ID.fullmatch(value["extensionId"]):
        raise ValueError("companion extension id is invalid")
    if value["host"] != "127.0.0.1":
        raise ValueError("companion host must be 127.0.0.1")
    if type(value["port"]) is not int or not 1024 <= value["port"] <= 65535:
        raise ValueError("companion port is invalid")
    return value


@contextmanager
def single_instance_lock(path: Path) -> Iterator[None]:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = path.open("a+")
    try:
        if os.name == "posix":
            import fcntl
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as error:
                raise RuntimeError("V3_COMPANION_ALREADY_RUNNING") from error
        else:
            import msvcrt
            try:
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError as error:
                raise RuntimeError("V3_COMPANION_ALREADY_RUNNING") from error
        yield
    finally:
        handle.close()


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Start the Navia local companion Runtime.")
    result.add_argument("--config", type=Path, default=default_config_path())
    result.add_argument("--install-extension-id")
    result.add_argument("--port", type=int, default=17861)
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if args.install_extension_id:
        write_config(args.config, args.install_extension_id, args.port)
        print(f"Navia companion configured at {args.config}")
        return 0
    try:
        config = read_config(args.config)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Navia companion is not configured: {error}", file=sys.stderr)
        return 2
    os.environ["NAVIA_LOCAL_FILES_EXTENSION_ID"] = str(config["extensionId"])
    os.environ["NAVIA_LOCAL_FILES_TOKEN"] = secrets.token_urlsafe(48)
    os.environ["NAVIA_COMPANION_ALLOW_STOP"] = "1"
    try:
        with single_instance_lock(args.config.with_suffix(".lock")):
            import uvicorn
            uvicorn.run(
                "navia_runtime.app:app",
                host="127.0.0.1",
                port=int(config["port"]),
                log_level="info",
                timeout_graceful_shutdown=3,
            )
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
