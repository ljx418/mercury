"""
BiliNote LLM 连通性测试 (用 OpenAI 协议)
从 .env 读 provider 配置, 测 API 是否通.

不打印 API key 真值.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from secret_loader import load_env, list_available_providers

# openai 1.x
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


def test_provider(name: str, cfg: dict) -> bool:
    """测 provider 连通性"""
    print(f"\n[*] 测试 {name} ({cfg['model']}) ...")

    client = OpenAI(
        api_key=cfg["api_key"],
        base_url=cfg["base_url"],
    )

    try:
        # 极简请求: 1 token 就够
        resp = client.chat.completions.create(
            model=cfg["model"],
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=5,
            temperature=0,
        )
        text = resp.choices[0].message.content
        print(f"  [OK] 响应: {text!r}")
        return True
    except Exception as e:
        msg = str(e)
        # 截断太长的错误信息
        if len(msg) > 300:
            msg = msg[:300] + "..."
        print(f"  [X] {msg}")
        return False


def main():
    print("=" * 60)
    print("BiliNote LLM 连通性测试")
    print("=" * 60)

    if not OPENAI_AVAILABLE:
        print("[X] openai 包未装: pip install openai")
        sys.exit(1)

    if not load_env():
        sys.exit(1)

    available = list_available_providers()
    if not available:
        print("[X] 没有可用的 provider, 检查 secrets/.env")
        sys.exit(1)

    print(f"\n[*] 可用 provider: {list(available.keys())}")

    results = {}
    for name, cfg in available.items():
        if cfg["openai_compatible"]:
            results[name] = test_provider(name, cfg)
        else:
            print(f"\n[*] {name} 不是 OpenAI 兼容 (用 anthropic SDK 测), 跳过")
            results[name] = None

    print("\n" + "=" * 60)
    print("汇总:")
    for name, r in results.items():
        marker = "[OK]" if r else ("[缺]" if r is None else "[X]")
        print(f"  {marker} {name}")

    if any(r is True for r in results.values()):
        print("\n[+] 有可用 LLM, 下一步: 在 BiliNote Web UI 添加 Provider")
        return 0
    else:
        print("\n[!] 没有可用的 LLM, 检查 base_url / key / model")
        return 1


if __name__ == "__main__":
    sys.exit(main())