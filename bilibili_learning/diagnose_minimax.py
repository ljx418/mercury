"""
minimax 连通性深度诊断 - 详细错误信息
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from secret_loader import load_env
import os

from openai import OpenAI

load_env(verbose=False)

api_key = os.environ.get("MINIMAX_API_KEY")
base_url = os.environ.get("MINIMAX_BASE_URL")
model = os.environ.get("MINIMAX_MODEL")

print(f"[*] 测试参数 (不打印 key 真值):")
print(f"    base_url: {base_url}")
print(f"    model: {model}")
print(f"    api_key 长度: {len(api_key) if api_key else 0}")
print(f"    api_key 前缀: {api_key[:6] if api_key else 'NONE'}...")
print()

# 测试 1: 当前 base_url
print("[测试1] 当前 base_url ...")
client = OpenAI(api_key=api_key, base_url=base_url)
try:
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "hi"}],
        max_tokens=5,
    )
    print(f"  [OK] 响应: {resp.choices[0].message.content!r}")
except Exception as e:
    print(f"  [X] 错误类型: {type(e).__name__}")
    print(f"  [X] 错误信息: {e}")
    # 详细: status_code / body
    if hasattr(e, 'status_code'):
        print(f"  [X] status_code: {e.status_code}")
    if hasattr(e, 'body'):
        print(f"  [X] body: {e.body}")
print()

# 测试 2: 备选 base_url
for alt_url in [
    "https://api.minimaxi.com/v1",
    "https://api.minimaxi.chat/v1",
    "https://api.minimax.io/v1",
]:
    print(f"[测试2] {alt_url} ...")
    client = OpenAI(api_key=api_key, base_url=alt_url)
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=5,
        )
        print(f"  [OK] 响应: {resp.choices[0].message.content!r}")
        print(f"  [建议] 把 .env 的 MINIMAX_BASE_URL 改成这个")
        break
    except Exception as e:
        print(f"  [X] {type(e).__name__}: {str(e)[:200]}")
    print()