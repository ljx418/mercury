# FC3 — truthful failure evidence and monotonic finalization

Oracles:
`scripts/stage_b_b5_3/test/structured_failure_evidence.node-test.mjs`
(3 cases, 3 pass) and `scripts/stage_b_b5_3/test/privacy_scan.node-test.mjs`
(7 cases, 7 pass).

## The oracle is a REAL structured Runtime failure

The FC3 case drives the REAL runner (`run_one_bvid.mjs`) against a local
HTTP double that answers with the PRODUCT's structured error envelope:

```json
{ "ok": false, "data": null,
  "error": { "code": "V3510B_CHAPTER_TIME_INVALID",
             "message": "章节起点必须严格递增。",
             "recoverable": false } }
```

The runner's own classification, its own finalization and its own nine-file
audit set run with that response. The test-only fault seam (which throws a
generic `Error`) is **not** what is exercised here — it exists for the other
runner tests only.

## The nine-file audit set

Every run, successful or failed, writes these nine files:

```text
final_disposition.txt   b5-source-receipt.json   isolation.json
receipt.json            provider_lock.txt         chrome_launch.log
secret_scan.csv         cleanup.json              task_namespace.json
```

plus `privacy-audit.json`, plus `failure-diagnostic.json` on the failure path,
plus `<bvid>-evidence.json` ONLY when a derivative was actually published.

The FC3 case asserts that all nine mandatory files exist after the structured
failure.

## What the failure evidence carries, exactly

| fact | where | on the failure path |
|---|---|---|
| the safe failure code | `b5-source-receipt.json` → `failureCode`, `failure-diagnostic.json` → `failureCode` | `V3510B_CHAPTER_TIME_INVALID` — the exact code, not a generic `Error` |
| the attempted Provider facts | `b5-source-receipt.json` → `provider.attempted` | `{ providerId, endpointClass, attemptCount, requestCount }` — present |
| the selected Provider facts | `provider.selectedProviderId`, `provider.selectedEndpointClass` | `minimax-cn-openai-vision`, `minimax_chat_completions` |
| the publication | `provider.published` | `null` — an absent publication stays null |
| the receipt mirror | `receipt.json` → `published` / `receipt` | `false` / `null` |
| the ledger count | `<stageRoot>/stage-actions.jsonl` | exactly ONE `providerCall` — the REJECTED attempt is counted |

The response BODY is never stored: the case asserts that the Chinese message
of the Runtime response appears nowhere in the diagnostic.

## Only an ALLOWLISTED frozen code is classified

`classifyRuntimeFailure(status, body)` returns a code ONLY when the body is
parsable JSON and the code matches

```text
^(?:V3510B_[A-Z0-9_]{1,64}|V352_[A-Z0-9_]{1,64})$
```

A foreign code (`ATTACKER_CONTROLLED_CODE`) yields `null`, and the case
asserts that the string appears nowhere in the receipt. An unparsable body
yields `null` and keeps only the HTTP status.

## The finalization is a MONOTONIC merge

`finalizeAuditEvidence()` re-reads the existing evidence, merges the facts
with an explicit precedence, and writes atomically (temp file + rename).

The precedence is one-directional: **a known non-null fact never becomes
null**. A retry or a restart can only ADD a fact or replace it with a
STRONGER one.

The proving case is a FRESH-PROCESS re-entry: a first run records
`V3510B_CHAPTER_TIME_INVALID`, then a SECOND, independent process re-enters
the same evidence root and fails with a generic error. The known safe failure
code survives the re-entry, the attempted Provider facts survive, and the
publication stays `null`.

## The privacy of the evidence

* `detectAbsolutePaths` is a GENERIC POSIX **and** Windows absolute-path
  detector. The allowlist is narrow and documented: `/v1/`, `/v3/`,
  `/health` — and a FILE under an allowlisted prefix is NOT allowlisted (a
  segment with a dot is a file name, and a file name is never public).
* `redactAbsolutePaths` replaces every detected path with a stable
  `path-ref:<sha256[:32]>`; the reference is stable for the same path.
* `safeFileReference` returns `file-ref:<sha256[:32]>` — the file reference is
  a hash, never the path.
* The secret scan stores the CLASSIFICATION, the COUNT and the hashed file
  reference. It never stores a matched secret character: the case asserts
  that `secret_scan.csv` contains neither an `sk-…` pattern nor the word
  `sample`.
* The FC3 case walks EVERY file of the audit set and asserts that
  `detectAbsolutePaths` finds nothing, and that `privacy-audit.json`
  reports `absolutePathCount: 0`.

## The honest limits

* The absolute-path detector is a TEXT detector over the evidence files. A
  path encoded in a non-text field would not be caught by it; the evidence
  carries only text and JSON scalars.
* The privacy of the evidence is proven for the nine-file audit set of the
  runner. The private diagnostic that the Runtime writes under its own
  private root is redacted by the Runtime's own sanitizer, and that is
  covered by the Runtime test suite, not by this package.
