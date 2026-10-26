import { useEffect, useRef, useState } from "react";
import {
  RuntimeRequestError,
  getLatestMediaTranscriptProjection,
  getMediaTranscriptProjection,
  type MediaTranscriptProjection
} from "../../../runtimeClient";

type TaskAuthority = { taskId?: string | null; sourceIdentity?: string | null };

function projectionMatchesAuthority(
  projection: MediaTranscriptProjection,
  authority: TaskAuthority
): boolean {
  if (!authority.taskId && !authority.sourceIdentity) return false;
  return (!authority.taskId || projection.taskId === authority.taskId)
    && (!authority.sourceIdentity || projection.sourceIdentity === authority.sourceIdentity);
}

export function useMediaAcquisitionTask(
  authority: TaskAuthority,
  options: { intervalMs?: number } = {}
) {
  const [projection, setProjection] = useState<MediaTranscriptProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(authority.taskId || authority.sourceIdentity));
  const revisionRef = useRef(0);
  const failureRef = useRef(0);
  const authorityRef = useRef(authority);
  authorityRef.current = authority;

  function acceptProjection(next: MediaTranscriptProjection) {
    const current = authorityRef.current;
    if (!projectionMatchesAuthority(next, current)) return;
    if (next.revision >= revisionRef.current) {
      revisionRef.current = next.revision;
      setProjection(next);
      setError(null);
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
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
        if (!active) return;
        if (next === null || !projectionMatchesAuthority(next, authority)) {
          if (Date.now() - startedAt < 30_000) timer = setTimeout(() => void poll(), options.intervalMs ?? 1_500);
          else { setError("V3_MEDIA_TASK_NOT_FOUND"); setLoading(false); }
          return;
        }
        if (next.revision >= revisionRef.current) {
          revisionRef.current = next.revision;
          setProjection(next);
        }
        setError(null);
        failureRef.current = 0;
        setLoading(false);
        if (!next.terminal || (next.state === "succeeded" && next.canCancel)) {
          timer = setTimeout(() => void poll(), options.intervalMs ?? 1_500);
        }
      } catch (failure) {
        if (!active) return;
        const notFound = failure instanceof RuntimeRequestError
          && failure.httpStatus === 404
          && failure.code === "V3_MEDIA_TASK_INVALID";
        failureRef.current += 1;
        if (notFound && Date.now() - startedAt < 30_000) {
          timer = setTimeout(() => void poll(), options.intervalMs ?? 1_500);
          return;
        }
        setError(failure instanceof Error ? failure.message : "V3_MEDIA_TASK_INVALID");
        setLoading(false);
        if (!notFound && failureRef.current < 3) timer = setTimeout(() => void poll(), options.intervalMs ?? 1_500);
      }
    }
    if (authority.taskId || authority.sourceIdentity) void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [authority.taskId, authority.sourceIdentity, options.intervalMs]);

  const visibleProjection = projection && projectionMatchesAuthority(projection, authority)
    ? projection
    : null;
  return { projection: visibleProjection, error, loading, acceptProjection };
}
