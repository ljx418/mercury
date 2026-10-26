const RECORDER_MIME_CANDIDATES = Object.freeze([
  "audio/webm;codecs=opus",
  "audio/webm",
] as const);

export function selectCaptureRecorderMime(
  isTypeSupported: (mimeType: string) => boolean,
): string | null {
  return RECORDER_MIME_CANDIDATES.find((mimeType) => isTypeSupported(mimeType)) ?? null;
}

/** Split PCM16 bytes without ever separating a two-byte sample. */
export function splitPcm16Bytes(bytes: Uint8Array, maxRawChunkBytes: number): Uint8Array[] {
  const chunkSize = Math.floor(maxRawChunkBytes / 2) * 2;
  if (chunkSize < 2 || bytes.byteLength % 2 !== 0) {
    throw new Error("V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID");
  }
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    chunks.push(bytes.slice(offset, Math.min(bytes.byteLength, offset + chunkSize)));
  }
  return chunks;
}
