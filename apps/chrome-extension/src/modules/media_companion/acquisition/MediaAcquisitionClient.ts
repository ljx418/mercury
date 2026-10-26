import {
  resolveMediaAcquisition,
  executeMediaAcquisition,
  recordMediaCaptureRouteFailure,
  type MediaAcquisitionExecution,
  type MediaCaptureEligibility
} from "../../../runtimeClient";
import type { MediaPageContext, MediaBridgeResponse } from "../contracts";
import type { PortalCredentialLease } from "../session";

export const MEDIA_COLLECT_CONTEXT_MESSAGE_TYPE = "navia.media.collectPageContext";

export type MediaAcquisitionStartResult = {
  context: MediaPageContext;
  taskId: string;
  disposition: "created" | "attached" | "published";
  policyProvenance?: "verified_current" | "unverified_legacy";
  execution: MediaAcquisitionExecution | null;
  eligibility: MediaCaptureEligibility | null;
  status: "input_acquired" | "awaiting_capture" | "blocked" | "attached" | "published";
  failureCode: string | null;
};

export type MediaAcquisitionClientDependencies = {
  collectCurrentContext(): Promise<MediaPageContext>;
  resolve: typeof resolveMediaAcquisition;
  execute: typeof executeMediaAcquisition;
  recordPublicSubtitleFailure: typeof recordMediaCaptureRouteFailure;
};

type MediaTabCandidate = Pick<chrome.tabs.Tab, "active" | "id" | "url">;

const SAFE_ID = /^[A-Za-z0-9._-]{1,160}$/;

function requireIdentityPart(value: string, field: string): string {
  if (!SAFE_ID.test(value)) throw new Error(`V3_MEDIA_PAGE_IDENTITY_INCOMPLETE:${field}`);
  return value;
}

export function mediaSourceIdentity(context: MediaPageContext): string {
  return [
    "portal",
    requireIdentityPart(context.adapterId, "adapterId"),
    requireIdentityPart(context.mediaId, "mediaId"),
    requireIdentityPart(context.playbackUnitId, "playbackUnitId"),
    requireIdentityPart(context.part.id, "partId")
  ].join(":");
}

export class MediaAcquisitionClient {
  readonly #dependencies: MediaAcquisitionClientDependencies;

  constructor(dependencies: MediaAcquisitionClientDependencies) {
    this.#dependencies = dependencies;
  }

