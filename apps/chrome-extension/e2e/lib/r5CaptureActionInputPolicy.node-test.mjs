import assert from "node:assert/strict";
import test from "node:test";

import { captureActionInputMode } from "./r5CaptureActionInputPolicy.mjs";

test("enable uses trusted input in the exact extension frame", () => {
  assert.equal(captureActionInputMode("media-companion-enable"), "owned_playwright_frame_trusted_input");
});

test("capture start prepares the grant through trusted input in the exact extension frame", () => {
  assert.equal(captureActionInputMode("media-capture-start"), "owned_playwright_frame_trusted_input");
});

test("finish and cancel use trusted input in the exact extension frame", () => {
  assert.equal(captureActionInputMode("media-capture-finish"), "owned_playwright_frame_trusted_input");
  assert.equal(captureActionInputMode("media-capture-cancel"), "owned_playwright_frame_trusted_input");
});

test("unknown actions fail closed", () => {
  assert.throws(() => captureActionInputMode("unknown"), /unsupported trusted capture action/);
});

