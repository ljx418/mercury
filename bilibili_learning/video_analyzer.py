"""
视频分析器 (事实层) - 用 video-vision-local skill 跑镜头/关键帧/OCR

用法:
  python3 video_analyzer.py /path/to/video.mp4
  python3 video_analyzer.py /path/to/video_dir/  # 批量分析目录下所有 mp4

输出:
  <video_dir>/_analysis/
    ├── keyframes/         # JPG 关键帧
    ├── analysis.json      # 镜头/关键帧/OCR 数据
    └── shots_timeline.txt # 人读时间线
"""
import argparse
import json
import sys
import subprocess
from pathlib import Path
from typing import Optional


def run_video_analyze(
    video_path: Path,
    output_dir: Path,
    num_frames: int = 60,
    top_k: int = 8,
) -> Optional[dict]:
    """调 D:\\0-日本之行\\_tools\\vision\\video_analyze.py (WSL: /mnt/d/0-日本之行/_tools/vision/video_analyze.py)"""
    # 优先用 D 盘的 vision 工具
    vision_script = Path("/mnt/d/0-日本之行/_tools/vision/video_analyze.py")
    if not vision_script.exists():
        print(f"[X] 找不到 vision_analyze.py: {vision_script}")
        print("    替代方案: 用本脚本内置的简化版 (ffprobe + ffmpeg 抽帧)")
        return run_simple_analyze(video_path, output_dir, num_frames, top_k)

    cmd = [
        "python3",
        str(vision_script),
        str(video_path),
        "--num-frames", str(num_frames),
        "--top-k", str(top_k),
        "--max-width", "1280",
        "--export-frames", str(output_dir / "keyframes"),
        "--json",
    ]

    print(f"[*] 跑 vision_analyze.py ...")
    print(f"    {' '.join(cmd)}")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            print(f"[X] vision_analyze 失败:")
            print(result.stderr[-2000:])
            return None
        return json.loads(result.stdout)
    except subprocess.TimeoutExpired:
        print("[X] vision_analyze 超时 (5 分钟)")
        return None
    except json.JSONDecodeError:
        print("[X] vision_analyze 输出不是合法 JSON")
        return None


def run_simple_analyze(
    video_path: Path,
    output_dir: Path,
    num_frames: int,
    top_k: int,
) -> dict:
    """简化版: ffprobe + ffmpeg 抽帧 (无 OCR 无镜头检测)"""
    print("[*] 跑简化分析 (ffprobe + ffmpeg) ...")

    # ffprobe
    probe_cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration,size:stream=width,height,r_frame_rate,codec_name",
        "-of", "json",
        str(video_path),
    ]
    probe = json.loads(subprocess.run(probe_cmd, capture_output=True, text=True).stdout)

    fmt = probe["format"]
    stream = probe["streams"][0]
    duration = float(fmt["duration"])
    width = stream["width"]
    height = stream["height"]

    # 抽帧
    keyframes_dir = output_dir / "keyframes"
    keyframes_dir.mkdir(parents=True, exist_ok=True)

    fps_str = f"{int(num_frames/duration)}/1" if duration > 0 else "2/1"
    extract_cmd = [
        "ffmpeg", "-y", "-i", str(video_path),
        "-vf", f"fps={fps_str},scale=1280:-1",
        "-q:v", "3",
        str(keyframes_dir / "f%03d.jpg"),
    ]
    subprocess.run(extract_cmd, capture_output=True, text=True, timeout=120)

    # 列抽出的帧
    frames = sorted(keyframes_dir.glob("f*.jpg"))
    keyframes = []
    for i, f in enumerate(frames):
        # 时间码 = i / fps_str 的分母
        fps_num = int(fps_str.split("/")[0])
        t = i / fps_num if fps_num else 0
        keyframes.append({
            "idx": i,
            "path": str(f),
            "timecode_sec": round(t, 2),
            "scores": {"total": 1.0},  # 简化版无打分
            "reason": "uniform_sample",
        })

    return {
        "path": str(video_path),
        "probe": {
            "width": width,
            "height": height,
            "duration_sec": duration,
            "fps": stream.get("r_frame_rate", "?"),
            "codec": stream.get("codec_name", "?"),
        },
        "shots": [],  # 简化版不检测
        "keyframes": keyframes[:top_k],
        "ocr_top": [],
        "ocr_subtitle_candidates": [],
        "warnings": ["simple_mode_used"],
    }


