import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  buildWorkspaceHash,
  parseWorkspaceHash,
  type WorkspaceRoute,
  type WorkspaceRouteParseResult
} from "./workspaceRoutes";

export type WorkspaceRouterRenderProps = {
  resolution: WorkspaceRouteParseResult;
  navigate: (route: Pick<WorkspaceRoute, "routeIntent" | "workspaceId" | "sourceId">, options?: { replace?: boolean }) => void;
  recoverToLibrary: (workspaceId?: string) => void;
};

type WorkspaceRouterProps = {
  children: (props: WorkspaceRouterRenderProps) => ReactNode;
  fallbackWorkspaceId?: string;
};

export function WorkspaceRouter({ children, fallbackWorkspaceId = "ws_default" }: WorkspaceRouterProps) {
  const [resolution, setResolution] = useState<WorkspaceRouteParseResult>(() => parseWorkspaceHash(window.location.hash));

  const restoreFromLocation = useCallback(() => {
    setResolution(parseWorkspaceHash(window.location.hash));
  }, []);

  useEffect(() => {
    window.addEventListener("hashchange", restoreFromLocation);
    window.addEventListener("popstate", restoreFromLocation);
    return () => {
      window.removeEventListener("hashchange", restoreFromLocation);
      window.removeEventListener("popstate", restoreFromLocation);
    };
  }, [restoreFromLocation]);

  const navigate = useCallback<WorkspaceRouterRenderProps["navigate"]>((route, options) => {
    const nextHash = buildWorkspaceHash(route);
    if (options?.replace) window.history.replaceState(null, "", nextHash);
    else window.history.pushState(null, "", nextHash);
    setResolution(parseWorkspaceHash(nextHash));
  }, []);

  const recoverToLibrary = useCallback((workspaceId = fallbackWorkspaceId) => {
    navigate({ routeIntent: "source_library", workspaceId });
  }, [fallbackWorkspaceId, navigate]);

  return children({ resolution, navigate, recoverToLibrary });
}

export { buildWorkspaceHash, parseWorkspaceHash } from "./workspaceRoutes";
export type { WorkspaceRoute, WorkspaceRouteIntent, WorkspaceRouteParseResult } from "./workspaceRoutes";

