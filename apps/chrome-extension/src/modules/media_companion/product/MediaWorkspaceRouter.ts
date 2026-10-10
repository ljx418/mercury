export type MediaWorkspaceRoute =
  | { kind: "task_library"; path: "/media/tasks" }
  | { kind: "task_overview"; path: string; taskId: string }
  | { kind: "outline" | "timeline" | "mindmap" | "ask" | "export"; path: string; taskId: string }
  | { kind: "evidence"; path: string; taskId: string; evidenceId: string };

export type MediaWorkspaceResolution =
  | { ok: true; route: MediaWorkspaceRoute; legacyReplacement: string | null }
  | { ok: false; attemptedPath: string; failureCode: "INVALID_MEDIA_ROUTE" };

const TASK_ID = "media_task_[a-f0-9]{32}";
const EVIDENCE_ID = "(?:mev|mtr)_[a-f0-9]{32}";

export function resolveMediaWorkspaceRoute(hash: string): MediaWorkspaceResolution | null {
  if (!hash.startsWith("#/media/")) return null;
  const path = hash.slice(1).split("?", 1)[0];
  if (path === "/media/tasks") return { ok: true, route: { kind: "task_library", path }, legacyReplacement: null };

  const legacy = new RegExp(`^/media/transcript/(${TASK_ID})$`).exec(path);
  if (legacy) {
    const replacement = `/media/tasks/${legacy[1]}`;
    return {
      ok: true,
      route: { kind: "task_overview", path: replacement, taskId: legacy[1] },
      legacyReplacement: `#${replacement}`,
    };
  }

  const evidence = new RegExp(`^/media/tasks/(${TASK_ID})/evidence/(${EVIDENCE_ID})$`).exec(path);
  if (evidence) {
    return { ok: true, route: { kind: "evidence", path, taskId: evidence[1], evidenceId: evidence[2] }, legacyReplacement: null };
  }
  const child = new RegExp(`^/media/tasks/(${TASK_ID})/(outline|timeline|mindmap|ask|export)$`).exec(path);
  if (child) {
    return {
      ok: true,
      route: { kind: child[2] as "outline" | "timeline" | "mindmap" | "ask" | "export", path, taskId: child[1] },
      legacyReplacement: null,
    };
  }
  const overview = new RegExp(`^/media/tasks/(${TASK_ID})$`).exec(path);
  if (overview) {
    return { ok: true, route: { kind: "task_overview", path, taskId: overview[1] }, legacyReplacement: null };
  }
  return { ok: false, attemptedPath: path, failureCode: "INVALID_MEDIA_ROUTE" };
}

export function mediaTaskPath(taskId: string, child?: "outline" | "timeline" | "mindmap" | "ask" | "export"): string {
  return `#/media/tasks/${taskId}${child ? `/${child}` : ""}`;
}
