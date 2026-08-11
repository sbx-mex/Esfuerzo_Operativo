#!/usr/bin/env python3
"""Comprueba que CSV, auditoría, JSON público y build sirven el mismo corte."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from build_data import OPERATIONAL_SOURCE, MERCH_SOURCE, VERSION, csv_records

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA = ROOT / "public" / "data" / "dashboard.json"
AUDIT_DATA = ROOT / "public" / "data" / "data-audit.json"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fail(errors: list[str], condition: bool, message: str) -> None:
    if condition:
        errors.append(message)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dist", action="store_true", help="También valida el artefacto compilado")
    args = parser.parse_args()

    operational, operational_profile = csv_records(OPERATIONAL_SOURCE, has_product=True)
    merch, merch_profile = csv_records(MERCH_SOURCE, has_product=False)
    dashboard = json.loads(PUBLIC_DATA.read_text(encoding="utf-8"))
    audit = json.loads(AUDIT_DATA.read_text(encoding="utf-8"))
    meta = dashboard.get("meta", {})
    sources = audit.get("sources", {})
    errors: list[str] = []

    expected = {
        "operativo": max(row["date"] for row in operational).isoformat(),
        "merch": max(row["date"] for row in merch).isoformat(),
    }
    published = {
        "operativo": meta.get("latestOperationalDate"),
        "merch": meta.get("latestMerchDate"),
    }
    fail(errors, expected != published, f"El JSON está atrasado: CSV={expected}, JSON={published}")
    fail(errors, meta.get("latestDate") != max(expected.values()), "latestDate no representa el corte más reciente")
    fail(errors, max(row[0] for row in dashboard.get("daily", [])) != expected["operativo"], "Las filas de Operativo no llegan a su corte")
    fail(errors, max(row[0] for row in dashboard.get("merch", [])) != expected["merch"], "Las filas de Merch no llegan a su corte")
    package_version = json.loads((ROOT / "package.json").read_text(encoding="utf-8")).get("version")
    fail(errors, len({dashboard.get("version"), audit.get("version"), package_version, VERSION}) != 1, "Las versiones de código y artefactos no coinciden")

    for path, profile in ((OPERATIONAL_SOURCE, operational_profile), (MERCH_SOURCE, merch_profile)):
        source = sources.get(path.name, {})
        fail(errors, source.get("sha256") != sha256(path), f"La auditoría no corresponde al archivo {path.name}")
        fail(errors, source.get("dateRange") != profile.get("dateRange"), f"El rango auditado de {path.name} está desactualizado")
        fail(errors, source.get("validRows") != profile.get("validRows"), f"El conteo auditado de {path.name} no coincide")

    if args.dist:
        dist_data = ROOT / "dist" / "data" / "dashboard.json"
        fail(errors, not dist_data.is_file(), "El build no contiene data/dashboard.json")
        if dist_data.is_file():
            fail(errors, sha256(dist_data) != sha256(PUBLIC_DATA), "El build no contiene el mismo JSON validado de public")

    if errors:
        raise SystemExit("\n".join(f"ERROR: {error}" for error in errors))
    print(json.dumps({
        "status": "ok",
        "latestOperationalDate": expected["operativo"],
        "latestMerchDate": expected["merch"],
        "operationalRows": operational_profile["validRows"],
        "merchRows": merch_profile["validRows"],
        "distVerified": args.dist,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
