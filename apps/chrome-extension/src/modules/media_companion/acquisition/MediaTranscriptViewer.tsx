import type { MediaTranscriptProjection } from "../../../runtimeClient";

function time(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function MediaTranscriptViewer({ segments }: { segments: MediaTranscriptProjection["segments"] }) {
  if (!segments.length) return <p role="status">转写片段将在本机任务完成后显示。</p>;
  return <ol className="media-transcript-viewer" aria-label="视频转写片段">
    {segments.map((segment) => <li key={segment.segmentId}>
      <time>{time(segment.startMs)}–{time(segment.endMs)}</time>
      <p>{segment.text}</p>
    </li>)}
  </ol>;
}
