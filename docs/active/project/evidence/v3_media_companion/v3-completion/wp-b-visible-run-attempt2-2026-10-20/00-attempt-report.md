# WP-B Visible Run Attempt 2

Status: `PRE-CASE STARTUP FAILURE - ANOTHER EXPLICIT VISIBLE APPROVAL REQUIRED`

## Result

The second explicitly approved owned headed-Chrome session stopped before any
acceptance case. The installed Google Chrome 155.0.8059.84 process started in
the current interactive Windows session, but it did not expose the requested
CDP endpoint within 30 seconds. B27, B29 and B30 therefore remain pending.

No Runtime was started, no 100 MB or 1 GB acceptance asset was generated, no
Provider was called and no audio device was opened. The harness terminated the
owned Chrome process tree and removed its profile and WSL temporary root.
Ports 17861 and 9731 were confirmed free afterward; the owned profile root and
the WSL session-root pattern were empty.

## Offline remediation

Chrome for Testing 155.0.8059.84 was downloaded from the official Chrome for
Testing stable channel into the ignored project-local `.navia/tools` root. The
downloaded archive SHA-256 is
`507f2a031441d10c62b5e3d4e863f09ac1198a571c1419976cbd8387f639afde`.

Two muted, no-window checks were then completed and cleaned:

1. An isolated-profile CDP smoke passed.
2. The exact harness startup path loaded the unpacked extension through
   `Extensions.loadUnpacked` and observed a valid extension id plus its service
   worker.

A deeper headless product check reached the expected browser-mode boundary:
headless Chrome does not expose `chrome.sidePanel`, so it cannot replace the
required headed Side Panel acceptance. The harness now reports this as an
explicit `PRODUCT-SEAM BLOCK` instead of leaking an unhandled TypeError. Its
offline suite passes 57/57.

The next headed session must use the project-local Chrome for Testing binary.
It remains subject to a new explicit user approval because attempt 2 launched
an owned headed browser even though it failed before the first case.
