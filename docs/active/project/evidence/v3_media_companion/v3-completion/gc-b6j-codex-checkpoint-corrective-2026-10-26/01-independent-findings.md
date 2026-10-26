# Independent Findings And Corrections

1. `dependencyChildEnvironment()` indexed the prepared environment with enum
   member names, producing an empty injection object. The positive test had
   pre-seeded the same variables and hid the defect. It now iterates the actual
   environment variable values, and the positive test starts without them.
2. The official preparation entrypoint did not validate the newly prepared
   object against the child-effective dependency resolution. It now performs
   identity-level parity before launch. A no-object preflight also fails when a
   product dependency is missing instead of returning an unconditional green.
3. Sequencer and runner used resolution-only comparison, and sequencer rebuilt
   `00-candidate-lock.json` without dependency identities. Both now perform
   identity comparison, including Provider metadata, and the final lock binds
   the verified prepared object.
4. The runner dependency probe referenced an undefined `evidenceDir`, causing
   a generic `B6_RUNNER_UNEXPECTED_FAILURE` before the intended stable refusal.
   It now uses the owned source evidence directory; resolver exceptions are
   mapped to `B6_DEPENDENCY_INPUT_UNREADABLE` in the dependency owner.

The private dependency object now has exact top-level, dependency, path, and
environment key sets. Relative paths, mismatched path/environment values,
missing fields, extra fields, malformed digests, and Provider metadata drift
all fail closed.

