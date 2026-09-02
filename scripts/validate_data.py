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
    required_directory = {"cc", "store", "region", "dm", "storeType", "benchmark"}
    if any(set(item) != required_directory for item in directory):
        errors.append("El directorio publicado no conserva Región, DM, Tipo Tienda y Benchmark")
    if any(not item.get("storeType") for item in directory):
        errors.append("El directorio contiene tiendas sin Tipo Tienda")
    if audit.get("status") != "ok":
        errors.append("La auditoría del motor no terminó en estado ok")
    checks = audit.get("checks", {})
    if checks.get("missingDirectory"):
        errors.append("Existen CC sin cruce en el directorio")
    if checks.get("unknownProducts"):
        errors.append("Existen productos sin homologar")
    operational_total = round(sum(sum(row[4:8]) for row in data.get("daily", [])), 3)
    merch_total = round(sum(row[4] for row in data.get("merch", [])), 3)
    daily_keys = [(row[0], row[3]) for row in data.get("daily", [])]
    merch_keys = [(row[0], row[3]) for row in data.get("merch", [])]
    if len(daily_keys) != len(set(daily_keys)):
        errors.append("El motor operativo contiene más de un registro agregado por fecha y CC")
    if len(merch_keys) != len(set(merch_keys)):
        errors.append("El motor Merch contiene más de un registro agregado por fecha y CC")
    expected_groups = {"Cake Pop", "Galletas", "Dona G&G", "Mini Pan Muerto"}
    catalog_groups = data.get("catalog", {}).get("groups", {})
    if set(catalog_groups) != expected_groups:
        errors.append("El catálogo operativo no conserva las cuatro familias independientes")
    normalized_variants = [
        str(product).casefold().replace(" ", "")
        for products in catalog_groups.values()
        for product in products
    ]
    if len(normalized_variants) != len(set(normalized_variants)):
        errors.append("Un producto fue asignado a más de una familia operativa")
    if any("combo" in product for product in normalized_variants if "dona" in product):
        errors.append("Dona en Combo no debe formar parte de Dona G&G")
    expected_mini_pan = {"panmuertoavella", "panmuertoqueso", "panmuertozarza"}
    published_mini_pan = {
        product for product in normalized_variants
        if product in expected_mini_pan
    }
    if published_mini_pan != expected_mini_pan:
        errors.append("Mini Pan Muerto no conserva sus tres productos homologados")
    if operational_total != round(checks.get("groupedOperationalUnits", -1), 3):
        errors.append("El total operativo del JSON no reconcilia")
    if merch_total != round(checks.get("merchUnits", -1), 3):
        errors.append("El total Merch del JSON no reconcilia")
    if data.get("meta", {}).get("latestDate") != checks.get("dateRange", [None, None])[-1]:
        errors.append("La última fecha no coincide con el rango auditado")
    daily_dates = [row[0] for row in data.get("daily", [])]
    merch_dates = [row[0] for row in data.get("merch", [])]
    if not daily_dates or data.get("meta", {}).get("latestOperationalDate") != max(daily_dates):
        errors.append("La fecha del motor operativo no coincide con sus datos")
    if not merch_dates or data.get("meta", {}).get("latestMerchDate") != max(merch_dates):
        errors.append("La fecha del motor Merch no coincide con sus datos")
    week_periods = data.get("meta", {}).get("weekPeriods", {})
    for engine in ("operativo", "merch"):
        periods = week_periods.get(engine, [])
        if not periods or any(item.get("status") not in {"open", "closed"} for item in periods):
            errors.append(f"El motor {engine} no documenta correctamente sus semanas")
        if len({item.get("week") for item in periods}) != len(periods):
            errors.append(f"El motor {engine} contiene semanas duplicadas en el resumen")
    for source_name, profile in audit.get("sources", {}).items():
        if source_name.endswith(".csv"):
            if profile.get("exactDuplicates"):
                errors.append(f"{source_name} contiene duplicados")
            if profile.get("indicators") != {"USD": profile.get("validRows")}:
                errors.append(f"{source_name} contiene indicadores distintos de USD")
            if not profile.get("valueColumn"):
                errors.append(f"{source_name} no documenta la columna de valor")
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
