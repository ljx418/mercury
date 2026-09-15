import { describe, expect, it } from "vitest";
import type { WorkspaceAuthorityApi } from "./workspaceAuthority";
import {
  WorkspaceAuthorityError,
  chooseRecoveryWorkspaceId,
  resolveWorkspaceAuthority
} from "./workspaceAuthority";
import type { WorkspaceRoute } from "./workspaceRoutes";

const route: WorkspaceRoute = {
  hostStrategy: "extension_workspace_page",
  routeIntent: "source_library",
  workspaceId: "missing_workspace",
  resolvedPath: "#/knowledge/sources?workspaceId=missing_workspace"
};

function api(overrides: Partial<WorkspaceAuthorityApi> = {}): WorkspaceAuthorityApi {
  return {
    checkRuntimeHealth: async () => true,
    getKnowledgeServiceStatus: async () => ({
      schemaVersion: "v2-knowledge-status-draft-2026-07-10",
      observedAt: "2026-09-08T00:00:00.000Z",
      frontendInferredRuntimeStatus: "online",
      runtimeStatus: "online",
      adapterStatus: "ready",
      dataServiceStatus: "unchecked",
      sourceBuildStatus: "not_saved"
    }),
    listKnowledgeWorkspaces: async () => [{
      workspaceId: "ws_default",
      name: "Default",
      sourceCount: 0,
      pendingBuildCount: 0,
      traceCoverage: 0,
      createdAt: "2026-09-08T00:00:00.000Z"
    }],
    listKnowledgeSources: async () => [],
    getKnowledgeSource: async () => { throw new Error("not used"); },
    getKnowledgeGraph: async () => ({ workspaceId: "ws_default", nodes: [], edges: [], status: "ready" }),
    ...overrides
  };
}

describe("resolveWorkspaceAuthority", () => {
  it("treats a Runtime transport rejection as offline", async () => {
    await expect(resolveWorkspaceAuthority(route, api({
      checkRuntimeHealth: async () => { throw new TypeError("Failed to fetch"); }
    }))).resolves.toEqual({ kind: "offline" });
  });

  it("recovers a missing workspace only to a Runtime-observed default", async () => {
    await expect(resolveWorkspaceAuthority(route, api())).resolves.toEqual({
      kind: "authority_error",
      errorCode: "WORKSPACE_NOT_FOUND",
      recoveryWorkspaceId: "ws_default",
      workspaces: [{
        workspaceId: "ws_default",
        name: "Default",
        sourceCount: 0,
        pendingBuildCount: 0,
        traceCoverage: 0,
        createdAt: "2026-09-08T00:00:00.000Z"
      }]
    });
  });

  it("uses the first observed workspace when ws_default is absent", async () => {
    expect(chooseRecoveryWorkspaceId([
      { workspaceId: "ws_research", name: "Research", sourceCount: 0, pendingBuildCount: 0, traceCoverage: 0, createdAt: "2026-09-08T00:00:00.000Z" },
      { workspaceId: "ws_archive", name: "Archive", sourceCount: 0, pendingBuildCount: 0, traceCoverage: 0, createdAt: "2026-09-08T00:00:00.000Z" }
    ])).toBe("ws_research");
  });

  it("does not invent a recovery workspace when Runtime returns none", async () => {
    const result = await resolveWorkspaceAuthority(route, api({ listKnowledgeWorkspaces: async () => [] }));
    expect(result).toEqual({
      kind: "authority_error",
      errorCode: "WORKSPACE_NOT_FOUND",
      recoveryWorkspaceId: undefined,
      workspaces: []
    });
  });

  it("supports an injected forbidden authority branch without changing Runtime contracts", async () => {
    const forbiddenRoute = { ...route, workspaceId: "ws_default", resolvedPath: "#/knowledge/sources?workspaceId=ws_default" };
    const result = await resolveWorkspaceAuthority(forbiddenRoute, api({
      listKnowledgeSources: async () => { throw new WorkspaceAuthorityError("FORBIDDEN"); }
    }));
    expect(result).toEqual({
      kind: "authority_error",
      errorCode: "FORBIDDEN",
      recoveryWorkspaceId: "ws_default",
      workspaces: [{
        workspaceId: "ws_default",
        name: "Default",
        sourceCount: 0,
        pendingBuildCount: 0,
        traceCoverage: 0,
        createdAt: "2026-09-08T00:00:00.000Z"
      }]
    });
  });
});
