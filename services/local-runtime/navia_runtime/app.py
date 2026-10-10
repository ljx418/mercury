from __future__ import annotations

import json
import logging
import os
import secrets
import signal
import time
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, Response, StreamingResponse

from navia_runtime import __version__
from navia_runtime.contracts import AgentEventType, ErrorCode, agent_event, failure, new_id, success, utc_now
from navia_runtime.modules.adapters.runtime import AdapterRegistry, default_adapter_registry
from navia_runtime.modules.agent_loop.runtime import run_agentic_turn, run_core_provider_turn_async
from navia_runtime.modules.agent_loop.runtime.pi_sidecar_client import PiSidecarClient, PiSidecarError
from navia_runtime.modules.mindmap.runtime import generate_mindmap_payload
from navia_runtime.modules.memory.data_service_adapter import KnowledgeAdapterError, build_knowledge_adapter_from_env
from navia_runtime.modules.memory.data_service_client import DataServiceClientError
from navia_runtime.modules.memory.permissions import PermissionFailure, PermissionService
from navia_runtime.modules.memory.guards import reject_local_candidate, validate_forget_input
from navia_runtime.modules.knowledge_v3 import KnowledgeV3Error, KnowledgeV3Store
from navia_runtime.modules.media_companion.credential_transport import (
    CredentialChannelStore,
    CredentialLeaseStore,
    MAX_ENVELOPE_BODY_BYTES,
    MediaCredentialAuthenticator,
    MediaCredentialFailure,
)
from navia_runtime.modules.companion import CompanionFailure, CompanionSessionBroker
from navia_runtime.modules.media_companion.bilibili_policy import (
    BILIBILI_CREDENTIAL_ENVELOPE_POLICY,
    BILIBILI_CREDENTIAL_TRANSPORT_POLICY,
)
from navia_runtime.modules.media_companion.asr import (
    AsrModelManager,
    AsrModelManagerError,
    AsrProviderError,
    FunAsrLlamaCppProviderAdapter,
    V3_BASELINE_ASR_MODEL_ID,
)
from navia_runtime.modules.media_companion.asr.model_manager import MAX_OFFLINE_PACKAGE_BYTES
from navia_runtime.modules.media_companion.acquisition import (
    MediaAcquisitionCoordinator,
    MediaAcquisitionError,
    AcquisitionAudioRef,
    SenseVoiceTranscriptService,
    TaskAudioStager,
    TranscriptTask,
    ArtifactRef,
    TaskArtifactError,
    TaskArtifactSandbox,
    CaptureSinkFailure,
    MediaCaptureFailure,
    MediaCaptureGrantService,
    RuntimeCaptureSink,
)
from navia_runtime.modules.media_companion.acquisition.coordinator import request_from_payload
from navia_runtime.modules.media_companion.acquisition.bilibili import BilibiliMediaAcquirer
from navia_runtime.modules.media_companion.acquisition.downloaders import YtDlpMediaDownloader
from navia_runtime.modules.media_companion.transcript_projection import MediaTranscriptProjectionService
from navia_runtime.modules.media_companion.task_store import MediaTaskStore, MediaTaskStoreError
from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer
from navia_runtime.modules.media_companion.product_services import MediaAskService, MediaExportService
from navia_runtime.modules.media_companion.comprehension import MediaComprehensionService
from navia_runtime.modules.adapters.media_vision import VisionConsentStore
from navia_runtime.modules.media_companion.vision import (
    SecretStoreError,
    UnavailableSecretStore,
    VisionProviderError,
    VisionProviderAdapterRegistry,
    VisionProviderStore,
    create_system_secret_store,
)
from starlette.concurrency import run_in_threadpool
from navia_runtime.modules.page_reading.runtime import build_high_signal_page_perception
from navia_runtime.provider_settings import (
    DeepSeekProvider,
    ProviderMissingError,
    ProviderRegistry,
    ProviderSettingsError,
    SettingsStore,
)
from navia_runtime.runtime_profile import (
    DEFERRED_MESSAGE,
    detect_deferred_intent,
    resolve_context_strategy,
    resolve_profile,
)
from navia_runtime.state_machine import mermaid_graph
from navia_runtime.stores import InMemoryEventStream, SQLiteEventStore, SQLiteSessionStore
from navia_runtime.v2.artifacts import V2ArtifactStore
from navia_runtime.v2.incremental import compute_snapshot_diff
from navia_runtime.v2.runtime_evidence import run_controlled_runtime_evidence
from navia_runtime.v2.schemas import SchemaValidationError
from navia_runtime.v2.workbench import build_workbench

logger = logging.getLogger(__name__)


ALLOWED_ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}

app = FastAPI(title="Navia Local Runtime", version=__version__)


def default_db_path() -> Path:
    configured = os.environ.get("NAVIA_DB_PATH")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[3] / ".navia/navia.sqlite3"


def default_asr_bundled_root() -> Path:
    configured = os.environ.get("NAVIA_BUNDLED_ASR_ROOT")
    if configured:
        return Path(configured)
    return default_db_path().parent / "bundled-asr"


def default_asr_root() -> Path:
    configured = os.environ.get("NAVIA_ASR_ROOT")
    if configured:
        return Path(configured)
    return default_db_path().parent / "asr"


def default_media_task_root() -> Path:
    configured = os.environ.get("NAVIA_MEDIA_TASK_ROOT")
    if configured:
        return Path(configured)
    return Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "navia/media-tasks"


def default_media_asr_task_root() -> Path:
    configured = os.environ.get("NAVIA_MEDIA_ASR_TASK_ROOT")
    if configured:
        return Path(configured)
    return Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "navia/media-asr-tasks"


event_store = SQLiteEventStore(default_db_path())
event_stream = InMemoryEventStream()
session_store = SQLiteSessionStore(default_db_path())
settings_store = SettingsStore(default_db_path())
provider_registry = ProviderRegistry(settings_store)
try:
    vision_secret_store = create_system_secret_store()
except SecretStoreError:
    vision_secret_store = UnavailableSecretStore()
vision_provider_store = VisionProviderStore(
    Path(os.environ.get("NAVIA_VISION_PROVIDER_DB_PATH", default_db_path())),
    vision_secret_store,
)
vision_provider_adapter = VisionProviderAdapterRegistry()
pi_sidecar_client = PiSidecarClient()
v2_artifact_store = V2ArtifactStore(default_db_path())
knowledge_adapter = build_knowledge_adapter_from_env()
knowledge_v3_store = KnowledgeV3Store(default_db_path())
companion_session_broker = CompanionSessionBroker()
permission_service = PermissionService(knowledge_adapter, companion_session_broker.accepts)
media_credential_authenticator = MediaCredentialAuthenticator(companion_session_broker.accepts)
media_credential_channel_store = CredentialChannelStore(
    policies=(BILIBILI_CREDENTIAL_TRANSPORT_POLICY,),
)
media_credential_lease_store = CredentialLeaseStore(
    policies=(BILIBILI_CREDENTIAL_ENVELOPE_POLICY,),
)
asr_model_manager = AsrModelManager(
    default_asr_root(),
    bundled_root=default_asr_bundled_root(),
)
media_acquisition_coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(default_media_task_root()))
media_outline_task_store = MediaTaskStore(default_db_path())
media_capture_grant_service = MediaCaptureGrantService()
runtime_capture_sink = RuntimeCaptureSink(media_acquisition_coordinator.sandbox)

V3_YT_DLP_SHA256 = "1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6"
V3_FFMPEG_SHA256 = "ed16af623947494a72e284b6eb8ff225f2da22b38b5d5069c2fd4b4ba3384e41"


def build_media_downloader(
    sandbox: TaskArtifactSandbox,
    *,
    yt_dlp_path: Path | None = None,
):
    """Build the frozen local downloader for a private task sandbox."""
    yt_dlp = yt_dlp_path or Path(
        os.environ.get("NAVIA_MEDIA_YT_DLP_PATH", default_db_path().parent / "tools/yt-dlp")
    )
    ffmpeg = Path(os.environ.get("NAVIA_MEDIA_FFMPEG_PATH", "/usr/bin/ffmpeg"))
    if yt_dlp.is_file() and ffmpeg.is_file():
        try:
            return YtDlpMediaDownloader(
                sandbox,
                yt_dlp=yt_dlp,
                yt_dlp_sha256=V3_YT_DLP_SHA256,
                ffmpeg=ffmpeg,
                ffmpeg_sha256=V3_FFMPEG_SHA256,
            )
        except (OSError, MediaAcquisitionError):
            return None
    return None


def build_media_acquirers() -> dict[str, Any]:
    """Build only audited local adapters; missing tools preserve the capture fallback."""
    return {"bilibili": BilibiliMediaAcquirer(downloader=build_media_downloader(media_acquisition_coordinator.sandbox))}


def create_sensevoice_provider():
    model_root = asr_model_manager.model_path(V3_BASELINE_ASR_MODEL_ID)
    if model_root is None:
        raise AsrProviderError("V3_MEDIA_TRANSCRIPT_MODEL_MISMATCH", "Frozen SenseVoice model is not installed and verified.")
    return FunAsrLlamaCppProviderAdapter(
        model_root,
        default_media_asr_task_root(),
        model_id=V3_BASELINE_ASR_MODEL_ID,
    )


media_transcript_service = SenseVoiceTranscriptService(
    TaskAudioStager(media_acquisition_coordinator.sandbox, default_media_asr_task_root()),
    create_sensevoice_provider,
    media_acquisition_coordinator.complete,
)
media_transcript_projection_service = MediaTranscriptProjectionService(
    media_acquisition_coordinator,
    media_transcript_service,
)
media_visual_sandbox = TaskArtifactSandbox(default_media_task_root() / "visual-products")
media_vision_consent_store = VisionConsentStore(default_db_path())
media_product_materializer = MediaProductMaterializer(
    media_outline_task_store,
    media_transcript_projection_service,
    default_media_task_root() / "product-evidence",
    lease_store=media_credential_lease_store,
    visual_sandbox=media_visual_sandbox,
    visual_downloader=build_media_downloader(
        media_visual_sandbox,
        yt_dlp_path=Path(
            os.environ.get(
                "NAVIA_MEDIA_VISUAL_YT_DLP_PATH",
                os.environ.get("NAVIA_MEDIA_YT_DLP_PATH", default_db_path().parent / "tools/yt-dlp"),
            )
        ),
    ),
    vision_consent=media_vision_consent_store,
    vision_providers=vision_provider_store,
    vision_adapters=vision_provider_adapter,
)
media_ask_service = MediaAskService(
    media_outline_task_store,
    default_media_task_root() / "product-evidence",
)
media_comprehension_service = MediaComprehensionService(
    media_outline_task_store,
    default_media_task_root() / "product-evidence",
)
media_export_service = MediaExportService(
    media_outline_task_store,
    media_ask_service,
    default_media_task_root() / "product-exports",
    comprehension=media_comprehension_service,
)
runtime_projection = {"state": "waiting_user"}


@app.middleware("http")
async def origin_allowlist(request: Request, call_next):
    origin = request.headers.get("origin")
    privileged_media_path = request.url.path.startswith("/v1/media/credential-") or request.url.path.startswith("/v1/media/capture-grants")
    privileged_companion_path = request.url.path.startswith("/v1/companion/")
    privileged_vision_path = request.url.path.startswith("/v1/vision/")
    allowed_origin = media_credential_authenticator.is_exact_origin(origin) if privileged_media_path or privileged_companion_path or privileged_vision_path else is_allowed_origin(origin)
    if origin and not allowed_origin:
        if privileged_media_path:
            return media_credential_error_response(
                MediaCredentialFailure("V3_MEDIA_RUNTIME_ORIGIN_MISMATCH", 403)
            )
        if privileged_companion_path or privileged_vision_path:
            return companion_error_response(
                CompanionFailure("V3_COMPANION_ORIGIN_MISMATCH", 403), origin
            )
        return JSONResponse(
            status_code=403,
            content=failure(
                ErrorCode.RUNTIME_NOT_READY,
                "Origin is not allowed by Navia Runtime.",
                request_id=request.headers.get("x-request-id"),
                recoverable=True,
                details={"origin": origin},
            ),
        )
    if request.method == "OPTIONS":
        response = Response(status_code=204)
    else:
        knowledge_path = request.url.path.startswith("/v1/knowledge/")
        protected = request.url.path.startswith("/v1/knowledge/permissions") or (
            knowledge_path and permission_service.enabled()
            and request.url.path not in {"/v1/knowledge/status", "/v1/knowledge/workspaces"}
        )
        if protected:
            try:
                permission_service.authenticate(request.headers.get("authorization"), origin)
            except PermissionFailure as error:
                return permission_error_response(request, error)
        response = await call_next(request)
    if allowed_origin and origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,PATCH,DELETE,OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type,X-Request-Id,Authorization,Idempotency-Key"
        response.headers["Access-Control-Max-Age"] = "600"
        response.headers["Vary"] = "Origin"
    if privileged_vision_path:
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(PermissionFailure)
async def permission_exception_handler(request: Request, error: PermissionFailure):
    return permission_error_response(request, error)


def vision_error_response(error: VisionProviderError, request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=error.status,
        content={
            "ok": False,
            "data": None,
            "error": {"code": error.code, "message": str(error)},
            "requestId": request.headers.get("x-request-id"),
        },
    )


