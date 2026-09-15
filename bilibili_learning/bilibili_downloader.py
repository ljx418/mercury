"""
B 站视频下载器 - 用导出的 cookies 鉴权, ffmpeg 合并

用法:
  python3 bilibili_downloader.py BV1xx411c7mD --output-dir /mnt/d/0-B站视频学习
  python3 bilibili_downloader.py BV1xx411c7mD,BV2yy411c7nE --output-dir /mnt/d/0-B站视频学习
  python3 bilibili_downloader.py --from-file bv_list.txt --output-dir /mnt/d/0-B站视频学习

依赖:
  - cookies/bilibili_cookies_latest.json (cookie_exporter.py 生成的)
  - ffmpeg (apt install ffmpeg, 或 Windows 自带版)

实现:
  - 优先 DASH 模式 (分开下载视频+音频, ffmpeg 合并, 画质最高)
  - Fallback 单 mp4 模式 (画质受限, 但更稳)
  - 每个 BV 单独子文件夹, 含原始 m4s + 合并后 mp4 + metadata.json
"""
import argparse
import json
import sys
import time
from pathlib import Path
from typing import Optional, Dict, List
import subprocess

# 关键常量
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
REFERER = "https://www.bilibili.com/"
# 始终跟脚本同目录, 避免在不同 cwd 跑时找不到 cookies
SCRIPT_DIR = Path(__file__).resolve().parent
COOKIES_PATH = SCRIPT_DIR / "cookies" / "bilibili_cookies_latest.json"
QUALITY_FALLBACK = [80, 64, 32, 16]  # 1080P, 720P, 480P, 360P

# 尝试 import
try:
    import requests
except ImportError:
    print("[X] 需要 requests: pip install requests")
    sys.exit(1)


def load_cookies() -> Dict[str, str]:
    """从 JSON 文件加载 cookies, 转成 requests 用的 dict"""
    if not COOKIES_PATH.exists():
        print(f"[X] 找不到 cookies: {COOKIES_PATH.absolute()}")
        print("    先跑 cookie_exporter.py")
        sys.exit(1)

    raw = json.loads(COOKIES_PATH.read_text(encoding="utf-8"))
    return {c["name"]: c["value"] for c in raw}


def get_video_info(bvid: str, cookies: Dict[str, str]) -> Dict:
    """调 B 站 view 接口拿视频基础信息 (cid, title, duration)"""
    url = "https://api.bilibili.com/x/web-interface/view"
    params = {"bvid": bvid}
    headers = {
        "User-Agent": USER_AGENT,
        "Referer": REFERER,
    }
    resp = requests.get(url, params=params, cookies=cookies, headers=headers, timeout=15)
    data = resp.json()

    if data.get("code") != 0:
        print(f"[X] view 接口失败: {data}")
        print(f"    错误码: {data.get('code')}, 消息: {data.get('message')}")
        sys.exit(1)

    return data["data"]


def get_playurl(bvid: str, cid: int, qn: int, cookies: Dict[str, str], fnval: int = 16) -> Dict:
    """调 playurl 接口拿播放地址
    fnval=16: DASH (分开视频音频) 推荐
    fnval=1:  单 mp4 (fallback)
    """
    url = "https://api.bilibili.com/x/player/playurl"
    params = {
        "bvid": bvid,
        "cid": cid,
        "qn": qn,
        "fnval": fnval,
        "fnver": 0,
        "fourk": 1,
        "platform": "html5",
        "high_quality": 1,
    }
    headers = {
        "User-Agent": USER_AGENT,
        "Referer": REFERER,
    }
    resp = requests.get(url, params=params, cookies=cookies, headers=headers, timeout=15)
    data = resp.json()

    if data.get("code") != 0:
        print(f"[!] playurl 失败 (qn={qn}, fnval={fnval}): {data.get('message')}")
        return None
    return data["data"]


