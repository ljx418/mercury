import type { MediaConsentScopeItem } from "../../MediaConsentCard";

export const BILIBILI_CONSENT_SCOPE_ITEMS: readonly MediaConsentScopeItem[] = Object.freeze([
  {
    scopeId: "bilibili_session_access",
    label: "读取 B站会话候选",
    description: "只判断浏览器是否存在可用候选，不展示或保存会话值。"
  },
  {
    scopeId: "temporary_media_download",
    label: "任务期临时媒体",
    description: "后续任务可在单次租约内获取临时媒体；本阶段不会下载。"
  },
  {
    scopeId: "audio_local_processing",
    label: "音频本地处理",
    description: "后续语音识别优先在本机完成。"
  },
  {
    scopeId: "frame_local_processing",
    label: "画面本地处理",
    description: "后续关键帧与 OCR 优先在本机完成。"
  },
  {
    scopeId: "selected_frame_cloud_vision",
    label: "选定帧云端视觉",
    description: "后续仅在再次满足任务条件时上传选定证据帧。"
  }
]);

