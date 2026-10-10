import type { MediaTranscriptProjection } from "../../../runtimeClient";

const LABELS: Record<MediaTranscriptProjection["state"], string> = {
  created: "任务已创建",
  acquiring: "正在获取字幕或媒体",
  awaiting_trusted_capture: "等待你启动标签页音频捕获",
  capturing: "正在捕获当前标签页音频",
  transcribing: "SenseVoice 正在本机转写",
  validating: "正在校验转写结果",
  cleaning: "正在停止并清理",
  succeeded: "转写已完成",
  degraded: "已生成降级结果",
  blocked: "任务已阻塞",
  failed: "任务失败",
  cancelled: "任务已取消"
};

export function MediaAcquisitionProgress({ projection }: { projection: MediaTranscriptProjection }) {
  const localAsr = projection.route === "credentialed_media_asr" || projection.route === "trusted_tab_capture_asr";
  const memoryMiB = projection.resources?.memoryLimitBytes
    ? Math.ceil(projection.resources.memoryLimitBytes / 1024 / 1024)
    : 8192;
  const diskMiB = projection.resources?.temporaryDiskPeakBytes
    ? Math.ceil(projection.resources.temporaryDiskPeakBytes / 1024 / 1024)
    : null;
  return <div
    className="media-task-progress"
    data-state={projection.state}
    data-cpu-core-limit={projection.resources?.cpuCoreLimit ?? 8}
    data-memory-limit-bytes={projection.resources?.memoryLimitBytes ?? 8 * 1024 ** 3}
    data-temporary-disk-peak-bytes={projection.resources?.temporaryDiskPeakBytes ?? 0}
    data-gpu-used={projection.resources?.gpuUsed ? "true" : "false"}
  >
    <div className="media-task-progress-heading">
      <strong>{LABELS[projection.state]}</strong>
      <span>{projection.progressPercent}%</span>
    </div>
    <progress max={100} value={projection.progressPercent} aria-label={LABELS[projection.state]} />
    <small>路线：{projection.route} · rev {projection.revision}</small>
    {localAsr ? <div className="media-asr-resource-notice" data-testid="media-asr-resource-notice">
      <strong>本地 SenseVoice 转写</strong>
      <p>长视频可能需要较长等待并持续使用 CPU；可随时点击“取消并清理”。</p>
      <dl>
        <div><dt>CPU 上限</dt><dd>{projection.resources?.cpuCoreLimit ?? 8} 核</dd></div>
        <div><dt>内存上限</dt><dd>{memoryMiB} MiB</dd></div>
        <div><dt>临时磁盘峰值</dt><dd>{diskMiB === null ? "按音频长度动态计算" : `${diskMiB} MiB`}</dd></div>
        <div><dt>GPU</dt><dd>{projection.resources?.gpuUsed ? "使用" : "不使用"}</dd></div>
      </dl>
    </div> : null}
  </div>;
}
