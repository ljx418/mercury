#!/usr/bin/env python3
"""Probe DeepSeek structure controls with synthetic evidence only.

The API key is read from the user-authorized desktop file. The report never
contains the key, response text, prompts, or local paths.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any

import httpx
from jsonschema import Draft202012Validator


KEY_PATH = Path("/mnt/c/Users/Administrator/Desktop/dsKey.txt")
REPORT_PATH = Path(
    os.environ.get(
        "NAVIA_DEEPSEEK_PROBE_REPORT",
        str(Path(__file__).with_name("deepseek-structured-output-probe.json")),
    )
)
BASE = "https://api.deepseek.com"
TRIALS = int(os.environ.get("NAVIA_DEEPSEEK_PROBE_TRIALS", "3"))
MODES = tuple(
    mode.strip()
    for mode in os.environ.get(
        "NAVIA_DEEPSEEK_PROBE_MODES",
        "chat_json_object,beta_strict_tool,responses_json_schema",
    ).split(",")
    if mode.strip()
)
KNOWN_MODES = {"chat_json_object", "beta_strict_tool", "responses_json_schema"}

EVIDENCE_IDS = [f"mtr_{index:032x}" for index in range(1, 4)]
CANDIDATE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["brief", "claims", "chapters", "unresolvedEvidenceConflict"],
    "properties": {
        "brief": {
            "type": "object",
            "additionalProperties": False,
            "required": ["text", "evidenceIds"],
            "properties": {
                "text": {"type": "string", "minLength": 20, "maxLength": 100},
                "evidenceIds": {
                    "type": "array", "minItems": 1, "uniqueItems": True,
                    "items": {"type": "string", "enum": EVIDENCE_IDS},
                },
            },
        },
        "claims": {
            "type": "array", "minItems": 2, "maxItems": 8,
            "items": {
                "type": "object", "additionalProperties": False,
                "required": ["text", "evidenceIds"],
                "properties": {
                    "text": {"type": "string", "minLength": 8, "maxLength": 240},
                    "evidenceIds": {
                        "type": "array", "minItems": 1, "uniqueItems": True,
                        "items": {"type": "string", "enum": EVIDENCE_IDS},
                    },
                },
            },
        },
        "chapters": {
            "type": "array", "minItems": 2, "maxItems": 12,
            "items": {
                "type": "object", "additionalProperties": False,
                "required": ["title", "thesis", "evidenceIds", "relationToPrevious"],
                "properties": {
                    "title": {"type": "string", "minLength": 4, "maxLength": 80},
                    "thesis": {"type": "string", "minLength": 8, "maxLength": 500},
                    "evidenceIds": {
                        "type": "array", "minItems": 1, "uniqueItems": True,
                        "items": {"type": "string", "enum": EVIDENCE_IDS},
                    },
                    "relationToPrevious": {
                        "type": "string",
                        "enum": ["opening", "continuation", "contrast", "cause_effect", "example", "conclusion"],
                    },
                },
            },
        },
        "unresolvedEvidenceConflict": {"type": "boolean"},
    },
}

SYNTHETIC_INPUT = {
    "title": "合成结构验证视频",
    "evidence": [
        {"evidenceId": EVIDENCE_IDS[0], "startMs": 0, "endMs": 10000, "text": "开篇提出低资源设备上的离线识别问题与目标。"},
        {"evidenceId": EVIDENCE_IDS[1], "startMs": 10000, "endMs": 20000, "text": "中段比较两种处理路径并说明证据约束。"},
        {"evidenceId": EVIDENCE_IDS[2], "startMs": 20000, "endMs": 30000, "text": "结尾建议先采用低资源路径并保留升级接口。"},
    ],
}


def prompt() -> str:
    return (
        "Return JSON only. Produce brief, claims, chapters and unresolvedEvidenceConflict "
        "for this synthetic evidence. Use only supplied evidenceId values. Brief must cover "
        "opening, middle and ending; claims must contain 2-8 items; chapters must contain "
        "2-12 time-ordered items. JSON input: "
        + json.dumps(SYNTHETIC_INPUT, ensure_ascii=False, separators=(",", ":"))
    )


def summary(mode: str, trial: int, started: float, response: httpx.Response | None, value: Any = None, error: Exception | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {
        "mode": mode,
        "trial": trial,
        "latencyMs": round((time.monotonic() - started) * 1000),
        "httpStatus": response.status_code if response is not None else None,
        "passed": False,
    }
    if response is not None:
        result["responseBytes"] = len(response.content)
        result["responseSha256"] = hashlib.sha256(response.content).hexdigest()
    if error is not None:
        result["errorType"] = type(error).__name__
        result["errorCode"] = str(error)[:160].replace("\n", " ")
        return result
    errors = sorted(error.message for error in Draft202012Validator(CANDIDATE_SCHEMA).iter_errors(value))
    result.update({
        "passed": not errors,
        "schemaErrorCount": len(errors),
        "topLevelKeys": sorted(value) if isinstance(value, dict) else [],
        "claimCount": len(value.get("claims", [])) if isinstance(value, dict) else None,
        "chapterCount": len(value.get("chapters", [])) if isinstance(value, dict) else None,
        "briefLength": len(value.get("brief", {}).get("text", "")) if isinstance(value, dict) else None,
    })
    return result


def post(client: httpx.Client, url: str, payload: dict[str, Any]) -> tuple[httpx.Response, dict[str, Any]]:
    response = client.post(url, json=payload)
    response.raise_for_status()
    return response, response.json()


def main() -> int:
    unknown_modes = sorted(set(MODES) - KNOWN_MODES)
    if unknown_modes:
        raise RuntimeError(f"unsupported probe modes: {', '.join(unknown_modes)}")
    if not MODES or TRIALS < 1:
        raise RuntimeError("probe requires at least one mode and one trial")
    key = KEY_PATH.read_text(encoding="utf-8").strip()
    if len(key) < 20:
        raise RuntimeError("authorized DeepSeek key file is empty or invalid")
    Draft202012Validator.check_schema(CANDIDATE_SCHEMA)
    results: list[dict[str, Any]] = []
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    with httpx.Client(headers=headers, timeout=120.0, follow_redirects=False) as client:
        for mode in MODES:
            for trial in range(1, TRIALS + 1):
                started = time.monotonic()
                response = None
                try:
                    if mode == "chat_json_object":
                        response, body = post(client, BASE + "/chat/completions", {
                            "model": "deepseek-chat",
                            "messages": [
                                {"role": "system", "content": "You produce valid JSON matching the requested structure."},
                                {"role": "user", "content": prompt()},
                            ],
                            "response_format": {"type": "json_object"},
                            "temperature": 0,
                            "max_tokens": 1800,
                        })
                        value = json.loads(body["choices"][0]["message"]["content"])
                    elif mode == "beta_strict_tool":
                        response, body = post(client, BASE + "/beta/chat/completions", {
                            "model": "deepseek-chat",
                            "messages": [{"role": "user", "content": prompt()}],
                            "tools": [{"type": "function", "function": {
                                "name": "submit_grounded_contract",
                                "description": "Submit the final evidence-grounded video contract.",
                                "strict": True,
                                "parameters": CANDIDATE_SCHEMA,
                            }}],
                            "tool_choice": {"type": "function", "function": {"name": "submit_grounded_contract"}},
                            "temperature": 0,
                            "max_tokens": 1800,
                        })
                        value = json.loads(body["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"])
                    else:
                        response, body = post(client, BASE + "/responses", {
                            "model": "deepseek-flash",
                            "input": prompt(),
                            "temperature": 0,
                            "max_output_tokens": 1800,
                            "text": {"format": {"type": "json_schema", "name": "grounded_contract", "schema": CANDIDATE_SCHEMA}},
                        })
                        text = "".join(
                            part.get("text", "")
                            for item in body.get("output", [])
                            for part in item.get("content", [])
                            if isinstance(part, dict) and part.get("type") in {"output_text", "text"}
                        )
                        value = json.loads(text)
                    results.append(summary(mode, trial, started, response, value=value))
                except Exception as exc:  # sanitized below; never persist response body or key
                    if isinstance(exc, httpx.HTTPStatusError):
                        response = exc.response
                    results.append(summary(mode, trial, started, response, error=exc))

    report = {
        "schemaVersion": "v3-provider-structured-output-probe/v1",
        "syntheticDataOnly": True,
        "trialsPerMode": TRIALS,
        "targetSchemaSha256": hashlib.sha256(json.dumps(CANDIDATE_SCHEMA, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        "results": results,
        "summary": {
            mode: {
                "passed": sum(item["passed"] for item in results if item["mode"] == mode),
                "total": sum(item["mode"] == mode for item in results),
            }
            for mode in MODES
        },
        "secretMaterialPersisted": False,
        "realProjectEvidenceUploaded": False,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
