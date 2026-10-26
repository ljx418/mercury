from __future__ import annotations

import re
from typing import Any

PAGE_CONTEXT_PROMPT_CHAR_LIMIT = 18_000
_SECRET_PATTERNS = (
    re.compile(r"sk-[A-Za-z0-9_-]{8,}"),
    re.compile(r"Bearer\s+[A-Za-z0-9._-]+", re.IGNORECASE),
    re.compile(r"/(?:Users|private|var|tmp|opt|home)/[^\s\"',}]*"),
)
_SENSITIVE_KEY_RE = re.compile(r"debug|raw|private|api[_-]?key|secret|token|authorization|password", re.IGNORECASE)

CHAT_PROFILE_SYSTEM_PROMPT = """你是浏览器侧边栏中的网页阅读聊天助手，不是编码助手。
当前处于 Chat Profile。
你可以回答普通问题、总结当前页面、解释内容、生成结构化摘要或 Mindmap。
你不能读取本地文件。
你不能查看目录。
你不能执行命令。
你不能调用 read/write/bash/edit/grep/find/ls。
你不需要也不允许使用工具。
当前网页内容、选区和用户问题已经由 Runtime 提供。
请直接基于提供的上下文完成回答。
总结页面时，直接总结。
生成 Mindmap 时，直接输出适合 Runtime 转换为 artifact 的结构化内容。
解释选区时，直接解释选区内容。
不要把普通问题判断为代码任务。
不要用代码任务视角评价普通体育、新闻、生活或网页伴读问题。
不要主动讨论问题是否属于代码任务。
不要主动建议写代码、抓取脚本、读取当前目录、读取文件或执行命令。
不要说“我需要查看目录”“让我读取文件”“我是编码助手”。
当前版本不调用实时搜索、天气、外部工具、本地文件或命令。
如果问题需要实时信息，请明确说明当前没有实时联网查询能力，并给出一般性分析。
不要声称已经联网检索，也不要编造无来源的进行中比分、盘口赔率、即时排名、当日晚间赛程或当日新闻。
回答要简洁、自然、结构清晰，优先使用 Markdown。
默认先给结论，再给理由，控制在 3-6 条要点。
除非用户明确询问查询渠道，不要列一堆外部网站。"""


def build_prompt_envelope(user_message: str, *, task_type: str = "general_chat", active_page: dict[str, Any] | None = None, page_context_text: str | None = None) -> str:
    context_text = page_context_text if page_context_text is not None else build_page_context_prompt(active_page)
    context_source = "Runtime provided browser page context" if context_text else "Runtime provided chat request"
    mindmap_instruction = (
        "\nMINDMAP_OUTPUT_FORMAT: 输出 Mermaid mindmap 代码块，必须以 mindmap 开头；如果无法生成 Mermaid，请输出清晰的层级 outline，供 Runtime 转换为 artifact.created。\n"
        if task_type == "mindmap_page"
        else ""
    )
    task_instruction = _task_instruction(task_type)
    page_context_block = (
        "\nPAGE_CONTEXT:\n"
        "以下 PAGE_CONTEXT 就是当前浏览器页面内容。不要说你无法访问浏览器页面，不要根据终端/coding-agent 运行环境拒答。不要请求读取目录、文件或命令。\n"
        f"{context_text}\n"
        if context_text
        else ""
    )
    return (
        f"{CHAT_PROFILE_SYSTEM_PROMPT}\n\n"
        f"TASK_TYPE: {task_type}\n"
        f"CONTEXT_SOURCE: {context_source}\n"
        "TOOLS_ALLOWED: false\n"
        f"{task_instruction}"
        f"{mindmap_instruction}"
        f"{page_context_block}\n"
        f"USER_REQUEST:\n{user_message}"
    )