def write_timeline(analysis: dict, output_path: Path):
    """生成人读时间线"""
    lines = []
    lines.append(f"# 视频时间线")
    lines.append(f"")
    lines.append(f"路径: {analysis['path']}")
    lines.append(f"时长: {analysis['probe']['duration_sec']:.1f} 秒")
    lines.append(f"分辨率: {analysis['probe']['width']}x{analysis['probe']['height']}")
    lines.append(f"")

    # 镜头
    if analysis.get("shots"):
        lines.append(f"## 镜头切点 ({len(analysis['shots'])} 个)")
        for i, shot in enumerate(analysis["shots"]):
            lines.append(f"  镜头 {i+1:03d}: {shot['start_tc']:.2f}s - {shot['end_tc']:.2f}s")
        lines.append(f"")

    # 关键帧
    if analysis.get("keyframes"):
        lines.append(f"## 关键帧 (top {len(analysis['keyframes'])})")
        for kf in analysis["keyframes"]:
            t = kf.get("timecode", kf.get("timecode_sec", 0))
            score = kf.get("scores", {}).get("total", 0)
            lines.append(f"  [{kf.get('idx', 0):03d}] {t:6.2f}s  score={score:.2f}  {kf.get('reason', '')}")
        lines.append(f"")

    # OCR
    if analysis.get("ocr_subtitle_candidates"):
        lines.append(f"## OCR 字幕候选")
        for ocr in analysis["ocr_subtitle_candidates"][:30]:
            lines.append(f"  [{ocr.get('t', '?'):.1f}s] {ocr.get('text', '')}")
        lines.append(f"")

    if analysis.get("ocr_top"):
        lines.append(f"## OCR 招牌/文本")
        for ocr in analysis["ocr_top"][:30]:
            lines.append(f"  [{ocr.get('t', '?'):.1f}s] {ocr.get('text', '')}")

    output_path.write_text("\n".join(lines), encoding="utf-8")


def analyze_video(video_path: Path, output_root: Path) -> Optional[Path]:
    """分析单个视频, 返回 analysis.json 路径"""
    print(f"\n{'='*60}")
    print(f"[>] 分析: {video_path.name}")
    print(f"{'='*60}")

    if not video_path.exists():
        print(f"[X] 文件不存在: {video_path}")
        return None

    # 输出目录: <video_dir>/_analysis/
    output_dir = output_root / "_analysis"
    output_dir.mkdir(parents=True, exist_ok=True)

    analysis = run_video_analyze(video_path, output_dir)
    if not analysis:
        return None

    # 写 JSON
    json_path = output_dir / "analysis.json"
    json_path.write_text(
        json.dumps(analysis, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # 写时间线
    timeline_path = output_dir / "shots_timeline.txt"
    write_timeline(analysis, timeline_path)

    print(f"[+] 完成:")
    print(f"    JSON: {json_path}")
    print(f"    时间线: {timeline_path}")
    print(f"    关键帧: {output_dir / 'keyframes'}")

    return json_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="视频文件 或 视频目录")
    parser.add_argument("--num-frames", type=int, default=60)
    parser.add_argument("--top-k", type=int, default=8)
    args = parser.parse_args()

    # 切换到脚本所在目录, 保证日志/分析输出位置稳定
    import os
    os.chdir(Path(__file__).resolve().parent)

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"[X] 找不到: {input_path}")
        sys.exit(1)

    videos = []
    if input_path.is_file():
        videos.append(input_path)
    else:
        # 找 mp4/m4s/mkv
        for ext in ["*.mp4", "*.mkv", "*.m4s", "*.flv"]:
            videos.extend(input_path.glob(ext))
        videos = sorted(videos)

    if not videos:
        print(f"[X] {input_path} 下没找到视频文件")
        sys.exit(1)

    print(f"[*] 找到 {len(videos)} 个视频")

    results = []
    for v in videos:
        # 输出目录用视频所在目录的 _analysis/
        output_root = v.parent
        result = analyze_video(v, output_root)
        results.append((v, result))

    # 汇总
    print(f"\n{'='*60}")
    print(f"分析汇总")
    print(f"{'='*60}")
    for v, p in results:
        status = "[OK]" if p else "[X]"
        print(f"  {status}  {v.name}")


if __name__ == "__main__":
    main()
