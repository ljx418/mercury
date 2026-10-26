/**
 * WP-A strict client for the media-dependency readiness API.
 *
 * The client is deliberately strict: it only ever sends the frozen request
 * body, it only reads the frozen response shapes, and it never constructs a
 * URL, a path or a digest from anything the user or a page supplied. The
 * Runtime is the only owner of downloads, verification and publication.
 */

export const MEDIA_DEPENDENCY_STATUS_SCHEMA_VERSION = "v3-media-dependency-status/v1" as const;
export const MEDIA_DEPENDENCY_INSTALLATION_SCHEMA_VERSION = "v3-media-dependency-installation/v1" as const;

/** The four frozen dependency ids, in their fixed order. */
export const MEDIA_DEPENDENCY_IDS = ["yt-dlp", "ffmpeg", "ffprobe", "sensevoice"] as const;
export type MediaDependencyId = (typeof MEDIA_DEPENDENCY_IDS)[number];

export type MediaDependencyKind = "managed_tool" | "system_tool" | "asr_model";
export type MediaDependencyInstallMode = "managed_download" | "system_verified" | "delegated_manager";
export type MediaDependencyStorageScope = "windows_persistent" | "runtime_system" | "asr_managed";
export type MediaDependencyState =
  | "missing"
  | "checking"
  | "downloading"
  | "verifying"
  | "installing"
  | "self_testing"
  | "ready"
  | "failed"
  | "corrupt";
export type MediaDependencyOverallState = "ready" | "action_required" | "installing" | "failed";
export type MediaDependencyJobState =
  | "checking"
  | "downloading"
  | "verifying"
  | "self_testing"
  | "installing"
  | "ready"
  | "cancelling"
  | "cancelled"
  | "failed"
  | "corrupt";

export type MediaDependencyFailureCode =
  | "V3_MEDIA_DEPENDENCY_REQUEST_INVALID"
  | "V3_MEDIA_DEPENDENCY_JOB_NOT_FOUND"
  | "V3_MEDIA_DEPENDENCY_JOB_ACTIVE"
  | "V3_MEDIA_DEPENDENCY_SOURCE_NOT_ALLOWED"
  | "V3_MEDIA_DEPENDENCY_NETWORK_FAILED"
  | "V3_MEDIA_DEPENDENCY_TIMEOUT"
  | "V3_MEDIA_DEPENDENCY_SIZE_MISMATCH"
  | "V3_MEDIA_DEPENDENCY_HASH_MISMATCH"
  | "V3_MEDIA_DEPENDENCY_DISK_SPACE_LOW"
  | "V3_MEDIA_DEPENDENCY_PERMISSION_DENIED"
  | "V3_MEDIA_DEPENDENCY_SELF_TEST_FAILED"
  | "V3_MEDIA_DEPENDENCY_RUNTIME_RESTARTED"
  | "V3_MEDIA_DEPENDENCY_SYSTEM_TOOL_MISSING"
  | "V3_MEDIA_DEPENDENCY_NOT_READY";

export type MediaDependencyEntry = {
  dependencyId: MediaDependencyId;
  required: boolean;
  kind: MediaDependencyKind;
  installMode: MediaDependencyInstallMode;
  state: MediaDependencyState;
  version: string | null;
  expectedSha256: string | null;
  observedSha256: string | null;
  verifiedAt: string | null;
  storageScope: MediaDependencyStorageScope;
  failureCode: MediaDependencyFailureCode | null;
};

export type MediaDependencyStatus = {
  schemaVersion: typeof MEDIA_DEPENDENCY_STATUS_SCHEMA_VERSION;
  overallState: MediaDependencyOverallState;
  generation: string | null;
  verifiedAt: string | null;
  activeJobId: string | null;
  latestJobId: string | null;
  routeReadiness: {
    credentialedMediaAsr: "ready" | "blocked";
    failureCode: MediaDependencyFailureCode | null;
  };
  dependencies: MediaDependencyEntry[];
};

