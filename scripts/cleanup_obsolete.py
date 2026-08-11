#!/usr/bin/env python3
"""Audita y elimina únicamente rutas explícitas del manifiesto autorizado."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOWED_ROOT_FILES = {"app.js", "styles.css", "service-worker.js", "manifest.json"}
ALLOWED_PREFIXES = ("data/", "tools/", "public/assets/")
PROTECTED = {
    "data/Esfuerzo operativo.csv",
    "data/Esfuerzo operativo_merch.csv",
    "data/Directorio.xlsx",
    "public/data/dashboard.json",
    "public/data/data-audit.json",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--check-clean", action="store_true")
    args = parser.parse_args()
    manifest_path = ROOT / "scripts" / "obsolete-files.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    raw_candidates = manifest.get("obsoleteFiles", [])
    if not isinstance(raw_candidates, list) or any(not isinstance(item, str) for item in raw_candidates):
        raise SystemExit("El manifiesto debe contener una lista de rutas")
    if len(raw_candidates) != len(set(raw_candidates)):
        raise SystemExit("El manifiesto contiene rutas duplicadas")
    approved: list[tuple[str, Path]] = []
    for raw in raw_candidates:
        relative = Path(raw)
        normalized = relative.as_posix()
        if relative.is_absolute() or ".." in relative.parts:
            raise SystemExit(f"Ruta insegura: {raw}")
        if normalized in PROTECTED:
            raise SystemExit(f"Motor protegido: {raw}")
        if normalized not in ALLOWED_ROOT_FILES and not normalized.startswith(ALLOWED_PREFIXES):
            raise SystemExit(f"Ruta fuera del alcance: {raw}")
        target = (ROOT / relative).resolve()
        if ROOT not in target.parents:
            raise SystemExit(f"Ruta fuera del repositorio: {raw}")
        if target.is_dir():
            raise SystemExit(f"Solo se permiten archivos: {raw}")
        approved.append((normalized,target))
    removed = []
    for normalized,target in approved:
        if args.apply and target.is_file():
            target.unlink()
            removed.append(normalized)
    remaining = [normalized for normalized,target in approved if target.is_file()]
    print(json.dumps({"mode":"apply" if args.apply else "audit", "removed":removed, "remaining":remaining}, ensure_ascii=False))
    if args.check_clean and remaining:
        raise SystemExit(f"Persisten {len(remaining)} archivos obsoletos")


if __name__ == "__main__":
    main()
