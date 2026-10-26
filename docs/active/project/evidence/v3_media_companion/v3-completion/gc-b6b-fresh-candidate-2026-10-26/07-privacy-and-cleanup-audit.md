# GC-B6B Privacy And Cleanup Audit

Batch: `GC-B6B FRESH SIX-SOURCE CANDIDATE + BLIND SEMANTIC REVIEW`
Run id: `gc-b6b-20261025T175243Z`

## 1. What the public evidence contains

The public package of this batch is a HAND-WRITTEN, privacy-safe
projection of the run. It carries:

- the frozen lock (the registry digest, the order, the reserves, the harness
  digests, the rubric and the prompt digests);
- the zero-action preflight receipt (the check list, the counters, the cookie
  NAMES digest and the usable cookie COUNT);
- the per-source machine facts: the disposition, the stable failure code,
  the stable quality failure codes, the structural counts (claims, chapters,
  regions, evidence, thumbnails), the derivative digest, the bundle digest,
  the review-binding digest, the Provider attempt COUNT, the upload counters
  and the cleanup facts;
- the bundle verification (the presence, the production validation verdict,
  the manifest verdict, the digests and the counts);
- the action ledger reconciliation (the event tallies and the per-source
  facts);
- the review decision and the risks.

It NEVER contains: a derivative text, a brief, a claim, a chapter title or
thesis, an evidence text, an OCR or caption text, a PNG byte, a private
bundle file name, an absolute or private path, a Cookie value, a secret, a
Provider response, a Provider request body, a prompt or a Provider identity
beyond the frozen selected-provider declaration of the machine receipt
contract.

The raw artifacts stay OUTSIDE the repository, in the owned work evidence
root and the owned private review root, and they are retained for the B7
audit.

## 2. The secret / path / raw-media scan

```text
$ node <the production detectors over every public payload file>
secret hits: 0
absolute path hits: 0
raw media payload hits: 0
```

The itemised result is in `06-secret-path-raw-media-scan.json`.

## 3. The owned-resource cleanup audit

```text
$ ps -eo pid,cmd | grep -E "navia-t01-profile|navia-b5-3-rtbvid|chrome.*navia-t0"
(no output)

$ ss -ltn | grep 17861
(no output)
```

- **Owned Chrome**: none. Every one of the six launches was an OWNED
  instance with `--mute-audio` asserted (`muteAudioVerified: true` in every
  machine receipt) and none of them was the user's Chrome.
- **Owned Runtime**: none. Every one of the six scratch roots was deleted
  (`runtimeScratchDeleted: true` in every machine receipt) and every one of
  the six profile roots was deleted (`profileRootDeleted: true`).
- **The product port 17861**: free.
- **Staging directories**: the private review root holds the five captured
  bundles and the review protocol; no staging directory of a failed capture
  remains (a failed capture removes its own owned staging directory).
- **The action ledger**: intact and append-only (56 events, 0 malformed
  lines, one candidate run id).
- The process audit of the run: `leakedBefore 0`, `leakedAfter 0`,
  `stillAliveAtCloseout 0`, no killed pids.

The pre-existing `${TMPDIR}/navia-b5-3-*` directories of the EARLIER attempts
predate this run and were not touched. The unrelated processes of the other
sessions on this machine were neither counted nor killed.

## 4. The private artifacts that are retained for B7

| Artifact | Location | Content |
|---|---|---|
| the five private review bundles | the owned private review root (0700, outside the repository) | the durable derivative bytes, the workspace projection, the derived evidence, the PNG thumbnails, the seek map, the capture receipt and the manifest |
| the frozen rubric and prompt | the same private root | the review protocol |
| the run evidence | the owned work evidence root (0700, outside the repository) | the per-source machine receipts, the derivatives, the diagnostics and the sequencer summary |

They are retained until the B7 checkpoint decides their fate.
