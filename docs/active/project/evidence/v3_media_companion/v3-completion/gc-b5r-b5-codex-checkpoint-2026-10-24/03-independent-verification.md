# Independent verification

## Commands

| Command | Exit | Result |
|---|---:|---|
| `sha256sum -c PAYLOAD_MANIFEST.sha256` in the real-run evidence package | 0 | all listed evidence files verified |
| `node scripts/stage_b_b5_3/test/run_offline_suite.mjs` | 0 | serial 7/7, concurrent 229/229 |
| `python3 -m pytest tests/test_v3_gc_b5r_input_authority.py tests/test_v3_gc_b5r_corrective_authority.py tests/test_v3_media_comprehension.py -q` | 0 | 72 passed |

## Static evidence observations

- Failed-source directories 3, 4 and 5 each contain four files rather than the
  mandatory nine-file audit set.
- The clean-run aggregate correctly exits nonzero and explicitly reports those
  missing files.
- The retained attempt logs contain at least 34 explicit Chrome launch lines.
- The published complete-source derivatives contain empty receipt digests,
  confirming that they predate the service fix.
- The current code reads Provider receipt extras after initial and repair
  requests; its frozen-schema test passes.

This checkpoint itself launched no Chrome or Runtime, called no Provider,
performed no download, read no Cookie and played no audio.

