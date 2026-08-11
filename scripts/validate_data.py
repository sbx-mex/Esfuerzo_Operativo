#!/usr/bin/env python3
"""Valida el artefacto generado y reconcilia métricas antes de publicar."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "public" / "data" / "dashboard.json"
AUDIT_PATH = ROOT / "public" / "data" / "data-audit.json"


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    audit = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
    errors: list[str] = []
    directory = data.get("directory", [])
    directory_cc = [item.get("cc") for item in directory]
    if len(directory_cc) != len(set(directory_cc)):
        errors.append("El directorio contiene CC duplicados")
    if audit.get("status") != "ok":
        errors.append("La auditoría del motor no terminó en estado ok")
    checks = audit.get("checks", {})
    if checks.get("missingDirectory"):
        errors.append("Existen CC sin cruce en el directorio")
    if checks.get("unknownProducts"):
        errors.append("Existen productos sin homologar")
    operational_total = round(sum(sum(row[4:7]) for row in data.get("daily", [])), 3)
    merch_total = round(sum(row[4] for row in data.get("merch", [])), 3)
    if operational_total != round(checks.get("groupedOperationalUnits", -1), 3):
        errors.append("El total operativo del JSON no reconcilia")
    if merch_total != round(checks.get("merchUnits", -1), 3):
        errors.append("El total Merch del JSON no reconcilia")
    if data.get("meta", {}).get("latestDate") != checks.get("dateRange", [None, None])[-1]:
        errors.append("La última fecha no coincide con el rango auditado")
    if errors:
        raise SystemExit("\n".join(f"ERROR: {error}" for error in errors))
    print(json.dumps({
        "status": "ok",
        "stores": len(directory),
        "operationalUnits": operational_total,
        "merchUnits": merch_total,
        "latestDate": data["meta"]["latestDate"],
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
