# The remaining risks and the exact stop reason

## The exact stop reason

```
WP-B VISIBLE PRODUCT-SEAM IMPLEMENTED AWAITING CODEX DRY REVIEW
```

## The internal / public contract statement

**No public contract changed.** The public API, the three frozen schemas, the
18-code closed set, the thresholds, the B01–B30 denominator, the T1–T4 order,
the Origin/auth order, the asset registry, the WP-A digests and the v10/v11
historical evidence are all byte-identical.

**One internal contract was added**, entirely outside the public surface:

| addition | where | why |
|---|---|---|
| a passive diagnostics recorder | `src/modules/media_companion/localImportDiagnostics.ts` | the harness needs the facts the product already produced, without an owner call |
| an E2E-only, read-only observation channel | `local_import/observations.py` + one `GET` route | the harness needs the SERVER-observed writer slice, the cleanup claim count and the residue counts |
| a product behaviour fix | the card abandons the old import when the resolved media identity really changes | without it, an import could keep uploading into the OLD task after the user switched videos |
| a driver seam | `e2e/lib/v3WpBVisibleSession/driver.mjs` | the flow description and the identity plan are pure, so the offline tests can assert the composition |

## The remaining risks

| risk | severity | why it is still a risk |
|---|---|---|
| the real Side Panel flow has never been executed | **Major, by design** | the whole visible acceptance path is unproven until the single approved session runs. The offline tests prove the COMPOSITION, not the behaviour. |
| the driver's control sequence may not match the real UI | Major | the product controls are the frozen test ids, but the real Side Panel may need extra settling between the policy, the Runtime and the lease. The driver fails loudly and leaves a redacted diagnostic rather than forcing state. |
| the MiniMax / OpenAI vision Provider is an external call | Major | the B29/B30 product needs a real vision dispatch. It is the user's own configured Provider; the harness does not choose one. |
| the 1 GB asset needs ~1.3 GB of disk and real CPU time | Minor | the preflight checks the disk and refuses before Chrome. |
| the `localImportEntryEligible` predicate is still the mount gate | Minor | the driver reaches it HONESTLY, but the predicate itself is a product function and the harness does not call it. |
| the Runtime observation channel adds a counter to the hot write path | Minor | the counter is a single comparison, guarded by the E2E flag, and it is off in production. |

## What the next owner must do

1. Run the **Codex dry review** over the sources listed in `09-handoff.md`.
2. If it is green, ask the user ONCE for the visible session.
3. Run the one session with the command in `09-handoff.md`.
4. Read the redacted receipt in the stable evidence destination. **B27, B29 and
   B30 are only proven by that receipt.**
5. Only after 30/30 and a stable candidate may Codex perform the single relay
   v11 refreeze.

**This package does not announce B27, B29, B30, WP-B or V3 as passing, and it
does not enter WP-C.**
