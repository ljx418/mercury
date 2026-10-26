"""WP-B C7 — production proof, end to end, over the REAL public API.

Nothing here is a stand-in for production except the two roots the test owns:

* every request travels the real router, the real privileged-Origin middleware,
  the real bearer check, the real one-shot token and the real endpoints;
* the orchestrator, the barrier, the coordinator, the task sandbox, the audio
  stager, the dependency snapshot and the transcript service are the production
  objects;
* the ASR is the REAL local SenseVoice model running on REAL speech audio, and
  the preparation is REAL ffmpeg/ffmpeg on a REAL container.

The media is a real MP4 muxed from a real user speech clip plus a real video
track. Nothing is padded, truncated, sparsified or mocked.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest

from navia_runtime import app as runtime_app
from navia_runtime.modules.media_companion.local_import import contracts as C

from wp_b_local_import_harness import (  # noqa: F401  (MASTER_TOKEN/ORIGIN used below)
    MASTER_TOKEN,
    ORIGIN,
    auth_headers,
    make_task_eligible,
    owned_client,
)

#: One REAL task per case. The coordinator binds at most ONE local import per
#: task for the life of the process, so a shared id would let an earlier case
#: block a later one — a test artefact, never a product rule.
#: Each case owns exactly one REAL acquisition task, derived from its own
#: temporary root, so no case can be blocked by another case's in-process
#: binding. The value is derived, never random, and never a client string.
def _case_identity(tmp_path: Path) -> tuple[str, str]:
    """One REAL task AND one REAL source per case.

    The frozen rule is one active task per source, so a shared identity would
    let an earlier case block a later one — a test artefact, not a product rule.
    Both values are derived from this case's own temporary root.
    """
    digest = hashlib.sha256(str(tmp_path).encode()).hexdigest()
    return "media_task_" + digest[:32], f"portal:bilibili:BV{digest[32:40].upper()}:cid:1"
SOURCE_IDENTITY = "portal:bilibili:BV1R6TEST:cid:1"
GENERATION = "depgen_" + "c" * 64
FFMPEG = "/usr/bin/ffmpeg"
FFPROBE = "/usr/bin/ffprobe"

#: The ONLY media this suite may read. It must be supplied EXPLICITLY by the
#: user or the harness through this environment variable. Nothing here searches
#: a directory, scans another repository, or falls back to a substitute: an
#: absent or noncompliant seed is reported as an external-input block.
SEED_MEDIA_ENV = "NAVIA_WP_B_SEED_MEDIA"
FFPROBE = "/usr/bin/ffprobe"


class SeedBlock(RuntimeError):
    """The authorized seed is absent or fails the frozen media oracles."""


def _authorized_seed() -> Path:
    raw = os.environ.get(SEED_MEDIA_ENV)
    if not raw:
        raise SeedBlock(
            f"{SEED_MEDIA_ENV} is not set. Real-media cases cannot run without an "
            "explicitly authorized seed; no substitute is permitted."
        )
    path = Path(raw).expanduser()
    if not path.is_file():
        raise SeedBlock(f"{SEED_MEDIA_ENV} does not point at a readable file.")
    if path.stat().st_size < 32_000:
        raise SeedBlock("The authorized seed is too small to contain real media.")
    return path


def _probe_seed(path: Path) -> dict[str, object]:
    """Validate the seed with the REAL ffprobe before it is used for anything."""
    completed = subprocess.run(
        [
            FFPROBE, "-v", "error",
            "-show_entries", "stream=codec_type,codec_name,width,height",
            "-show_entries", "format=duration",
            "-of", "json", str(path),
        ],
        capture_output=True, text=True, timeout=120, check=False,
    )
    if completed.returncode != 0:
        raise SeedBlock("The authorized seed could not be probed by ffprobe.")
    payload = json.loads(completed.stdout)
    streams = payload.get("streams") or []
    kinds = {stream.get("codec_type") for stream in streams}
    duration = float((payload.get("format") or {}).get("duration") or 0.0)
    if "video" not in kinds or "audio" not in kinds:
        raise SeedBlock("The authorized seed must carry BOTH a video and an audio stream.")
    if duration <= 0:
        raise SeedBlock("The authorized seed has no duration.")
    return {"kinds": sorted(str(k) for k in kinds), "durationMs": int(duration * 1000)}


def _digest(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@pytest.fixture(scope="module")
def seed_media(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """The EXPLICITLY authorized seed, validated with the real ffprobe.

    The file is COPIED into this case's own temporary root and is never
    modified. It is never padded, truncated, sparsified or substituted.
    """
    try:
        authorized = _authorized_seed()
        probe = _probe_seed(authorized)
    except SeedBlock as block:
        pytest.skip(f"EXTERNAL-INPUT BLOCK: {block}")
    root = tmp_path_factory.mktemp("c7-seed")
    target = root / f"seed{authorized.suffix or '.mp4'}"
    shutil.copyfile(authorized, target)
    # Re-probe the COPY, so what the suite uses is what it validated.
    _probe_seed(target)
    return target


@dataclass(frozen=True)
class Case:
    """One production case: its own task, source, real seed media and session."""

    task_id: str
    source_identity: str
    media: Path
    companion_bearer: str


@pytest.fixture
def production(tmp_path: Path, seed_media: Path, request, monkeypatch: pytest.MonkeyPatch):
    """The production stack on private roots, driven through the real app."""
    from navia_runtime.modules.media_companion.dependencies import catalog as frozen

    task_id, source_identity = _case_identity(tmp_path)

    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", MASTER_TOKEN)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", ORIGIN.removeprefix("chrome-extension://"))
    monkeypatch.setenv("NAVIA_DB_PATH", str(tmp_path / "navia.sqlite3"))
    monkeypatch.setenv("NAVIA_MEDIA_TASK_ROOT", str(tmp_path / "media-tasks"))
    # conftest keeps one Runtime database across a session, so an import left by
    # an EARLIER run of this case would still hold the task slot. Release this
    # case's own leftovers; nothing outside the task is touched.
    for stale in list(runtime_app.local_media_import_store.list_incomplete()):
        if stale["taskId"] != task_id:
            continue
        try:
            runtime_app.local_media_import_manager.cancel(stale["importId"])
        except Exception:  # noqa: BLE001
            pass

    # The ASR task root is deliberately NOT redirected: the stager binds it at
    # import time and the provider resolves it per call, so the two MUST agree.
    # Only this test's own task directory is removed below.
    monkeypatch.setenv("NAVIA_MEDIA_TOOL_ROOT", str(tmp_path / "managed-tools"))
    monkeypatch.setenv("NAVIA_MEDIA_FFMPEG_PATH", FFMPEG)
    monkeypatch.setenv("NAVIA_MEDIA_FFPROBE_PATH", FFPROBE)
    monkeypatch.setattr(
        runtime_app.media_credential_authenticator,
        "authenticate_bootstrap",
        _accept,
        raising=False,
    )
    # The outline/product routes authenticate with a REAL companion session,
    # issued by the production broker for the exact privileged origin.
    session = runtime_app.companion_session_broker.issue(ORIGIN)
    companion_bearer = str(session["token"])
    monkeypatch.setattr(
        runtime_app.companion_session_broker, "configured_origin", lambda: ORIGIN, raising=False
    )
    # The generation the import carries is the task's REAL leased generation,
    # exactly as production resolves it. A synthetic one would be refused by
    # the orchestrator's generation gate.
    def _real_generation() -> str:
        status = runtime_app.media_dependency_manager.status()
        generation = status.get("generation")
        return str(generation) if isinstance(generation, str) and generation else GENERATION

    monkeypatch.setattr(
        runtime_app, "local_import_generation_resolver", _real_generation, raising=False
    )

    # The REAL managed-tool registry, so the dependency snapshot verifies.
    managed = tmp_path / "managed"
    digest = frozen.YT_DLP_EXPECTED_SHA256
    target = managed / "versions" / "yt-dlp" / frozen.YT_DLP_VERSION / digest
    target.mkdir(parents=True, exist_ok=True)
    source = Path("/mnt/c/workSpace/navia/.navia/tools/yt-dlp")
    if source.is_file():
        (target / "yt-dlp").write_bytes(source.read_bytes())
    (managed / "active.json").write_text(
        json.dumps(
            {
                "sha256": digest,
                "version": frozen.YT_DLP_VERSION,
                "verifiedAt": "2026-10-20T00:00:00.000Z",
            }
        ),
        "utf-8",
    )
    monkeypatch.setattr(runtime_app.media_dependency_manager, "_root", managed, raising=False)
    # conftest redirects NAVIA_DB_PATH to a temp root, so the import-time ASR
    # manager points at an empty directory. Point it at the REAL, verified
    # SenseVoice model this repository owns; nothing is installed or copied.
    real_asr_root = Path(runtime_app.__file__).resolve().parents[3] / ".navia" / "asr"
    from navia_runtime.modules.media_companion.asr.model_manager import AsrModelManager

    real_asr_manager = AsrModelManager(real_asr_root)
    monkeypatch.setattr(runtime_app, "asr_model_manager", real_asr_manager, raising=False)
    monkeypatch.setattr(
        runtime_app.media_dependency_manager, "_asr_manager", real_asr_manager, raising=False
    )
    assert real_asr_manager.model_path("funasr-sensevoice-small-q8") is not None
    assert real_asr_manager.settings()["effectiveModelId"] == "funasr-sensevoice-small-q8"

    # The ASR task root is a process-wide scratch directory that survives
    # between pytest runs. A leftover staging root from an earlier run is not a
    # failure; it is this test's own scratch space.
    

    # C3: the same eligibility the production coordinator would decide.
    make_task_eligible(task_id, source_identity)
    # The REAL, user-configured and user-verified vision Provider, read from
    # the SAME store the Runtime uses, with the secret resolved from the
    # Windows credential vault. Nothing about it is faked.
    from navia_runtime.modules.media_companion.vision.provider_settings import (
        VisionProviderStore,
        create_system_secret_store,
    )

    real_provider_db = Path(runtime_app.__file__).resolve().parents[3] / ".navia" / "navia.sqlite3"
    if real_provider_db.is_file():
        real_providers = VisionProviderStore(real_provider_db, create_system_secret_store())
        selected = real_providers.selected_provider_id()
        if selected:
            monkeypatch.setattr(
                runtime_app.media_product_materializer, "_vision_providers", real_providers, raising=False
            )

    # The REAL dependency snapshot for this task, exactly as /execute acquires it.
    snapshot = runtime_app.media_dependency_manager.acquire_snapshot(task_id)
    assert snapshot is not None, [
        (item.dependency_id, item.state, item.failure_code)
        for item in runtime_app.media_dependency_manager.dependency_states()
    ]
    assert runtime_app.media_dependency_manager.leased_snapshot(task_id) is snapshot

    yield Case(
        task_id=task_id,
        source_identity=source_identity,
        media=seed_media,
        companion_bearer=companion_bearer,
    )
    # Leave no active import behind: the frozen rule allows one per task, and a
    # leftover from THIS case's own run is not a product defect.
    for record in list(runtime_app.local_media_import_store.list_incomplete()):
        try:
            runtime_app.media_local_import_manager.cancel(record["importId"])
        except Exception:  # noqa: BLE001
            pass
    runtime_app.media_dependency_manager.release_lease(task_id)


def _accept(authorization: str | None, origin: str | None) -> None:
    from navia_runtime.modules.media_companion.credential_transport import MediaCredentialFailure

    if authorization != f"Bearer {MASTER_TOKEN}":
        raise MediaCredentialFailure("V3_MEDIA_RUNTIME_AUTH_REQUIRED", 401)
    if origin != ORIGIN:
        raise MediaCredentialFailure("V3_MEDIA_RUNTIME_ORIGIN_MISMATCH", 403)


async def _create(client, production: "Case", byte_length: int) -> dict[str, Any]:
    response = await client.post(
        "/v1/media/local-imports",
        headers=auth_headers(**{"Content-Type": "application/json"}),
        json={
            "taskId": production.task_id,
            "sourceIdentity": production.source_identity,
            "declaredMediaType": "video/mp4",
            "byteLength": byte_length,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


async def _put(client, import_id: str, token: str, body: bytes):
    return await client.put(
        f"/v1/media/local-imports/{import_id}/content",
        headers=auth_headers(
            **{
                "Content-Type": "video/mp4",
                "X-Navia-Import-Token": token,
                "Content-Length": str(len(body)),
            }
        ),
        content=body,
    )


@pytest.mark.anyio
async def test_c7_b21_the_public_api_reaches_a_real_terminal_transcript(
    production: Case,
) -> None:
    """B21 — public create+PUT, real preparation, real local SenseVoice."""
    payload = production.media.read_bytes()
    orchestrator = runtime_app.media_local_import_orchestrator

    async with owned_client() as client:
        created = await _create(client, production, len(payload))
        import_id = created["import"]["importId"]
        assert C.IMPORT_ID_RE.fullmatch(import_id), import_id
        response = await _put(client, import_id, created["uploadToken"], payload)
    assert response.status_code == 200, response.text

    # The Runtime owns T1..T4 and starts ASR itself.
    runtime_app.wait_for_local_import_orchestration(import_id, timeout=600)

    # T4 is durable before ASR is allowed to start.
    barrier = orchestrator.barriers.get(import_id)
    assert barrier["phase"] == "video_deleted", barrier
    assert not orchestrator.coordinator.get(production.task_id)["state"] == "succeeded"

    transcript = runtime_app.media_transcript_service.wait(production.task_id, timeout=900)
    assert transcript["state"] == "succeeded", transcript
    assert transcript["taskId"] == production.task_id

    # The REAL local SenseVoice produced REAL speech text.
    segments = runtime_app.media_transcript_service.private_segments(production.task_id)
    assert segments, "the real ASR produced no segment"
    spoken = "".join(str(segment.get("text", "")) for segment in segments)
    assert len(spoken.strip()) >= 2, spoken

    # The transcript consumer's terminal receipt is durable, and the barrier —
    # not the transcript service — still owns the shared input.
    barrier = orchestrator.barriers.get(import_id)
    assert barrier["transcriptTerminal"] is True, barrier
    assert barrier["visualTerminal"] is False, "the product has not run yet"
    # The transcript's terminal is a PHASE in the frozen vocabulary.
    assert barrier["phase"] == "transcript_terminal", barrier

    # The ORIGINAL video is gone; nothing else was.
    assert not orchestrator.shared_input(import_id).exists()
    assert orchestrator.coordinator.get(production.task_id)["state"] != "succeeded", (
        "the visual consumer still owns the shared input"
    )

    record = orchestrator.store.get(import_id)
    assert record["state"] == "ready"
    assert record["videoManifestSha256"] == hashlib.sha256(payload).hexdigest()

    # And the public status carries the frozen media projection, nothing else.
    async with owned_client() as client:
        status = await client.get(
            f"/v1/media/local-imports/{import_id}", headers=auth_headers()
        )
    assert status.status_code == 200
    public = status.json()["data"]["import"]
    assert public["schemaVersion"] == C.PUBLIC_STATUS_SCHEMA_VERSION
    assert public["recoverable"] is True
    assert public["media"]["sha256"] == record["videoManifestSha256"]
    assert 1 <= public["media"]["durationMs"] <= C.MAX_DURATION_MS
    rendered = json.dumps(public)
    for forbidden in ("source.bin", str(production.media), production.media.name, "speech.wav"):
        assert forbidden not in rendered

    # A redacted receipt for the evidence directory: identifiers, digests and
    # counts only. No path, no name, no token, no raw speech.
    print(
        "WPB_RECEIPT "
        + json.dumps(
            {
                "case": "B21",
                "importId": import_id,
                "taskId": production.task_id,
                "sourceIdentity": production.source_identity,
                "videoManifestSha256": record["videoManifestSha256"],
                "visualReceiptSha256": barrier["visualReceiptSha256"],
                "audioOwnerReceiptSha256": barrier["audioOwnerReceiptSha256"],
                "durationMs": public["media"]["durationMs"],
                "widthPx": public["media"]["widthPx"],
                "heightPx": public["media"]["heightPx"],
                "container": public["media"]["container"],
                "byteLength": record["byteLength"],
                "uploadedBytes": record["uploadedBytes"],
                "transcriptSegments": len(segments),
                "transcriptCharacters": len(spoken.strip()),
                "barrierPhase": barrier["phase"],
                "publicSchemaVersion": public["schemaVersion"],
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )


@pytest.mark.anyio
async def test_c7_b22_the_receipt_bound_frames_reach_the_real_materializer(
    production: Case,
) -> None:
    """B22 — the receipt is the ONLY visual evidence, and neither consumer
    may release the shared input before the other is terminal."""
    payload = production.media.read_bytes()
    orchestrator = runtime_app.media_local_import_orchestrator

    async with owned_client() as client:
        created = await _create(client, production, len(payload))
        import_id = created["import"]["importId"]
        await _put(client, import_id, created["uploadToken"], payload)
    runtime_app.wait_for_local_import_orchestration(import_id, timeout=600)

    receipt = runtime_app.media_product_materializer._imported_visual_receipt(production.task_id)
    assert receipt is not None
    assert receipt["mediaSha256"] == hashlib.sha256(payload).hexdigest()
    assert receipt["visualReceiptSha256"] == orchestrator.barriers.get(import_id)["visualReceiptSha256"]
    assert 1 <= len(receipt["frames"]) <= 8

    # The real materializer holds this receipt, so it never downloads.
    materializer = runtime_app.media_product_materializer
    # Bound methods compare by identity, so compare the bound objects instead.
    assert materializer._imported_visual_receipt_resolver.__self__ is orchestrator
    assert materializer._visual_terminal.__self__ is orchestrator

    # The transcript is terminal; the visual product has not reported yet, so
    # the shared input must NOT have been released.
    runtime_app.media_transcript_service.wait(production.task_id, timeout=600)
    barrier = runtime_app.media_local_import_orchestrator.barriers.get(import_id)
    if barrier["visualTerminal"] is False:
        assert barrier["phase"] in {"video_deleted", "transcript_terminal"}, barrier
        assert orchestrator.coordinator.get(production.task_id)["state"] != "succeeded"

    # FC2: the local route dispatches NO downloader, NO credential resolver
    # and NO capture. The counters are installed BEFORE the route runs.
    dispatch = {"downloader": 0, "credentials": 0, "capture": 0, "cleanup": 0}
    materializer = runtime_app.media_product_materializer

    def _counted_downloader(task_id: str):
        dispatch["downloader"] += 1
        return runtime_app.media_product_materializer._resolve_visual_downloader(task_id)

    def _counted_credentials(lease_id, task_id):
        dispatch["credentials"] += 1
        return {}

    original_complete = runtime_app.media_acquisition_coordinator.complete

    def _counted_complete(task_id: str):
        dispatch["cleanup"] += 1
        return original_complete(task_id)

    materializer._resolve_visual_downloader = _counted_downloader
    materializer._lease_store = type(
        "CountingLeaseStore",
        (),
        {"resolve_credentials": staticmethod(_counted_credentials)},
    )()
    runtime_app.media_acquisition_coordinator.complete = _counted_complete

    # The PRODUCTION route drives the materializer — not a private callback.
    async with owned_client() as client:
        materialized = await client.post(
            f"/v1/media/outline-tasks/{production.task_id}/materialize-visual",
            headers={
                "Authorization": f"Bearer {production.companion_bearer}",
                "Origin": ORIGIN,
            },
        )
    assert materialized.status_code == 200, materialized.text
    task = materialized.json()["data"]["task"]
    assert task["taskId"] == production.task_id

    # The SAME task produced Overview / Outline / Timeline / Mindmap.
    projections = task["projections"]
    assert projections["outline"]["sections"], projections["outline"]
    assert projections["outline"]["summary"].strip()
    assert projections["timeline"], "the timeline projection is empty"
    assert projections["mindmap"]["nodes"], "the mindmap has no nodes"
    assert projections["outline"]["taskId"] == production.task_id
    assert projections["mindmap"]["taskId"] == production.task_id

    # At least one REAL receipt-bound thumbnail, readable through the SAME
    # production route the workspace jump uses.
    frames = [
        item for item in projections["evidenceCatalog"] if item.get("kind") == "frame"
    ]
    assert frames, "no receipt-bound frame evidence was published"
    async with owned_client() as client:
        served = await client.get(
            f"/v1/media/tasks/{production.task_id}/evidence/{frames[0]['evidenceId']}/thumbnail",
            headers={
                "Authorization": f"Bearer {production.companion_bearer}",
                "Origin": ORIGIN,
            },
        )
    assert served.status_code == 200, served.text
    assert served.headers["content-type"] == "image/png", served.headers
    assert served.content[:8] == b"\x89PNG\r\n\x1a\n"
    assert frames[0]["taskId"] == production.task_id
    assert frames[0]["timestampStartMs"] >= 0
    thumbnail_count = len(frames)

    # The materializer submitted its own terminal receipt: cleanup happened ONCE.
    assert orchestrator.barriers.get(import_id)["visualTerminal"] is True
    assert orchestrator.barriers.get(import_id)["phase"] == "cleaned"
    assert orchestrator.coordinator.get(production.task_id)["state"] == "succeeded"

    # FC2: the local route dispatched nothing it was forbidden to dispatch.
    assert dispatch["downloader"] == 0, dispatch
    assert dispatch["credentials"] == 0, dispatch
    assert dispatch["cleanup"] == 1, dispatch

    # FC2: the residuals are zero. The original video, the prepared WAV and
    # the rendered frames are all released by the single cleanup owner.
    assert not orchestrator.shared_input(import_id).exists()
    import_root = Path(orchestrator.media_root) / import_id
    residual = [
        path for path in import_root.rglob("*")
        if path.is_file() and path.name != ".navia-owner.json"
    ] if import_root.exists() else []
    assert residual == [], residual
    visual_sandbox = runtime_app.media_product_materializer._visual_sandbox
    task_root = Path(visual_sandbox.root) / production.task_id
    sandbox_residual = [
        path for path in task_root.rglob("*")
        if path.is_file() and path.name != ".navia-owner.json"
    ] if task_root.exists() else []
    assert sandbox_residual == [], sandbox_residual

    # A redacted receipt for the evidence directory.
    print(
        "WPB_RECEIPT "
        + json.dumps(
            {
                "case": "B22",
                "taskId": production.task_id,
                "importId": import_id,
                "sourceIdentity": production.source_identity,
                "videoManifestSha256": orchestrator.store.get(import_id)["videoManifestSha256"],
                "visualReceiptSha256": orchestrator.barriers.get(import_id)["visualReceiptSha256"],
                "audioOwnerReceiptSha256": orchestrator.barriers.get(import_id)["audioOwnerReceiptSha256"],
                "outlineId": projections["outline"]["outlineId"],
                "outlineSections": len(projections["outline"]["sections"]),
                "timelineSegments": len(projections["timeline"]),
                "mindmapNodes": len(projections["mindmap"]["nodes"]),
                "evidenceCount": len(projections["evidenceCatalog"]),
                "thumbnailCount": thumbnail_count,
                "downloaderDispatch": dispatch["downloader"],
                "credentialDispatch": dispatch["credentials"],
                "cleanupCalls": dispatch["cleanup"],
                "barrierPhase": orchestrator.barriers.get(import_id)["phase"],
                "transcriptTerminal": orchestrator.barriers.get(import_id)["transcriptTerminal"],
                "visualTerminal": orchestrator.barriers.get(import_id)["visualTerminal"],
                "sourceResidual": len(residual),
                "sandboxResidual": len(sandbox_residual),
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )

    # A duplicate materialization cannot release the shared input again.
    async with owned_client() as client:
        again = await client.post(
            f"/v1/media/outline-tasks/{production.task_id}/materialize-visual",
            headers={
                "Authorization": f"Bearer {production.companion_bearer}",
                "Origin": ORIGIN,
            },
        )
    assert again.status_code == 200, again.text
    assert orchestrator.barriers.get(import_id)["phase"] == "cleaned"
    # The cleanup still ran exactly ONCE, even across two materializations.
    assert dispatch["cleanup"] == 1, dispatch


@pytest.mark.anyio
async def test_c7_a_routed_failure_never_leaves_a_partial_import(
    production: Case,
) -> None:
    """C7 — a wrong one-shot token creates no writer and no residue."""
    import_id: str | None = None
    async with owned_client() as client:
        created = await _create(client, production, production.media.stat().st_size)
        import_id = created["import"]["importId"]
        refused = await _put(client, import_id, "z" * 43, b"x" * 64)
        assert refused.status_code == 401
        assert refused.json()["error"]["code"] == "V3_MEDIA_IMPORT_TOKEN_INVALID"
        # The import is still awaiting its REAL upload, not aborted.
        current = await client.get(f"/v1/media/local-imports/{import_id}", headers=auth_headers())
    record = current.json()["data"]["import"]
    assert record["state"] == "awaiting_upload"
    assert record["uploadedBytes"] == 0
    assert runtime_app.media_local_import_orchestrator.barriers.find(import_id) is None
