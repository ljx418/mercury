# Navia Local Runtime

Python FastAPI runtime for Navia V1.

Run locally:

```bash
uvicorn navia_runtime.app:app --host 127.0.0.1 --port 17861 --app-dir services/local-runtime
```

V3-1.4 manual companion setup (one-time) and daily start:

On this Windows/WSL checkout, double-click `Navia Runtime.lnk` in the repository root. The first
start asks for the 32-character ID shown for Navia at `chrome://extensions`; later starts reuse the
local `~/.navia/companion.json` pairing. The shortcut starts the Companion entrypoint rather than
the unauthenticated development Runtime.

Equivalent manual installation:

```bash
PYTHONPATH=services/local-runtime python3 services/local-runtime/scripts/install_navia_companion.py \
  --extension-id <32-character-chrome-extension-id> \
  --launcher "$HOME/Desktop/Navia-Companion.sh"
"$HOME/Desktop/Navia-Companion.sh"
```

On Windows with the Runtime in WSL, set `--launcher` to a Windows-mounted Desktop path ending in
`.cmd`. The launcher binds only `127.0.0.1`, generates a new process secret at every start, and
never writes a Runtime bearer into the launcher or companion config.

Implemented V1 endpoints:

- `GET /v1/health`
- `GET /v1/models/status`
- `POST /v1/sessions`
- `GET /v1/sessions/{session_id}`
- `POST /v1/page/context`
- `POST /v1/chat/stream`
- `GET /v1/sessions/{session_id}/trace`
- `GET /v1/agent/state`
- `GET /v1/agent/state-machine/mermaid`

Implemented V2 local evidence endpoints:

- `POST /v2/runtime/evidence`
- `GET /v2/artifacts/{artifact_id}`
- `POST /v2/snapshots/diff`
- `POST /v2/workbench`

V3-2-0a local ASR model-control endpoints:

- `GET /v1/asr/catalog`
- `GET|PATCH /v1/asr/settings`
- `POST /v1/asr/installations`
- `GET|DELETE /v1/asr/installations/{job_id}`
- `GET /v1/asr/installations/{job_id}/events`
- `DELETE /v1/asr/models/{model_id}`
- `PUT /v1/asr/models/import/{model_id}`

V3-3 visual-provider credential endpoints (exact extension origin + Companion bearer required):

- `GET /v1/vision/providers`
- `PUT|DELETE /v1/vision/providers/{provider_id}`
- `POST /v1/vision/providers/{provider_id}/test`
- `PATCH /v1/vision/providers/{provider_id}/select`

Vision API keys are never stored in SQLite. MiniMax and OpenAI use separate credential references; the selected provider/model is constrained by the Runtime catalog. Native Python runtimes use the platform keyring; the supported WSL launcher uses Windows Credential Vault through `powershell.exe`. If neither secure backend is available, provider setup fails closed.

Release builds prepare the immutable Tiny fallback outside Git, then point Runtime at the asset root:

```bash
PYTHONPATH=services/local-runtime python3 services/local-runtime/scripts/prepare_bundled_asr.py \
  --source /path/to/faster-whisper-tiny-fixed-revision \
  --output /path/to/release/bundled-asr
NAVIA_BUNDLED_ASR_ROOT=/path/to/release/bundled-asr ./scripts/start_backend.sh
```

The script verifies the frozen file set, byte lengths and SHA-256 values before publishing. Installing or loading Tiny proves only a local fallback; it does not pass V3-2 ASR quality.

The runtime must only be bound to `127.0.0.1` in local development.

Session, page, event, message, tool, artifact, budget, and checkpoint records are persisted to SQLite by default:

```text
.navia/navia.sqlite3
```

Override the database path with `NAVIA_DB_PATH` when needed.

Run tests from the repository root:

```bash
PYTHONPATH=services/local-runtime python3 -m pytest -q services/local-runtime/tests
```