export type MediaDependencyJob = {
  schemaVersion: typeof MEDIA_DEPENDENCY_INSTALLATION_SCHEMA_VERSION;
  jobId: string;
  dependencyIds: MediaDependencyId[];
  state: MediaDependencyJobState;
  cancelable: boolean;
  progress: {
    stage: string;
    percent: number;
    bytesCompleted: number;
    bytesTotal: number;
  };
  failureCode: MediaDependencyFailureCode | null;
  publishedGeneration: string | null;
  sequence: number;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export type MediaDependencyApiError = {
  code: MediaDependencyFailureCode | string;
  message: string;
  recoverable: boolean;
  details: Record<string, unknown>;
};

const JOB_ID_PATTERN = /^media_dep_job_[a-f0-9]{32}$/;
const GENERATION_PATTERN = /^depgen_[a-f0-9]{64}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

/** A client-side error that never leaks a path, a URL or a secret. */
export class MediaDependencyClientError extends Error {
  readonly code: string;
  readonly recoverable: boolean;
  readonly details: Record<string, unknown>;

  constructor(payload: { code: string; message: string; recoverable?: boolean; details?: Record<string, unknown> }) {
    super(payload.message);
    this.name = "MediaDependencyClientError";
    this.code = payload.code;
    this.recoverable = payload.recoverable ?? true;
    this.details = payload.details ?? {};
  }
}

function assertStatus(status: unknown): asserts status is MediaDependencyStatus {
  if (!status || typeof status !== "object") throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_NOT_READY", message: "依赖状态响应格式不正确。" });
  const value = status as Partial<MediaDependencyStatus>;
  if (value.schemaVersion !== MEDIA_DEPENDENCY_STATUS_SCHEMA_VERSION) {
    throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_NOT_READY", message: "依赖状态版本不受支持。" });
  }
  if (!Array.isArray(value.dependencies) || value.dependencies.length !== 4) {
    throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_NOT_READY", message: "依赖项集合不完整。" });
  }
  const ids = value.dependencies.map((entry) => entry.dependencyId);
  const known: readonly string[] = MEDIA_DEPENDENCY_IDS;
  if (new Set(ids).size !== 4 || ids.some((id) => !known.includes(id))) {
    throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_NOT_READY", message: "依赖项集合不完整。" });
  }
  if (value.generation !== null && value.generation !== undefined && !GENERATION_PATTERN.test(value.generation)) {
    throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_NOT_READY", message: "依赖代次格式不正确。" });
  }
  for (const key of ["activeJobId", "latestJobId"] as const) {
    const id = value[key];
    if (id !== null && id !== undefined && !JOB_ID_PATTERN.test(id)) {
      throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_NOT_READY", message: "作业标识格式不正确。" });
    }
  }
  for (const entry of value.dependencies) {
    for (const digest of [entry.expectedSha256, entry.observedSha256]) {
      if (digest !== null && digest !== undefined && !SHA256_PATTERN.test(digest)) {
        throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_NOT_READY", message: "依赖摘要格式不正确。" });
      }
    }
  }
}

function assertJob(job: unknown): asserts job is MediaDependencyJob {
  if (!job || typeof job !== "object") {
    throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_NOT_READY", message: "作业响应格式不正确。" });
  }
  const value = job as Partial<MediaDependencyJob>;
  if (value.schemaVersion !== MEDIA_DEPENDENCY_INSTALLATION_SCHEMA_VERSION) {
    throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_NOT_READY", message: "作业版本不受支持。" });
  }
  if (typeof value.jobId !== "string" || !JOB_ID_PATTERN.test(value.jobId)) {
    throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_NOT_READY", message: "作业标识格式不正确。" });
  }
  if (!Number.isInteger(value.sequence) || (value.sequence ?? -1) < 0) {
    throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_NOT_READY", message: "作业序号不合法。" });
  }
  const percent = value.progress?.percent ?? -1;
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_NOT_READY", message: "作业进度不合法。" });
  }
}

/** The ONLY installable dependency id. The client never invents another. */
export const INSTALLABLE_DEPENDENCY_IDS: readonly MediaDependencyId[] = ["yt-dlp"];

export type MediaDependencyTransport = {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
};

