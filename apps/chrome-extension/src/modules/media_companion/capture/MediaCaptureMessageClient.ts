import { MEDIA_CAPTURE_MESSAGE_TYPE, type PublicMediaCaptureGrant, type MediaCaptureResponse } from "./contracts";

export class MediaCaptureMessageClient {
  constructor(private readonly sendMessage: (message: unknown) => Promise<unknown>) {}

  async start(input: {
    trustedClick: boolean;
    userActivation: boolean;
    grant: PublicMediaCaptureGrant;
    ticket: string;
    sourceIdentity: string;
    acquisitionRecordId: string;
  }): Promise<MediaCaptureResponse> {
    if (!input.trustedClick || !input.userActivation) {
      return { ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" };
    }
    const armed = await this.sendMessage({
      type: MEDIA_CAPTURE_MESSAGE_TYPE,
      command: "arm",
      trustedClick: true,
      userActivation: true,
      grant: input.grant,
      ticket: input.ticket,
      sourceIdentity: input.sourceIdentity,
      acquisitionRecordId: input.acquisitionRecordId
    }) as MediaCaptureResponse;
    if (!armed.ok || armed.state !== "armed") return armed;
    for (let attempt = 0; attempt < 300; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const status = await this.sendMessage({ type: MEDIA_CAPTURE_MESSAGE_TYPE, command: "status" }) as MediaCaptureResponse;
      if (!status.ok || status.state === "capturing") return status;
    }
    return { ok: false, failureCode: "V3_MEDIA_CAPTURE_GRANT_EXPIRED" };
  }

  stop(reason: "completed" | "cancelled" | "navigation" | "tab_closed" | "consent_revoked" | "runtime_disconnected" | "timeout" | "failed") {
    return this.sendMessage({ type: MEDIA_CAPTURE_MESSAGE_TYPE, command: "stop", reason }) as Promise<MediaCaptureResponse>;
  }
}
