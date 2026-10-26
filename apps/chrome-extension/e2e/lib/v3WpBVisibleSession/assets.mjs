/**
 * WP-B VH4/VH5/VH6 — the registry asset generation and validation.
 *
 * The assets are generated ONLY in the later approved run, from the explicitly
 * authorized seed, with the FROZEN registry generator settings:
 *
 *   * the seed is LOOPED, never padded, never truncated and never sparsified;
 *   * the encoded result is MEASURED afterwards: the byte window, the allocated
 *     ratio, the SHA-256, the ffprobe digest, the non-empty segment count and
 *     the distinct frame count are all part of the receipt;
 *   * every probe and every temporary file lives UNDER THE OWNED ROOT, and
 *     each creation is protected by a cleanup that also runs when the encode,
 *     the read or the hash fails.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { HarnessError } from "./plan.mjs";

export const FROZEN_GENERATOR = Object.freeze({
  videoCodec: "libx264",
  videoPixelFormat: "yuv420p",
  videoWidth: 1280,
  videoHeight: 720,
  videoFrameRate: 30,
  videoBitrate: "8M",
  audioCodec: "aac",
  audioSampleRate: 48000,
  audioChannels: 2,
  audioBitrate: "160k"
});

/** The argv of one registry asset. The seed is LOOPED. */
export function buildAssetArgv({ asset, seedPath, target, ffmpegPath, generator }) {
  const settings = { ...FROZEN_GENERATOR, ...(generator ?? {}) };
  return [
    ffmpegPath,
    "-nostdin",
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-stream_loop",
    "-1",
    "-i",
    seedPath,
    "-t",
    String(asset.targetDurationSeconds),
    "-c:v",
    settings.videoCodec,
    "-pix_fmt",
    settings.videoPixelFormat,
    "-r",
    String(settings.videoFrameRate),
    "-s",
    `${settings.videoWidth}x${settings.videoHeight}`,
    "-b:v",
    settings.videoBitrate,
    "-c:a",
    settings.audioCodec,
    "-ar",
    String(settings.audioSampleRate),
    "-ac",
    String(settings.audioChannels),
    "-b:a",
    settings.audioBitrate,
    target
  ];
}