def download_file(url: str, dest: Path, cookies: Dict[str, str], desc: str = "") -> bool:
    """下载单个文件, 带进度条"""
    headers = {
        "User-Agent": USER_AGENT,
        "Referer": REFERER,
    }
    try:
        with requests.get(url, headers=headers, cookies=cookies, stream=True, timeout=60) as r:
            r.raise_for_status()
            total = int(r.headers.get("Content-Length", 0))
            downloaded = 0
            dest.parent.mkdir(parents=True, exist_ok=True)
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 256):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total:
                            pct = downloaded / total * 100
                            bar = "#" * int(pct // 2) + "-" * (50 - int(pct // 2))
                            print(f"\r  [{bar}] {pct:.1f}% ({downloaded//1024}KB/{total//1024}KB) {desc}", end="", flush=True)
            print()
        return True
    except Exception as e:
        print(f"\n[X] 下载失败: {e}")
        return False


def merge_with_ffmpeg(video: Path, audio: Path, output: Path) -> bool:
    """用 ffmpeg 合并视频+音频"""
    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(video),
        "-i", str(audio),
        "-c", "copy",
        "-loglevel", "error",
        str(output),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            print(f"[X] ffmpeg 合并失败: {result.stderr}")
            return False
        return True
    except FileNotFoundError:
        print("[X] 找不到 ffmpeg, 请先安装 (apt install ffmpeg 或 Windows: choco install ffmpeg)")
        return False
    except subprocess.TimeoutExpired:
        print("[X] ffmpeg 超时 (5 分钟)")
        return False


def download_single_video(bvid: str, output_dir: Path, cookies: Dict[str, str]) -> Optional[Path]:
    """下载单个视频, 返回最终 mp4 路径或 None"""
    print(f"\n{'='*60}")
    print(f"[>] 处理: {bvid}")
    print(f"{'='*60}")

    # 1. 拿基本信息
    print("[1/4] 拿视频信息 ...")
    info = get_video_info(bvid, cookies)
    title = info["title"]
    cid = info["cid"]
    duration = info["duration"]
    owner = info["owner"]["name"]
    desc = info.get("desc", "")

    print(f"    标题: {title}")
    print(f"    UP主: {owner}")
    print(f"    时长: {duration//60}:{duration%60:02d}")

    # 子目录: <output_dir>/<title>_<bvid>/
    safe_title = "".join(c if c.isalnum() or c in " -_" else "_" for c in title)[:50]
    video_dir = output_dir / f"{safe_title}_{bvid}"
    video_dir.mkdir(parents=True, exist_ok=True)

    # 保存 metadata
    meta = {
        "bvid": bvid,
        "title": title,
        "owner": owner,
        "duration_sec": duration,
        "cid": cid,
        "aid": info["aid"],
        "desc": desc,
        "pubdate": info.get("pubdate"),
        "pic": info.get("pic"),
    }
    (video_dir / "metadata.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # 2. 试 DASH 模式 (视频+音频分开)
    print("[2/4] 试 DASH 模式 (画质优先) ...")
    playurl_data = None
    used_qn = None
    for qn in QUALITY_FALLBACK:
        data = get_playurl(bvid, cid, qn, cookies, fnval=16)
        if data and data.get("dash"):
            playurl_data = data
            used_qn = qn
            print(f"    [OK] 拿到 DASH 流 (画质 qn={qn})")
            break

    final_mp4 = None
    if playurl_data and playurl_data.get("dash"):
        dash = playurl_data["dash"]
        video_url = dash["video"][0]["baseUrl"] if dash.get("video") else None
        audio_url = dash["audio"][0]["baseUrl"] if dash.get("audio") else None

        if video_url:
            video_m4s = video_dir / "video.m4s"
            print(f"[3/4] 下载视频流 ...")
            if download_file(video_url, video_m4s, cookies, "video"):
                if audio_url:
                    audio_m4s = video_dir / "audio.m4s"
                    print(f"    下载音频流 ...")
                    if not download_file(audio_url, audio_m4s, cookies, "audio"):
                        audio_url = None

                # 合并
                final_mp4 = video_dir / f"{safe_title}.mp4"
                print(f"[4/4] ffmpeg 合并 → {final_mp4.name} ...")
                if audio_url:
                    ok = merge_with_ffmpeg(video_m4s, audio_m4s, final_mp4)
                else:
                    # 无音频流, 直接 rename
                    video_m4s.rename(final_mp4)
                    ok = True

                if ok:
                    # 清理中间文件
                    if audio_url and (video_dir / "audio.m4s").exists():
                        (video_dir / "audio.m4s").unlink()
                    print(f"[+] 完成: {final_mp4}")
                    return final_mp4

    # 3. Fallback: 单 mp4
    print("[!] DASH 失败, fallback 单 mp4 模式 ...")
    for qn in QUALITY_FALLBACK:
        data = get_playurl(bvid, cid, qn, cookies, fnval=1)
        if data and data.get("durl"):
            mp4_url = data["durl"][0]["url"]
            final_mp4 = video_dir / f"{safe_title}.mp4"
            print(f"[3/4] 下载 mp4 (qn={qn}) ...")
            if download_file(mp4_url, final_mp4, cookies, "mp4"):
                print(f"[+] 完成: {final_mp4}")
                return final_mp4

    print(f"[X] {bvid} 下载失败 (所有画质都试了)")
    return None


def main():
    parser = argparse.ArgumentParser(description="B 站视频下载器")
    parser.add_argument("bvids", nargs="*", help="BV 号列表, 空格分隔")
    parser.add_argument("--from-file", help="从文件读 BV 号 (每行一个)")
    parser.add_argument("--output-dir", required=True, help="下载根目录")
    args = parser.parse_args()

    bvids: List[str] = list(args.bvids)
    if args.from_file:
        bvids.extend([
            line.strip() for line in Path(args.from_file).read_text().splitlines()
            if line.strip() and not line.startswith("#")
        ])

    if not bvids:
        print("[X] 至少给一个 BV 号")
        parser.print_help()
        sys.exit(1)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"[*] 输出目录: {output_dir}")
    print(f"[*] 待下载 {len(bvids)} 个视频")

    cookies = load_cookies()
    if "SESSDATA" not in cookies:
        print("[!] cookies 里没有 SESSDATA, 大概率登录态掉了")
        print("    重新跑 chrome_launcher.py + cookie_exporter.py")
        sys.exit(1)

    results = []
    for i, bvid in enumerate(bvids, 1):
        print(f"\n[*] 进度: {i}/{len(bvids)}")
        result = download_single_video(bvid, output_dir, cookies)
        results.append((bvid, result))
        # 礼貌延迟, 避免被风控
        if i < len(bvids):
            time.sleep(3)

    # 汇总
    print(f"\n{'='*60}")
    print(f"下载汇总")
    print(f"{'='*60}")
    for bvid, path in results:
        if path:
            print(f"  [OK]  {bvid} → {path}")
        else:
            print(f"  [X]  {bvid}")
    ok_count = sum(1 for _, p in results if p)
    print(f"\n成功: {ok_count}/{len(results)}")


if __name__ == "__main__":
    main()
