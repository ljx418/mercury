# Security and cleanup

- Chrome launches: one approved owned visible session; always minimized and
  muted. No user Chrome process or profile was read, reused, terminated or
  modified.
- Audio playback and audio-output device use: zero.
- Owned Chrome, Runtime and harness processes after completion: zero.
- Owned ports, profiles, session roots and generated large assets: zero.
- Secret/private-path/raw-media scan: zero unexplained findings.
- Expected lexical findings: the schema's forbidden `apiKey` field name and
  fake Bearer/key strings used only to prove redaction rejection.
- Public receipt contains identifiers, digests, counts and bounded resource
  measurements only. It contains no Cookie, bearer, provider key, filename,
  private absolute path, transcript text, frame bytes or raw media.
- Git operations: no commit, push, reset, clean, checkout or revert.

