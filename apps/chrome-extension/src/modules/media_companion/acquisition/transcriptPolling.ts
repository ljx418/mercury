import { getMediaTranscript, type MediaTranscriptTask } from "../../../runtimeClient";

export async function waitForMediaTranscript(
  taskId: string,
  options: {
    read?: typeof getMediaTranscript;
    delay?: (milliseconds: number) => Promise<void>;
    intervalMs?: number;
    maximumAttempts?: number;
  } = {}
): Promise<MediaTranscriptTask> {
  const read = options.read ?? getMediaTranscript;
  const delay = options.delay ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const intervalMs = options.intervalMs ?? 2_000;
  const maximumAttempts = options.maximumAttempts ?? 7_200;
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const { task } = await read(taskId);
    if (["succeeded", "failed", "cancelled"].includes(task.state)) return task;
    await delay(intervalMs);
  }
  throw new Error("V3_MEDIA_TRANSCRIPT_PROCESS_TIMEOUT");
}
