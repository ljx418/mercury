# GC-B6D Recovery Canary And Capture Corrective

Date: 2026-10-25

Status: `GC-B6D PRODUCT RECOVERY PROVEN / GC-B6E CAPTURE BINARY CORRECTIVE PASS / AUTHORIZATION CONSUMED`

The one authorized order-2 recovery canary ran once and was not retried. The
product path recovered within the frozen request budget, reached `ready`, and
published a valid V2.1 derivative with a complete evidence catalog and readable
PNG thumbnails.

B6 capture did not close. It failed before bundle publication with
`B6_BUNDLE_ABSOLUTE_PATH`. The run remains `BLOCKED`: it produced no bundle,
blind projection, review row, sentinel result, B6 pass, or Stage B pass.

Codex traced the failure to a harness-only false positive. The privacy scanner
decoded arbitrary PNG and duplicate manifest payload bytes as UTF-8. Random
compressed bytes could therefore manufacture a path-looking substring. The
scanner now reads only structured semantic strings and the textual derivative;
binary thumbnails and duplicate manifest payloads are not interpreted as
text. PNG ancillary chunks other than ffmpeg's fixed-size `pHYs` are rejected.

The correction is verified offline but has not been exercised against a fresh
real capture. The next gate is one fresh order-2 capture confirmation with a
new explicit authorization. It is not a six-source B6B rerun authorization.
