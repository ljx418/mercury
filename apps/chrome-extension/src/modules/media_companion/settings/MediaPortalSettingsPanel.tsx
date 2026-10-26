import { useEffect, useState } from "react";
import {
  bootstrapLocalRuntimeSession,
  clearMediaCache,
  configureMediaCache,
  deleteMediaPortalSettings,
  getMediaCacheStatus,
  getMediaPortalSettings,
  saveMediaPortalSettings,
  testMediaPortalSettings,
  toggleMediaPortalSettings,
  type MediaCacheStatus,
  type MediaPortalSettings,
  type RuntimeStatus
} from "../../../runtimeClient";

type Props = { runtimeStatus: RuntimeStatus; onSettingsChange?: (settings: MediaPortalSettings) => void };

const emptySettings: MediaPortalSettings = {
  adapterId: "bilibili", enabled: false, configured: false, cookieCount: 0,
  expiresAt: null, testStatus: null, secretStorage: null, updatedAt: null
};

const emptyCache: MediaCacheStatus = {
  entryCount: 0, usedBytes: 0, maximumBytes: 5 * 1024 ** 3, retentionHours: 24,
  oldestCreatedAt: null, nextExpiryAt: null
};

function bytes(value: number): string {
  if (value < 1024 ** 2) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

export function MediaPortalSettingsPanel({ runtimeStatus, onSettingsChange }: Props) {
  const [settings, setSettings] = useState(emptySettings);
  const [cache, setCache] = useState(emptyCache);
  const [cookieText, setCookieText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("启动 Runtime 后可配置 B站登录态下载。");
  const [confirmAction, setConfirmAction] = useState<"cookie" | "cache" | null>(null);

  function applySettings(next: MediaPortalSettings) {
    setSettings(next);
    onSettingsChange?.(next);
  }

  async function withSession<T>(operation: () => Promise<T>): Promise<T> {
    await bootstrapLocalRuntimeSession();
    return operation();
  }

  async function refresh() {
    if (runtimeStatus !== "online") return;
    setBusy(true);
    try {
      const [nextSettings, nextCache] = await withSession(() => Promise.all([
        getMediaPortalSettings(), getMediaCacheStatus()
      ]));
      applySettings(nextSettings);
      setCache(nextCache);
      setMessage(nextSettings.configured
        ? "B站登录态与缓存状态已从本机 Runtime 读取。"
        : "尚未导入 B站 Cookie；可选择浏览器导出的 JSON/cookies.txt，或粘贴 Cookie Header。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "媒体下载设置读取失败。");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void refresh(); }, [runtimeStatus]);
  useEffect(() => () => setCookieText(""), []);

  async function readCookieFile(file: File | null) {
    if (!file) return;
    if (file.size > 128 * 1024) {
      setMessage("Cookie 文件超过 128 KiB，已拒绝读取。");
      return;
    }
    try {
      setCookieText(await file.text());
      setMessage(`已读取 ${file.name}，点击“保存并验证”后才会写入本机凭据库。`);
    } catch {
      setMessage("Cookie 文件读取失败。");
    }
  }

  async function save() {
    if (!cookieText.trim()) return;
    setBusy(true);
    setConfirmAction(null);
    try {
      const next = await withSession(() => saveMediaPortalSettings(cookieText, true));
      applySettings(next);
      setCookieText("");
      setMessage("Cookie 已验证并保存在系统凭据库。后续分析将优先使用一次下载路线。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cookie 保存或验证失败。");
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    setBusy(true);
    try {
      const next = await withSession(() => toggleMediaPortalSettings(!settings.enabled));
      applySettings(next);
      setMessage(next.enabled ? "登录态媒体下载已启用。" : "登录态媒体下载已暂停；一次性浏览器会话仍可作为回退。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "启用状态更新失败。");
    } finally { setBusy(false); }
  }

  async function test() {
    setBusy(true);
    try {
      applySettings(await withSession(testMediaPortalSettings));
      setMessage("B站登录态验证成功。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "B站登录态验证失败。");
    } finally { setBusy(false); }
  }

  async function removeCookie() {
    if (confirmAction !== "cookie") { setConfirmAction("cookie"); return; }
    setBusy(true);
    try {
      applySettings(await withSession(deleteMediaPortalSettings));
      setCache(await getMediaCacheStatus());
      setConfirmAction(null);
      setMessage("B站 Cookie 与媒体下载缓存已删除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cookie 删除失败。");
    } finally { setBusy(false); }
  }

  async function saveCacheSettings(maximumBytes = cache.maximumBytes, retentionHours = cache.retentionHours) {
    setBusy(true);
    try {
      setCache(await withSession(() => configureMediaCache(maximumBytes, retentionHours)));
      setMessage("缓存上限与自动清理周期已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "缓存设置更新失败。");
    } finally { setBusy(false); }
  }

  async function clearCacheNow() {
    if (confirmAction !== "cache") { setConfirmAction("cache"); return; }
    setBusy(true);
    try {
      const result = await withSession(clearMediaCache);
      setCache(result.cache);
      setConfirmAction(null);
      setMessage(`已清理 ${result.cleared.removedEntries} 个缓存文件，释放 ${bytes(result.cleared.removedBytes)}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "缓存清理失败。");
    } finally { setBusy(false); }
  }

  const storage = settings.secretStorage === "windows_credential_vault"
    ? "Windows 凭据库" : settings.secretStorage === "os_keyring" ? "操作系统凭据库" : "未配置";

  return <section className="media-portal-settings" aria-labelledby="media-portal-settings-title" data-testid="media-portal-settings">
    <header>
      <div><h3 id="media-portal-settings-title">B站登录态下载</h3><p>配置一次后，Navia 会在本机下载一份受控视频缓存，并从同一文件提取音频、章节与关键帧。</p></div>
      <button type="button" className={`media-setting-toggle${settings.enabled ? " active" : ""}`} role="switch" aria-checked={settings.enabled} disabled={busy || !settings.configured} onClick={() => void toggle()}>{settings.enabled ? "已启用" : "未启用"}</button>
    </header>
    <dl className="media-portal-summary">
      <div><dt>登录状态</dt><dd>{settings.testStatus?.status === "ok" ? "验证通过" : settings.configured ? "需要复验" : "未配置"}</dd></div>
      <div><dt>保存位置</dt><dd>{storage}</dd></div>
      <div><dt>受控字段</dt><dd>{settings.cookieCount} 项</dd></div>
      <div><dt>自动清理</dt><dd>{cache.retentionHours} 小时</dd></div>
    </dl>
    <label className="media-cookie-file">
      <span>导入 Cookie 文件</span>
      <input type="file" accept=".json,.txt,application/json,text/plain" disabled={busy} onChange={(event) => void readCookieFile(event.target.files?.[0] ?? null)} />
    </label>
    <label className="media-cookie-text">
      <span>或粘贴 Cookie JSON / cookies.txt / Cookie Header</span>
      <textarea value={cookieText} onChange={(event) => setCookieText(event.target.value)} rows={3} autoComplete="off" spellCheck={false} disabled={busy} placeholder="内容只会发送到 127.0.0.1 Runtime；保存后立即从本输入框清除。" />
    </label>
    <p className="media-setting-impact">Cookie 仅保存到系统凭据库，不会写入扩展存储、SQLite、日志或审计包。启用后会占用网络流量与本机磁盘；默认下载不高于 480p，24 小时后自动清理。</p>
    <div className="media-setting-actions">
      <button type="button" disabled={busy || runtimeStatus !== "online" || !cookieText.trim()} onClick={() => void save()}>保存并验证</button>
      {settings.configured ? <button type="button" className="secondary" disabled={busy} onClick={() => void test()}>重新验证</button> : null}
      {settings.configured ? <button type="button" className="danger" disabled={busy} onClick={() => void removeCookie()}>{confirmAction === "cookie" ? "再次点击确认删除" : "删除登录信息"}</button> : null}
    </div>
    <div className="media-cache-settings">
      <div className="media-cache-heading"><div><strong>媒体缓存</strong><span>{cache.entryCount} 个文件 · {bytes(cache.usedBytes)} / {bytes(cache.maximumBytes)}</span></div><button type="button" className="danger" disabled={busy || cache.entryCount === 0} onClick={() => void clearCacheNow()}>{confirmAction === "cache" ? "再次点击确认清空" : "立即清空"}</button></div>
      <div className="media-cache-controls">
        <label><span>空间上限</span><select value={cache.maximumBytes} disabled={busy} onChange={(event) => void saveCacheSettings(Number(event.target.value), cache.retentionHours)}><option value={1024 ** 3}>1 GB</option><option value={2 * 1024 ** 3}>2 GB</option><option value={5 * 1024 ** 3}>5 GB</option><option value={10 * 1024 ** 3}>10 GB</option></select></label>
        <label><span>自动清理</span><select value={cache.retentionHours} disabled={busy} onChange={(event) => void saveCacheSettings(cache.maximumBytes, Number(event.target.value))}><option value={1}>1 小时</option><option value={6}>6 小时</option><option value={24}>24 小时</option><option value={72}>3 天</option><option value={168}>7 天</option></select></label>
      </div>
    </div>
    <p className="muted" role="status" aria-live="polite">{message}</p>
  </section>;
}
