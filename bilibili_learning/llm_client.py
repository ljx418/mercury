"""
MMX CLI 包装 - 用 minimax 官方 CLI 调用 LLM / vision / TTS
优先于 Python openai 库 (CLI 已认证, 处理认证/区域/限速)

回退策略:
  1. 优先用 mmx CLI (minimax 官方)
  2. 失败则用 deepseek API (OpenAI 兼容, Python requests)
"""
import json
import subprocess
import sys
from pathlib import Path
from typing import Optional, List, Dict

SCRIPT_DIR = Path(__file__).resolve().parent
MMX_BIN = Path("/home/administrator/.npm-global/bin/mmx")

# dotenv 用于读 deepseek key
sys.path.insert(0, str(SCRIPT_DIR))
from secret_loader import load_env, get_key


def call_mmx_text(messages: List[Dict[str, str]], model: str = "MiniMax-M3") -> Optional[str]:
    """调 minimax mmx CLI text chat (MiniMax Messages API)."""
    if not MMX_BIN.exists():
        print(f"[X] mmx CLI 不存在: {MMX_BIN}")
        return None

    # mmx 用 --system + 多个 --message (前缀 role:)
    system_prompt = None
    msg_flags = []
    for m in messages:
        role = m["role"]
        content = m["content"]
        if role == "system":
            system_prompt = content
        elif role == "user":
            msg_flags.extend(["--message", content])
        elif role == "assistant":
            msg_flags.extend(["--message", f"assistant:{content}"])

    cmd = [str(MMX_BIN), "text", "chat", "--model", model, "--quiet"]
    if system_prompt:
        cmd.extend(["--system", system_prompt])
    cmd.extend(msg_flags)

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            print(f"[X] mmx text 失败 (code {result.returncode}): {result.stderr[-300:]}")
            return None
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        print("[X] mmx text 超时 (120s)")
        return None
    except Exception as e:
        print(f"[X] mmx text 异常: {e}")
        return None


def call_deepseek_text(messages: List[Dict[str, str]], model: str = "deepseek-chat") -> Optional[str]:
    """调 deepseek API (OpenAI 兼容)."""
    load_env(verbose=False)
    api_key = get_key("DEEPSEEK_API_KEY", required=False)
    base_url = get_key("DEEPSEEK_BASE_URL", required=False) or "https://api.deepseek.com/v1"

    if not api_key:
        print("[X] DEEPSEEK_API_KEY 未设置")
        return None

    try:
        import requests
    except ImportError:
        print("[X] requests 没装: pip install requests")
        return None

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.3,
    }

    try:
        resp = requests.post(
            f"{base_url}/chat/completions",
            headers=headers, json=payload, timeout=120,
        )
        if resp.status_code != 200:
            print(f"[X] deepseek HTTP {resp.status_code}: {resp.text[:300]}")
            return None
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[X] deepseek 异常: {e}")
        return None


def chat_with_fallback(messages: List[Dict[str, str]],
                        primary: str = "mmx",
                        fallback: str = "deepseek") -> Optional[str]:
    """
    主备链调用 LLM:
      primary="mmx" → minimax CLI
      fallback="deepseek" → deepseek API

    失败自动 fallback, 返回最后响应.
    """
    attempts = []
    if primary == "mmx":
        r = call_mmx_text(messages)
        attempts.append(("mmx", r))
        if r:
            return r
        print("[!] mmx 失败, fallback 到 deepseek...")
    if fallback == "deepseek":
        r = call_deepseek_text(messages)
        attempts.append(("deepseek", r))
        if r:
            return r
    # 都失败
    print("[X] 所有 LLM provider 都失败")
    for name, r in attempts:
        print(f"    {name}: {'OK' if r else 'FAIL'}")
    return None


def generate_video_outline(ocr_text: str, subtitle_text: str, metadata: dict) -> dict:
    """生成视频大纲, 主 minimax, 备 deepseek."""
    system_prompt = """你是视频笔记助手. 任务:
1. 把视频分成 3-7 个章节
2. 每个章节给: 标题, 起始/结束时间戳(秒), 100-200 字摘要, 3-5 个关键要点
3. 输出**纯 JSON** 格式, 严格遵循 schema
4. **不确定的内容不要编造**, 看不懂就标 "unknown"

JSON schema:
{
  "chapters": [
    {
      "title": "章节标题 (中文, 简洁)",
      "start_tc": 0.0,
      "end_tc": 120.5,
      "summary": "章节摘要",
      "key_points": ["要点 1", "要点 2"]
    }
  ],
  "mindmap_root": "视频主题 (一句话)",
  "overall_summary": "视频整体 50 字总结"
}"""

    user_prompt = f"""视频元信息:
- 标题: {metadata.get('title', '?')}
- UP主: {metadata.get('owner', '?')}
- 时长: {metadata.get('duration_sec', '?')} 秒
- 简介: {metadata.get('desc', '?')[:500]}

---

【画面 OCR 文字】(从视频帧提取, 可能不完整)
{ocr_text[:3000]}

---

【字幕文字】(若有)
{subtitle_text[:3000]}

---

按 schema 输出 JSON. 时间戳从 0 开始."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    response = chat_with_fallback(messages)
    if not response:
        return {"error": "所有 LLM provider 都失败"}

    # 抠 JSON
    try:
        start = response.find("{")
        end = response.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(response[start:end])
        else:
            return {"raw_response": response, "parse_error": "no JSON found"}
    except Exception as e:
        return {"raw_response": response, "parse_error": str(e)}


if __name__ == "__main__":
    print("=" * 60)
    print("LLM Client (mmx CLI + deepseek fallback) 测试")
    print("=" * 60)

    # 测试 1: mmx CLI 是否可用
    if MMX_BIN.exists():
        print(f"[+] mmx CLI 已就绪: {MMX_BIN}")
    else:
        print(f"[X] mmx CLI 不存在")

    # 测试 2: 真发一个简单请求
    print()
    print("[*] 测试 LLM 调用 (会真发请求, 看是否走通)...")
    test_messages = [
        {"role": "system", "content": "你是个简洁助手."},
        {"role": "user", "content": "用一句话说 'OK 我能工作'."},
    ]
    response = chat_with_fallback(test_messages)
    if response:
        print(f"[+] LLM 响应: {response[:200]}")
    else:
        print("[X] LLM 调用失败")