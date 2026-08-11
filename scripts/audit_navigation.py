#!/usr/bin/env python3
"""Auditoría estática de los diez controles clave de navegación accesible."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "src" / "App.tsx").read_text(encoding="utf-8")
CSS = (ROOT / "src" / "styles.css").read_text(encoding="utf-8")
HTML = (ROOT / "index.html").read_text(encoding="utf-8")

CHECKS = {
    "salto directo a filtros": 'className="skip-link"' in APP and 'id="filtros"' in APP,
    "pestañas semánticas": 'role="tablist"' in APP and 'role="tabpanel"' in APP,
    "pestañas con flechas": "navigateViews" in APP and "ArrowRight" in APP,
    "semana con confirmación": 'className="week-picker-close"' in APP and ">Listo</button>" in APP,
    "semana cierra con Escape": "event.key !== 'Escape'" in APP,
    "semana cierra fuera": "closeFromOutside" in APP and "pointerdown" in APP,
    "restablecimiento global": "resetAllFilters" in APP and 'className="filter-summary"' in APP,
    "estado anunciado": 'role="status"' in APP and 'aria-live="polite"' in APP,
    "foco visible": ":focus-visible" in CSS and ".skip-link:focus" in CSS,
    "móvil táctil y seguro": "touch-action:manipulation" in CSS and "safe-area-inset" in CSS and "viewport-fit=cover" in HTML,
}

failed = [name for name, passed in CHECKS.items() if not passed]
if failed:
    raise SystemExit("\n".join(f"ERROR: falta {name}" for name in failed))
print(json.dumps({"status": "ok", "navigationChecks": len(CHECKS)}, ensure_ascii=False))
