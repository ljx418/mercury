"""WP-A API tests — production owner: the four authenticated loopback routes.

Cases map to A02 (frozen body), A03 (envelope) and A04 (semantic mutations).
Every request goes through the real FastAPI app and the real auth middleware.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from navia_runtime.app import app, media_dependency_manager

EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop"
ORIGIN = f"chrome-extension://{EXTENSION_ID}"
TOKEN = "wp-a-master-token-0000000000000000000000000000000000"


@pytest.fixture(autouse=True)
def reset_manager() -> None:
    """The manager is a process singleton, so each case starts from a clean job table."""
    media_dependency_manager._jobs.clear()
    media_dependency_manager._active_job_id = None
    media_dependency_manager._latest_job_id = None
    media_dependency_manager._leases.clear()


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> TestClient:
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", TOKEN)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", EXTENSION_ID)
    monkeypatch.setenv("NAVIA_MEDIA_TOOL_ROOT", str(tmp_path / "managed-tools"))
    with TestClient(app) as test_client:
        yield test_client


def auth(extra: dict[str, str] | None = None) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {TOKEN}", "Origin": ORIGIN}
    if extra:
        headers.update(extra)
    return headers


# --- A03: envelopes ---------------------------------------------------------


def test_a03_status_envelope_is_exact(client: TestClient) -> None:
    response = client.get("/v1/media/dependencies", headers=auth())
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"ok", "data", "error", "request_id"}
    assert body["ok"] is True
    assert body["error"] is None
    # The status lives DIRECTLY in data, not under a wrapper.
    assert set(body["data"]) == {
        "schemaVersion",
        "overallState",
        "generation",
        "verifiedAt",
        "activeJobId",
        "latestJobId",
        "routeReadiness",
        "dependencies",
    }


def test_a03_error_envelope_is_exact(client: TestClient) -> None:
    response = client.get("/v1/media/dependency-installations/media_dep_job_" + "0" * 32, headers=auth())
    assert response.status_code == 404
    body = response.json()
    assert set(body) == {"ok", "data", "error", "request_id"}
    assert body["ok"] is False
    assert body["data"] is None
    assert set(body["error"]) == {"code", "message", "recoverable", "details"}
    assert body["error"]["code"] == "V3_MEDIA_DEPENDENCY_JOB_NOT_FOUND"


def test_a03_responses_never_leak_paths_urls_or_secrets(client: TestClient) -> None:
    body = client.get("/v1/media/dependencies", headers=auth()).text
    for forbidden in ("/mnt/", "C:\\", "github.com/yt-dlp", TOKEN, "http://", "https://"):
        assert forbidden not in body, f"the dependency surface leaked {forbidden}"


def test_a03_unauthenticated_request_is_refused(client: TestClient) -> None:
    response = client.get("/v1/media/dependencies")
    assert response.status_code in {401, 403}
    body = response.json()
    assert body["ok"] is False
    assert body["data"] is None
    assert set(body["error"]) == {"code", "message", "recoverable", "details"}


# --- A02: the frozen request body -------------------------------------------


def test_a02_exact_body_is_accepted(client: TestClient) -> None:
    response = client.post(
        "/v1/media/dependency-installations", headers=auth(), json={"dependencyIds": ["yt-dlp"]}
    )
    assert response.status_code == 202
    body = response.json()
    assert body["ok"] is True
    assert set(body["data"]) == {"job"}
    job = body["data"]["job"]
    assert set(job) == {
        "schemaVersion",
        "jobId",
        "dependencyIds",
        "state",
        "cancelable",
        "progress",
        "failureCode",
        "publishedGeneration",
        "sequence",
        "createdAt",
        "updatedAt",
        "finishedAt",
    }


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"dependencyIds": ["yt-dlp"], "url": "https://example.com/yt-dlp"},
        {"dependencyIds": ["yt-dlp"], "path": "/tmp/yt-dlp"},
        {"dependencyIds": ["yt-dlp"], "sha256": "0" * 64},
        {"dependencyIds": ["yt-dlp", "ffmpeg"]},
        {"dependencyIds": ["ffmpeg"]},
        {"dependencyIds": "yt-dlp"},
        {"dependencyIds": []},
        {"dependencyId": "yt-dlp"},
    ],
)
def test_a02_every_mutation_is_refused(client: TestClient, payload: Any) -> None:
    response = client.post("/v1/media/dependency-installations", headers=auth(), json=payload)
    assert response.status_code == 400, response.text
    body = response.json()
    assert body["ok"] is False
    assert body["error"]["code"] == "V3_MEDIA_DEPENDENCY_REQUEST_INVALID"
    # A refused request must not have created a job.
    status = client.get("/v1/media/dependencies", headers=auth()).json()["data"]
    assert status["activeJobId"] is None


# --- A04: job lifecycle envelopes -------------------------------------------


def test_a04_job_read_and_cancel_use_the_frozen_envelope(client: TestClient) -> None:
    created = client.post(
        "/v1/media/dependency-installations", headers=auth(), json={"dependencyIds": ["yt-dlp"]}
    ).json()
    job_id = created["data"]["job"]["jobId"]

    fetched = client.get(f"/v1/media/dependency-installations/{job_id}", headers=auth())
    assert fetched.status_code == 200
    assert fetched.json()["data"]["job"]["jobId"] == job_id

    cancelled = client.delete(f"/v1/media/dependency-installations/{job_id}", headers=auth())
    assert cancelled.status_code == 200
    assert set(cancelled.json()["data"]["job"]) == set(created["data"]["job"])


@pytest.mark.parametrize(
    "job_id",
    [
        "media_dep_job_" + "0" * 32,
        "not-a-job-id",
        "media_dep_job_",
        "media_dep_job_" + "0" * 31,
        "media_dep_job_" + "0" * 33,
    ],
)
def test_a04_invalid_job_ids_are_not_found(client: TestClient, job_id: str) -> None:
    response = client.get(f"/v1/media/dependency-installations/{job_id}", headers=auth())
    assert response.status_code == 404, response.text
    assert response.json()["error"]["code"] == "V3_MEDIA_DEPENDENCY_JOB_NOT_FOUND"


def test_a04_a_second_concurrent_job_is_refused(client: TestClient) -> None:
    first = client.post(
        "/v1/media/dependency-installations", headers=auth(), json={"dependencyIds": ["yt-dlp"]}
    )
    assert first.status_code == 202
    second = client.post(
        "/v1/media/dependency-installations", headers=auth(), json={"dependencyIds": ["yt-dlp"]}
    )
    assert second.status_code == 409
    body = second.json()
    assert body["error"]["code"] == "V3_MEDIA_DEPENDENCY_JOB_ACTIVE"
    assert body["error"]["details"]["jobId"] == first.json()["data"]["job"]["jobId"]


def test_a04_status_reports_the_active_job(client: TestClient) -> None:
    created = client.post(
        "/v1/media/dependency-installations", headers=auth(), json={"dependencyIds": ["yt-dlp"]}
    ).json()
    job_id = created["data"]["job"]["jobId"]

    status = client.get("/v1/media/dependencies", headers=auth()).json()["data"]
    assert status["activeJobId"] == job_id
    assert status["latestJobId"] == job_id
    assert status["overallState"] == "installing"
