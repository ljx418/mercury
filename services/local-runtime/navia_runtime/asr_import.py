from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from navia_runtime.app import asr_model_manager
from navia_runtime.modules.media_companion.asr import AsrModelManagerError


def main() -> int:
    parser = argparse.ArgumentParser(description="Import a verified Navia ASR offline package.")
    parser.add_argument("--model", required=True, help="Immutable Navia ASR model ID.")
    parser.add_argument("--package", type=Path, required=True, help="Path to a .navia-asrpack file.")
    args = parser.parse_args()
    try:
        if not args.package.is_file():
            raise AsrModelManagerError("V3_ASR_PACKAGE_INVALID", "Offline package file does not exist.")
        _, controlled_path = asr_model_manager.create_import_path(args.model)
        shutil.copyfile(args.package, controlled_path)
        result = asr_model_manager.start_import(args.model, controlled_path, asynchronous=False)
        print(f"{result['state']}: {result['modelId']}: {result['message']}")
        return 0 if result["state"] == "ready" else 2
    except AsrModelManagerError as error:
        print(f"{error.code}: {error}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
