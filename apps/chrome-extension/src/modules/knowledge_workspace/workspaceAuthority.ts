import {
  checkRuntimeHealth,
  getKnowledgeGraph,
  getKnowledgeServiceStatus,
  getKnowledgeSource,
  listKnowledgeSources,
  listKnowledgeWorkspaces,
  type KnowledgeGraph,
  type KnowledgeServiceStatus,
  type KnowledgeSource,
  type KnowledgeWorkspace
} from "../../runtimeClient";
import type { WorkspaceRoute } from "./workspaceRoutes";

export type WorkspaceAuthorityErrorCode = "WORKSPACE_NOT_FOUND" | "SOURCE_NOT_FOUND" | "FORBIDDEN";

export type WorkspaceAuthorityApi = {
  checkRuntimeHealth: typeof checkRuntimeHealth;
  getKnowledgeServiceStatus: typeof getKnowledgeServiceStatus;
  listKnowledgeWorkspaces: typeof listKnowledgeWorkspaces;
  listKnowledgeSources: typeof listKnowledgeSources;
  getKnowledgeSource: typeof getKnowledgeSource;
  getKnowledgeGraph: typeof getKnowledgeGraph;
};

export type WorkspaceAuthorityResolution =
  | { kind: "offline" }
  | {
      kind: "ready";
      serviceStatus: KnowledgeServiceStatus;
      workspaces: KnowledgeWorkspace[];
      sources: KnowledgeSource[];
      selectedSource: KnowledgeSource | null;
      graph: KnowledgeGraph | null;
    }
  | {
      kind: "authority_error";
      errorCode: WorkspaceAuthorityErrorCode;
      recoveryWorkspaceId?: string;
      workspaces: KnowledgeWorkspace[];
    };

export class WorkspaceAuthorityError extends Error {
  constructor(readonly code: WorkspaceAuthorityErrorCode, message = code) {
    super(message);
    this.name = "WorkspaceAuthorityError";
  }
}

const runtimeAuthorityApi: WorkspaceAuthorityApi = {
  checkRuntimeHealth,
  getKnowledgeServiceStatus,
  listKnowledgeWorkspaces,
  listKnowledgeSources,
  getKnowledgeSource,
  getKnowledgeGraph
};

export function chooseRecoveryWorkspaceId(workspaces: KnowledgeWorkspace[]): string | undefined {
  return workspaces.find((workspace) => workspace.workspaceId === "ws_default")?.workspaceId
    ?? workspaces[0]?.workspaceId;
}

export async function resolveWorkspaceAuthority(
  route: WorkspaceRoute,
  api: WorkspaceAuthorityApi = runtimeAuthorityApi
): Promise<WorkspaceAuthorityResolution> {
  try {
    if (!(await api.checkRuntimeHealth())) return { kind: "offline" };
  } catch {
    return { kind: "offline" };
  }

  let workspaces: KnowledgeWorkspace[] = [];
  try {
    const [serviceStatus, nextWorkspaces] = await Promise.all([
      api.getKnowledgeServiceStatus(),
      api.listKnowledgeWorkspaces()
    ]);
    workspaces = nextWorkspaces;
    const recoveryWorkspaceId = chooseRecoveryWorkspaceId(workspaces);
    const workspaceExists = workspaces.some((workspace) => workspace.workspaceId === route.workspaceId);
    if (!workspaceExists) {
      return { kind: "authority_error", errorCode: "WORKSPACE_NOT_FOUND", recoveryWorkspaceId, workspaces };
    }

    const sources = await api.listKnowledgeSources(route.workspaceId);
    let selectedSource: KnowledgeSource | null = null;
    let graph: KnowledgeGraph | null = null;
    if (route.routeIntent === "source_detail" && route.sourceId) {
      if (!sources.some((source) => source.sourceId === route.sourceId)) {
        return { kind: "authority_error", errorCode: "SOURCE_NOT_FOUND", recoveryWorkspaceId: route.workspaceId, workspaces };
      }
      const source = await api.getKnowledgeSource(route.sourceId);
      if (source.workspaceId !== route.workspaceId || source.status === "forgotten") {
        return { kind: "authority_error", errorCode: "SOURCE_NOT_FOUND", recoveryWorkspaceId: route.workspaceId, workspaces };
      }
      selectedSource = source;
    }
    if (route.routeIntent === "graph") graph = await api.getKnowledgeGraph(route.workspaceId);

    return { kind: "ready", serviceStatus, workspaces, sources, selectedSource, graph };
  } catch (error) {
    if (error instanceof WorkspaceAuthorityError) {
      const routeWorkspaceExists = workspaces.some((workspace) => workspace.workspaceId === route.workspaceId);
      return {
        kind: "authority_error",
        errorCode: error.code,
        recoveryWorkspaceId: routeWorkspaceExists ? route.workspaceId : chooseRecoveryWorkspaceId(workspaces),
        workspaces
      };
    }
    throw error;
  }
}
