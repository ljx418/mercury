# GC-B6J Risks And The Next Decision

Batch: `GC-B6J OFFLINE CORRECTIVE`
Date: 2026-10-26

## 1. The final state

```text
GC-B6J OFFLINE CANDIDATE AWAITING CODEX CHECKPOINT
```

It does not authorize or schedule a visible run. The fresh six-source
authorization is SPENT and this package does not replace it. B7, Stage C,
Stage B PASS and V3 PASS stay blocked.

## 2. The remaining risks

| Id | Risk | Severity | Note |
|---|---|---|---|
| R1 | The dependency identity of the vision Provider source database is the digest of the product's own owned metadata copy | MEDIUM | The source database is MUTABLE and large: a content digest of the file would drift on every unrelated product write, so the identity is the digest of the SELECTED AND VERIFIED Provider metadata as the product's own owner copies it. A re-verification of the Provider changes the metadata and therefore the identity, which is the intended drift. |
| R2 | The product dependency trees are sealed by their METADATA (path, size, type, timestamps) plus the content of their small and executable files | MEDIUM | The ASR models are large and installed once: a full content digest of the trees would be expensive and the metadata seal is the honest limit. A byte change that preserves the size and the timestamps of a large model is not detected. |
| R3 | The child verifies the RESOLUTION and the presence of the dependencies; the preflight verifies the IDENTITY | MEDIUM | The child does not probe the Provider database, because the probe would read the product database before the authorization. The parity chain is therefore: the preflight validates the identity of the prepared object, and the child validates that it resolves the SAME dependency. |
| R4 | The candidate path is a switch, not a physical impossibility | MEDIUM | The dependency binding and the sealed snapshot are required by the candidate path. A direct invocation of the runner or the sequencer without the preparation is a DIFFERENT path: it is refused by the snapshot requirement, and the existing fully injected offline harness remains explicitly test-only. |
| R5 | The stable-code allowlist is a frozen vocabulary | LOW | The allowlist is assembled from the OWNERS of the codes, so a new harness code must be published by its owner. A legitimate code that is not published by an owner is refused by the public publication rather than published as an exception name. |
| R6 | The private dependency object holds the resolved paths | LOW | It lives in the owned private root with mode 0600, it is never copied into the snapshot and it never enters the public package: only the safe identities do. |
| R7 | The Stage B tree is largely UNTRACKED in git | MEDIUM | The changed-file inventory of this batch is this document; the git diff mixes it with the uncommitted Stage B work of the earlier batches. |
| R8 | A concurrent session is modifying the Runtime modules and the relay sources | MEDIUM | Their modifications are NOT this batch's and were not touched. The relay scope digests are byte-identical to the GC-B6B proof, and the relay gate is green inside the offline suite. |

## 3. What this batch established

- ONE dependency-resolution authority: the managed tools, the ASR root, the
  vision Provider source database and the extension build root are resolved
  once, bound to safe identities and handed to the child as EXPLICIT
  environment values.
- The preflight and the snapshot child now consume the SAME immutable
  dependency object, and a missing, changed, inaccessible or mismatched
  dependency stops BEFORE the authorization consumption, the Cookie read,
  the Chrome launch and the Runtime startup.
- The external-input refusal has a stable allowlisted code that survives the
  runner finalization, the machine receipt and the public projection, and
  the public package can never carry an exception name, an exception
  message, a path, a database name, a credential or a Provider identity.
- The retention digest owner returns a sorted unique set, so a legitimate
  private ledger is publishable and the public validator stays strict.

## 4. The decisions Codex must take

1. **The checkpoint of this implementation.** Nothing else is authorized
   until the checkpoint closes.
2. **The candidate re-run.** The spent GC-B6B authorization is not
   restored. A fresh six-source candidate requires a new explicit user
   authorization and a fresh run, authorization, stage, private and evidence
   root. This package neither requests nor performs one.
3. **The order-2 and product-side diagnosis.** The visible diagnostic is
   BLOCKED and its authorization is consumed. The product-side cause of the
   degraded task is still open.
4. **The dependency identity limits.** Whether the metadata seal of the large
   product trees and the metadata-digest identity of the Provider database
   are the accepted limits of the candidate seal.

## 5. What was NOT done

- No Chrome, no visible window, no Cookie read or injection, no Runtime
  media task, no Provider request, no download, no import, no real BVID, no
  blind review, no sentinel and NO authorization consumption.
- The spent GC-B6B candidate was neither rerun nor amended, and no
  historical evidence package and no generated public no-go package was
  edited.
- No public API, V2.1 schema, quality threshold, eight-request budget,
  registry, fixed denominator, Provider registry or review protocol byte was
  changed, and no relay or protocol hash was self-refrozen.
- The repository was not committed, pushed, reset, cleaned, checked out or
  reverted.
