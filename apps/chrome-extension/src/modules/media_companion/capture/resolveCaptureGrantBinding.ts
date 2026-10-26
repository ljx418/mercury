export type CaptureGrantBinding = {
  taskId: string;
  adapterId: string;
};

type LeaseBinding = Partial<CaptureGrantBinding> | null | undefined;

export function resolveCaptureGrantBinding(
  lease: LeaseBinding,
  activeTaskId: string | null | undefined,
  activeAdapterId: string | null | undefined,
): CaptureGrantBinding | null {
  const taskId = activeTaskId ?? lease?.taskId;
  const adapterId = activeAdapterId ?? lease?.adapterId;
  if (!/^media_task_[a-f0-9]{32}$/.test(taskId ?? "")) return null;
  if (!/^[a-z][a-z0-9_-]{1,31}$/.test(adapterId ?? "")) return null;
  return { taskId: taskId!, adapterId: adapterId! };
}
