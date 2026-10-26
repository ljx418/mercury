# WP0 R5-B visible checkpoint, window 11

Date: 2026-10-18

Status: `R5-B INTERNAL SENDER CONTRACT DECISION REQUIRED / R6 IMPLEMENTATION NO-GO`

## Single visible run

- Run ID: `r5b-positive-20261018T194000Z`
- Fixed source: `BV1Bb411w741`
- Fresh owned production Chrome, Profile, Runtime, task, and evidence root
- Chrome used explicit `--mute-audio`
- Sound / Provider / visible retry: `0 / 0 / 0`
- The run stopped on the first material failure and did not fabricate PCM, transcript, or terminal success.

## Observed boundary failure

The trusted user action reached the real extension capture route, but Background rejected the Offscreen Port:

```text
V3_MEDIA_CAPTURE_PREPARE_FAILED
offscreen document did not become ready:document_id_missing
```

The Runtime completed the session, portal, credential, resolve, execute, eligibility, acquisition, and
projection requests required to reach `awaiting_trusted_capture`. The failure occurred before the capture
WebSocket and before any PCM was accepted.

Chrome's `MessageSender.documentId` is optional in the installed Chrome type contract. The frozen relay v10
contract instead requires it to be non-empty and uses it as the lookup/binding key. Waiting longer or repeating
the visible run cannot satisfy an absent optional field.

## Decision boundary

The next corrective route changes the internal sender security contract, even though it does not change a public
API or user step. It therefore requires an explicit checkpoint before implementation. The proposed route keeps
all existing exact sender checks and, only when `MessageSender.documentId` is absent, resolves exactly one
`OFFSCREEN_DOCUMENT` by exact extension URL/type/incognito context and binds its returned context document ID.
Ambiguous, missing, mismatched, tab-hosted, wrong-frame, wrong-extension, wrong-origin, replacement, and
incognito-mismatch cases remain fail closed.

## Gate

R5-B positive E2E remains unproven. R6 implementation remains blocked.