def authenticate_vision_request(request: Request) -> JSONResponse | None:
    try:
        companion_session_broker.authenticate(request.headers.get("authorization"), request.headers.get("origin"))
    except CompanionFailure as error:
        return companion_error_response(error, request.headers.get("origin"))
    return None


@app.exception_handler(DataServiceClientError)
async def data_service_client_exception_handler(request: Request, error: DataServiceClientError):
    return JSONResponse(
        status_code=error.status_code if error.status_code and error.status_code >= 400 else 503,
        content=failure(
            ErrorCode.RUNTIME_NOT_READY,
            "The configured data_service operation could not be completed.",
            request_id=request.headers.get("x-request-id"),
            details={"reason": error.code},
        ),
    )


@app.exception_handler(KnowledgeAdapterError)
async def knowledge_adapter_exception_handler(request: Request, error: KnowledgeAdapterError):
    return JSONResponse(
        status_code=error.status_code,
        content=failure(
            ErrorCode.RUNTIME_NOT_READY,
            str(error),
            request_id=request.headers.get("x-request-id"),
            details={"reason": error.code},
        ),
    )


@app.exception_handler(KnowledgeV3Error)
async def knowledge_v3_exception_handler(request: Request, error: KnowledgeV3Error):
    return JSONResponse(
        status_code=error.status,
        content={"ok": False, "data": None, "error": {"code": error.code, "message": str(error)},
                 "requestId": request.headers.get("x-request-id")},
    )


def permission_error_response(request: Request, error: PermissionFailure):
    return JSONResponse(status_code=error.status, content=failure(
        error.code, "Local file access could not be completed.",
        request_id=request.headers.get("x-request-id"), details={"reason": error.reason},
    ))


def media_credential_error_response(error: MediaCredentialFailure):
    response = JSONResponse(
        status_code=error.status,
        content={
            "ok": False,
            "error": {
                "code": error.code,
                "message": "Media credential request was rejected.",
            },
        },
    )
    response.headers["Cache-Control"] = "no-store"
    return response


def media_acquisition_error_response(error: MediaAcquisitionError, request: Request):
    response = JSONResponse(
        status_code=error.status,
        content={
            "ok": False,
            "data": None,
            "error": {
                "code": error.code,
                "message": str(error),
                "recoverable": error.status < 500,
            },
            "request_id": request.headers.get("x-request-id"),
        },
    )
    response.headers["Cache-Control"] = "no-store"
    return response


def media_outline_error_response(error: MediaTaskStoreError, request: Request):
    response = JSONResponse(
        status_code=error.status,
        content={
            "ok": False,
            "data": None,
            "error": {"code": error.code, "message": str(error), "recoverable": error.status < 500},
            "request_id": request.headers.get("x-request-id"),
        },
    )
    response.headers["Cache-Control"] = "no-store"
    return response


def media_transcript_error_response(error: AsrProviderError, request: Request):
    status = 404 if error.code == "V3_MEDIA_TRANSCRIPT_TASK_INVALID" else 409
    response = JSONResponse(
        status_code=status,
        content={
            "ok": False,
            "data": None,
            "error": {
                "code": error.code if error.code.startswith("V3_MEDIA_TRANSCRIPT_") else "V3_MEDIA_TRANSCRIPT_PROCESS_FAILED",
                "message": "Local media transcription request could not be completed.",
                "recoverable": True,
            },
            "request_id": request.headers.get("x-request-id"),
        },
    )
    response.headers["Cache-Control"] = "no-store"
    return response


def media_capture_error_response(error: MediaCaptureFailure | CaptureSinkFailure):
    status = error.status if isinstance(error, MediaCaptureFailure) else 409
    response = JSONResponse(
        status_code=status,
        content={
            "ok": False,
            "data": None,
            "error": {"code": error.code, "message": "Media capture request was rejected."},
        },
    )
    response.headers["Cache-Control"] = "no-store"
    return response


def is_allowed_origin(origin: str | None) -> bool:
    if not origin:
        return True
    if origin in ALLOWED_ORIGINS:
        return True
    return origin.startswith("chrome-extension://")


def persist_and_publish(event: dict[str, Any]) -> dict[str, Any]:
    event_store.append(event)
    event_stream.publish(event)
    if event["type"] == AgentEventType.STATE_TRANSITION.value:
        runtime_projection["state"] = event["data"]["to"]
    return event


def sse(events: Iterable[dict[str, Any]]) -> Iterable[str]:
    for event in events:
        yield f"event: {event['type']}\n"
        yield f"data: {json.dumps(event, separators=(',', ':'))}\n\n"


@app.get("/v1/health")
def health(request: Request):
    return success(
        {
            "status": "ok",
            "version": __version__,
            "runtime": "local",
        },
        request_id=request.headers.get("x-request-id"),
    )


