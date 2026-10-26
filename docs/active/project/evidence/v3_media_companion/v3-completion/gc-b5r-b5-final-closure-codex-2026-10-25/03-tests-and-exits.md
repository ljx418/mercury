# Tests And Exit Codes

| Check | Result |
|---|---|
| B-5 offline Node suite | 457/457, exit 0 |
| Focused Runtime comprehension/GC-B5R | 155 passed, exit 0 |
| Full Runtime suite after production changes | 1254 passed, 3 skipped, exit 0 |
| Final R8 production preflight | passed, no failed checks, zero external actions |
| Final R8 six-video sequencer | 6/6 complete, positive verdict, exit 0 |
| relay-v11 baseline | 50/50, exit 0 |
| relay-v11 mutations | 16/16, exit 0 |

The full Runtime suite preceded the last prompt-context-only refinement. The
focused 155-test suite and the real R8 run were repeated after that refinement.

Visible closure attempts in this Codex batch launched 22 owned muted Chrome
instances: R5 6, R6 6, R7 4, and R8 6. The runner's retained historical-log
counter remains a separate lower bound and does not pretend that temporary
corrective candidates are part of its retained-log set.
