# The cleanup report

Everything this pass created is owned and removable. Nothing was left running.

| kind | count | note |
|---|---|---|
| visible Chrome | **0** | the phase forbids it and the runner refuses without the approval flag |
| headless Chrome | **0** | the real adapters are written but unexecuted |
| owned Chrome profile | **0** | no profile directory was created |
| owned Runtime | **0** | the Runtime was never started; its lifecycle is proven with injected adapters |
| owned ports | **0** | the CDP and Runtime ports were never bound |
| large assets | **0** | no 100 MB or 1 GB asset was generated |
| owned temporary roots | **0** | the offline runner removes its own root; the offline tests remove every root they create in an `afterEach`, so a failing assertion cannot leave one behind |
| owned processes | **0** | no child process was started by this pass |

## The cleanup PLAN of the later, approved session

The Codex-corrected plan is intact and still runs in a `finally`, whatever
happened:

1. terminate the owned Chrome PID and its process tree (through the OWNED
   profile marker, never a WSL proxy pid);
2. terminate the owned Runtime PID and its process tree;
3. remove the owned profile directory;
4. remove the owned asset directory;
5. remove the owned temporary root (every probe, frame and intermediate);
6. remove the owned evidence directory;
7. **then** write the redacted receipt to the STABLE destination, so it survives
   the owned root's deletion.

The plan owns nothing outside its own root, and the offline test proves it.

## The repository state

* Nothing was committed, pushed, reset, cleaned, checked out or reverted.
* No unrelated dirty-worktree change was overwritten.
* The relay v11 inventory was not touched and nothing was refrozen.
* The only removed files are this pass's OWN predecessor: the stub library
  `e2e/lib/v3WpBLocalImportOwnedSession.mjs` and its test, which existed only
  to hold the throw-only `runCase()`.
