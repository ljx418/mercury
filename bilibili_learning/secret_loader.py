"""
密钥加载器 - 从 secrets/.env 安全加载 LLM API key, 不打印真值

支持的 provider:
  - MINIMAX (主用)
  - DEEPSEEK (中文强, 便宜)
  - OPENAI (备用)
  - ANTHROPIC (备用)
"""
import os
from pathlib import Path
from typing import Optional, Dict

try:
    from dotenv import load_dotenv
    DOTENV_AVAILABLE = True
except ImportError:
    DOTENV_AVAILABLE = False

SCRIPT_DIR = Path(__file__).resolve().parent
ENV_PATH = SCRIPT_DIR / "secrets" / ".env"


def load_env(verbose: bool = True) -> bool:
    """加载 .env 到 os.environ."""
    if not DOTENV_AVAILABLE:
        if verbose:
            print("[X] python-dotenv 没装")
        return False
    if not ENV_PATH.exists():
        if verbose:
            print(f"[X] 找不到 {ENV_PATH}")
            print("    复制 secrets/.env.example 为 secrets/.env 并填值")
        return False
    load_dotenv(ENV_PATH)
    if verbose:
        print(f"[+] .env 已加载: {ENV_PATH}")
    return True


def get_key(name: str, required: bool = True) -> Optional[str]:
    """从环境变量拿 key. 不打印真值."""
    val = os.environ.get(name)
    if not val:
        if required:
            print(f"[!] {name} 未设置")
        return None
    if len(val) > 12:
        masked = val[:4] + "*" * min(len(val) - 8, 20) + val[-4:]
    else:
        masked = val[:2] + "***"
    print(f"[+] {name} 已设置 (长度 {len(val)}, 前缀 {masked[:6]}...)")
    return val


# Provider 配置 (OpenAI 兼容协议)
PROVIDERS = {
    "minimax": {
        "api_key_env": "MINIMAX_API_KEY",
        "base_url_env": "MINIMAX_BASE_URL",
        "model_env": "MINIMAX_MODEL",
        "default_base_url": "https://api.minimaxi.chat/v1",
        "default_model": "MiniMax-M3",
        "openai_compatible": True,
    },
    "deepseek": {
        "api_key_env": "DEEPSEEK_API_KEY",
        "base_url_env": "DEEPSEEK_BASE_URL",
        "model_env": "DEEPSEEK_MODEL",
        "default_base_url": "https://api.deepseek.com/v1",
        "default_model": "deepseek-chat",
        "openai_compatible": True,
    },
    "openai": {
        "api_key_env": "OPENAI_API_KEY",
        "base_url_env": "OPENAI_BASE_URL",
        "model_env": "OPENAI_MODEL",
        "default_base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o-mini",
        "openai_compatible": True,
    },
    "anthropic": {
        "api_key_env": "ANTHROPIC_API_KEY",
        "base_url_env": None,
        "model_env": "ANTHROPIC_MODEL",
        "default_base_url": None,
        "default_model": "claude-3-5-sonnet-20241022",
        "openai_compatible": False,  # 用 anthropic SDK, 不走 OpenAI 协议
    },
}


def get_provider_config(name: str) -> Optional[Dict]:
    """拿 provider 配置, 自动 fallback 到默认值."""
    if name not in PROVIDERS:
        print(f"[X] 未知 provider: {name}, 可选: {list(PROVIDERS.keys())}")
        return None
    cfg = PROVIDERS[name]
    api_key = os.environ.get(cfg["api_key_env"], "")
    if not api_key:
        print(f"[!] {cfg['api_key_env']} 未设置, provider {name} 不可用")
        return None
    base_url = os.environ.get(cfg["base_url_env"]) if cfg["base_url_env"] else cfg["default_base_url"]
    model = os.environ.get(cfg["model_env"]) if cfg["model_env"] else cfg["default_model"]
    return {
        "name": name,
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
        "openai_compatible": cfg["openai_compatible"],
    }


def list_available_providers() -> Dict[str, Dict]:
    """列出所有 API key 已设置的 provider."""
    available = {}
    for name in PROVIDERS:
        cfg = get_provider_config(name)
        if cfg:
            available[name] = cfg
    return available


def check_all_keys() -> dict:
    """检查所有 key 状态."""
    status = {}
    for name, cfg in PROVIDERS.items():
        has_key = bool(os.environ.get(cfg["api_key_env"]))
        status[cfg["api_key_env"]] = has_key
    return status


if __name__ == "__main__":
    print("=" * 60)
    print("密钥环境检查 (不打印真值)")
    print("=" * 60)
    if load_env():
        print()
        print("[*] Key 状态:")
        for k, v in check_all_keys().items():
            print(f"  [{'OK' if v else '缺'}] {k}")
        print()
        print("[*] 可用 provider:")
        available = list_available_providers()
        for name, cfg in available.items():
            print(f"  [OK] {name}: model={cfg['model']}, base={cfg['base_url']}")
        if not available:
            print("  [缺] 没有可用的 provider")