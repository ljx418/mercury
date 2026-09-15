export type WorkspaceRouteIntent = "source_library" | "source_detail" | "ask" | "graph" | "permissions";

export type WorkspaceRoute = {
  hostStrategy: "extension_workspace_page";
  routeIntent: WorkspaceRouteIntent;
  workspaceId: string;
  sourceId?: string;
  operationId?: string;
  resolvedPath: string;
};

export type WorkspaceRouteParseResult =
  | { ok: true; route: WorkspaceRoute }
  | { ok: false; errorCode: "INVALID_ROUTE"; attemptedPath: string };

const ROUTE_PATHS: Record<Exclude<WorkspaceRouteIntent, "source_detail">, string> = {
  source_library: "/knowledge/sources",
  ask: "/knowledge/ask",
  graph: "/knowledge/graph",
  permissions: "/knowledge/settings/permissions"
};

export function buildWorkspaceHash(route: Pick<WorkspaceRoute, "routeIntent" | "workspaceId" | "sourceId">): string {
  const workspaceId = requireStableId(route.workspaceId, "workspaceId");
  const query = `workspaceId=${encodeURIComponent(workspaceId)}`;
  if (route.routeIntent === "source_detail") {
    const sourceId = requireStableId(route.sourceId, "sourceId");
    return `#/knowledge/sources/${encodeURIComponent(sourceId)}?${query}`;
  }
  if (route.sourceId !== undefined) throw new Error(`${route.routeIntent} does not accept sourceId.`);
  return `#${ROUTE_PATHS[route.routeIntent]}?${query}`;
}

export function parseWorkspaceHash(hash: string): WorkspaceRouteParseResult {
  const attemptedPath = hash || "(empty)";
  if (!hash.startsWith("#/knowledge/")) return invalid(attemptedPath);

  let parsed: URL;
  try {
    parsed = new URL(hash.slice(1), "https://navia.local");
  } catch {
    return invalid(attemptedPath);
  }

  const keys = [...parsed.searchParams.keys()];
  if (keys.length !== 1 || keys[0] !== "workspaceId" || parsed.searchParams.getAll("workspaceId").length !== 1) {
    return invalid(attemptedPath);
  }
  const workspaceId = decodedStableId(parsed.searchParams.get("workspaceId"));
  if (!workspaceId) return invalid(attemptedPath);

  let routeIntent: WorkspaceRouteIntent;
  let sourceId: string | undefined;
  if (parsed.pathname === ROUTE_PATHS.source_library) routeIntent = "source_library";
  else if (parsed.pathname === ROUTE_PATHS.ask) routeIntent = "ask";
  else if (parsed.pathname === ROUTE_PATHS.graph) routeIntent = "graph";
  else if (parsed.pathname === ROUTE_PATHS.permissions) routeIntent = "permissions";
  else {
    const match = parsed.pathname.match(/^\/knowledge\/sources\/([^/]+)$/);
    const decodedSourceId = decodedStableId(match?.[1]);
    if (!decodedSourceId) return invalid(attemptedPath);
    sourceId = decodedSourceId;
    routeIntent = "source_detail";
  }

  const resolvedPath = buildWorkspaceHash({ routeIntent, workspaceId, sourceId });
  if (resolvedPath !== hash) return invalid(attemptedPath);
  return {
    ok: true,
    route: {
      hostStrategy: "extension_workspace_page",
      routeIntent,
      workspaceId,
      sourceId,
      resolvedPath
    }
  };
}

function requireStableId(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}

function decodedStableId(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value).trim();
    if (!decoded || decoded.includes("/") || decoded.includes("?") || decoded.includes("#")) return null;
    return decoded;
  } catch {
    return null;
  }
}

function invalid(attemptedPath: string): WorkspaceRouteParseResult {
  return { ok: false, errorCode: "INVALID_ROUTE", attemptedPath };
}
