# Run Facts

Run: `gc-b6b-20261026T080359Z-292745bcb719`.

## Preflight

- production preflight: passed;
- failed checks: 0;
- Chrome, Runtime media work, Provider, download, import, media task, Cookie injection, audio, tabCapture, focus, and source completion counters: all 0;
- candidate preparation: 499 sealed files;
- executable identities: Node v22.22.1, Python 3.12.3, Playwright 1.60.0, extension dependency count 169, Runtime dependency count 8166.

The first preparation attempt was refused before authorization and before external action because a Windows-mounted root could not satisfy mode 0700. The owned empty root was deleted, the candidate was prepared under a Linux mode-0700 root, and preflight was repeated successfully. No candidate attempt was consumed by the refusal.

## Candidate

| Counter | Value |
|---|---:|
| sourceAttempt | 6 |
| chromeLaunch | 6 |
| visibleWindow | 6 |
| runtimeStart | 0 |
| mediaTask | 0 |
| runtimeSynthesize | 0 |
| providerCall | 0 |
| download/import | 0 / 0 |
| cookieInjection | 0 |
| audio/tabCapture/focus | 0 / 0 / 0 |
| sourceCompletion | 0 |

Every Chrome launch carried `--mute-audio`. Every row failed with the same external-input condition before Runtime startup. All raw-video, raw-audio, frame-byte, Cookie, key, and local-path upload counters are 0.

The generated public decision records `reviewAuthorized:false`, `blindReviewPerformed:false`, six failed rows, zero review rows, and zero sentinel receipts.

