# Relay v11 target architecture

## 1. Ownership

```text
trusted Side Panel action
  -> Background MediaCaptureController (only orchestrator)
     -> OffscreenAudioPort v11 (only sender/context validator)
        -> chrome.runtime.getContexts(exact OFFSCREEN_DOCUMENT + exact URL)
        -> AuthoritativeOffscreenIdentity(documentId, url, origin, incognito)
     -> RuntimeCaptureTransport (only Runtime WebSocket owner)
  -> OffscreenProducerBootstrap (PCM producer only; no network/ticket/source identity)
```

## 2. Identity decision

`MessageSender.documentId` is optional evidence. It is never treated as the sole identity source.

- Sender facts always require exact extension ID, exact bundled URL, absent tab and absent-or-zero frame.
- Background discovers exactly one authoritative `OFFSCREEN_DOCUMENT` by exact URL/type.
- The context must provide non-empty document ID, exact URL and extension origin, and matching incognito state.
- A present sender document ID must equal the context document ID.
- An absent sender document ID is compatible only when the unique authoritative context passes every check.
- The authoritative context document ID is the live-owner binding key; replacement remains forbidden.

## 3. Versioning

Relay v10 schema, fixture, verifier and evidence remain immutable. Relay v11 receives a new schema version,
Port name, fixture and verifier. Background and Offscreen migrate atomically; there is no v10/v11 dual accept,
fallback or downgrade.

The nine message shapes, PCM/Base64/credit/backpressure rules, marker, FailureCode inventories, Runtime API,
ticket TTL, SourceAuthority and product materialization do not change.

## 4. R6 impact

The prepared R6 package remains NO-GO. After R5-B passes, its authority references must be revised from relay
v10 to accepted relay v11 while preserving the exact 65-case denominator. The fifth relay sender negative changes
meaning but is not removed; SP11 positives supplement acceptance and do not count toward the 65 negatives.
