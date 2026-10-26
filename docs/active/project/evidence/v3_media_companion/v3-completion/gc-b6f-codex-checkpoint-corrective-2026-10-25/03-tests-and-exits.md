# Tests And Exit Codes

| Check | Result |
|---|---|
| Initial focused invocation without repository import path | collection error, exit 2; no tests ran |
| Corrected GC-B6F Python focused suite | exit 0, 41/41 |
| GC-B5R/B6D/B6F combined Python suite | exit 0, 241/241 |
| GC-B6F runner focused suite | exit 0, 3/3 |
| B6C/lifecycle/B6D/B6F Node suite | exit 0, 46/46 |
| Runtime full suite | exit 0, 1324 passed / 3 skipped |
| Stage B full offline suite | exit 0, 626/626 |

The first focused command omitted the repository's required import path and
failed during collection with `ModuleNotFoundError`. It executed no test. The
same file then passed with the repository import path, and later passed again
inside both the combined and full Runtime suites.

The Stage B suite reports the external canary as `external_not_run`; it is not
counted as a pass.
