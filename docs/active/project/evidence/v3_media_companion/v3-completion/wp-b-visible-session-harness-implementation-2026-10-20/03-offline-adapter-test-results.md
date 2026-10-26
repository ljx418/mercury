# The offline adapter-test results

`e2e/lib/v3WpBVisibleSession.node-test.mjs` — **32 tests, 32 passed, 0 failed**.

| group | what it proves | tests |
|---|---|---|
| 1 | every frozen visible case has a REAL executor and a complete required-oracle schema; the completeness rule fails for a missing executor, a throw-only placeholder and an incomplete oracle; a receipt without a required field is a failure, never a default | 4 |
| 2 | the owned Runtime refuses an occupied port and never reuses it; it uses its OWN private roots and never the user's; it times out with a precise block instead of hanging; it is terminated as a process tree; the companion session is established through the production route | 5 |
| 3 | the CDP endpoint is POLLED before the connection; the extension is loaded with the browser-level command and verified; a verification failure exits WITHOUT relaunching Chrome; the owned Chrome is always muted and never loads the extension from the command line; the build flavour decision is recorded | 5 |
| 4 | B27 drives the real user path IN ORDER and reduces a receipt; it fails when the XHR was not aborted, when the DELETE is missing and when residue survives | 2 |
| 5 | B29 reduces a receipt with the real measurements and fails on a non-monotonic progress, an oversized writer slice or a missing product; B30 refuses an out-of-window asset, a sparse asset and an unavailable measurement; B30 enforces the EXACT resource boundaries; B30 requires the real accessibility oracles | 5 |
| 6 | the redacted receipt refuses every private shape; the stable receipt survives the owned root's deletion; the stable destination must be declared; a failed run still leaves one redacted diagnostic | 4 |
| 7 | every temporary path is below the owned root; the cleanup runs even when the work failed half way | 2 |
| 8 | the preflight stops before Chrome when the seed, the ports or the disk are not ready; the SenseVoice resolution never guesses a repository default; the product's tool configuration is required and verified against the Runtime; the default and the offline invocation launch zero Runtime and zero Chrome and generate zero large assets | 5 |

## The recorded doubles

The tests drive recording doubles, never the real adapters. A double records the
ORDER of the real user path, so the assertions are about the sequence of
actions, not only about the final value:

```
openLocalImportCard → selectLocalFile → observeUploadStart → triggerIdentityChange
  → readPublicStatus → readExtensionStorage → readUiResidue
```