def companion_error_response(error: CompanionFailure, origin: str | None = None) -> JSONResponse:
    import hashlib
    expected = companion_session_broker.configured_origin() or ""
    details = {
        "observedOriginSha256": hashlib.sha256((origin or "").encode("utf-8")).hexdigest(),
        "expectedOriginSha256": hashlib.sha256(expected.encode("utf-8")).hexdigest(),
    } if error.code == "V3_COMPANION_ORIGIN_MISMATCH" else {}
    response = JSONResponse(
        status_code=error.status,
        content={
            "ok": False,
            "data": None,
            "error": {"code": error.code, "message": "Companion Runtime request was rejected.", "details": details},
        },
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/v1/companion/status")
def companion_status(request: Request):
    if not companion_session_broker.is_exact_origin(request.headers.get("origin")):
        return companion_error_response(CompanionFailure("V3_COMPANION_ORIGIN_MISMATCH", 403), request.headers.get("origin"))
    response = JSONResponse(content={"ok": True, "data": companion_session_broker.status(), "error": None})
    response.headers["Cache-Control"] = "no-store"
    return response


@app.post("/v1/companion/sessions", status_code=201)
def create_companion_session(request: Request):
    try:
        session = companion_session_broker.issue(request.headers.get("origin"))
        response = JSONResponse(status_code=201, content={"ok": True, "data": session, "error": None})
        response.headers["Cache-Control"] = "no-store"
        return response
    except CompanionFailure as error:
        return companion_error_response(error, request.headers.get("origin"))


@app.delete("/v1/companion/sessions/current")
def revoke_companion_session(request: Request):
    try:
        session = companion_session_broker.revoke(
            request.headers.get("authorization"), request.headers.get("origin")
        )
        response = JSONResponse(content={"ok": True, "data": {"session": session}, "error": None})
        response.headers["Cache-Control"] = "no-store"
        return response
    except CompanionFailure as error:
        return companion_error_response(error)


def companion_shutdown_callback() -> None:
    os.kill(os.getpid(), signal.SIGTERM)


@app.post("/v1/companion/stop", status_code=202)
def stop_companion(request: Request):
    try:
        if os.environ.get("NAVIA_COMPANION_ALLOW_STOP") != "1":
            raise CompanionFailure("V3_COMPANION_STOP_REJECTED", 409)
        stop = companion_session_broker.begin_stop(
            request.headers.get("authorization"), request.headers.get("origin")
        )
        from threading import Timer
        Timer(0.2, companion_shutdown_callback).start()
        response = JSONResponse(status_code=202, content={"ok": True, "data": stop, "error": None})
        response.headers["Cache-Control"] = "no-store"
        return response
    except CompanionFailure as error:
        return companion_error_response(error)


@app.get("/v1/vision/providers")
def list_vision_providers(request: Request):
    denied = authenticate_vision_request(request)
    if denied is not None:
        return denied
    try:
        return success(
            {
                "providers": vision_provider_store.list(),
                "catalog": vision_provider_store.catalog(),
                "selectedProviderId": vision_provider_store.selected_provider_id(),
            },
            request_id=request.headers.get("x-request-id"),
        )
    except VisionProviderError as error:
        return vision_error_response(error, request)


@app.put("/v1/vision/providers/{provider_id}")
async def upsert_vision_provider(provider_id: str, request: Request):
    denied = authenticate_vision_request(request)
    if denied is not None:
        return denied
    try:
        try:
            body = await request.json()
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise VisionProviderError("VISION_PROVIDER_INVALID", "视觉 Provider 请求 JSON 无效。") from None
        if not isinstance(body, dict):
            raise VisionProviderError("VISION_PROVIDER_INVALID", "视觉 Provider 请求必须是对象。")
        provider = vision_provider_store.upsert(provider_id, body)
        return success({"provider": provider}, request_id=request.headers.get("x-request-id"))
    except VisionProviderError as error:
        return vision_error_response(error, request)


@app.post("/v1/vision/providers/{provider_id}/test")
def test_vision_provider(provider_id: str, request: Request):
    denied = authenticate_vision_request(request)
    if denied is not None:
        return denied
    try:
        provider = vision_provider_store.get(provider_id, include_secret=True)
        if provider is None:
            raise VisionProviderError("VISION_PROVIDER_MISSING", "视觉 Provider 不存在。", 404)
        result = vision_provider_adapter.test(provider)
        visible = vision_provider_store.update_test_status(provider_id, result)
        return success({"result": result, "provider": visible}, request_id=request.headers.get("x-request-id"))
    except VisionProviderError as error:
        return vision_error_response(error, request)


@app.patch("/v1/vision/providers/{provider_id}/select")
def select_vision_provider(provider_id: str, request: Request):
    denied = authenticate_vision_request(request)
    if denied is not None:
        return denied
    try:
        provider = vision_provider_store.select(provider_id)
        return success({"provider": provider, "selectedProviderId": provider_id}, request_id=request.headers.get("x-request-id"))
    except VisionProviderError as error:
        return vision_error_response(error, request)


@app.delete("/v1/vision/providers/{provider_id}")
def delete_vision_provider(provider_id: str, request: Request):
    denied = authenticate_vision_request(request)
    if denied is not None:
        return denied
    try:
        vision_provider_store.delete(provider_id)
        return success({"deleted": True, "providerId": provider_id}, request_id=request.headers.get("x-request-id"))
    except VisionProviderError as error:
        return vision_error_response(error, request)


@app.post("/v1/media/credential-channels", status_code=201)
async def create_media_credential_channel(request: Request):
    try:
        media_credential_authenticator.authenticate_bootstrap(
            request.headers.get("authorization"),
            request.headers.get("origin"),
        )
        raw = await request.body()
        if len(raw) > 4096:
            raise MediaCredentialFailure("V3_MEDIA_CHANNEL_INVALID", 400)
        try:
            body = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise MediaCredentialFailure("V3_MEDIA_CHANNEL_INVALID", 400) from None
        channel_token, channel = media_credential_channel_store.issue(
            body,
            request.headers["origin"],
        )
        response = JSONResponse(
            status_code=201,
            content={"ok": True, "data": {"channelToken": channel_token, "channel": channel}},
        )
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaCredentialFailure as error:
        return media_credential_error_response(error)


@app.post("/v1/media/credential-leases", status_code=201)
async def create_media_credential_lease(request: Request):
    try:
        authorization = request.headers.get("authorization", "")
        prefix = "Navia-Media-Channel "
        if not authorization.startswith(prefix) or len(authorization) <= len(prefix):
            raise MediaCredentialFailure("V3_MEDIA_CHANNEL_INVALID", 401)
        channel = media_credential_channel_store.consume(authorization.removeprefix(prefix))
        raw = await request.body()
        if len(raw) > MAX_ENVELOPE_BODY_BYTES:
            raise MediaCredentialFailure("V3_MEDIA_ENVELOPE_TOO_LARGE", 413)
        try:
            envelope = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise MediaCredentialFailure("V3_MEDIA_ENVELOPE_INVALID", 400) from None
        revocation_token, lease = media_credential_lease_store.issue(channel, envelope)
        response = JSONResponse(
            status_code=201,
            content={
                "ok": True,
                "data": {"lease": lease, "revocationToken": revocation_token},
            },
        )
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaCredentialFailure as error:
        return media_credential_error_response(error)


@app.delete("/v1/media/credential-leases/{lease_id}")
async def revoke_media_credential_lease(lease_id: str, request: Request):
    try:
        authorization = request.headers.get("authorization", "")
        prefix = "Navia-Media-Revoke "
        if not authorization.startswith(prefix) or len(authorization) <= len(prefix):
            raise MediaCredentialFailure("V3_MEDIA_LEASE_REVOKED", 403)
        lease = media_credential_lease_store.revoke(
            lease_id,
            authorization.removeprefix(prefix),
        )
        response = JSONResponse(status_code=200, content={"ok": True, "data": {"lease": lease}})
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaCredentialFailure as error:
        return media_credential_error_response(error)


CAPTURE_GRANT_REQUEST_FIELDS = {
    "taskId", "adapterId", "pageIdentitySha256", "tabId", "tabIdSha256", "surface",
}


@app.post("/v1/media/capture-grants", status_code=201)
async def create_media_capture_grant(request: Request):
    try:
        media_credential_authenticator.authenticate_bootstrap(
            request.headers.get("authorization"), request.headers.get("origin")
        )
        raw = await request.body()
        if len(raw) > 4096:
            raise MediaCaptureFailure("V3_MEDIA_CAPTURE_BINDING_INVALID", 413)
        try:
            body = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise MediaCaptureFailure("V3_MEDIA_CAPTURE_BINDING_INVALID", 400) from None
        if not isinstance(body, dict) or set(body) != CAPTURE_GRANT_REQUEST_FIELDS:
            raise MediaCaptureFailure("V3_MEDIA_CAPTURE_BINDING_INVALID", 400)
        eligibility = media_acquisition_coordinator.capture_eligibility(body["taskId"])
        if not eligibility["captureFallbackEligible"]:
            raise MediaCaptureFailure("V3_MEDIA_CAPTURE_NOT_ELIGIBLE", 409)
        ticket, grant = media_capture_grant_service.issue(body)
        media_acquisition_coordinator.bind_capture_grant(body["taskId"], grant["grantId"])
        response = JSONResponse(status_code=201, content={"ok": True, "data": {"grant": grant, "ticket": ticket}})
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaCredentialFailure as error:
        return media_credential_error_response(error)
    except MediaCaptureFailure as error:
        return media_capture_error_response(error)
    except MediaAcquisitionError as error:
        return media_capture_error_response(MediaCaptureFailure(error.code, error.status))


@app.get("/v1/media/capture-grants/{grant_id}")
def get_media_capture_grant(grant_id: str):
    grant = media_capture_grant_service.public_record(grant_id)
    if grant is None:
        return media_capture_error_response(MediaCaptureFailure("V3_MEDIA_CAPTURE_GRANT_INVALID", 404))
    response = JSONResponse(content={"ok": True, "data": {"grant": grant}})
    response.headers["Cache-Control"] = "no-store"
    return response


@app.delete("/v1/media/capture-grants/{grant_id}")
def revoke_media_capture_grant(grant_id: str):
    try:
        grant = media_capture_grant_service.revoke(grant_id)
        cleanup = runtime_capture_sink.abort()
        response = JSONResponse(content={"ok": True, "data": {"grant": grant, "cleanup": cleanup}})
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaCaptureFailure as error:
        return media_capture_error_response(error)


CAPTURE_START_FIELDS = {
    "type", "ticket", "taskId", "adapterId", "pageIdentitySha256", "tabId", "tabIdSha256",
    "surface", "sourceIdentity", "acquisitionRecordId", "sampleRateHz", "channels", "sampleWidthBytes",
}


@app.websocket("/v1/media/capture-stream")
async def media_capture_stream(websocket: WebSocket):
    origin = websocket.headers.get("origin")
    if not media_credential_authenticator.is_exact_origin(origin):
        await websocket.close(code=4403, reason="V3_MEDIA_CAPTURE_ORIGIN_MISMATCH")
        return
    await websocket.accept()
    terminal = False
    try:
        start = await websocket.receive_json()
        if not isinstance(start, dict) or set(start) != CAPTURE_START_FIELDS or start.get("type") != "start":
            raise MediaCaptureFailure("V3_MEDIA_CAPTURE_BINDING_INVALID", 400)
        binding = {key: start[key] for key in CAPTURE_GRANT_REQUEST_FIELDS}
        grant = media_capture_grant_service.consume(start["ticket"], binding)
        runtime_capture_sink.begin(
            task_id=start["taskId"],
            source_identity=start["sourceIdentity"],
            acquisition_record_id=start["acquisitionRecordId"],
            grant=grant,
            sample_rate_hz=start["sampleRateHz"],
            channels=start["channels"],
            sample_width_bytes=start["sampleWidthBytes"],
        )
        await websocket.send_json({"type": "started", "grant": grant})
        sequence = 0
        while True:
            message = await websocket.receive()
            if message.get("bytes") is not None:
                observation = runtime_capture_sink.write(sequence, message["bytes"])
                await websocket.send_json({"type": "chunkAccepted", "observation": observation})
                sequence += 1
                continue
            text = message.get("text")
            if text is None:
                raise CaptureSinkFailure("V3_MEDIA_CAPTURE_STREAM_INVALID")
            try:
                command = json.loads(text)
            except json.JSONDecodeError:
                raise CaptureSinkFailure("V3_MEDIA_CAPTURE_STREAM_INVALID") from None
            if command == {"type": "stop", "reason": "completed"}:
                reference, capture = runtime_capture_sink.finalize()
                logger.warning(
                    "V3 capture finalized task=%s capturedMs=%s chunks=%s nonZeroSamples=%s peakAbsSample=%s",
                    start["taskId"], capture["capturedMs"], capture["chunkCount"],
                    capture["nonZeroSampleCount"], capture["peakAbsSample"],
                )
                terminal = True
                transcript = media_transcript_service.create(TranscriptTask(reference))
                transcript = await run_in_threadpool(media_transcript_service.start, transcript["taskId"])
                await websocket.send_json({
                    "type": "completed",
                    "capture": capture,
                    "transcript": transcript,
                    "stop": {
                        "reason": "completed", "terminalStatus": "succeeded",
                        "tracksStopped": True, "socketClosed": True, "offscreenClosed": True,
                        "sinkClosed": True, "activeCaptureCount": 0, "residualRawAudioCount": 0,
                        "stoppedAt": utc_now(), "failureCode": None,
                    },
                })
                await websocket.close(code=1000)
                return
            if command.get("type") == "stop" and command.get("reason") in {
                "cancelled", "navigation", "tab_closed", "consent_revoked", "runtime_disconnected", "timeout", "failed"
            } and set(command) == {"type", "reason"}:
                cleanup = runtime_capture_sink.abort()
                terminal = True
                await websocket.send_json({"type": "cancelled", "reason": command["reason"], "cleanup": cleanup})
                await websocket.close(code=1000)
                return
            raise CaptureSinkFailure("V3_MEDIA_CAPTURE_STREAM_INVALID")
    except WebSocketDisconnect:
        pass
    except (MediaCaptureFailure, CaptureSinkFailure) as error:
        try:
            await websocket.send_json({"type": "failed", "failureCode": error.code})
            await websocket.close(code=4409)
        except RuntimeError:
            pass
    finally:
        if not terminal:
            runtime_capture_sink.abort()


@app.get("/v1/models/status")
def models_status(request: Request):
    asr_settings = asr_model_manager.settings()
    return success(
        {
            "intent": {"status": "ready", "mode": "rule_based", "provider": "rule-based"},
            "mindmap": {"status": "ready", "mode": "deterministic", "provider": "deterministic-fallback"},
            "llm": {"status": "ready", "mode": "deterministic", "provider": "deterministic-reading-tools"},
            "asr": {
                "status": "ready" if asr_settings["effectiveModelId"] else "unavailable",
                "mode": "local_provider_catalog",
                "endpoint": "local",
                "requestedModelId": asr_settings["requestedModelId"],
                "effectiveModelId": asr_settings["effectiveModelId"],
                "fallbackActive": asr_settings["fallbackActive"],
                "fallbackReason": asr_settings["fallbackReason"],
            },
        },
        request_id=request.headers.get("x-request-id"),
    )


MEDIA_ACQUISITION_REQUEST_FIELDS = {
    "taskId", "sourceIdentity", "adapterId", "mediaId", "playbackUnitId", "partId",
    "consentPolicyId", "consentPolicyRevision",
}


@app.post("/v1/media/acquisitions", status_code=201)
async def create_media_acquisition(request: Request):
    try:
        body = await request_json_or_empty(request)
        if set(body) != MEDIA_ACQUISITION_REQUEST_FIELDS:
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Media acquisition request fields do not match the frozen contract.")
        task = media_acquisition_coordinator.create(request_from_payload(body))
        response = JSONResponse(status_code=201, content=success({"task": task}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except (KeyError, TypeError, ValueError):
        return media_acquisition_error_response(MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Media acquisition request is invalid."), request)
    except MediaAcquisitionError as error:
        return media_acquisition_error_response(error, request)


@app.get("/v1/media/acquisitions/{task_id}")
def get_media_acquisition(task_id: str, request: Request):
    try:
        response = JSONResponse(content=success({"task": media_acquisition_coordinator.get(task_id)}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaAcquisitionError as error:
        return media_acquisition_error_response(error, request)


@app.post("/v1/media/acquisitions/{task_id}/execute")
async def execute_media_acquisition(task_id: str, request: Request):
    try:
        media_credential_authenticator.authenticate_bootstrap(
            request.headers.get("authorization"), request.headers.get("origin")
        )
        if await request.body():
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Execute does not accept a request body.")
        result = await run_in_threadpool(
            media_acquisition_coordinator.acquire_input,
            task_id,
            lease_store=media_credential_lease_store,
            acquirers=build_media_acquirers(),
            preserve_expected_failures=True,
        )
        if result.get("outcome") == "awaiting_public_subtitle":
            outcome = result
        else:
            transcript = None
            if result.get("route") == "credentialed_media_asr":
                reference = media_acquisition_coordinator.audio_reference(task_id)
                transcript = media_transcript_service.create(TranscriptTask(reference))
                transcript = media_transcript_service.start(transcript["taskId"])
            elif result.get("route") == "credentialed_subtitle":
                media_acquisition_coordinator.complete(task_id)
            outcome = {
                "outcome": "input_acquired",
                "input": result,
                "failures": media_acquisition_coordinator.capture_eligibility(task_id)["failures"],
                "transcript": transcript,
            }
        response = JSONResponse(content={"ok": True, "data": {"task": media_acquisition_coordinator.get(task_id), **outcome}})
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaCredentialFailure as error:
        return media_credential_error_response(error)
    except TaskArtifactError as error:
        return media_acquisition_error_response(
            MediaAcquisitionError(error.code, str(error), status=500), request
        )
    except MediaAcquisitionError as error:
        return media_acquisition_error_response(error, request)


@app.get("/v1/media/task-projections")
def get_latest_media_task_projection(sourceIdentity: str, request: Request):
    try:
        media_credential_authenticator.authenticate_bootstrap(
            request.headers.get("authorization"), request.headers.get("origin")
        )
        projection = media_transcript_projection_service.latest_for_source(sourceIdentity)
        response = JSONResponse(content=success({"projection": projection}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaCredentialFailure as error:
        return media_credential_error_response(error)
    except MediaAcquisitionError as error:
        return media_acquisition_error_response(error, request)


@app.get("/v1/media/task-projections/{task_id}")
def get_media_task_projection(task_id: str, request: Request):
    try:
        media_credential_authenticator.authenticate_bootstrap(
            request.headers.get("authorization"), request.headers.get("origin")
        )
        projection = media_transcript_projection_service.get(task_id)
        response = JSONResponse(content=success({"projection": projection}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaCredentialFailure as error:
        return media_credential_error_response(error)
    except MediaAcquisitionError as error:
        return media_acquisition_error_response(error, request)


@app.delete("/v1/media/task-projections/{task_id}")
def cancel_media_task_projection(task_id: str, request: Request):
    try:
        media_credential_authenticator.authenticate_bootstrap(
            request.headers.get("authorization"), request.headers.get("origin")
        )
        try:
            transcript = media_transcript_service.get(task_id)
        except AsrProviderError:
            transcript = None
        if transcript is not None and transcript["state"] not in {"succeeded", "failed", "cancelled"}:
            media_transcript_service.cancel(task_id)
        elif media_acquisition_coordinator.get(task_id)["state"] not in {
            "succeeded", "degraded", "blocked", "failed", "cancelled"
        }:
            media_acquisition_coordinator.cancel(task_id)
        projection = media_transcript_projection_service.get(task_id)
        response = JSONResponse(content=success({"projection": projection}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaCredentialFailure as error:
        return media_credential_error_response(error)
    except MediaAcquisitionError as error:
        return media_acquisition_error_response(error, request)


def authenticate_media_outline_request(request: Request) -> JSONResponse | None:
    try:
        companion_session_broker.authenticate(request.headers.get("authorization"), request.headers.get("origin"))
    except CompanionFailure as error:
        return companion_error_response(error, request.headers.get("origin"))
    return None


@app.post("/v1/media/outline-tasks", status_code=201)
async def create_media_outline_task(request: Request):
    denied = authenticate_media_outline_request(request)
    if denied is not None:
        return denied
    try:
        body = await request_json_or_empty(request)
        if set(body) != {"sourceIdentity"} or not isinstance(body.get("sourceIdentity"), str):
            raise MediaTaskStoreError("TASK_IDENTITY_MISMATCH", "Only sourceIdentity may be submitted.")
        task_id = f"media_task_{secrets.token_hex(16)}"
        task = media_outline_task_store.create(task_id, body["sourceIdentity"])
        response = JSONResponse(status_code=201, content=success({"task": task}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaTaskStoreError as error:
        return media_outline_error_response(error, request)


@app.get("/v1/media/outline-tasks")
def get_media_outline_tasks(request: Request, sourceIdentity: str | None = None, limit: int = 50):
    denied = authenticate_media_outline_request(request)
    if denied is not None:
        return denied
    try:
        data = (
            {"task": media_outline_task_store.latest_for_source(sourceIdentity)}
            if sourceIdentity is not None
            else {"tasks": media_outline_task_store.list_tasks(limit=limit)}
        )
        response = JSONResponse(content=success(data, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaTaskStoreError as error:
        return media_outline_error_response(error, request)


@app.get("/v1/media/outline-tasks/{task_id}")
def get_media_outline_task(task_id: str, request: Request):
    denied = authenticate_media_outline_request(request)
    if denied is not None:
        return denied
    try:
        response = JSONResponse(content=success({"task": media_outline_task_store.get(task_id)}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaTaskStoreError as error:
        return media_outline_error_response(error, request)


@app.get("/v1/media/tasks/{task_id}/comprehension")
def get_media_workspace_comprehension(task_id: str, request: Request, revision: int | None = None):
    denied = authenticate_media_outline_request(request)
    if denied is not None:
        return denied
    try:
        projection = media_comprehension_service.get(task_id, revision)
        response = JSONResponse(content=success({"projection": projection}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaTaskStoreError as error:
        return media_outline_error_response(error, request)


@app.get("/v1/media/tasks/{task_id}/evidence/{evidence_id}/thumbnail")
def get_media_workspace_thumbnail(task_id: str, evidence_id: str, request: Request):
    denied = authenticate_media_outline_request(request)
    if denied is not None:
        return denied
    try:
        thumbnail = media_comprehension_service.thumbnail(task_id, evidence_id)
        response = Response(content=thumbnail.read_bytes(), media_type="image/png")
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response
    except MediaTaskStoreError as error:
        return media_outline_error_response(error, request)


@app.post("/v1/media/outline-tasks/{task_id}/materialize")
async def materialize_media_outline_task(task_id: str, request: Request):
    denied = authenticate_media_outline_request(request)
    if denied is not None:
        return denied
    try:
        if await request.body():
            raise MediaTaskStoreError("TASK_IDENTITY_MISMATCH", "Materialize does not accept a request body.")
        task = await run_in_threadpool(media_product_materializer.materialize, task_id)
        response = JSONResponse(content=success({"task": task}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except (MediaTaskStoreError, MediaAcquisitionError) as error:
        return media_outline_error_response(error, request)


@app.post("/v1/media/outline-tasks/{task_id}/materialize-visual")
async def materialize_visual_media_outline_task(task_id: str, request: Request):
    denied = authenticate_media_outline_request(request)
    if denied is not None:
        return denied
    try:
        body = await request_json_or_empty(request)
        if set(body) != {"credentialLeaseId"} or not isinstance(body.get("credentialLeaseId"), str):
            raise MediaTaskStoreError("TASK_IDENTITY_MISMATCH", "A task-bound credential lease is required.")
        task = await run_in_threadpool(
            media_product_materializer.materialize_visual,
            task_id,
            body["credentialLeaseId"],
        )
        response = JSONResponse(content=success({"task": task}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaCredentialFailure as error:
        return media_credential_error_response(error)
    except (MediaTaskStoreError, MediaAcquisitionError) as error:
        return media_outline_error_response(error, request)


@app.post("/v1/media/outline-tasks/{task_id}/ask")
async def ask_media_outline_task(task_id: str, request: Request):
    denied = authenticate_media_outline_request(request)
    if denied is not None:
        return denied
    try:
        body = await request_json_or_empty(request)
        if set(body) != {"expectedRevision", "question"} or type(body.get("expectedRevision")) is not int:
            raise MediaTaskStoreError("ASK_QUESTION_INVALID", "expectedRevision and question are required.")
        result = await run_in_threadpool(
            media_ask_service.ask,
            task_id,
            body["expectedRevision"],
            body.get("question"),
        )
        response = JSONResponse(content=success({"result": result}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaTaskStoreError as error:
        return media_outline_error_response(error, request)


@app.get("/v1/media/outline-tasks/{task_id}/asks")
def get_media_outline_task_asks(task_id: str, request: Request, revision: int):
    denied = authenticate_media_outline_request(request)
    if denied is not None:
        return denied
    try:
        task = media_outline_task_store.get(task_id)
        if task["revision"] != revision:
            raise MediaTaskStoreError("TASK_REVISION_CONFLICT", "Task revision changed.", status=409)
        results = media_ask_service.list_results(task_id, revision)
        response = JSONResponse(content=success({"results": results}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaTaskStoreError as error:
        return media_outline_error_response(error, request)


@app.post("/v1/media/outline-tasks/{task_id}/exports")
async def export_media_outline_task(task_id: str, request: Request):
    denied = authenticate_media_outline_request(request)
    if denied is not None:
        return denied
    try:
        body = await request_json_or_empty(request)
        if set(body) != {"expectedRevision", "format"} or type(body.get("expectedRevision")) is not int:
            raise MediaTaskStoreError("EXPORT_FORMAT_INVALID", "expectedRevision and format are required.")
        manifest = await run_in_threadpool(
            media_export_service.create,
            task_id,
            body["expectedRevision"],
            body.get("format"),
        )
        response = JSONResponse(content=success({"manifest": manifest}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaTaskStoreError as error:
        return media_outline_error_response(error, request)


@app.get("/v1/media/outline-tasks/{task_id}/exports/{export_id}")
def download_media_outline_export(task_id: str, export_id: str, request: Request):
    denied = authenticate_media_outline_request(request)
    if denied is not None:
        return denied
    try:
        artifact, media_type = media_export_service.artifact(task_id, export_id)
        response = Response(content=artifact.read_bytes(), media_type=media_type)
        response.headers["Content-Disposition"] = f'attachment; filename="{artifact.name}"'
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaTaskStoreError as error:
        return media_outline_error_response(error, request)


@app.post("/v1/media/outline-tasks/{task_id}/cancel")
async def cancel_media_outline_task(task_id: str, request: Request):
    denied = authenticate_media_outline_request(request)
    if denied is not None:
        return denied
    try:
        body = await request_json_or_empty(request)
        if set(body) != {"expectedRevision"} or type(body.get("expectedRevision")) is not int:
            raise MediaTaskStoreError("TASK_REVISION_CONFLICT", "expectedRevision is required.")
        task = media_outline_task_store.cancel(task_id, body["expectedRevision"])
        return success({"task": task}, request_id=request.headers.get("x-request-id"))
    except MediaTaskStoreError as error:
        return media_outline_error_response(error, request)


@app.post("/v1/media/outline-tasks/{task_id}/retry")
async def retry_media_outline_task(task_id: str, request: Request):
    denied = authenticate_media_outline_request(request)
    if denied is not None:
        return denied
    try:
        body = await request_json_or_empty(request)
        if set(body) != {"expectedRevision"} or type(body.get("expectedRevision")) is not int:
            raise MediaTaskStoreError("TASK_REVISION_CONFLICT", "expectedRevision is required.")
        task = media_outline_task_store.retry(task_id, body["expectedRevision"])
        return success({"task": task}, request_id=request.headers.get("x-request-id"))
    except MediaTaskStoreError as error:
        return media_outline_error_response(error, request)


@app.delete("/v1/media/acquisitions/{task_id}")
def cancel_media_acquisition(task_id: str, request: Request):
    try:
        response = JSONResponse(content=success({"task": media_acquisition_coordinator.cancel(task_id)}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaAcquisitionError as error:
        return media_acquisition_error_response(error, request)


@app.post("/v1/media/capture-eligibility/{task_id}/failures")
async def record_media_capture_route_failure(task_id: str, request: Request):
    try:
        media_credential_authenticator.authenticate_bootstrap(
            request.headers.get("authorization"), request.headers.get("origin")
        )
        body = await request_json_or_empty(request)
        if set(body) != {"route", "failureCode"}:
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Route failure fields do not match the contract.")
        if body["route"] != "public_or_page_subtitle":
            raise MediaAcquisitionError(
                "V3_MEDIA_ROUTE_ORDER_INVALID",
                "Credentialed route failures are authored only by Runtime execution.",
                status=403,
            )
        result = media_acquisition_coordinator.record_route_failure(task_id, body["route"], body["failureCode"])
        response = JSONResponse(content={"ok": True, "data": result})
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaCredentialFailure as error:
        return media_credential_error_response(error)
    except (KeyError, TypeError, ValueError):
        return media_acquisition_error_response(MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Route failure is invalid."), request)
    except MediaAcquisitionError as error:
        return media_acquisition_error_response(error, request)


@app.get("/v1/media/capture-eligibility/{task_id}")
def get_media_capture_eligibility(task_id: str, request: Request):
    try:
        media_credential_authenticator.authenticate_bootstrap(
            request.headers.get("authorization"), request.headers.get("origin")
        )
        response = JSONResponse(content={"ok": True, "data": media_acquisition_coordinator.capture_eligibility(task_id)})
        response.headers["Cache-Control"] = "no-store"
        return response
    except MediaCredentialFailure as error:
        return media_credential_error_response(error)
    except MediaAcquisitionError as error:
        return media_acquisition_error_response(error, request)


MEDIA_TRANSCRIPT_REQUEST_FIELDS = {
    "taskId", "sourceIdentity", "acquisitionRecordId", "artifact", "durationMs",
    "sampleRateHz", "channels", "sampleWidthBytes",
}
MEDIA_TRANSCRIPT_ARTIFACT_FIELDS = {"artifactId", "kind", "byteLength", "sha256"}


@app.post("/v1/media/transcripts", status_code=202)
async def create_media_transcript(request: Request):
    try:
        body = await request_json_or_empty(request)
        artifact = body.get("artifact")
        if set(body) != MEDIA_TRANSCRIPT_REQUEST_FIELDS or not isinstance(artifact, dict) or set(artifact) != MEDIA_TRANSCRIPT_ARTIFACT_FIELDS:
            raise AsrProviderError("V3_MEDIA_TRANSCRIPT_TASK_INVALID", "Transcript request fields do not match the frozen contract.")
        reference = AcquisitionAudioRef(
            task_id=body["taskId"],
            source_identity=body["sourceIdentity"],
            acquisition_record_id=body["acquisitionRecordId"],
            artifact=ArtifactRef(
                task_id=body["taskId"],
                artifact_id=artifact["artifactId"],
                kind=artifact["kind"],
                byte_length=artifact["byteLength"],
                sha256=artifact["sha256"],
            ),
            duration_ms=body["durationMs"],
            sample_rate_hz=body["sampleRateHz"],
            channels=body["channels"],
            sample_width_bytes=body["sampleWidthBytes"],
        )
        task = media_transcript_service.create(TranscriptTask(reference))
        task = media_transcript_service.start(task["taskId"])
        response = JSONResponse(status_code=202, content=success({"task": task}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except (KeyError, TypeError, ValueError):
        return media_transcript_error_response(AsrProviderError("V3_MEDIA_TRANSCRIPT_TASK_INVALID", "Transcript request is invalid."), request)
    except AsrProviderError as error:
        return media_transcript_error_response(error, request)


@app.get("/v1/media/transcripts/{task_id}")
def get_media_transcript(task_id: str, request: Request):
    try:
        task = media_transcript_service.get(task_id)
        data: dict[str, Any] = {"task": task}
        if task["state"] == "succeeded":
            data["segments"] = media_transcript_service.private_segments(task_id)
        response = JSONResponse(content=success(data, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except AsrProviderError as error:
        return media_transcript_error_response(error, request)


@app.delete("/v1/media/transcripts/{task_id}")
def cancel_media_transcript(task_id: str, request: Request):
    try:
        response = JSONResponse(content=success({"task": media_transcript_service.cancel(task_id)}, request_id=request.headers.get("x-request-id")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except AsrProviderError as error:
        return media_transcript_error_response(error, request)


@app.get("/v1/asr/catalog")
def get_asr_catalog(request: Request):
    return success(asr_model_manager.catalog(), request_id=request.headers.get("x-request-id"))


@app.get("/v1/asr/settings")
def get_asr_settings(request: Request):
    return success(asr_model_manager.settings(), request_id=request.headers.get("x-request-id"))


@app.patch("/v1/asr/settings")
async def patch_asr_settings(request: Request):
    try:
        body = await request_json_or_empty(request)
        if set(body) != {"requestedModelId"}:
            raise AsrModelManagerError("V3_ASR_REQUEST_INVALID", "Only requestedModelId may be changed.")
        return success(asr_model_manager.patch_settings(body), request_id=request.headers.get("x-request-id"))
    except AsrModelManagerError as error:
        return asr_model_error_response(error, request)


@app.post("/v1/asr/installations", status_code=202)
async def create_asr_installation(request: Request):
    try:
        body = await request_json_or_empty(request)
        if set(body) != {"modelId"}:
            raise AsrModelManagerError("V3_ASR_REQUEST_INVALID", "Only an allowlisted modelId may be submitted.")
        model_id = body.get("modelId")
        if not isinstance(model_id, str) or not model_id:
            raise AsrModelManagerError("V3_ASR_MODEL_REQUIRED", "modelId is required.")
        job = asr_model_manager.start_install(model_id)
        return JSONResponse(status_code=202, content=success({"job": job}, request_id=request.headers.get("x-request-id")))
    except AsrModelManagerError as error:
        return asr_model_error_response(error, request)


@app.get("/v1/asr/installations/{job_id}")
def get_asr_installation(job_id: str, request: Request):
    try:
        return success({"job": asr_model_manager.get_job(job_id)}, request_id=request.headers.get("x-request-id"))
    except AsrModelManagerError as error:
        return asr_model_error_response(error, request)


@app.get("/v1/asr/installations/{job_id}/events")
def stream_asr_installation(job_id: str, request: Request):
    try:
        asr_model_manager.get_job(job_id)
    except AsrModelManagerError as error:
        return asr_model_error_response(error, request)

    def events():
        last_sequence = -1
        while True:
            job = asr_model_manager.get_job(job_id)
            sequence = int(job.get("sequence", 0))
            if sequence != last_sequence:
                yield f"event: installation\ndata: {json.dumps(job, separators=(',', ':'))}\n\n"
                last_sequence = sequence
            if job.get("state") in {"ready", "failed", "corrupt", "cancelled"}:
                break
            time.sleep(0.2)

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-store"})


@app.delete("/v1/asr/installations/{job_id}")
def cancel_asr_installation(job_id: str, request: Request):
    try:
        return success({"job": asr_model_manager.cancel_job(job_id)}, request_id=request.headers.get("x-request-id"))
    except AsrModelManagerError as error:
        return asr_model_error_response(error, request)


@app.delete("/v1/asr/models/{model_id}")
def uninstall_asr_model(model_id: str, request: Request):
    try:
        return success(asr_model_manager.uninstall(model_id), request_id=request.headers.get("x-request-id"))
    except AsrModelManagerError as error:
        return asr_model_error_response(error, request)


@app.put("/v1/asr/models/import/{model_id}", status_code=202)
async def import_asr_model(model_id: str, request: Request):
    package_path: Path | None = None
    try:
        _, package_path = asr_model_manager.create_import_path(model_id)
        received = 0
        with package_path.open("xb") as output:
            try:
                package_path.chmod(0o600)
            except OSError:
                pass
            async for chunk in request.stream():
                received += len(chunk)
                if received > MAX_OFFLINE_PACKAGE_BYTES:
                    raise AsrModelManagerError("V3_ASR_PACKAGE_TOO_LARGE", "Offline ASR package exceeds the size limit.", status=413)
                output.write(chunk)
        if received == 0:
            raise AsrModelManagerError("V3_ASR_PACKAGE_INVALID", "Offline ASR package is empty.")
        job = asr_model_manager.start_import(model_id, package_path)
        return JSONResponse(status_code=202, content=success({"job": job}, request_id=request.headers.get("x-request-id")))
    except AsrModelManagerError as error:
        if package_path:
            package_path.unlink(missing_ok=True)
        return asr_model_error_response(error, request)


@app.get("/v1/pi/sidecar/health")
def pi_sidecar_health(request: Request):
    request_id = request.headers.get("x-request-id")
    try:
        health_payload = pi_sidecar_client.health()
        return success(
            {
                "status": "ok",
                "provider": "piagent",
                "sidecar": "reachable",
                "health": health_payload if isinstance(health_payload, dict) else {},
                "checkedAt": utc_now(),
            },
            request_id=request_id,
        )
    except PiSidecarError:
        return success(
            {
                "status": "unavailable",
                "provider": "piagent",
                "sidecar": "unreachable",
                "recoverable": True,
                "code": "piagent_sidecar_unavailable",
                "message": "Pi Sidecar 未启动或暂不可用。",
                "nextSteps": ["启动 Pi Sidecar", "检查 DeepSeek Provider / model", "或在 Settings 中手动切换到 LLM Direct"],
                "checkedAt": utc_now(),
            },
            request_id=request_id,
        )


@app.get("/v1/settings")
def get_settings(request: Request):
    return success(settings_store.get_settings(), request_id=request.headers.get("x-request-id"))


@app.patch("/v1/settings")
async def patch_settings(request: Request):
    body = await request.json()
    try:
        return success(settings_store.patch_settings(body), request_id=request.headers.get("x-request-id"))
    except ProviderSettingsError as exc:
        return provider_failure_response(exc, request)


@app.get("/v1/llm/providers")
def list_llm_providers(request: Request):
    return success({"providers": settings_store.list_providers()}, request_id=request.headers.get("x-request-id"))


@app.post("/v1/llm/providers")
async def create_llm_provider(request: Request):
    body = await request.json()
    return await import_llm_provider_body(body, request)


@app.patch("/v1/llm/providers")
async def patch_llm_provider_from_body(request: Request):
    body = await request.json()
    provider_id = body.get("id")
    if not isinstance(provider_id, str) or not provider_id:
        return provider_failure_response(
            ProviderSettingsError("Provider id is required.", code="provider_missing"),
            request,
        )
    try:
        provider = settings_store.patch_provider(provider_id, body)
        return success({"provider": provider, "settings": settings_store.get_settings()}, request_id=request.headers.get("x-request-id"))
    except ProviderSettingsError as exc:
        return provider_failure_response(exc, request)


@app.patch("/v1/llm/providers/{provider_id}")
async def patch_llm_provider(provider_id: str, request: Request):
    body = await request.json()
    try:
        provider = settings_store.patch_provider(provider_id, body)
        return success({"provider": provider, "settings": settings_store.get_settings()}, request_id=request.headers.get("x-request-id"))
    except ProviderSettingsError as exc:
        return provider_failure_response(exc, request)


@app.delete("/v1/llm/providers")
async def delete_llm_provider_from_body(request: Request):
    body = await request.json()
    provider_id = body.get("id")
    if not isinstance(provider_id, str) or not provider_id:
        return provider_failure_response(
            ProviderSettingsError("Provider id is required.", code="provider_missing"),
            request,
        )
    try:
        return success(settings_store.delete_provider(provider_id), request_id=request.headers.get("x-request-id"))
    except ProviderSettingsError as exc:
        return provider_failure_response(exc, request)


@app.delete("/v1/llm/providers/{provider_id}")
def delete_llm_provider(provider_id: str, request: Request):
    try:
        return success(settings_store.delete_provider(provider_id), request_id=request.headers.get("x-request-id"))
    except ProviderSettingsError as exc:
        return provider_failure_response(exc, request)


@app.post("/v1/llm/providers/import")
async def import_llm_provider(request: Request):
    body = await request.json()
    return await import_llm_provider_body(body, request)


@app.post("/v1/llm/providers/{provider_id}/test")
def test_llm_provider(provider_id: str, request: Request):
    provider = settings_store.get_provider(provider_id, include_secret=True)
    if not provider:
        return provider_failure_response(ProviderMissingError(), request)
    try:
        test_result = DeepSeekProvider(provider, provider_registry.client_factory).test()
        visible_provider = settings_store.update_test_status(provider_id, test_result)
        return success({"result": test_result, "provider": visible_provider}, request_id=request.headers.get("x-request-id"))
    except ProviderSettingsError as exc:
        return provider_failure_response(exc, request)
    except RuntimeError as exc:
        error_result = {"status": "error", "message": str(exc), "latencyMs": 0}
        visible_provider = settings_store.update_test_status(provider_id, error_result)
        return success({"result": error_result, "provider": visible_provider}, request_id=request.headers.get("x-request-id"))


@app.post("/v1/sessions")
async def create_session(request: Request):
    body = await request.json()
    session = session_store.create(new_id("sess_"), utc_now(), metadata=body.get("metadata", {}))
    return success(
        {
            "session_id": session["session_id"],
            "created_at": session["created_at"],
        },
        request_id=request.headers.get("x-request-id"),
    )


@app.get("/v1/chat/sessions")
def list_chat_sessions(request: Request):
    sessions = [chat_session_summary(session) for session in session_store.list_sessions(include_archived=False)]
    return success({"sessions": sessions}, request_id=request.headers.get("x-request-id"))


@app.post("/v1/chat/sessions")
async def create_chat_session(request: Request):
    body = await request_json_or_empty(request)
    metadata = {
        "title": normalize_session_title(body.get("title")) or "新会话",
        "profile": normalize_session_profile(body.get("profile")),
        "archived": False,
        "source": body.get("source") or "sidepanel",
        "messageCount": 0,
    }
    page_ref = normalize_page_ref(body.get("pageRef"))
    if page_ref:
        metadata["pageRef"] = page_ref
    session = session_store.create(new_id("sess_"), utc_now(), metadata=metadata)
    return success({"session": chat_session_summary(session)}, request_id=request.headers.get("x-request-id"))


@app.get("/v1/chat/sessions/{session_id}")
def get_chat_session(session_id: str, request: Request):
    record = session_store.get_session_record(session_id)
    if not record:
        return JSONResponse(
            status_code=404,
            content=failure(ErrorCode.SESSION_NOT_FOUND, "Session not found.", request_id=request.headers.get("x-request-id")),
        )
    return success({"session": chat_session_summary(record)}, request_id=request.headers.get("x-request-id"))


@app.patch("/v1/chat/sessions/{session_id}")
async def patch_chat_session(session_id: str, request: Request):
    body = await request_json_or_empty(request)
    if not session_store.exists(session_id):
        return JSONResponse(
            status_code=404,
            content=failure(ErrorCode.SESSION_NOT_FOUND, "Session not found.", request_id=request.headers.get("x-request-id")),
        )
    metadata: dict[str, Any] = {}
    page_ref = normalize_page_ref(body.get("pageRef"))
    if page_ref:
        metadata["pageRef"] = page_ref
    session = session_store.update_session(
        session_id,
        title=normalize_session_title(body.get("title")) if "title" in body else None,
        profile=normalize_session_profile(body.get("profile")) if "profile" in body else None,
        archived=bool(body.get("archived")) if "archived" in body else None,
        metadata=metadata or None,
    )
    return success({"session": chat_session_summary(session or {})}, request_id=request.headers.get("x-request-id"))


@app.delete("/v1/chat/sessions/{session_id}")
def delete_chat_session(session_id: str, request: Request):
    if not session_store.exists(session_id):
        return JSONResponse(
            status_code=404,
            content=failure(ErrorCode.SESSION_NOT_FOUND, "Session not found.", request_id=request.headers.get("x-request-id")),
        )
    session = session_store.update_session(session_id, archived=True)
    return success({"session": chat_session_summary(session or {})}, request_id=request.headers.get("x-request-id"))


@app.get("/v1/chat/sessions/{session_id}/messages")
def get_chat_session_messages(session_id: str, request: Request):
    record = session_store.get_session_record(session_id)
    if not record:
        return JSONResponse(
            status_code=404,
            content=failure(ErrorCode.SESSION_NOT_FOUND, "Session not found.", request_id=request.headers.get("x-request-id")),
        )
    return success(
        {
            "session": chat_session_summary(record),
            "messages": chat_message_records(record),
            "artifacts": record.get("artifacts", []),
        },
        request_id=request.headers.get("x-request-id"),
    )


@app.get("/v1/sessions/{session_id}")
def get_session(session_id: str, request: Request):
    record = session_store.get_session_record(session_id)
    if not record:
        return JSONResponse(
            status_code=404,
            content=failure(ErrorCode.SESSION_NOT_FOUND, "Session not found.", request_id=request.headers.get("x-request-id")),
        )
    active_page = record.get("active_page") if isinstance(record.get("active_page"), dict) else None
    return success(
        {
            "session_id": record["session_id"],
            "created_at": record["created_at"],
            "updated_at": record["updated_at"],
            "metadata": record.get("metadata", {}),
            "activePage": {
                "page_id": active_page.get("page_id"),
                "url": active_page.get("url"),
                "title": active_page.get("title"),
                "domain": active_page.get("domain"),
                "content_hash": active_page.get("content_hash"),
                "captured_at": active_page.get("captured_at"),
                "perception": active_page.get("perception"),
            }
            if active_page
            else None,
            "messages": record.get("messages", []),
            "artifacts": record.get("artifacts", []),
            "toolCalls": record.get("tool_calls", []),
            "budgetLedger": record.get("budget_ledger", []),
            "checkpoints": record.get("checkpoints", []),
        },
        request_id=request.headers.get("x-request-id"),
    )


@app.post("/v1/page/context")
async def page_context(request: Request):
    body = await request.json()
    request_id = request.headers.get("x-request-id") or new_id("req_")
    session_id = body.get("session_id")
    if not isinstance(session_id, str) or not session_store.exists(session_id):
        return JSONResponse(
            status_code=404,
            content=failure(ErrorCode.SESSION_NOT_FOUND, "Session not found.", request_id=request_id),
        )

    missing_fields = [
        field
        for field in ["url", "title", "domain"]
        if not isinstance(body.get(field), str) or not body.get(field)
    ]
    if missing_fields:
        return JSONResponse(
            status_code=400,
            content=failure(
                ErrorCode.REQUEST_INVALID,
                "Page context is missing required fields.",
                request_id=request_id,
                recoverable=True,
                details={"missing_fields": missing_fields},
            ),
        )

    perception_result = build_high_signal_page_perception(page_reading_input(session_id, body))
    if not perception_result["ok"]:
        return JSONResponse(
            status_code=400,
            content=failure(
                ErrorCode.PAGE_CONTEXT_REQUIRED,
                perception_result["error"]["message"],
                request_id=request_id,
                recoverable=True,
                details={"source": "page_reading"},
            ),
        )
    page = with_legacy_page_aliases(perception_result["structuredPage"], body)
    structured_page_snapshot = dict(page)
    page["perception"] = {
        "structuredPage": structured_page_snapshot,
        "highSignalPage": perception_result["highSignalPage"],
        "perceptionDigest": perception_result["perceptionDigest"],
        "sourceMap": perception_result["sourceMap"],
        "qualityReport": perception_result["qualityReport"],
        "candidateExtraction": perception_result.get("candidateExtraction"),
    }
    page["highSignalPage"] = perception_result["highSignalPage"]
    page["perceptionDigest"] = perception_result["perceptionDigest"]
    page["sourceMap"] = perception_result["sourceMap"]
    page["qualityReport"] = perception_result["qualityReport"]
    page_id = page["page_id"]
    content_hash = page["content_hash"]
    session_store.set_active_page(session_id, page)
    persist_and_publish(
        agent_event(
            AgentEventType.PAGE_CONTEXT_RECEIVED,
            session_id=session_id,
            request_id=request_id,
            data={"page_id": page_id, "content_hash": content_hash, "url": page["url"]},
        )
    )
    return success(
        {
            "page_id": page_id,
            "content_hash": content_hash,
            "status": "accepted",
            "structuredPage": page,
            "highSignalPage": perception_result["highSignalPage"],
            "perceptionDigest": perception_result["perceptionDigest"],
            "sourceMap": perception_result["sourceMap"],
            "qualityReport": perception_result["qualityReport"],
            "perception": page["perception"],
        },
        request_id=request_id,
    )


@app.post("/v1/chat/stream")
async def chat_stream(request: Request):
    body = await request.json()
    request_id = body.get("request_id") or request.headers.get("x-request-id") or new_id("req_")
    session_id = resolve_chat_stream_session_id(body)
    if not isinstance(session_id, str) or not session_id.startswith("sess_"):
        err = agent_event(
            AgentEventType.ERROR,
            session_id=session_id or "sess_invalid",
            request_id=request_id,
            data={"code": ErrorCode.SESSION_NOT_FOUND.value, "message": "session_id is invalid"},
        )
        persist_and_publish(err)
        return StreamingResponse(sse([err]), media_type="text/event-stream")

    if not session_store.exists(session_id):
        err = agent_event(
            AgentEventType.ERROR,
            session_id=session_id,
            request_id=request_id,
            data={"code": ErrorCode.SESSION_NOT_FOUND.value, "message": "Session not found."},
        )
        persist_and_publish(err)
        return StreamingResponse(sse([err]), media_type="text/event-stream")

    message = str(body.get("message") or "")
    active_page = session_store.get_active_page(session_id)
    intent = detect_chat_intent(message, body)
    maybe_update_session_title(session_id, message, intent, active_page)
    settings_snapshot = settings_store.get_settings()
    profile_resolution = resolve_profile(settings_snapshot, body)
    deferred_intent = detect_deferred_intent(message, body.get("intentHint") if isinstance(body.get("intentHint"), str) else None)
    if deferred_intent:
        events = deferred_intent_events(session_id, request_id, deferred_intent)
        persist_turn_result(session_id, message, turn_result_from_events(events, status="deferred"))
        for event in events:
            persist_and_publish(event)
        return StreamingResponse(sse(events), media_type="text/event-stream")
    if profile_resolution.profile == "agent":
        events = agent_profile_preflight_events(session_id, request_id)
        persist_turn_result(session_id, message, turn_result_from_events(events, status="deferred"))
        for event in events:
            persist_and_publish(event)
        return StreamingResponse(sse(events), media_type="text/event-stream")
    context_strategy = resolve_context_strategy(intent, message)
    if context_strategy.type == "page_context" and body.get("autoContext") is True and active_page is None:
        err = page_context_auto_capture_event(session_id, request_id)
        persist_and_publish(err)
        return StreamingResponse(sse([err]), media_type="text/event-stream")
    if body.get("coreProvider") == "mock" and intent in {"summarize_page", "mindmap_page", "explain_selection", "page_qa"}:
        result = run_agentic_turn(
            {
                "sessionId": session_id,
                "requestId": request_id,
                "userMessage": message,
                "activePage": active_page,
                "recentMessages": normalize_recent_messages(session_store.get_session_record(session_id)),
                "budget": body.get("budget") if isinstance(body.get("budget"), dict) else {},
                "adapterRegistry": integration_adapter_registry(),
                "forceAdapterId": "fixture.denied" if is_high_risk_message(message) else body.get("forceAdapterId"),
            }
        )
        persist_turn_result(session_id, message, result)
        for event in result["events"]:
            persist_and_publish(event)
        return StreamingResponse(sse(result["events"]), media_type="text/event-stream")
    if is_explicit_core_provider_request(body):
        core_config_or_error = resolve_core_config(body, session_id=session_id, request_id=request_id)
        if isinstance(core_config_or_error, dict) and "provider" in core_config_or_error:
            result = await run_core_provider_turn_async(
                {
                    "sessionId": session_id,
                    "requestId": request_id,
                    "userMessage": message,
                    "activePage": active_page,
                    "recentMessages": normalize_recent_messages(session_store.get_session_record(session_id)),
                    "budget": body.get("budget") if isinstance(body.get("budget"), dict) else {},
                    "coreConfig": {**core_config_or_error, "mode": "reading" if active_page else "chat"},
                }
            )
            persist_turn_result(session_id, message, result)
            for event in result["events"]:
                persist_and_publish(event)
            return StreamingResponse(sse(result["events"]), media_type="text/event-stream")
        if isinstance(core_config_or_error, dict):
            err = core_config_or_error
            persist_and_publish(err)
            return StreamingResponse(sse([err]), media_type="text/event-stream")

    if should_use_agentic_tools(message, body, intent=intent, active_page=active_page):
        result = run_agentic_turn(
            {
                "sessionId": session_id,
                "requestId": request_id,
                "userMessage": message,
                "activePage": active_page,
                "recentMessages": normalize_recent_messages(session_store.get_session_record(session_id)),
                "budget": body.get("budget") if isinstance(body.get("budget"), dict) else {},
                "adapterRegistry": integration_adapter_registry(),
                "forceAdapterId": "fixture.denied" if is_high_risk_message(message) else body.get("forceAdapterId"),
            }
        )
        persist_turn_result(session_id, message, result)
        for event in result["events"]:
            persist_and_publish(event)
        return StreamingResponse(sse(result["events"]), media_type="text/event-stream")

    return StreamingResponse(sse(stream_llm_turn(session_id, request_id, message, active_page)), media_type="text/event-stream")


@app.get("/v1/sessions/{session_id}/trace")
def session_trace(session_id: str, request: Request, turn_id: str | None = None):
    events = event_store.list_by_session(session_id)
    if turn_id is not None:
        events = [event for event in events if event.get("turn_id") == turn_id]
    return success(
        {
            "session_id": session_id,
            "turn_id": turn_id,
            "events": events,
        },
        request_id=request.headers.get("x-request-id"),
    )


@app.get("/v1/agent/state")
def agent_state(request: Request):
    return success({"state": runtime_projection["state"]}, request_id=request.headers.get("x-request-id"))


@app.get("/v1/agent/state-machine/mermaid")
def state_machine_mermaid(request: Request):
    return success({"mermaid": mermaid_graph()}, request_id=request.headers.get("x-request-id"))


@app.get("/v1/knowledge/status")
def knowledge_status(request: Request):
    return success(knowledge_adapter.status(), request_id=request.headers.get("x-request-id"))


@app.get("/v1/knowledge/workspaces")
def knowledge_workspaces(request: Request):
    return success(knowledge_adapter.list_workspaces(), request_id=request.headers.get("x-request-id"))


@app.get("/v1/knowledge/sources")
def knowledge_sources(request: Request, workspaceId: str):
    return success(knowledge_adapter.list_sources(workspaceId), request_id=request.headers.get("x-request-id"))


@app.post("/v1/knowledge/sources")
async def knowledge_save_source(request: Request):
    idempotency_key = request.headers.get("Idempotency-Key")
    if not isinstance(idempotency_key, str) or len(idempotency_key) < 8:
        return JSONResponse(
            status_code=400,
            content=failure(
                ErrorCode.REQUEST_INVALID,
                "Idempotency-Key header is required for V2 knowledge source save.",
                request_id=request.headers.get("x-request-id"),
                details={"header": "Idempotency-Key"},
            ),
        )
    body = await request_json_or_empty(request)
    reject_local_candidate(body, idempotency_key)
    missing = [field for field in ["candidateId", "workspaceId", "sourceType", "createdAt"] if not body.get(field)]
    if missing:
        return JSONResponse(
            status_code=400,
            content=failure(
                ErrorCode.REQUEST_INVALID,
                "MemoryCandidate is missing required fields.",
                request_id=request.headers.get("x-request-id"),
                details={"missing": missing},
            ),
        )
    result = knowledge_adapter.save_source(body, idempotency_key=idempotency_key)
    return JSONResponse(
        status_code=202,
        content=success(result, request_id=request.headers.get("x-request-id")),
    )


@app.get("/v1/knowledge/sources/{sourceId}")
def knowledge_source(sourceId: str, request: Request):
    source = knowledge_adapter.get_source(sourceId)
    if source is None:
        return JSONResponse(
            status_code=404,
            content=failure(ErrorCode.ARTIFACT_NOT_FOUND, "Knowledge source not found.", request_id=request.headers.get("x-request-id")),
        )
    return success({"source": source}, request_id=request.headers.get("x-request-id"))


@app.get("/v1/knowledge/operations/{operationId}")
def knowledge_operation(operationId: str, request: Request):
    operation = knowledge_adapter.get_operation(operationId)
    if operation is None:
        return JSONResponse(
            status_code=404,
            content=failure(ErrorCode.ARTIFACT_NOT_FOUND, "Knowledge operation not found.", request_id=request.headers.get("x-request-id")),
        )
    return success({"operation": operation}, request_id=request.headers.get("x-request-id"))


@app.post("/v1/knowledge/query")
async def knowledge_query(request: Request):
    body = await request_json_or_empty(request)
    workspace_id = body.get("workspaceId")
    question = body.get("question")
    if not isinstance(workspace_id, str) or not isinstance(question, str) or not question.strip():
        return JSONResponse(
            status_code=400,
            content=failure(
                ErrorCode.REQUEST_INVALID,
                "workspaceId and question are required.",
                request_id=request.headers.get("x-request-id"),
            ),
        )
    source_ids = body.get("sourceIds") if isinstance(body.get("sourceIds"), list) else None
    return success(knowledge_adapter.query(workspace_id, question, source_ids), request_id=request.headers.get("x-request-id"))


@app.get("/v1/knowledge/graph")
def knowledge_graph(request: Request, workspaceId: str):
    return success(knowledge_adapter.graph(workspaceId), request_id=request.headers.get("x-request-id"))


@app.get("/v1/knowledge/source/{sourceId}/trace")
def knowledge_source_trace(sourceId: str, request: Request):
    trace = knowledge_adapter.trace(sourceId)
    if trace is None:
        return JSONResponse(
            status_code=404,
            content=failure(ErrorCode.ARTIFACT_NOT_FOUND, "Knowledge source not found.", request_id=request.headers.get("x-request-id")),
        )
    return success(trace, request_id=request.headers.get("x-request-id"))


@app.post("/v1/knowledge/permissions")
async def knowledge_grant_permission(request: Request):
    return JSONResponse(
        status_code=202,
        content=success(permission_service.grant(await request_json_or_empty(request)), request_id=request.headers.get("x-request-id")),
    )


@app.get("/v1/knowledge/permissions")
def knowledge_list_permissions(request: Request, workspaceId: str):
    return success(permission_service.list(workspaceId), request_id=request.headers.get("x-request-id"))


@app.post("/v1/knowledge/permissions/{permissionRootId}/scan")
async def knowledge_scan_permission(permissionRootId: str, request: Request):
    body = await request_json_or_empty(request)
    if set(body) != {"workspaceId"} or not isinstance(body["workspaceId"], str) or not body["workspaceId"]:
        raise PermissionFailure("invalid_request", 400)
    result = await run_in_threadpool(permission_service.scan, permissionRootId, body["workspaceId"])
    return success(result, request_id=request.headers.get("x-request-id"))


@app.post("/v1/knowledge/permissions/{permissionRootId}/imports")
async def knowledge_import_permission(permissionRootId: str, request: Request):
    result = await run_in_threadpool(permission_service.import_files, permissionRootId,
                                    await request_json_or_empty(request), request.headers.get("idempotency-key", ""))
    return JSONResponse(status_code=202, content=success(result, request_id=request.headers.get("x-request-id")))


@app.delete("/v1/knowledge/permissions/{permissionRootId}")
def knowledge_revoke_permission(permissionRootId: str, request: Request):
    result = permission_service.revoke(permissionRootId)
    return JSONResponse(status_code=202, content=success(result, request_id=request.headers.get("x-request-id")))


@app.post("/v1/knowledge/sources/{sourceId}/forget")
async def knowledge_forget_source(sourceId: str, request: Request):
    body = await request_json_or_empty(request)
    validate_forget_input(body)
    result = knowledge_adapter.forget_source(sourceId, body)
    if result is None:
        return JSONResponse(
            status_code=404,
            content=failure(ErrorCode.ARTIFACT_NOT_FOUND, "Knowledge source not found.", request_id=request.headers.get("x-request-id")),
        )
    return JSONResponse(status_code=202, content=success(result, request_id=request.headers.get("x-request-id")))


@app.post("/v3/knowledge/drafts")
async def v3_knowledge_create_draft(request: Request):
    auth_error = authenticate_vision_request(request)
    if auth_error is not None:
        return auth_error
    draft = knowledge_v3_store.create_draft(await request_json_or_empty(request))
    return JSONResponse(status_code=201, content=success({"draft": draft}, request_id=request.headers.get("x-request-id")))


@app.get("/v3/knowledge/drafts/{draftId}")
def v3_knowledge_get_draft(draftId: str, request: Request):
    auth_error = authenticate_vision_request(request)
    if auth_error is not None:
        return auth_error
    return success({"draft": knowledge_v3_store.get_draft(draftId)}, request_id=request.headers.get("x-request-id"))


@app.patch("/v3/knowledge/drafts/{draftId}")
async def v3_knowledge_update_draft(draftId: str, request: Request):
    auth_error = authenticate_vision_request(request)
    if auth_error is not None:
        return auth_error
    draft = knowledge_v3_store.update_draft(draftId, await request_json_or_empty(request))
    return success({"draft": draft}, request_id=request.headers.get("x-request-id"))


@app.post("/v3/knowledge/drafts/{draftId}/cancel")
def v3_knowledge_cancel_draft(draftId: str, request: Request):
    auth_error = authenticate_vision_request(request)
    if auth_error is not None:
        return auth_error
    return success({"draft": knowledge_v3_store.cancel_draft(draftId)}, request_id=request.headers.get("x-request-id"))


@app.post("/v3/knowledge/drafts/{draftId}/save")
def v3_knowledge_save_draft(draftId: str, request: Request):
    auth_error = authenticate_vision_request(request)
    if auth_error is not None:
        return auth_error
    return success(knowledge_v3_store.save_draft(draftId), request_id=request.headers.get("x-request-id"))


@app.get("/v3/knowledge/items")
def v3_knowledge_list_items(request: Request, sort: str = "updated_desc"):
    auth_error = authenticate_vision_request(request)
    if auth_error is not None:
        return auth_error
    return success({"items": knowledge_v3_store.list_items(sort=sort)}, request_id=request.headers.get("x-request-id"))


@app.get("/v3/knowledge/items/{itemId}")
def v3_knowledge_get_item(itemId: str, request: Request):
    auth_error = authenticate_vision_request(request)
    if auth_error is not None:
        return auth_error
    return success({"item": knowledge_v3_store.get_item(itemId)}, request_id=request.headers.get("x-request-id"))


@app.patch("/v3/knowledge/items/{itemId}")
async def v3_knowledge_update_item(itemId: str, request: Request):
    auth_error = authenticate_vision_request(request)
    if auth_error is not None:
        return auth_error
    item = knowledge_v3_store.update_item(itemId, await request_json_or_empty(request))
    return success({"item": item}, request_id=request.headers.get("x-request-id"))


@app.delete("/v3/knowledge/items/{itemId}")
def v3_knowledge_delete_item(itemId: str, request: Request):
    auth_error = authenticate_vision_request(request)
    if auth_error is not None:
        return auth_error
    return success(knowledge_v3_store.delete_item(itemId), request_id=request.headers.get("x-request-id"))


@app.post("/v2/runtime/evidence")
async def v2_runtime_evidence(request: Request):
    body = await request.json()
    try:
        result = run_controlled_runtime_evidence(v2_artifact_store, body, source="http")
    except SchemaValidationError as exc:
        return JSONResponse(
            status_code=400,
            content=failure(
                ErrorCode.SCHEMA_VALIDATION_FAILED,
                str(exc),
                request_id=request.headers.get("x-request-id"),
                details={"path": exc.path},
            ),
        )
    return success(
        {
            "status": "accepted" if result["ok"] else "denied_or_failed",
            "artifact": result["artifact"],
        },
        request_id=request.headers.get("x-request-id"),
    )


@app.get("/v2/artifacts/{artifact_id}")
def v2_get_artifact(artifact_id: str, request: Request):
    artifact = v2_artifact_store.get(artifact_id)
    if not artifact:
        return JSONResponse(
            status_code=404,
            content=failure(ErrorCode.ARTIFACT_NOT_FOUND, "V2 artifact not found.", request_id=request.headers.get("x-request-id")),
        )
    return success({"artifact": artifact}, request_id=request.headers.get("x-request-id"))


@app.post("/v2/snapshots/diff")
async def v2_snapshot_diff(request: Request):
    body = await request.json()
    try:
        result = compute_snapshot_diff(v2_artifact_store, body, source="http")
    except SchemaValidationError as exc:
        return JSONResponse(
            status_code=400,
            content=failure(
                ErrorCode.SCHEMA_VALIDATION_FAILED,
                str(exc),
                request_id=request.headers.get("x-request-id"),
                details={"path": exc.path},
            ),
        )
    return success(result, request_id=request.headers.get("x-request-id"))


@app.post("/v2/workbench")
async def v2_workbench(request: Request):
    body = await request.json()
    try:
        result = build_workbench(v2_artifact_store, body, source="http")
    except SchemaValidationError as exc:
        return JSONResponse(
            status_code=400,
            content=failure(
                ErrorCode.SCHEMA_VALIDATION_FAILED,
                str(exc),
                request_id=request.headers.get("x-request-id"),
                details={"path": exc.path},
            ),
        )
    return success(result, request_id=request.headers.get("x-request-id"))


async def import_llm_provider_body(body: dict[str, Any], request: Request):
    provider_type = str(body.get("type") or body.get("providerType") or "deepseek")
    if provider_type != "deepseek":
        return provider_failure_response(
            ProviderSettingsError("Only DeepSeek provider import is supported in V1.0.", code="provider_unsupported"),
            request,
        )
    try:
        provider = settings_store.import_deepseek(body, new_id("prov_"))
        return success({"provider": provider, "settings": settings_store.get_settings()}, request_id=request.headers.get("x-request-id"))
    except ProviderSettingsError as exc:
        return provider_failure_response(exc, request)


def provider_failure_response(exc: ProviderSettingsError, request: Request) -> JSONResponse:
    status_code = 404 if exc.code == "provider_missing" else 400
    error_code = ErrorCode.MODEL_UNAVAILABLE if exc.code.startswith("provider") else ErrorCode.REQUEST_INVALID
    return JSONResponse(
        status_code=status_code,
        content=failure(
            error_code,
            str(exc),
            request_id=request.headers.get("x-request-id"),
            recoverable=exc.recoverable,
            details={"code": exc.code},
        ),
    )


def asr_model_error_response(exc: AsrModelManagerError, request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={
            "ok": False,
            "data": None,
            "error": {
                "code": exc.code,
                "message": str(exc),
                "recoverable": exc.status < 500,
                "details": {},
            },
            "request_id": request.headers.get("x-request-id") or new_id("req_"),
        },
    )


async def request_json_or_empty(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        return {}
    return body if isinstance(body, dict) else {}


def resolve_chat_stream_session_id(body: dict[str, Any]) -> str | None:
    session_id = body.get("session_id")
    if isinstance(session_id, str) and session_id:
        return session_id
    recent = session_store.get_recent_session()
    if recent:
        return str(recent["session_id"])
    session = session_store.create(new_id("sess_"), utc_now(), metadata={"source": "chat_stream", "profile": "chat"})
    return str(session["session_id"])


def normalize_session_title(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    title = value.strip()
    return title[:80] if title else None


def normalize_session_profile(value: Any) -> str:
    return value if value in {"chat", "agent"} else "chat"


def normalize_page_ref(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    url = value.get("url")
    title = value.get("title")
    domain = value.get("domain")
    if not isinstance(url, str) or not isinstance(title, str) or not isinstance(domain, str):
        return None
    return {
        "id": str(value.get("id") or value.get("page_id") or value.get("pageId") or new_id("page_ref_")),
        "url": url,
        "title": title,
        "domain": domain,
        "capturedAt": str(value.get("capturedAt") or value.get("captured_at") or utc_now()),
        **({"contentHash": value["contentHash"]} if isinstance(value.get("contentHash"), str) else {}),
        **({"contentHash": value["content_hash"]} if isinstance(value.get("content_hash"), str) else {}),
    }


def chat_session_summary(record: dict[str, Any]) -> dict[str, Any]:
    metadata = record.get("metadata") if isinstance(record.get("metadata"), dict) else {}
    page_ref = metadata.get("pageRef") if isinstance(metadata.get("pageRef"), dict) else None
    active_page = record.get("active_page") if isinstance(record.get("active_page"), dict) else None
    if not page_ref and active_page:
        page_ref = {
            "id": active_page.get("page_id"),
            "url": active_page.get("url"),
            "title": active_page.get("title"),
            "domain": active_page.get("domain"),
            "capturedAt": active_page.get("captured_at"),
            "contentHash": active_page.get("content_hash"),
        }
    message_count = metadata.get("messageCount")
    if not isinstance(message_count, int):
        messages = record.get("messages")
        message_count = len(messages) if isinstance(messages, list) else 0
    return {
        "id": record.get("session_id"),
        "title": metadata.get("title") or "新会话",
        "profile": metadata.get("profile") if metadata.get("profile") in {"chat", "agent"} else "chat",
        "createdAt": record.get("created_at"),
        "updatedAt": record.get("updated_at"),
        "lastMessageAt": metadata.get("lastMessageAt"),
        "pageRef": page_ref,
        "messageCount": message_count,
        "archived": bool(metadata.get("archived")),
        "lastMessageExcerpt": metadata.get("lastMessageExcerpt"),
        "hasArtifacts": bool(metadata.get("hasArtifacts")),
    }


def chat_message_records(record: dict[str, Any]) -> list[dict[str, Any]]:
    artifacts_by_turn: dict[str, list[str]] = {}
    for artifact in record.get("artifacts", []):
        if not isinstance(artifact, dict):
            continue
        turn_id = artifact.get("turnId")
        artifact_id = artifact.get("artifactId")
        if isinstance(turn_id, str) and isinstance(artifact_id, str):
            artifacts_by_turn.setdefault(turn_id, []).append(artifact_id)
    messages = record.get("messages") if isinstance(record.get("messages"), list) else []
    normalized: list[dict[str, Any]] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        metadata = message.get("metadata") if isinstance(message.get("metadata"), dict) else {}
        turn_id = message.get("turn_id")
        normalized.append(
            {
                "id": message.get("message_id"),
                "sessionId": message.get("session_id") or record.get("session_id"),
                "turnId": turn_id,
                "role": message.get("role"),
                "kind": metadata.get("kind") or "normal",
                "content": message.get("content") or "",
                "createdAt": message.get("created_at"),
                "artifactIds": artifacts_by_turn.get(turn_id, []),
                "pageContextId": metadata.get("pageContextId"),
            }
        )
    return normalized


def maybe_update_session_title(session_id: str, user_message: str, intent: str, active_page: dict[str, Any] | None) -> None:
    record = session_store.get_session_record(session_id)
    if not record:
        return
    metadata = record.get("metadata") if isinstance(record.get("metadata"), dict) else {}
    if metadata.get("title") not in {None, "", "新会话"}:
        return
    title = title_for_first_message(user_message, intent, active_page)
    session_store.update_session(session_id, title=title)


def title_for_first_message(user_message: str, intent: str, active_page: dict[str, Any] | None) -> str:
    page_title = active_page.get("title") if isinstance(active_page, dict) else None
    if intent == "summarize_page" and isinstance(page_title, str) and page_title:
        return f"总结：{page_title}"[:80]
    if intent == "mindmap_page" and isinstance(page_title, str) and page_title:
        return f"Mindmap：{page_title}"[:80]
    trimmed = user_message.strip()
    return trimmed[:20] if trimmed else "新会话"


def stream_llm_turn(session_id: str, request_id: str, user_message: str, active_page: dict[str, Any] | None) -> Iterable[dict[str, Any]]:
    turn_id = new_id("turn_")
    response_text = ""
    try:
        provider = provider_registry.get_default_provider()
        for chunk in provider.stream_chat(user_message, page_context=active_page):
            response_text += chunk
            yield persist_and_publish(
                agent_event(
                    AgentEventType.RESPONSE_DELTA,
                    session_id=session_id,
                    turn_id=turn_id,
                    request_id=request_id,
                    data={"text": chunk},
                )
            )
        persist_llm_messages(session_id, turn_id, user_message, response_text)
        yield persist_and_publish(
            agent_event(
                AgentEventType.RESPONSE_DONE,
                session_id=session_id,
                turn_id=turn_id,
                request_id=request_id,
                data={"status": "done"},
            )
        )
    except ProviderSettingsError as exc:
        yield persist_and_publish(provider_error_event(session_id, turn_id, request_id, exc.code, str(exc), exc.recoverable))
    except RuntimeError as exc:
        yield persist_and_publish(provider_error_event(session_id, turn_id, request_id, "provider_call_failed", str(exc), True))


def provider_error_event(session_id: str, turn_id: str, request_id: str, code: str, message: str, recoverable: bool) -> dict[str, Any]:
    return agent_event(
        AgentEventType.ERROR,
        session_id=session_id,
        turn_id=turn_id,
        request_id=request_id,
        data={"code": code, "message": message, "recoverable": recoverable},
    )


def page_context_auto_capture_event(session_id: str, request_id: str) -> dict[str, Any]:
    return agent_event(
        AgentEventType.ERROR,
        session_id=session_id,
        request_id=request_id,
        data={
            "code": "page_context_auto_capture_required",
            "message": "需要读取当前页面后继续。",
            "recoverable": True,
            "action": "capture_page_and_retry",
        },
    )


def deferred_intent_events(session_id: str, request_id: str, intent: str) -> list[dict[str, Any]]:
    turn_id = new_id("turn_")
    trace_id = new_id("trace_")
    return [
        agent_event(
            AgentEventType.INTENT_DETECTED,
            session_id=session_id,
            turn_id=turn_id,
            trace_id=trace_id,
            request_id=request_id,
            data={"provider": "runtime_profile", "adapter_id": intent, "confidence": 1.0, "status": "deferred"},
        ),
        agent_event(
            AgentEventType.STATE_TRANSITION,
            session_id=session_id,
            turn_id=turn_id,
            trace_id=trace_id,
            request_id=request_id,
            data={"from": "intent_detecting", "to": "capability_boundary", "reason": intent},
        ),
        agent_event(
            AgentEventType.RESPONSE_DELTA,
            session_id=session_id,
            turn_id=turn_id,
            trace_id=trace_id,
            request_id=request_id,
            data={"text": DEFERRED_MESSAGE},
        ),
        agent_event(
            AgentEventType.RESPONSE_DONE,
            session_id=session_id,
            turn_id=turn_id,
            trace_id=trace_id,
            request_id=request_id,
            data={"status": "done"},
        ),
    ]


def agent_profile_preflight_events(session_id: str, request_id: str) -> list[dict[str, Any]]:
    turn_id = new_id("turn_")
    trace_id = new_id("trace_")
    message = "Agent 模式会在后续版本支持工具和长任务。当前暂未开放天气查询、实时搜索、Deep Research、PPT 生成、Code Task、本地文件和命令工具。你仍可继续使用 Chat。"
    return [
        agent_event(
            AgentEventType.INTENT_DETECTED,
            session_id=session_id,
            turn_id=turn_id,
            trace_id=trace_id,
            request_id=request_id,
            data={"provider": "runtime_profile", "adapter_id": "agent_preflight", "confidence": 1.0, "status": "deferred"},
        ),
        agent_event(
            AgentEventType.STATE_TRANSITION,
            session_id=session_id,
            turn_id=turn_id,
            trace_id=trace_id,
            request_id=request_id,
            data={"from": "agent_checking", "to": "agent_unavailable", "reason": "agent_deferred"},
        ),
        agent_event(
            AgentEventType.RESPONSE_DELTA,
            session_id=session_id,
            turn_id=turn_id,
            trace_id=trace_id,
            request_id=request_id,
            data={"text": message},
        ),
        agent_event(
            AgentEventType.RESPONSE_DONE,
            session_id=session_id,
            turn_id=turn_id,
            trace_id=trace_id,
            request_id=request_id,
            data={"status": "done"},
        ),
    ]


def turn_result_from_events(events: list[dict[str, Any]], status: str) -> dict[str, Any]:
    first = events[0] if events else {}
    return {
        "turnId": first.get("turn_id") or new_id("turn_"),
        "traceId": first.get("trace_id") or new_id("trace_"),
        "requestId": first.get("request_id") or new_id("req_"),
        "status": status,
        "events": events,
        "artifacts": [],
        "toolCalls": [],
        "state": "done" if status == "done" else status,
    }


def persist_llm_messages(session_id: str, turn_id: str, user_message: str, assistant_message: str) -> None:
    now = utc_now()
    session_store.add_message(
        session_id,
        {
            "message_id": new_id("msg_"),
            "turn_id": turn_id,
            "role": "user",
            "content": user_message,
            "created_at": now,
            "metadata": {"source": "typed"},
        },
    )
    session_store.add_message(
        session_id,
        {
            "message_id": new_id("msg_"),
            "turn_id": turn_id,
            "role": "assistant",
            "content": assistant_message,
            "created_at": now,
            "metadata": {"source": "llm_direct"},
        },
    )


def detect_chat_intent(message: str, body: dict[str, Any]) -> str:
    hint = body.get("intentHint")
    if isinstance(hint, str) and hint:
        return hint
    lowered = message.lower()
    if any(keyword in lowered for keyword in ["mindmap", "思维导图", "脑图", "mermaid"]):
        return "mindmap_page"
    if any(keyword in lowered for keyword in ["总结", "summary", "summarize"]):
        return "summarize_page"
    if any(keyword in lowered for keyword in ["解释选区", "解释选中", "selection", "selected text"]):
        return "explain_selection"
    if any(keyword in lowered for keyword in ["当前页面", "这个页面", "这页", "这篇", "这篇文章", "这段", "上面内容", "文章"]):
        return "page_qa"
    if any(keyword in lowered for keyword in ["改写", "rewrite", "润色"]):
        return "rewrite"
    return "general_chat"


def intent_requires_page_context(intent: str, message: str) -> bool:
    if intent in {"page_qa", "summarize_page", "mindmap_page", "explain_selection"}:
        return True
    lowered = message.lower()
    return any(keyword in lowered for keyword in ["当前页面", "这个页面", "这页", "这篇", "这篇文章", "这段", "上面内容"])


def should_use_agentic_tools(message: str, body: dict[str, Any], *, intent: str | None = None, active_page: dict[str, Any] | None = None) -> bool:
    lowered = message.lower()
    if is_high_risk_message(message):
        return True
    if isinstance(body.get("budget"), dict) or body.get("forceAdapterId"):
        return True
    selected_intent = intent or detect_chat_intent(message, body)
    if selected_intent in {"summarize_page", "mindmap_page", "explain_selection", "page_qa"}:
        return True
    return active_page is not None and any(keyword in lowered for keyword in ["什么", "为什么", "如何", "how", "what", "why", "?"])


def is_explicit_core_provider_request(body: dict[str, Any]) -> bool:
    return body.get("coreProvider") in {"mock", "llm_direct", "piagent"}


def resolve_core_config(body: dict[str, Any], *, session_id: str, request_id: str) -> dict[str, Any] | None:
    try:
        selected = settings_store.resolve_chat_provider(body)
        core_provider = selected.get("coreProvider") or os.environ.get("NAVIA_CORE_PROVIDER")
        if core_provider not in {"mock", "llm_direct", "piagent"}:
            return None
        config: dict[str, Any] = {"provider": core_provider}
        if core_provider in {"llm_direct", "piagent"}:
            provider = settings_store.get_llm_provider_for_chat(
                selected.get("llmProviderId"),
                selected.get("model"),
                include_secret=True,
            )
            config["llmProviderId"] = provider["id"]
            config["model"] = provider["selectedModel"]
            config["options"] = {"modelProvider": model_provider_payload(provider)}
        return config
    except ProviderSettingsError as exc:
        return provider_error_event(session_id, new_id("turn_"), request_id, exc.code, str(exc), exc.recoverable)


def model_provider_payload(provider: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": provider["type"],
        "baseUrl": provider["baseUrl"],
        "model": provider["selectedModel"],
        "apiKey": provider.get("apiKey"),
        "apiKeyRef": provider.get("apiKeyRef"),
        "capabilities": {
            "streaming": True,
            "toolCalls": False,
            "jsonOutput": True,
            "reasoning": provider["selectedModel"] in {"deepseek-v4-pro", "deepseek-reasoner"},
        },
    }


def page_reading_input(session_id: str, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "sessionId": session_id,
        "pageId": body.get("page_id") or body.get("pageId"),
        "url": body["url"],
        "title": body["title"],
        "domain": body["domain"],
        "capturedAt": body.get("captured_at") or body.get("capturedAt") or utc_now(),
        "headings": body.get("headings", []),
        "selectedText": body.get("selected_text") or body.get("selectedText"),
        "visibleText": body.get("visible_text") or body.get("visibleText"),
        "cleanedText": body.get("cleaned_text") or body.get("cleanedText") or body.get("visible_text") or body.get("visibleText") or "",
        "html": body.get("html"),
        "metadata": body.get("metadata", {}),
        "dom_signals": body.get("dom_signals") or body.get("domSignals") or {},
    }


def with_legacy_page_aliases(page: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    page_id = str(page["pageId"])
    content_hash = str(page["contentHash"])
    captured_at = str(page["capturedAt"])
    chunks = []
    for chunk in page.get("chunks", []):
        if isinstance(chunk, dict):
            chunks.append(
                {
                    **chunk,
                    "chunk_id": chunk.get("chunkId"),
                    "page_id": chunk.get("pageId"),
                    "heading_path": chunk.get("headingPath", []),
                    "token_estimate": chunk.get("tokenEstimate"),
                }
            )
    return {
        **page,
        "page_id": page_id,
        "session_id": page.get("sessionId"),
        "tab_id": body.get("tab_id"),
        "content_hash": content_hash,
        "captured_at": captured_at,
        "selected_text": body.get("selected_text"),
        "visible_text": body.get("visible_text"),
        "cleaned_text": body.get("cleaned_text") or body.get("visible_text") or "",
        "headings": body.get("headings", []),
        "chunks": chunks,
    }


def normalize_recent_messages(record: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not record:
        return []
    messages = record.get("messages") if isinstance(record.get("messages"), list) else []
    return [
        {
            "messageId": message.get("message_id"),
            "role": message.get("role"),
            "content": message.get("content"),
            "turnId": message.get("turn_id"),
        }
        for message in messages[-12:]
        if isinstance(message, dict)
    ]


def is_high_risk_message(message: str) -> bool:
    lowered = message.lower()
    return any(token in lowered for token in ["read_local_file", "/etc/passwd", "本地文件", "shell", "browser automation"])


def persist_turn_result(session_id: str, user_message: str, result: dict[str, Any]) -> None:
    turn_id = str(result["turnId"])
    trace_id = str(result["traceId"])
    request_id = str(result["requestId"])
    session_store.add_message(
        session_id,
        {
            "message_id": new_id("msg_"),
            "session_id": session_id,
            "turn_id": turn_id,
            "role": "user",
            "content": user_message,
            "created_at": utc_now(),
            "metadata": {"request_id": request_id, "trace_id": trace_id},
        },
    )
    assistant_text = "".join(
        str(event.get("data", {}).get("text") or "")
        for event in result.get("events", [])
        if isinstance(event, dict) and event.get("type") == AgentEventType.RESPONSE_DELTA.value
    )
    session_store.add_message(
        session_id,
        {
            "message_id": new_id("msg_"),
            "session_id": session_id,
            "turn_id": turn_id,
            "role": "assistant",
            "content": assistant_text,
            "created_at": utc_now(),
            "metadata": {"request_id": request_id, "trace_id": trace_id},
        },
    )
    for tool_result in result.get("toolResults", []):
        if not isinstance(tool_result, dict):
            continue
        session_store.add_tool_call(
            session_id,
            {
                "tool_call_id": tool_result["tool_call_id"],
                "session_id": session_id,
                "turn_id": turn_id,
                "tool_name": tool_result["tool_name"],
                "status": tool_result["status"],
                "created_at": utc_now(),
                "tool_result": tool_result,
            },
        )
        session_store.add_budget_entry(
            session_id,
            {
                "session_id": session_id,
                "turn_id": turn_id,
                "tool_call_id": tool_result["tool_call_id"],
                "created_at": utc_now(),
                "status": tool_result["status"],
                "budget_cost": tool_result.get("budget_cost", {}),
            },
        )
    for artifact in result.get("artifacts", []):
        if isinstance(artifact, dict):
            session_store.add_artifact(session_id, artifact)
    if assistant_text:
        session_store.upsert_checkpoint(
            session_id,
            {
                "checkpoint_id": new_id("ckpt_"),
                "session_id": session_id,
                "turn_id": turn_id,
                "created_at": utc_now(),
                "summary": assistant_text[:240],
                "metadata": {"request_id": request_id, "trace_id": trace_id, "strategy": "latest_turn_summary"},
            },
        )


def integration_adapter_registry() -> AdapterRegistry:
    registry = default_adapter_registry()
    registry.register(
        {
            "adapterId": "mindmap.generate",
            "name": "Generate Mindmap",
            "kind": "internal_tool",
            "capability": "mindmap_generation",
            "requiredContext": ["activePage"],
            "riskLevel": "safe",
            "budgetHint": {
                "model_calls": 0,
                "tool_calls": 1,
                "input_tokens": 0,
                "output_tokens": 0,
                "context_bytes": 0,
                "runtime_ms": 1,
            },
        },
        c_mindmap_adapter,
    )
    return registry


def c_mindmap_adapter(invocation: dict[str, Any]) -> dict[str, Any]:
    page = invocation.get("input", {}).get("activePage")
    page_record = page if isinstance(page, dict) else {}
    perception = page_record.get("perception") if isinstance(page_record.get("perception"), dict) else {}
    perception_digest = perception.get("perceptionDigest") or page_record.get("perceptionDigest")
    source_map = perception.get("sourceMap") or page_record.get("sourceMap")
    quality_report = perception.get("qualityReport") or page_record.get("qualityReport")
    result = generate_mindmap_payload(
        {
            "sessionId": invocation["sessionId"],
            "turnId": invocation["turnId"],
            "toolCallId": invocation["toolCallId"],
            "structuredPage": page,
            "perceptionDigest": perception_digest,
            "sourceMap": source_map,
            "qualityReport": quality_report,
        }
    )
    if not result["ok"]:
        return {
            "adapterId": invocation["adapterId"],
            "toolCallId": invocation["toolCallId"],
            "status": "failed",
            "content": {},
            "artifacts": [],
            "budgetCost": {
                "model_calls": 0,
                "tool_calls": 1,
                "input_tokens": 0,
                "output_tokens": 0,
                "context_bytes": 0,
                "runtime_ms": 1,
            },
            "warnings": [],
            "error": result["error"],
        }
    artifact = {
        "artifactId": new_id("art_"),
        "sessionId": invocation["sessionId"],
        "turnId": invocation["turnId"],
        "toolCallId": invocation["toolCallId"],
        "type": "mindmap",
        "sourcePageId": result["sourcePageId"],
        "sourceChunkIds": result["sourceChunkIds"],
        "source": "page",
        "content": result["mermaidSource"],
        "metadata": result["metadata"],
        "createdAt": utc_now(),
    }
    return {
        "adapterId": invocation["adapterId"],
        "toolCallId": invocation["toolCallId"],
        "status": "succeeded",
        "content": {"answer": "已基于当前页面生成 Mermaid 思维导图。", "mermaid": result["mermaidSource"]},
        "artifacts": [artifact],
        "budgetCost": {
            "model_calls": 0,
            "tool_calls": 1,
            "input_tokens": 0,
            "output_tokens": max(1, len(str(result["mermaidSource"])) // 4),
            "context_bytes": 0,
            "runtime_ms": 1,
        },
        "warnings": result.get("warnings", []),
        "error": None,
    }
