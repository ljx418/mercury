/**
 * WP0 R1-C2-1 — Offscreen producer bootstrap.
 *
 * The Offscreen document must connect the frozen Port as soon as it loads.
 * The previous entrypoint only called `ensurePort()` inside `startCapture()`,
 * while `startCapture()` only ran after a Port `start` arrived — a circular
 * dependency that made the FIRST capture unreachable. This module is the
 * injectable, chrome-free seam so the real composition can be tested
 * without a browser.
 *
 * The two-stage session binding uses only the frozen nine messages:
 *
 *   1. Port connect            -> producer transport ready (no message)
 *   2. Background -> `start`  (captureSessionId + one-shot streamId)
 *   3. Offscreen   -> `ready` (echoes the bound captureSessionId)
 *   4. Background -> first `chunk_credit`
 *
 * No tenth protocol message is introduced, and every Port message carries
 * the same captureSessionId.
 */

import {
  MEDIA_CAPTURE_AUDIO_PORT_NAME,
  type BackgroundToOffscreenMessage
} from "./relayContracts";

export type ProducerPortLike = {
  name: string;
  postMessage(message: unknown): void;
  disconnect(): void;
  onMessage: { addListener(listener: (message: unknown) => void): void };
  onDisconnect: { addListener(listener: () => void): void };
};

export type ProducerBootstrapDeps = {
  /** `chrome.runtime.connect` in production; a fake in tests. */
  connect: (info: { name: string }) => ProducerPortLike;
  /** Handles one Background -> Offscreen message. */
  onMessage: (message: BackgroundToOffscreenMessage) => void | Promise<void>;
  /** The Port closed. */
  onDisconnect: () => void;
};

/**
 * Connect the frozen Port and register the message listener
 * SYNCHRONOUSLY, before anything is posted, so a fast `ready` from the
 * Background owner can never be lost.
 */
export function bootstrapOffscreenProducerPort(deps: ProducerBootstrapDeps): ProducerPortLike {
  const connection = deps.connect({ name: MEDIA_CAPTURE_AUDIO_PORT_NAME });
  connection.onMessage.addListener((raw: unknown) => {
    const message = raw as BackgroundToOffscreenMessage | undefined;
    if (!message || typeof message !== "object" || typeof message.type !== "string") return;
    void deps.onMessage(message);
  });
  connection.onDisconnect.addListener(() => deps.onDisconnect());
  return connection;
}
