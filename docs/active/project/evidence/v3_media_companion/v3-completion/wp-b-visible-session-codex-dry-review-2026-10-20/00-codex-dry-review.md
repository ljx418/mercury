# WP-B Visible Session Codex Dry Review

Status: `WP-B VISIBLE DRY REVIEW PASS - EXTERNAL INPUTS REQUIRED`

The visible run has not started. Chrome launches, Runtime launches, generated
100 MB/1 GB assets, audio output, and B27/B29/B30 executions are all zero.

## Findings closed

1. The local-import card existed only in an unused workspace page. It is now
   mounted in the real Side Panel product tree.
2. Incognito case contexts could not contain the unpacked extension. Cases now
   share the owned persistent extension context while using distinct tabs,
   identities, tasks, and Side Panel lifecycles.
3. The driver targeted controls absent from the Side Panel. It now uses the
   real media-companion enable flow and waits for the honest fallback card.
4. The owned Runtime did not enable its E2E-only read-only observation route.
5. Upload diagnostics were sampled in the wrong order and leaked stale case
   measurements. Final bytes and per-import reset semantics are now explicit.
6. B27 treated unrelated extension storage as residue. It now checks only
   local-import identifiers and credential-shaped residue.
7. B30 used synthetic KeyboardEvent dispatch and parent-only Runtime RSS. It
   now uses Playwright keyboard input and full owned process-tree RSS.
8. The cookie parser rejected canonical HttpOnly Netscape exports and did not
   support the repository's JSON format. Both are accepted and constrained to
   Bilibili cookies with a usable SESSDATA entry.
9. Input qualification happened after Chrome. Cookie content, seed file,
   SenseVoice files, tools, four distinct Bilibili video identities, ports,
   extension build, and disk are now checked before Chrome.
10. LocalMediaImportCard recreated its unmount callback on every render, so a
    progress render could cancel its own upload. Failed XHRs could also strand
    an import. Callback ownership is stable and failure now aborts, DELETEs,
    and polls the Runtime import.
11. B29/B30 omitted importId when reading Runtime residue and read frame
    evidence from a non-existent envelope field. Both now use the production
    `evidenceCatalog` shape and fail closed on route errors.
12. B27 used a small seed for an in-flight interruption. It now reuses the
    registered real 1 GB asset to avoid a loopback-upload race.

## Contract impact

Public contract: none. Frozen schemas, failure-code universe, thresholds,
B01-B30 denominator, T1-T4 ordering, asset registry, and historical evidence
were not changed. The Runtime observation route remains authenticated,
read-only, and absent unless the owned E2E environment flag is set.

## Gate result

Offline implementation and anti-false-green gates pass. B27, B29, and B30
remain `PENDING_VISIBLE_RUN`. The approved visible run is blocked only by
explicit external inputs: one authorized 30-300 second real speech video and
four distinct Bilibili video URLs that honestly reach the local-import fallback.
The user-supplied cookie file is present and parses without exposing values.

