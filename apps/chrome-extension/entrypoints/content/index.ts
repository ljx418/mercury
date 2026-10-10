import { initializeContentBridge } from "../../src/contentBridge";

declare const __NAVIA_E2E_BRIDGE__: boolean;

export default defineContentScript({
  matches: ["https://www.bilibili.com/video/*"],
  main() {
    const mode = window.location.hostname === "www.bilibili.com" && window.location.pathname.startsWith("/video/")
      ? "portal_auto"
      : "bridge_only";
    initializeContentBridge(document, window.location.href, { mode });
    if (__NAVIA_E2E_BRIDGE__) installCredentialSenderProbe();
  }
});

function installCredentialSenderProbe() {
  window.addEventListener("message", (event) => {
    if (
      event.source !== window
      || event.data?.type !== "navia.e2e.mediaCredential.senderProbe"
      || event.data?.command !== "get_browser_session_binding"
    ) return;
    void chrome.runtime.sendMessage({
      type: "navia.mediaCredential",
      command: "get_browser_session_binding"
    }).then((response) => {
      const failureCode = response && typeof response === "object" && typeof response.failureCode === "string"
        ? response.failureCode
        : "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED";
      window.postMessage({
        type: "navia.e2e.mediaCredential.senderProbeResult",
        probeId: typeof event.data.probeId === "string" ? event.data.probeId : "unknown",
        ok: response?.ok === true,
        failureCode
      }, window.location.origin);
    }).catch(() => {
      window.postMessage({
        type: "navia.e2e.mediaCredential.senderProbeResult",
        probeId: typeof event.data.probeId === "string" ? event.data.probeId : "unknown",
        ok: false,
        failureCode: "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED"
      }, window.location.origin);
    });
  });
}
