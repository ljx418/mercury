const OWNED_FRAME_TRUSTED_INPUT = "owned_playwright_frame_trusted_input";

export function captureActionInputMode(testId) {
  if (testId === "media-companion-enable") return OWNED_FRAME_TRUSTED_INPUT;
  if (testId === "media-capture-start") return OWNED_FRAME_TRUSTED_INPUT;
  if (testId === "media-capture-finish" || testId === "media-capture-cancel") {
    return OWNED_FRAME_TRUSTED_INPUT;
  }
  throw new Error(`unsupported trusted capture action: ${String(testId)}`);
}