def _task_instruction(task_type: str) -> str:
    if task_type == "summarize_page":
        return (
            "\nSUMMARY_OUTPUT_REQUIREMENTS:\n"
            "1. 先判断页面的正文类型与核心问题，忽略导航、推荐、评论、登录提示和重复控件。\n"
            "2. 第一段用 1-2 句给出全文主旨，不复述页面标题。\n"
            "3. 再按原文逻辑给出 3-7 个带小标题的要点，区分观点、依据、步骤、例子与限制。\n"
            "4. 对数字、人名、时间、因果和结论只保留 PAGE_CONTEXT 明确支持的内容；信息不足时明确标注。\n"
            "5. 结尾给出“阅读结论”，说明读者应记住什么；不要输出泛化建议或与页面无关的常识。\n"
            "6. 如果 PAGE_CONTEXT 是视频详情页而非完整字幕，必须说明总结覆盖的是页面资料，不得假装已理解整段视频。\n"
        )
    if task_type == "page_qa":
        return (
            "\nPAGE_QA_REQUIREMENTS: 先定位 PAGE_CONTEXT 中直接支持答案的段落，再回答；"
            "不得把标题、推荐内容或评论当作正文依据。证据不足时直说不足。\n"
        )
    return ""


def build_page_context_prompt(active_page: dict[str, Any] | None, *, max_chars: int = PAGE_CONTEXT_PROMPT_CHAR_LIMIT) -> str:
    if not isinstance(active_page, dict) or max_chars <= 0:
        return ""
    sections: list[tuple[str, str]] = []
    title = _string_field(active_page, "title")
    url = _string_field(active_page, "url")
    if title:
        sections.append(("PAGE_TITLE", title))
    if url:
        sections.append(("PAGE_URL", url))

    selected = _first_text(active_page, ("selectedText", "selected_text"))
    digest = _first_text(active_page, ("perceptionDigest", "highSignalPage"))
    if not digest:
        perception = active_page.get("perception")
        if isinstance(perception, dict):
            digest = _first_text(perception, ("perceptionDigest", "highSignalPage"))
    cleaned = _first_text(active_page, ("cleanedText", "cleaned_text"))
    visible = _first_text(active_page, ("visibleText", "visible_text"))
    chunks = _chunks_text(active_page.get("chunks"))

    if selected:
        sections.append(("SELECTED_TEXT", selected))
    if digest:
        sections.append(("PAGE_CONTEXT_DIGEST", digest))
    page_text = _first_non_empty(cleaned, visible, chunks)
    if page_text:
        sections.append(("PAGE_TEXT", page_text))

    return _render_sections(sections, max_chars=max_chars)


def _render_sections(sections: list[tuple[str, str]], *, max_chars: int) -> str:
    output: list[str] = []
    remaining = max_chars
    for label, raw_text in sections:
        if remaining <= 0:
            break
        text = _redact_text(raw_text).strip()
        if not text:
            continue
        prefix = f"{label}:\n"
        available = remaining - len(prefix) - 2
        if available <= 0:
            break
        clipped = text[:available]
        block = f"{prefix}{clipped}"
        output.append(block)
        remaining -= len(block) + 2
    return "\n\n".join(output)


def _string_field(value: dict[str, Any], key: str) -> str:
    child = value.get(key)
    return _redact_text(child).strip() if isinstance(child, str) else ""


def _first_text(value: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        child = value.get(key)
        text = _text_from_value(child)
        if text:
            return text
    return ""


def _first_non_empty(*values: str) -> str:
    for value in values:
        if value:
            return value
    return ""


def _chunks_text(value: object) -> str:
    if not isinstance(value, list):
        return ""
    chunks: list[str] = []
    for item in value[:24]:
        text = _text_from_value(item)
        if text:
            chunks.append(text)
    return "\n".join(chunks)


def _text_from_value(value: object) -> str:
    if isinstance(value, str):
        return _redact_text(value).strip()
    if isinstance(value, list):
        parts = [_text_from_value(item) for item in value]
        return "\n".join(part for part in parts if part)
    if isinstance(value, dict):
        parts: list[str] = []
        for key in ("summary", "title", "heading", "text", "content", "digest", "abstract", "description"):
            if key in value and not _SENSITIVE_KEY_RE.search(key):
                text = _text_from_value(value[key])
                if text:
                    parts.append(text)
        for key in ("items", "blocks", "sections", "headings", "chunks", "keyPoints", "highlights"):
            if key in value and not _SENSITIVE_KEY_RE.search(key):
                text = _text_from_value(value[key])
                if text:
                    parts.append(text)
        return "\n".join(parts)
    return ""


def _redact_text(value: object) -> str:
    text = str(value or "")
    for pattern in _SECRET_PATTERNS:
        replacement = "sk-****" if pattern.pattern.startswith("sk-") else "[redacted]"
        text = pattern.sub(replacement, text)
    return text