export function createMediaDependencyClient(transport: MediaDependencyTransport) {
  return {
    async status(): Promise<MediaDependencyStatus> {
      const status = await transport.get<MediaDependencyStatus>("/v1/media/dependencies");
      assertStatus(status);
      return status;
    },

    async startInstall(dependencyIds: readonly MediaDependencyId[] = INSTALLABLE_DEPENDENCY_IDS): Promise<MediaDependencyJob> {
      // The frozen body is exactly `{dependencyIds:[...]}` and nothing else.
      if (!Array.isArray(dependencyIds) || dependencyIds.length === 0) {
        throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_REQUEST_INVALID", message: "必须指定要安装的依赖。" });
      }
      for (const id of dependencyIds) {
        const installable: readonly string[] = INSTALLABLE_DEPENDENCY_IDS;
        if (!installable.includes(id)) {
          throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_REQUEST_INVALID", message: "该依赖不可安装。" });
        }
      }
      const body = await transport.post<{ job: MediaDependencyJob }>("/v1/media/dependency-installations", { dependencyIds: [...dependencyIds] });
      assertJob(body.job);
      return body.job;
    },

    async job(jobId: string): Promise<MediaDependencyJob> {
      if (!JOB_ID_PATTERN.test(jobId)) {
        throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_JOB_NOT_FOUND", message: "作业不存在。" });
      }
      const body = await transport.get<{ job: MediaDependencyJob }>(`/v1/media/dependency-installations/${encodeURIComponent(jobId)}`);
      assertJob(body.job);
      return body.job;
    },

    async cancel(jobId: string): Promise<MediaDependencyJob> {
      if (!JOB_ID_PATTERN.test(jobId)) {
        throw new MediaDependencyClientError({ code: "V3_MEDIA_DEPENDENCY_JOB_NOT_FOUND", message: "作业不存在。" });
      }
      const body = await transport.delete<{ job: MediaDependencyJob }>(`/v1/media/dependency-installations/${encodeURIComponent(jobId)}`);
      assertJob(body.job);
      return body.job;
    }
  };
}

export type MediaDependencyClient = ReturnType<typeof createMediaDependencyClient>;

/**
 * The recovery advice for a frozen failure code.
 *
 * Each class gets ONE honest next step. There is no generic "install failed"
 * text, and the advice never contains a path, a URL or a command line.
 */
export function mediaDependencyRecoveryAdvice(
  code: MediaDependencyFailureCode | string | null
): { title: string; detail: string; retryable: boolean } {
  switch (code) {
    case "V3_MEDIA_DEPENDENCY_NETWORK_FAILED":
      return { title: "网络不可用", detail: "下载未完成。请检查网络后重试，或稍后在网络恢复时再次修复。", retryable: true };
    case "V3_MEDIA_DEPENDENCY_TIMEOUT":
      return { title: "下载超时", detail: "下载未在时限内完成。请重试，或在网络更稳定时修复。", retryable: true };
    case "V3_MEDIA_DEPENDENCY_DISK_SPACE_LOW":
      return { title: "磁盘空间不足", detail: "安装需要额外的可用空间。请先清理空间再修复本机依赖。", retryable: true };
    case "V3_MEDIA_DEPENDENCY_SIZE_MISMATCH":
      return { title: "文件大小不符", detail: "下载到的文件与冻结大小不一致。请重新下载后修复。", retryable: true };
    case "V3_MEDIA_DEPENDENCY_HASH_MISMATCH":
      return { title: "文件校验不符", detail: "文件与冻结摘要不一致，已保留原有可用版本。请重新下载缺失项。", retryable: true };
    case "V3_MEDIA_DEPENDENCY_SELF_TEST_FAILED":
      return { title: "自检未通过", detail: "文件已校验但自检失败，因此不会生效。请重试或联系维护者。", retryable: true };
    case "V3_MEDIA_DEPENDENCY_PERMISSION_DENIED":
      return { title: "权限不足", detail: "本机目录不可写。请检查本机权限后修复。", retryable: true };
    case "V3_MEDIA_DEPENDENCY_SYSTEM_TOOL_MISSING":
      return { title: "缺少系统工具", detail: "本机缺少所需的系统工具。请由管理员安装该系统组件。", retryable: false };
    case "V3_MEDIA_DEPENDENCY_SOURCE_NOT_ALLOWED":
      return { title: "来源不被允许", detail: "下载来源不在冻结白名单内。不会改用其他来源。", retryable: false };
    case "V3_MEDIA_DEPENDENCY_RUNTIME_RESTARTED":
      return { title: "Runtime 已重启", detail: "上次修复因 Runtime 重启中断。请重新修复本机依赖。", retryable: true };
    case "V3_MEDIA_DEPENDENCY_JOB_ACTIVE":
      return { title: "已有修复在进行", detail: "请等待当前修复结束。", retryable: false };
    case "V3_MEDIA_DEPENDENCY_JOB_NOT_FOUND":
      return { title: "作业不存在", detail: "该修复作业已不存在。", retryable: false };
    case "V3_MEDIA_DEPENDENCY_REQUEST_INVALID":
      return { title: "请求不合法", detail: "请求与冻结合同不符。", retryable: false };
    case "V3_MEDIA_DEPENDENCY_NOT_READY":
      return { title: "依赖尚未就绪", detail: "本机依赖未全部就绪。完成修复后即可分析无字幕视频。", retryable: true };
    default:
      return { title: "需要修复本机依赖", detail: "本机依赖未全部就绪。点击“修复本机依赖”以继续。", retryable: true };
  }
}
