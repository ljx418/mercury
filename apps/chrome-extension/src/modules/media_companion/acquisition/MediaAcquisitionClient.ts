import {
  createMediaAcquisition,
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
  execution: MediaAcquisitionExecution;
  eligibility: MediaCaptureEligibility | null;
  status: "input_acquired" | "awaiting_capture" | "blocked";
  failureCode: string | null;
};

export type MediaAcquisitionClientDependencies = {
  collectCurrentContext(): Promise<MediaPageContext>;
  create: typeof createMediaAcquisition;
  execute: typeof executeMediaAcquisition;
  recordPublicSubtitleFailure: typeof recordMediaCaptureRouteFailure;
};

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
    await this.#dependencies.create({
      taskId: lease.taskId,
      sourceIdentity,
      adapterId: context.adapterId,
      mediaId: context.mediaId,
      playbackUnitId: context.playbackUnitId,
      partId: context.part.id,
      consentPolicyId: policy.policyId,
      consentPolicyRevision: policy.policyRevision
    });
    const execution = await this.#dependencies.execute(lease.taskId);
    if (execution.outcome === "input_acquired") {
      return { context, execution, eligibility: null, status: "input_acquired", failureCode: null };
    }
    if (context.transcriptAvailability === "available") {
      return {
        context,
        execution,
        eligibility: null,
        status: "blocked",
        failureCode: "V3_MEDIA_PUBLIC_TRANSCRIPT_READER_UNAVAILABLE"
      };
    }
    const eligibility = await this.#dependencies.recordPublicSubtitleFailure(lease.taskId, {
      route: "public_or_page_subtitle",
      failureCode: context.transcriptAvailability === "restricted"
        ? "V3_MEDIA_PLATFORM_REJECTED"
        : "V3_MEDIA_SUBTITLE_UNAVAILABLE"
    });
    if (!eligibility.captureFallbackEligible || eligibility.failures.length !== 3) {
      throw new Error("V3_MEDIA_CAPTURE_NOT_ELIGIBLE");
    }
    return { context, execution, eligibility, status: "awaiting_capture", failureCode: null };
  }
}

export function createChromeMediaContextCollector(): () => Promise<MediaPageContext> {
  return async () => {
    const candidates = (await chrome.tabs.query({ currentWindow: true })).filter(
      (tab) => typeof tab.id === "number" && /^https:\/\/www\.bilibili\.com\/video\//.test(tab.url ?? "")
    );
    if (candidates.length !== 1) throw new Error("V3_MEDIA_PORTAL_AMBIGUOUS");
    const response = await chrome.tabs.sendMessage(
      candidates[0].id!,
      { type: MEDIA_COLLECT_CONTEXT_MESSAGE_TYPE }
    ) as MediaBridgeResponse<MediaPageContext>;
    if (!response?.ok) throw new Error(response?.failureCode ?? "V3_MEDIA_PAGE_IDENTITY_INCOMPLETE");
    return response.value;
  };
}
