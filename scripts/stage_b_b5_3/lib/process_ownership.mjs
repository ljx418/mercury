// The OWNED process audit.
//
// A leak of a visible run is a process that THIS sequencer OWNS and that
// outlived its parent. An unrelated process of another test or another run is
// NEVER a leak of this run: it is neither counted nor killed.
//
// The ownership is proven by the PROCESS TREE. While a child is alive, the
// tracker records the PIDs that are its descendants. After the child exits,
// the recorded PIDs that are still alive are the leaks.
//
// Nothing here scans the whole machine for a NAME: a name scan would count
// the runner of another test as a leak of this one.

import fs from "node:fs";

/** The pid -> ppid table of the running system. */
export function processTable() {
  const table = new Map();
  let entries = [];
  try {
    entries = fs.readdirSync("/proc");
  } catch {
    return table;
  }
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = fs.readFileSync(`/proc/${entry}/stat`, "utf8");
      // The comm field may contain spaces and parentheses: the parent pid is
      // the field AFTER the closing parenthesis.
      const after = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      const ppid = Number(after[1]);
      if (Number.isInteger(ppid)) table.set(Number(entry), ppid);
    } catch {
      // The process exited while the table was read.
    }
  }
  return table;
}

/** The PIDs that descend from the root pid. */
export function descendantPids(rootPid, table = processTable()) {
  const result = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [pid, ppid] of table) {
      if (pid === rootPid || result.has(pid)) continue;
      if (ppid === rootPid || result.has(ppid)) {
        result.add(pid);
        changed = true;
      }
    }
  }
  return result;
}

/** TRUE when the pid is still alive. */
export function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Boolean(error && error.code === "EPERM");
  }
}

/**
 * The tracker of the OWNED processes.
 *
 * `track(rootPid)` starts recording the descendants of a child. `leaks()`
 * reports the recorded PIDs that are still alive: those are the only
 * processes this run may consider a leak.
 */
export function createOwnedProcessTracker({ pollMs = 150 } = {}) {
  // rootPid -> { label, pids }
  const owned = new Map();
  let timer = null;
  const poll = () => {
    const table = processTable();
    for (const [rootPid, entry] of owned) {
      for (const pid of descendantPids(rootPid, table)) entry.pids.add(pid);
    }
  };
  const start = () => {
    if (timer) return;
    timer = setInterval(poll, pollMs);
    if (typeof timer.unref === "function") timer.unref();
  };
  return {
    /**
     * Start recording the descendants of a child.
     *
     * The LABEL identifies the OWNER of the child (its source), so a leak
     * can be attributed to the source that produced it.
     */
    track(rootPid, { label = null } = {}) {
      if (!Number.isInteger(rootPid) || rootPid <= 0) return;
      owned.set(rootPid, { label: label ? String(label) : null, pids: new Set([rootPid]) });
      start();
    },
    forget(rootPid) {
      owned.delete(rootPid);
      if (owned.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    /** The OWNED pids that are still alive. */
    leaks() {
      const result = [];
      for (const [rootPid, entry] of owned) {
        for (const pid of entry.pids) {
          if (pid === rootPid) continue;
          if (isAlive(pid)) result.push({ rootPid, pid, label: entry.label });
        }
      }
      return result.sort((a, b) => a.pid - b.pid);
    },
    /**
     * Kill ONLY the OWNED descendants that are still alive.
     *
     * A process that is not owned is never signalled and never terminated.
     */
    killOwnedLeaks() {
      const killed = [];
      for (const leak of this.leaks()) {
        try {
          process.kill(leak.pid, "SIGKILL");
          killed.push(leak.pid);
        } catch {
          // The process exited between the check and the signal.
        }
      }
      return killed;
    },
    /** The tracked roots. */
    roots() {
      return [...owned.keys()].sort((a, b) => a - b);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      owned.clear();
    },
  };
}
