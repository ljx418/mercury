import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaCredentialLeaseCard } from "../MediaCredentialLeaseCard";
import type { PortalCredentialLease } from "../session/credential";

const lease: PortalCredentialLease = {
  schemaVersion: "portal-credential-lease/v1",
  leaseId: `pcl_${"1".repeat(32)}`,
  envelopeId: `pce_${"2".repeat(32)}`,
  taskId: `media_task_${"3".repeat(32)}`,
  adapterId: "example",
  policyId: "example-media-consent/v1",
  policyRevision: 1,
  browserSessionBindingSha256: "4".repeat(64),
  credentialNameSetSha256: "5".repeat(64),
  credentialCount: 1,
  transportMode: "one_shot_envelope",
  secretStorage: "runtime_process_memory_only",
  serverValidationStatus: "not_performed",
  issuedAt: "2026-09-17T10:00:00Z",
  expiresAt: "2026-09-17T10:01:00Z",
  state: "active",
  failureCode: null
};

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function render(state: "idle" | "establishing" | "ready" | "failed", next: Partial<React.ComponentProps<typeof MediaCredentialLeaseCard>> = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const props: React.ComponentProps<typeof MediaCredentialLeaseCard> = {
    portalLabel: "示例门户",
    state,
    lease: state === "ready" ? lease : null,
    error: state === "failed" ? "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED" : null,
    disabled: false,
    onStart: vi.fn(),
    ...next
  };
  act(() => root?.render(<MediaCredentialLeaseCard {...props} />));
  return { host, props };
}

describe("MediaCredentialLeaseCard", () => {
  it("shows the truthful V3-1.3 ready boundary without public identifiers", () => {
    const { host } = render("ready");
    expect(host.textContent).toContain("会话租约已就绪");
    expect(host.textContent).toContain("正在准备当前视频的字幕与本地媒体路线");
    expect(host.textContent).toContain("未执行平台服务端验证");
    expect(host.textContent).not.toContain(lease.leaseId);
    expect(host.textContent).not.toContain(lease.envelopeId);
  });

  it("invokes start only through the visible command and exposes failure", () => {
    const onStart = vi.fn();
    const { host } = render("failed", { onStart });
    const button = host.querySelector<HTMLButtonElement>("[data-testid='media-credential-start']");
    act(() => button?.click());
    expect(onStart).toHaveBeenCalledOnce();
    expect(host.querySelector("[role='alert']")?.textContent).toContain("V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED");
  });

  it("disables start with an explicit precondition reason", () => {
    const { host } = render("idle", { disabled: true, disabledReason: "请先连接本机 Runtime" });
    expect(host.querySelector<HTMLButtonElement>("[data-testid='media-credential-start']")?.disabled).toBe(true);
    expect(host.textContent).toContain("请先连接本机 Runtime");
  });
});