function sha256File(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** The ffprobe facts of a file: the streams, the duration and the digest. */
export function probeMedia({ file, ffprobePath }) {
  const result = spawnSync(
    ffprobePath,
    [
      "-v", "error",
      "-show_entries", "stream=codec_type,codec_name,width,height",
      "-show_entries", "format=duration",
      "-of", "json",
      file
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new HarnessError(`EXTERNAL-INPUT BLOCK: the media could not be probed: ${result.stderr || ""}`);
  }
  const payload = JSON.parse(result.stdout || "{}");
  const factsSha256 = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  return {
    streams: payload.streams ?? [],
    durationMs: Math.round(Number(payload.format?.duration ?? 0) * 1000),
    sha256: sha256File(file),
    factsSha256
  };
}

/** The non-empty SenseVoice segment count of a file. */
export function transcribeMedia({ file, senseVoice, ffmpegPath, temp }) {
  if (!ffmpegPath || !temp) {
    throw new HarnessError(
      "EXTERNAL-INPUT BLOCK: SenseVoice qualification requires the verified ffmpeg and an owned temporary root.",
    );
  }
  // The native SenseVoice binary accepts wav/mp3/flac, not an MP4 container.
  // Decode through the already-verified product ffmpeg into the owned root.
  const wav = temp.pathFor("asr/qualification.wav");
  fs.mkdirSync(path.dirname(wav), { recursive: true });
  try {
    const decoded = spawnSync(
      ffmpegPath,
      [
        "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-i", file, "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000",
        "-c:a", "pcm_s16le", wav
      ],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    if (decoded.status !== 0 || !fs.existsSync(wav)) {
      throw new HarnessError(
        `EXTERNAL-INPUT BLOCK: the media audio could not be decoded: ${decoded.stderr || ""}`,
      );
    }
    const result = spawnSync(
      senseVoice.files.binary,
      [
        "-m", senseVoice.files.model,
        "--vad", senseVoice.files.vad,
        "--vad-maxseg", "15000",
        "-a", wav,
        "--backend", "cpu",
        "--srt"
      ],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    if (result.status !== 0) {
      throw new HarnessError(`EXTERNAL-INPUT BLOCK: the media could not be transcribed: ${result.stderr || ""}`);
    }
    const nonEmptySegments = (result.stdout || "")
      .split("\n")
      .filter((line) => line.trim() && !/^\d+$/.test(line.trim()) && !line.includes("-->"))
      .filter((line) => line.trim().length > 0).length;
    return { nonEmptySegments };
  } finally {
    fs.rmSync(wav, { force: true });
  }
}

/**
 * The distinct frame digests of a file.
 *
 * Every probe frame lives UNDER THE OWNED ROOT and is removed even when the
 * extraction fails.
 */
export function distinctFrameHashes({ file, ffmpegPath, temp, count = 3 }) {
  const hashes = new Set();
  const frames = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const second = Math.floor((index + 1) * (10 / (count + 1)));
      const target = temp.pathFor(`frames/frame-${index + 1}.png`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      frames.push(target);
      const result = spawnSync(
        ffmpegPath,
        [
          "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
          "-ss", String(second), "-i", file,
          "-frames:v", "1", "-c:v", "png", "-f", "image2", target
        ],
        { encoding: "utf8" },
      );
      if (result.status !== 0 || !fs.existsSync(target)) {
        throw new HarnessError("EXTERNAL-INPUT BLOCK: a frame could not be extracted.");
      }
      hashes.add(sha256File(target));
    }
  } finally {
    for (const frame of frames) {
      try {
        fs.rmSync(frame, { force: true });
      } catch {
        // A frame that is already gone is not a failure.
      }
    }
  }
  return [...hashes];
}

/**
 * Validate the authorized seed against the FROZEN registry requirements.
 */
export function validateAuthorizedSeed({ seedPath, requirements, tools, senseVoice, temp }) {
  const probe = probeMedia({ file: seedPath, ffprobePath: tools.ffprobe.path });
  const kinds = new Set(probe.streams.map((stream) => stream.codec_type));
  if (!kinds.has("video") || !kinds.has("audio")) {
    throw new HarnessError(
      "EXTERNAL-INPUT BLOCK: the authorized seed must carry BOTH a video and an audio stream.",
    );
  }
  if (probe.durationMs < requirements.minimumDurationMs || probe.durationMs > requirements.maximumDurationMs) {
    throw new HarnessError(
      `EXTERNAL-INPUT BLOCK: the authorized seed is ${probe.durationMs} ms, outside the frozen ${requirements.minimumDurationMs}..${requirements.maximumDurationMs} ms window.`,
    );
  }
  const transcript = transcribeMedia({
    file: seedPath,
    senseVoice,
    ffmpegPath: tools.ffmpeg.path,
    temp
  });
  if (transcript.nonEmptySegments < requirements.senseVoiceMinimumNonEmptySegments) {
    throw new HarnessError(
      `EXTERNAL-INPUT BLOCK: the authorized seed produced ${transcript.nonEmptySegments} non-empty segments; ${requirements.senseVoiceMinimumNonEmptySegments} are required.`,
    );
  }
  const frames = distinctFrameHashes({ file: seedPath, ffmpegPath: tools.ffmpeg.path, temp });
  if (frames.length < requirements.distinctFrameHashesAtLeast) {
    throw new HarnessError(
      `EXTERNAL-INPUT BLOCK: the authorized seed produced ${frames.length} distinct frame hashes; ${requirements.distinctFrameHashesAtLeast} are required.`,
    );
  }
  return {
    durationMs: probe.durationMs,
    nonEmptySegments: transcript.nonEmptySegments,
    distinctFrameCount: frames.length,
    ffprobeSha256: probe.factsSha256
  };
}

/**
 * Generate ONE registry asset and measure it.
 *
 * The result is never trusted: the byte window, the allocated ratio and the
 * frozen oracles are all measured after the encode.
 */
export function generateRegistryAsset({
  asset,
  seedPath,
  tools,
  temp,
  generator,
  senseVoice,
  requirements
}) {
  const target = temp.pathFor(`assets/${asset.id}.mp4`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const argv = buildAssetArgv({ asset, seedPath, target, ffmpegPath: tools.ffmpeg.path, generator });
  const result = spawnSync(argv[0], argv.slice(1), { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0 || !fs.existsSync(target)) {
    throw new HarnessError(
      `EXTERNAL-INPUT BLOCK: the ${asset.id} asset could not be generated: ${result.stderr || ""}`.slice(0, 400),
    );
  }
  const stat = fs.statSync(target);
  const allocatedBytes = stat.blocks * 512;
  const allocatedRatio = stat.size > 0 ? allocatedBytes / stat.size : 0;
  if (stat.size < asset.minimumBytes || stat.size > asset.maximumBytes) {
    throw new HarnessError(
      `EXTERNAL-INPUT BLOCK: the ${asset.id} asset is ${stat.size} bytes, outside the frozen ${asset.minimumBytes}..${asset.maximumBytes} window.`,
    );
  }
  if (allocatedRatio < asset.minimumAllocatedRatio) {
    throw new HarnessError(
      `EXTERNAL-INPUT BLOCK: the ${asset.id} asset is sparse (allocated ratio ${allocatedRatio.toFixed(4)}).`,
    );
  }
  const probe = probeMedia({ file: target, ffprobePath: tools.ffprobe.path });
  if (!senseVoice || !requirements) {
    throw new HarnessError(
      `EXTERNAL-INPUT BLOCK: the generated ${asset.id} asset cannot be qualified without SenseVoice and the frozen seed requirements.`,
    );
  }
  const transcript = transcribeMedia({
    file: target,
    senseVoice,
    ffmpegPath: tools.ffmpeg.path,
    temp
  });
  const frames = distinctFrameHashes({
    file: target,
    ffmpegPath: tools.ffmpeg.path,
    temp,
    count: requirements.distinctFrameHashesAtLeast
  });
  if (transcript.nonEmptySegments < requirements.senseVoiceMinimumNonEmptySegments) {
    throw new HarnessError(
      `EXTERNAL-INPUT BLOCK: the generated ${asset.id} asset produced ${transcript.nonEmptySegments} non-empty segments.`,
    );
  }
  if (frames.length < requirements.distinctFrameHashesAtLeast) {
    throw new HarnessError(
      `EXTERNAL-INPUT BLOCK: the generated ${asset.id} asset produced ${frames.length} distinct frame hashes.`,
    );
  }
  return {
    path: target,
    byteLength: stat.size,
    allocatedRatio: Number(allocatedRatio.toFixed(4)),
    sha256: probe.sha256,
    ffprobeSha256: probe.factsSha256,
    durationMs: probe.durationMs,
    nonEmptySegments: transcript.nonEmptySegments,
    distinctFrameCount: frames.length,
    assetId: asset.id
  };
}
