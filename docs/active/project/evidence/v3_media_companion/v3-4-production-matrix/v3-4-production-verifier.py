#!/usr/bin/env python3
"""Independently verify a sealed V3-4 public run against its private SQLite store."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
from pathlib import Path

import jsonschema


MEDIA_SUFFIXES = {".mp4", ".media", ".wav", ".png", ".jpg", ".jpeg", ".webp"}


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    parser.add_argument("--schema", type=Path, required=True)
    args = parser.parse_args()

    result_path = args.run_root / "run-result.json"
    seal_path = args.run_root / "run-seal.json"
    result = json.loads(result_path.read_text(encoding="utf-8"))
    seal = json.loads(seal_path.read_text(encoding="utf-8"))
    schema = json.loads(args.schema.read_text(encoding="utf-8"))
    validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
    checks: dict[str, bool] = {}

    unhashed = dict(result)
    content_hash = unhashed.pop("contentSha256")
    checks["V409-01 canonical result hash"] = hashlib.sha256(canonical(unhashed)).hexdigest() == content_hash
    checks["V409-02 seal bindings"] = seal == {
        "schemaVersion": "v3-4-run-seal/v1",
        "runId": result["runId"],
        "contentSha256": content_hash,
        "resultSha256": sha256_file(result_path),
    }
    checks["V409-03 fixed denominator"] = result["summary"] == {
        "sampleCount": 12,
        "readyCount": 10,
        "degradedCount": 1,
        "blockedCount": 1,
        "cloudVisionDispatchCount": 8,
        "schemaValidCount": 12,
        "idempotentReplayCount": 11,
        "rawMediaResidualCount": 0,
    }
    samples = result["samples"]
    checks["V409-04 ordered terminal matrix"] = (
        [item["sampleId"] for item in samples] == [f"v3-sample-{index:02d}" for index in range(1, 13)]
        and [item["state"] for item in samples] == ["ready"] * 10 + ["blocked", "degraded"]
    )
    checks["V409-05 selected-frame budget"] = [item["cloudDispatchCount"] for item in samples] == [1] * 8 + [0] * 4

    db_path = args.private_root / "media-outline.sqlite3"
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM media_tasks ORDER BY task_id").fetchall()
    sample_by_task_hash = {item["taskIdSha256"]: item for item in samples}
    checks["V402 state rows"] = len(rows) == 12 and sorted(row["state"] for row in rows) == ["blocked", "degraded"] + ["ready"] * 10
    checks["V403 atomic rows"] = conn.execute("SELECT COUNT(*) FROM media_task_outbox WHERE status='completed'").fetchone()[0] == 12
    checks["V405 idempotency rows"] = conn.execute("SELECT COUNT(*) FROM media_task_idempotency").fetchone()[0] == 12
    checks["V411 no duplicate evidence"] = conn.execute(
        "SELECT COUNT(*) FROM (SELECT task_id,evidence_id,task_revision,COUNT(*) c FROM media_evidence_refs GROUP BY 1,2,3 HAVING c>1)"
    ).fetchone()[0] == 0

    envelope_count = 0
    projection_hashes_valid = True
    private_hashes_valid = True
    event_sequences_valid = True
    blocked_zero_projection = True
    restart_reads_valid = True
    for row in rows:
        task_id = row["task_id"]
        public_sample = sample_by_task_hash.get(hashlib.sha256(task_id.encode()).hexdigest())
        if public_sample is None:
            restart_reads_valid = False
            continue
        evidence_rows = conn.execute(
            "SELECT evidence_id,kind,start_ms,end_ms,content_sha256,relative_ref FROM media_evidence_refs WHERE task_id=? AND task_revision=? ORDER BY evidence_id",
            (task_id, row["revision"]),
        ).fetchall()
        catalog = [{
            "evidenceId": item["evidence_id"], "taskId": task_id, "kind": item["kind"],
            "timestampStartMs": item["start_ms"], "timestampEndMs": item["end_ms"],
            "contentSha256": item["content_sha256"], "relativeArtifactRef": item["relative_ref"],
        } for item in evidence_rows]
        for item in evidence_rows:
            evidence_path = args.private_root / item["relative_ref"]
            if not evidence_path.is_file():
                private_hashes_valid = False
                continue
            private = json.loads(evidence_path.read_text(encoding="utf-8"))
            if hashlib.sha256(private.get("text", "").encode()).hexdigest() != item["content_sha256"]:
                private_hashes_valid = False
        outline_row = conn.execute(
            "SELECT canonical_json FROM media_outlines WHERE task_id=? AND task_revision=? AND published=1",
            (task_id, row["revision"]),
        ).fetchone()
        if outline_row:
            projections = json.loads(outline_row["canonical_json"])
            outline, timeline, mindmap = projections["outline"], projections["timeline"], projections["mindmap"]
        else:
            outline, timeline, mindmap = None, [], None
        blocked_zero_projection &= row["state"] != "blocked" or (not catalog and outline is None and not timeline and mindmap is None)
        bundle = {
            "schemaVersion": "v3-media-outline-taskstore/v2",
            "task": {
                "taskId": task_id, "sourceIdentity": row["source_identity"], "state": row["state"],
                "revision": row["revision"], "knowledgeImportStatus": row["knowledge_import_status"],
            },
            "evidenceCatalog": catalog,
            "outline": outline,
            "timeline": timeline,
            "mindmap": mindmap,
            "terminalFailureCode": row["terminal_failure_code"],
        }
        outbox = conn.execute("SELECT outbox_id FROM media_task_outbox WHERE task_id=?", (task_id,)).fetchone()
        transaction = {
            "transactionId": "mtx_" + hashlib.sha256(outbox["outbox_id"].encode()).hexdigest()[:32],
            "taskId": task_id, "expectedRevision": row["revision"] - 1, "committedRevision": row["revision"],
            "aggregateCommitted": True, "eventCommitted": True, "outboxCommitted": True,
            "outlinePublished": outline is not None, "projectionPublished": outline is not None,
            "terminalFailureCode": row["terminal_failure_code"], "duplicateWriteCount": 0,
            "unresolvedEvidenceReferenceCount": 0, "crossTaskEvidenceReferenceCount": 0,
            "projectionEvidenceClosurePassed": outline is not None, "committedAt": row["updated_at"],
        }
        envelope = {key: value for key, value in bundle.items() if key != "terminalFailureCode"}
        envelope["task"] = dict(envelope["task"], createdAt=row["created_at"], updatedAt=row["updated_at"])
        envelope["transactionReceipt"] = transaction
        errors = list(validator.iter_errors(envelope))
        if errors or canonical_hash(transaction) != public_sample["transactionReceiptSha256"]:
            projection_hashes_valid = False
        if outline is not None:
            projection_hashes_valid &= (
                outline["contentSha256"] == public_sample["outlineSha256"]
                and len(outline["sections"]) == public_sample["sectionCount"]
                and len(timeline) == public_sample["timelineCount"]
                and len(mindmap["nodes"]) == public_sample["mindmapNodeCount"]
            )
        sequences = [item[0] for item in conn.execute("SELECT sequence FROM media_task_events WHERE task_id=? ORDER BY sequence", (task_id,))]
        event_sequences_valid &= sequences == list(range(len(sequences)))
        envelope_count += not errors

    conn.close()
    checks["V409-06 reconstructed envelopes"] = envelope_count == 12 and projection_hashes_valid
    checks["V409-07 blocked zero projection"] = blocked_zero_projection
    checks["V412 time and evidence files"] = private_hashes_valid
    checks["V413 timeline closure"] = all(item["timelineCount"] == item["sectionCount"] for item in samples if item["state"] != "blocked")
    checks["V414 mindmap closure"] = all(item["mindmapNodeCount"] == item["sectionCount"] + 1 for item in samples if item["state"] != "blocked")
    checks["V415 deterministic receipts"] = all(item.get("idempotentReplayMatched") is True for item in samples if item["state"] != "blocked")
    checks["V416 restart read"] = restart_reads_valid and event_sequences_valid
    public_blob = b"\n".join(path.read_bytes() for path in args.run_root.rglob("*") if path.is_file())
    checks["V417 public path boundary"] = not re.search(rb"/(?:home|mnt|tmp|Users)/|[A-Za-z]:\\\\", public_blob)
    checks["V417 V4 boundary"] = all(row["knowledge_import_status"] == "deferred_to_v4" for row in rows)
    checks["V417 raw artifact cleanup"] = not any(path.is_file() and path.suffix.lower() in MEDIA_SUFFIXES for path in args.private_root.rglob("*"))
    checks["V418 public allowlist"] = sorted(path.name for path in args.run_root.iterdir()) == ["run-result.json", "run-seal.json"]

    failed = [name for name, passed in checks.items() if not passed]
    output = {
        "schemaVersion": "v3-4-production-verification/v1",
        "runId": result["runId"],
        "summary": {"total": len(checks), "passed": len(checks) - len(failed), "failed": len(failed)},
        "checks": [{"id": index + 1, "name": name, "passed": passed} for index, (name, passed) in enumerate(checks.items())],
        "failedChecks": failed,
        "passed": not failed,
    }
    print(json.dumps(output, ensure_ascii=False, sort_keys=True, indent=2))
    return int(bool(failed))


def canonical_hash(value: object) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())
