#!/usr/bin/env python3
"""Audita diez garantías de instalación, actualización y resiliencia PWA."""

from __future__ import annotations

import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "src" / "App.tsx").read_text(encoding="utf-8")
INSTALL = (ROOT / "src" / "InstallPrompt.tsx").read_text(encoding="utf-8")
MAIN = (ROOT / "src" / "main.tsx").read_text(encoding="utf-8")
DATA = (ROOT / "src" / "data.ts").read_text(encoding="utf-8")
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
VITE = (ROOT / "vite.config.ts").read_text(encoding="utf-8")


def png_size(name: str) -> tuple[int, int] | None:
    raw = (ROOT / "public" / name).read_bytes()
    if raw[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", raw[16:24])


checks = {
    "icono Android 192": png_size("pwa-icon-192.png") == (192, 192),
    "icono Android 512": png_size("pwa-icon-512.png") == (512, 512),
    "icono maskable": png_size("pwa-maskable-512.png") == (512, 512) and "purpose:'maskable'" in VITE,
    "icono iOS": png_size("apple-touch-icon.png") == (180, 180) and "apple-touch-icon" in HTML,
    "instalación Android": "beforeinstallprompt" in INSTALL and "userChoice" in INSTALL,
    "confirmación instalada": "appinstalled" in INSTALL and "display-mode: standalone" in INSTALL,
    "guía iOS": "Agregar a inicio" in INSTALL and "navigator.maxTouchPoints" in INSTALL,
    "actualización PWA": "onNeedRefresh" in MAIN and "pwa-apply-update" in INSTALL,
    "recuperación de conexión": "addEventListener('online'" in APP and "offline-banner" in APP,
    "caché estable": "actualizar" not in DATA and "cache:'no-cache'" in DATA,
}
failed = [name for name, passed in checks.items() if not passed]
if failed:
    raise SystemExit("\n".join(f"ERROR: falta {name}" for name in failed))
print(json.dumps({"status":"ok", "pwaChecks":len(checks)}, ensure_ascii=False))
