from __future__ import annotations

import atexit
import os
import shutil
import tempfile
from pathlib import Path


# navia_runtime.app creates process-global SQLite stores at import time. Keep
# every pytest module away from the user's real .navia database, including
# legacy tests that intentionally call settings_store.clear().
_PYTEST_RUNTIME_ROOT = Path(tempfile.mkdtemp(prefix="navia-pytest-runtime-"))
os.environ["NAVIA_DB_PATH"] = str(_PYTEST_RUNTIME_ROOT / "navia.sqlite3")
os.environ.setdefault("NAVIA_MEDIA_TASK_ROOT", str(_PYTEST_RUNTIME_ROOT / "media-tasks"))
os.environ.setdefault("NAVIA_ASR_TASK_ROOT", str(_PYTEST_RUNTIME_ROOT / "media-asr-tasks"))


@atexit.register
def _cleanup_pytest_runtime_root() -> None:
    shutil.rmtree(_PYTEST_RUNTIME_ROOT, ignore_errors=True)
