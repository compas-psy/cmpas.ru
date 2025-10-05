"""
Request metadata extraction utilities.
"""
from __future__ import annotations

import re
from typing import Dict
from fastapi import Request


def _detect_device_type(user_agent: str) -> str:
    ua = user_agent.lower()
    if "telegram" in ua:
        return "Telegram MiniApp"
    if "android" in ua or "iphone" in ua or "ipad" in ua or "mobile" in ua:
        return "web mobile"
    return "web desktop"


def _detect_browser(user_agent: str) -> str:
    # Very lightweight detector
    if "edg/" in user_agent:
        m = re.search(r"Edg/(\d+[\.\w]*)", user_agent)
        return f"Edge {m.group(1)}" if m else "Edge"
    if "chrome/" in user_agent and "chromium" not in user_agent.lower():
        m = re.search(r"Chrome/(\d+[\.\w]*)", user_agent)
        return f"Chrome {m.group(1)}" if m else "Chrome"
    if "firefox/" in user_agent.lower():
        m = re.search(r"Firefox/(\d+[\.\w]*)", user_agent)
        return f"Firefox {m.group(1)}" if m else "Firefox"
    if "safari/" in user_agent and "chrome" not in user_agent.lower():
        m = re.search(r"Version/(\d+[\.\w]*)", user_agent)
        return f"Safari {m.group(1)}" if m else "Safari"
    if "trident" in user_agent.lower() or "msie" in user_agent.lower():
        return "Internet Explorer"
    return "Unknown"


def _detect_os(user_agent: str) -> str:
    ua = user_agent.lower()
    if "windows" in ua:
        return "Windows"
    if "android" in ua:
        return "Android"
    if "iphone" in ua or "ipad" in ua or "ios" in ua:
        return "iOS"
    if "mac os" in ua or "macintosh" in ua:
        return "macOS"
    if "linux" in ua:
        return "Linux"
    return "Unknown"


def get_request_meta(request: Request) -> Dict[str, str]:
    """Extracts common request metadata for login audit."""
    ua = request.headers.get("user-agent", "")
    ip = request.client.host if request.client else None
    return {
        "ip_address": ip or "",
        "user_agent": ua,
        "device_type": _detect_device_type(ua),
        "browser": _detect_browser(ua),
        "os": _detect_os(ua),
        "referer": request.headers.get("referer", ""),
        "accept_language": request.headers.get("accept-language", ""),
    }
