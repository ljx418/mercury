const EVIDENCE_RETURN_KEY = "navia.mediaEvidenceReturn.v1";

export type EvidenceReturnBinding = {
  taskId: string;
  evidenceId: string;
  returnHash: string;
  triggerKey?: string;
};

export function recordEvidenceReturn(taskId: string, evidenceId: string, triggerKey: string): void {
  sessionStorage.setItem(EVIDENCE_RETURN_KEY, JSON.stringify({
    taskId,
    evidenceId,
    triggerKey,
    returnHash: window.location.hash,
  } satisfies EvidenceReturnBinding));
}

export function readEvidenceReturn(): EvidenceReturnBinding | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(EVIDENCE_RETURN_KEY) ?? "null") as Partial<EvidenceReturnBinding> | null;
    return value && typeof value.taskId === "string" && typeof value.evidenceId === "string"
      && typeof value.returnHash === "string" && value.returnHash.startsWith("#/media/tasks/")
      && (value.triggerKey === undefined || typeof value.triggerKey === "string")
      ? value as EvidenceReturnBinding : null;
  } catch { return null; }
}

export function clearEvidenceReturn(): void {
  sessionStorage.removeItem(EVIDENCE_RETURN_KEY);
}