  async start(
    lease: PortalCredentialLease,
    policy: { policyId: string; policyRevision: number }
  ): Promise<MediaAcquisitionStartResult> {
    const context = await this.#dependencies.collectCurrentContext();
    if (context.adapterId !== lease.adapterId) throw new Error("V3_MEDIA_LEASE_TASK_MISMATCH");
    const sourceIdentity = mediaSourceIdentity(context);
    const resolved = await this.#dependencies.resolve({
      taskId: lease.taskId,
      sourceIdentity,
      adapterId: context.adapterId,
      mediaId: context.mediaId,
      playbackUnitId: context.playbackUnitId,
      partId: context.part.id,
      consentPolicyId: policy.policyId,
      consentPolicyRevision: policy.policyRevision
    });
    if (resolved.disposition !== "created") {
      return { context, taskId: resolved.authoritativeTaskId, disposition: resolved.disposition,
        policyProvenance: resolved.disposition === "published" ? resolved.policyProvenance : undefined,
        execution: null, eligibility: null, status: resolved.disposition, failureCode: null };
    }
    const execution = await this.#dependencies.execute(resolved.authoritativeTaskId);
    if (execution.outcome === "input_acquired") {
      return { context, taskId: resolved.authoritativeTaskId, disposition: "created", execution, eligibility: null, status: "input_acquired", failureCode: null };
    }
    if (context.transcriptAvailability === "available") {
      return {
        context,
        taskId: resolved.authoritativeTaskId,
        disposition: "created",
        execution,
        eligibility: null,
        status: "blocked",
        failureCode: "V3_MEDIA_PUBLIC_TRANSCRIPT_READER_UNAVAILABLE"
      };
    }
    const eligibility = await this.#dependencies.recordPublicSubtitleFailure(resolved.authoritativeTaskId, {
      route: "public_or_page_subtitle",
      failureCode: context.transcriptAvailability === "restricted"
        ? "V3_MEDIA_PLATFORM_REJECTED"
        : "V3_MEDIA_SUBTITLE_UNAVAILABLE"
    });
    if (!eligibility.captureFallbackEligible || eligibility.failures.length !== 3) {
      throw new Error("V3_MEDIA_CAPTURE_NOT_ELIGIBLE");
    }
    return { context, taskId: resolved.authoritativeTaskId, disposition: "created", execution, eligibility, status: "awaiting_capture", failureCode: null };
  }

  async startConfigured(
    taskId: string,
    adapterId: string,
    policy: { policyId: string; policyRevision: number }
  ): Promise<MediaAcquisitionStartResult> {
    const context = await this.#dependencies.collectCurrentContext();
    if (context.adapterId !== adapterId) throw new Error("V3_MEDIA_PERSISTENT_SESSION_ADAPTER_MISMATCH");
    const sourceIdentity = mediaSourceIdentity(context);
    const resolved = await this.#dependencies.resolve({
      taskId,
      sourceIdentity,
      adapterId: context.adapterId,
      mediaId: context.mediaId,
      playbackUnitId: context.playbackUnitId,
      partId: context.part.id,
      consentPolicyId: policy.policyId,
      consentPolicyRevision: policy.policyRevision
    });
    if (resolved.disposition !== "created") {
      return { context, taskId: resolved.authoritativeTaskId, disposition: resolved.disposition,
        policyProvenance: resolved.disposition === "published" ? resolved.policyProvenance : undefined,
        execution: null, eligibility: null, status: resolved.disposition, failureCode: null };
    }
    const execution = await this.#dependencies.execute(resolved.authoritativeTaskId);
    if (execution.outcome === "input_acquired") {
      return { context, taskId: resolved.authoritativeTaskId, disposition: "created", execution, eligibility: null, status: "input_acquired", failureCode: null };
    }
    if (context.transcriptAvailability === "available") {
      return { context, taskId: resolved.authoritativeTaskId, disposition: "created", execution, eligibility: null, status: "blocked", failureCode: "V3_MEDIA_PUBLIC_TRANSCRIPT_READER_UNAVAILABLE" };
    }
    const eligibility = await this.#dependencies.recordPublicSubtitleFailure(resolved.authoritativeTaskId, {
      route: "public_or_page_subtitle",
      failureCode: context.transcriptAvailability === "restricted"
        ? "V3_MEDIA_PLATFORM_REJECTED"
        : "V3_MEDIA_SUBTITLE_UNAVAILABLE"
    });
    return {
      context,
      taskId: resolved.authoritativeTaskId,
      disposition: "created",
      execution,
      eligibility,
      status: eligibility.captureFallbackEligible ? "awaiting_capture" : "blocked",
      failureCode: eligibility.captureFallbackEligible ? null : "V3_MEDIA_CAPTURE_NOT_ELIGIBLE"
    };
  }
}

export function createChromeMediaContextCollector(): () => Promise<MediaPageContext> {
  return async () => {
    const candidates = await chrome.tabs.query({ currentWindow: true });
    const selected = selectCurrentMediaTab(candidates);
    const response = await chrome.tabs.sendMessage(
      selected.id!,
      { type: MEDIA_COLLECT_CONTEXT_MESSAGE_TYPE }
    ) as MediaBridgeResponse<MediaPageContext>;
    if (!response?.ok) throw new Error(response?.failureCode ?? "V3_MEDIA_PAGE_IDENTITY_INCOMPLETE");
    return response.value;
  };
}

export function selectCurrentMediaTab(tabs: readonly MediaTabCandidate[]): MediaTabCandidate {
  const candidates = tabs.filter(
    (tab) => typeof tab.id === "number" && /^https:\/\/www\.bilibili\.com\/video\//.test(tab.url ?? "")
  );
  const activeCandidates = candidates.filter((tab) => tab.active);
  if (activeCandidates.length === 1) return activeCandidates[0];
  if (candidates.length !== 1) throw new Error("V3_MEDIA_PORTAL_AMBIGUOUS");
  return candidates[0];
}
