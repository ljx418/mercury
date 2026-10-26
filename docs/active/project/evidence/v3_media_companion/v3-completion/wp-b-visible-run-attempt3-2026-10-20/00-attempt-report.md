# WP-B Visible Run Attempt 3

Status: `PRE-CASE STARTUP FAILURE - B27/B29/B30 REMAIN PENDING`

## Result

Attempt 3 used the project-local official Chrome for Testing
155.0.8059.84 distribution. The owned headed process again did not expose CDP
within 30 seconds, so no acceptance case started.

No Runtime was started, no 100 MB or 1 GB asset was generated, no Provider was
called and no audio device was opened. The owned process tree, profile and WSL
temporary root were removed. Ports 17861, 9731 and 9732 were confirmed free,
and no owned Chrome process remained.

## Diagnosis and next correction

The same Chrome for Testing binary passes a muted headless CDP smoke and loads
the unpacked extension plus service worker through the harness startup path.
This isolates the failure to the Windows headed-window launch rather than the
browser binary, profile, extension or remote-debugging support.

A Playwright-pipe experiment also produced an explicit cross-OS error: WSL
Node cannot pass its Unix pipe file descriptors to a Windows Chrome process.
That path is therefore not a valid replacement.

The next candidate replaces the extreme negative window coordinate with
Windows' native `--start-minimized` behavior and retains
`--disable-backgrounding-occluded-windows`. Startup failures now append only
two bounded facts: the number of Chrome processes carrying the owned profile
marker and whether Windows itself can reach the CDP endpoint. No command line,
path, cookie or token is included. The offline harness suite passes 57/57.

B27, B29 and B30 are not claimed as passed.
