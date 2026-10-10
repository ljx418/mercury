import { useEffect, useRef, useState } from "react";
import {
  getLatestMediaTranscriptProjection,
  getMediaTranscriptProjection,
  type MediaTranscriptProjection
} from "../../../runtimeClient";

type TaskAuthority = { taskId?: string | null; sourceIdentity?: string | null };

export function useMediaAcquisitionTask(
  authority: TaskAuthority,
  options: { intervalMs?: number } = {}
) {
  const [projection, setProjection] = useState<MediaTranscriptProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(authority.taskId || authority.sourceIdentity));
  const revisionRef = useRef(0);
  const failureRef = useRef(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    revisionRef.current = 0;
    failureRef.current = 0;
    setProjection(null);
    setError(null);
    setLoading(Boolean(authority.taskId || authority.sourceIdentity));

    async function poll() {
      try {
        const next = authority.taskId
          ? await getMediaTranscriptProjection(authority.taskId)
          : authority.sourceIdentity
            ? await getLatestMediaTranscriptProjection(authority.sourceIdentity)
            : null;
        if (!active || next === null) return;
        if (next.revision >= revisionRef.current) {
          revisionRef.current = next.revision;
          setProjection(next);
        }
        setError(null);
        failureRef.current = 0;
        setLoading(false);
        if (!next.terminal) timer = setTimeout(() => void poll(), options.intervalMs ?? 1_500);
      } catch (failure) {
        if (!active) return;
        setError(failure instanceof Error ? failure.message : "V3_MEDIA_TASK_INVALID");
        setLoading(false);
        failureRef.current += 1;
        if (failureRef.current < 3) timer = setTimeout(() => void poll(), options.intervalMs ?? 1_500);
      }
    }
    if (authority.taskId || authority.sourceIdentity) void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [authority.taskId, authority.sourceIdentity, options.intervalMs]);

  return { projection, error, loading };
}
