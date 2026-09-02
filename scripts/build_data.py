#!/usr/bin/env python3
"""Compila los tres motores de Esfuerzo Operativo en un JSON ligero y auditable."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
PUBLIC = ROOT / "public" / "data"
OPERATIONAL_SOURCE = DATA / "Esfuerzo operativo.csv"
MERCH_SOURCE = DATA / "Esfuerzo operativo_merch.csv"
DIRECTORY_SOURCE = DATA / "Directorio.xlsx"
OUTPUT = PUBLIC / "dashboard.json"
AUDIT_OUTPUT = PUBLIC / "data-audit.json"
VERSION = "1.11.0"

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"m": MAIN_NS, "r": REL_NS}
MONTH_ORDER = {"Ene": 1, "Feb": 2, "Mar": 3, "Abr": 4, "May": 5, "Jun": 6,
               "Jul": 7, "Ago": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dic": 12}
GROUPS = ("Cake Pop", "Galletas", "Dona G&G", "Mini Pan Muerto")
MINI_PAN_MUERTO_PRODUCTS = {
    "panmuertoavella",
    "panmuertoqueso",
    "panmuertozarza",
}


def week_periods(records: list[dict[str, object]]) -> list[dict[str, object]]:
    """Describe qué semanas están cerradas sin mezclar los dos motores."""
    dates_by_week: defaultdict[int, set[date]] = defaultdict(set)
    for record in records:
        dates_by_week[int(record["week"])].add(record["date"])
    if not dates_by_week:
        return []
    latest_week = max(dates_by_week, key=lambda week: max(dates_by_week[week]))
    periods: list[dict[str, object]] = []
    for week, dates in sorted(dates_by_week.items()):
        start, end = min(dates), max(dates)
        is_closed = week != latest_week or end.weekday() == 6
        periods.append({
            "week": week,
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "daysLoaded": len(dates),
            "status": "closed" if is_closed else "open",
        })
    return periods


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalized(value: object) -> str:
    return "".join(
        character for character in unicodedata.normalize("NFD", clean(value).lower())
        if unicodedata.category(character) != "Mn"
    )


def normalized_header(value: object) -> str:
    return re.sub(r"[^a-z0-9]", "", normalized(value))


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_json(path: Path, payload: object, *, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(
            payload,
            handle,
            ensure_ascii=False,
            indent=2 if pretty else None,
            separators=None if pretty else (",", ":"),
        )
        handle.write("\n")
    os.replace(temporary, path)


def decode_csv(path: Path) -> str:
    raw = path.read_bytes()
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")) or raw.count(b"\x00") > len(raw) // 5:
        return raw.decode("utf-16")
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"{path.name}: codificación no reconocida")


def parse_date(value: object) -> date:
    text = clean(value)
    for pattern in ("%m/%d/%Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%y", "%d/%m/%y"):
        try:
            return datetime.strptime(text, pattern).date()
        except ValueError:
            continue
    raise ValueError(f"Fecha no reconocida: {text!r}")


def number(value: object) -> float | None:
    text = clean(value).replace(",", "").replace("$", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def canonical_cc(value: object) -> str:
    text = clean(value)
    return text[:-2] if text.endswith(".0") else text


def product_group(product: str) -> str | None:
    key = normalized(product).replace(" ", "")
    if key.startswith("cakepop"):
        return "Cake Pop"
    if key.startswith("galleta"):
        return "Galletas"
    if "donachocolateconnuez" in key:
        return "Dona G&G"
    if key in MINI_PAN_MUERTO_PRODUCTS:
        return "Mini Pan Muerto"
    return None


def column_index(reference: str) -> int:
    result = 0
    for character in re.match(r"[A-Z]+", reference).group(0):
        result = result * 26 + ord(character) - 64
    return result - 1


def workbook_rows(path: Path) -> dict[str, list[list[str]]]:
    sheets: dict[str, list[list[str]]] = {}
    with zipfile.ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relationship_map = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in shared_root.findall("m:si", NS):
                shared_strings.append("".join(node.text or "" for node in item.iter(f"{{{MAIN_NS}}}t")))
        for sheet in workbook.find("m:sheets", NS):
            target = relationship_map[sheet.attrib[f"{{{REL_NS}}}id"]]
            target = target if target.startswith("xl/") else f"xl/{target.lstrip('/')}"
            target = target.replace("xl/worksheets/../", "xl/")
            xml_sheet = ET.fromstring(archive.read(target))
            rows: list[list[str]] = []
            for xml_row in xml_sheet.findall(".//m:sheetData/m:row", NS):
                values: dict[int, str] = {}
                for cell in xml_row.findall("m:c", NS):
                    position = column_index(cell.attrib["r"])
                    cell_type = cell.attrib.get("t")
                    value_node = cell.find("m:v", NS)
                    if cell_type == "inlineStr":
                        value = "".join(node.text or "" for node in cell.iter(f"{{{MAIN_NS}}}t"))
                    elif value_node is None:
                        value = ""
                    else:
                        raw = value_node.text or ""
                        value = shared_strings[int(raw)] if cell_type == "s" and raw else raw
                    values[position] = value
                if values:
                    rows.append([values.get(index, "") for index in range(max(values) + 1)])
            sheets[sheet.attrib["name"]] = rows
    return sheets


def read_directory(path: Path) -> tuple[list[dict[str, str]], dict[str, dict[str, str]]]:
    sheets = workbook_rows(path)
    if not sheets:
        raise ValueError("Directorio.xlsx no contiene hojas")
    selected_rows = next((rows for rows in sheets.values() if rows and "cc" in [normalized_header(v) for v in rows[0]]), None)
    if not selected_rows:
        raise ValueError("Directorio.xlsx: no se encontró la tabla CC, Tienda, Región, DM, Tipo Tienda")
    header = [normalized_header(value) for value in selected_rows[0]]
    required = {"cc", "tienda", "region", "dm", "tipotienda"}
    missing = sorted(required - set(header))
    if missing:
        raise ValueError(f"Directorio.xlsx: faltan columnas {missing}")
    indices = {name: header.index(name) for name in required}
    benchmark_header = next(
        (name for name in ("loquefunciona", "benchmark", "practicadestacada") if name in header),
        None,
    )
    directory: list[dict[str, str]] = []
    by_cc: dict[str, dict[str, str]] = {}
    duplicate_cc: list[str] = []
    for row_number, row in enumerate(selected_rows[1:], 2):
        padded = row + [""] * len(header)
        cc = canonical_cc(padded[indices["cc"]])
        if not cc:
            continue
        record = {
            "cc": cc,
            "store": clean(padded[indices["tienda"]]),
            "region": clean(padded[indices["region"]]),
            "dm": clean(padded[indices["dm"]]),
            "storeType": clean(padded[indices["tipotienda"]]),
            "benchmark": clean(padded[header.index(benchmark_header)]) if benchmark_header else "",
        }
        if not all(record[field] for field in ("cc", "store", "region", "dm", "storeType")):
            raise ValueError(f"Directorio.xlsx fila {row_number}: contiene campos vacíos")
        if cc in by_cc:
            duplicate_cc.append(cc)
            continue
        by_cc[cc] = record
        directory.append(record)
    if duplicate_cc:
        raise ValueError(f"Directorio.xlsx: CC duplicados {sorted(set(duplicate_cc))}")
    directory.sort(key=lambda item: (item["region"], item["dm"], item["store"], item["cc"]))
    return directory, by_cc


def csv_records(path: Path, *, has_product: bool) -> tuple[list[dict[str, object]], dict[str, object]]:
    """Lee una descarga BI sin depender del preámbulo, total de filas o columna de medida.

    El cubo agrega texto antes de la tabla y deja columnas de encabezado vacías antes
    del valor. La posición de la medida se infiere después de ``Indicadores`` y se
    valida contra todas las filas de datos para evitar tomar Semana, Dia o CeCo como USD.
    """
    rows = list(csv.reader(io.StringIO(decode_csv(path))))
    header_index = next(
        (index for index, row in enumerate(rows) if {"tiendas", "mes", "semana", "dia"}.issubset({normalized_header(v) for v in row})),
        None,
    )
    if header_index is None:
        raise ValueError(f"{path.name}: no se encontró el encabezado del cubo")
    header = [normalized_header(value) for value in rows[header_index]]
    required = {"tiendas", "mes", "semana", "dia", "indicadores"} | ({"productos"} if has_product else set())
    missing = sorted(required - set(header))
    if missing:
        raise ValueError(f"{path.name}: faltan columnas {missing}")
    repeated = sorted(name for name in required if header.count(name) > 1)
    if repeated:
        raise ValueError(f"{path.name}: encabezados requeridos duplicados {repeated}")
    indices = {name: header.index(name) for name in required}

    indicator_column = indices["indicadores"]
    maximum_width = max((len(row) for row in rows[header_index:]), default=len(header))
    numeric_columns: dict[int, int] = {}
    for column in range(indicator_column + 1, maximum_width):
        numeric_columns[column] = sum(
            1 for row in rows[header_index + 1:]
            if len(row) > column and number(row[column]) is not None
        )
    populated_numeric_columns = [column for column, count in numeric_columns.items() if count]
    if len(populated_numeric_columns) != 1:
        readable = {column + 1: numeric_columns[column] for column in populated_numeric_columns}
        raise ValueError(
            f"{path.name}: no fue posible identificar una única columna de valor después de "
            f"Indicadores; candidatas={readable}"
        )
    value_column = populated_numeric_columns[0]

    output: list[dict[str, object]] = []
    seen_rows: set[tuple[str, ...]] = set()
    duplicates = 0
    blank_rows = 0
    ignored_summary_rows = 0
    invalid_rows: list[dict[str, object]] = []
    indicators: Counter[str] = Counter()
    row_widths: Counter[int] = Counter()
    for row_number, row in enumerate(rows[header_index + 1:], header_index + 2):
        if not any(clean(value) for value in row):
            blank_rows += 1
            continue
        row_widths[len(row)] += 1
        signature = tuple(clean(value) for value in row)
        if signature in seen_rows:
            duplicates += 1
            continue
        seen_rows.add(signature)
        padded = row + [""] * max(len(header), value_column + 1)
        cc = canonical_cc(padded[indices["tiendas"]])
        if not cc or not re.fullmatch(r"\d{4,8}", cc):
            ignored_summary_rows += 1
            continue
        numeric_value = number(padded[value_column])
        try:
            indicator = clean(padded[indicator_column])
            indicators[indicator] += 1
            if normalized_header(indicator) != "usd":
                raise ValueError(f"Indicador inesperado {indicator!r}")
            record = {
                "cc": cc,
                "month": clean(padded[indices["mes"]]).title(),
                "week": int(float(clean(padded[indices["semana"]]))),
                "date": parse_date(padded[indices["dia"]]),
                "product": clean(padded[indices["productos"]]) if has_product else "",
                "units": numeric_value,
            }
            if not record["cc"] or record["units"] is None or record["units"] < 0:
                raise ValueError("CC o unidades inválidas")
            output.append(record)
        except (ValueError, TypeError) as error:
            invalid_rows.append({"row": row_number, "error": str(error)})
    if invalid_rows:
        raise ValueError(f"{path.name}: filas inválidas {invalid_rows[:8]}")
    if duplicates:
        raise ValueError(f"{path.name}: contiene {duplicates} filas exactamente duplicadas")
    if not output:
        raise ValueError(f"{path.name}: no contiene filas de datos válidas")
    dates = [record["date"] for record in output]
    return output, {
        "sourceRows": len(rows) - header_index - 1,
        "validRows": len(output),
        "blankRowsIgnored": blank_rows,
        "summaryRowsIgnored": ignored_summary_rows,
        "exactDuplicates": duplicates,
        "headerRow": header_index + 1,
        "valueColumn": value_column + 1,
        "rowWidths": {str(width): count for width, count in sorted(row_widths.items())},
        "indicators": dict(indicators),
        "stores": len({record["cc"] for record in output}),
        "dateRange": [min(dates).isoformat(), max(dates).isoformat()],
        "encoding": "UTF-16" if "\x00" in path.read_bytes()[:100].decode("latin1") else "UTF-8",
    }


def build_from_sources(
    operational_source: Path,
    merch_source: Path,
    directory_source: Path,
) -> tuple[dict[str, object], dict[str, object]]:
    """Construye el tablero sin asumir cantidad de filas ni un corte compartido."""
    for source in (operational_source, merch_source, directory_source):
        if not source.is_file():
            raise FileNotFoundError(f"Falta el motor requerido: {source.relative_to(ROOT)}")
    directory, directory_by_cc = read_directory(directory_source)
    operational, operational_profile = csv_records(operational_source, has_product=True)
    merch, merch_profile = csv_records(merch_source, has_product=False)

    unknown_products = Counter()
    variants: dict[str, set[str]] = {group: set() for group in GROUPS}
    operational_daily: defaultdict[tuple[str, str, int, str], list[float]] = defaultdict(
        lambda: [0.0] * len(GROUPS)
    )
    source_operational_total = 0.0
    grouped_operational_total = 0.0
    date_month_mismatches = 0
    csv_cc = set()
    for record in operational:
        cc = str(record["cc"])
        csv_cc.add(cc)
        group = product_group(str(record["product"]))
        units = float(record["units"])
        source_operational_total += units
        if group is None:
            unknown_products[str(record["product"])] += 1
            continue
        variants[group].add(str(record["product"]))
        group_index = GROUPS.index(group)
        key = (record["date"].isoformat(), str(record["month"]), int(record["week"]), cc)
        operational_daily[key][group_index] += units
        grouped_operational_total += units
        if MONTH_ORDER.get(str(record["month"])) != record["date"].month:
            date_month_mismatches += 1

    merch_daily: defaultdict[tuple[str, str, int, str], float] = defaultdict(float)
    merch_total = 0.0
    for record in merch:
        cc = str(record["cc"])
        csv_cc.add(cc)
        key = (record["date"].isoformat(), str(record["month"]), int(record["week"]), cc)
        merch_daily[key] += float(record["units"])
        merch_total += float(record["units"])

    missing_directory = sorted(csv_cc - set(directory_by_cc))
    if missing_directory:
        raise ValueError(f"CC sin cruce en Directorio.xlsx: {missing_directory}")
    if unknown_products:
        raise ValueError(f"Productos sin homologación: {dict(unknown_products)}")
    if abs(source_operational_total - grouped_operational_total) > 0.001:
        raise ValueError("La suma homologada no reconcilia contra el CSV operativo")

    operational_dates = sorted({key[0] for key in operational_daily})
    merch_dates = sorted({key[0] for key in merch_daily})
    all_dates = sorted(set(operational_dates) | set(merch_dates))
    if not all_dates:
        raise ValueError("Los CSV no contienen fechas utilizables")
    months = sorted({key[1] for key in operational_daily} | {key[1] for key in merch_daily}, key=lambda value: MONTH_ORDER.get(value, 99))
    weeks = sorted({key[2] for key in operational_daily} | {key[2] for key in merch_daily})

    daily_rows = [
        [date_value, month, week, cc, *[round(value, 3) for value in values]]
        for (date_value, month, week, cc), values in sorted(operational_daily.items())
    ]
    merch_rows = [
        [date_value, month, week, cc, round(units, 3)]
        for (date_value, month, week, cc), units in sorted(merch_daily.items())
    ]
    latest_date = max(all_dates)
    payload: dict[str, object] = {
        "version": VERSION,
        "meta": {
            "latestDate": latest_date,
            "latestOperationalDate": max(operational_dates),
            "latestMerchDate": max(merch_dates),
            "minDate": min(all_dates),
            "months": months,
            "weeks": weeks,
            "groups": list(GROUPS),
            "weekPeriods": {
                "operativo": week_periods(operational),
                "merch": week_periods(merch),
            },
            "metricDefinition": "USD = promedio diario de unidades totales por tienda en la selección",
            "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        },
        "directory": directory,
        "dailyColumns": ["date", "month", "week", "cc", "cakePop", "cookies", "dona", "miniPanMuerto"],
        "daily": daily_rows,
        "merchColumns": ["date", "month", "week", "cc", "units"],
        "merch": merch_rows,
        "catalog": {
            "groups": {group: sorted(values) for group, values in variants.items()},
            "notes": {"Dona G&G": "No aplica Dona en Combo"},
        },
    }
    audit: dict[str, object] = {
        "status": "ok",
        "version": VERSION,
        "sources": {
            operational_source.name: {**operational_profile, "sha256": file_hash(operational_source)},
            merch_source.name: {**merch_profile, "sha256": file_hash(merch_source)},
            directory_source.name: {
                "records": len(directory),
                "regions": len({item["region"] for item in directory}),
                "districts": len({item["dm"] for item in directory}),
                "storeTypes": sorted({item["storeType"] for item in directory}),
                "benchmarkColumn": any(item["benchmark"] for item in directory),
                "sha256": file_hash(directory_source),
            },
        },
        "checks": {
            "directoryStores": len(directory),
            "csvStores": len(csv_cc),
            "missingDirectory": missing_directory,
            "directoryWithoutSales": sorted(set(directory_by_cc) - csv_cc),
            "unknownProducts": dict(unknown_products),
            "sourceOperationalUnits": round(source_operational_total, 3),
            "groupedOperationalUnits": round(grouped_operational_total, 3),
            "merchUnits": round(merch_total, 3),
            "dailyRows": len(daily_rows),
            "merchDailyRows": len(merch_rows),
            "businessMonthCalendarMismatches": date_month_mismatches,
            "dateRange": [min(all_dates), max(all_dates)],
        },
        "catalog": {group: sorted(values) for group, values in variants.items()},
    }
    return payload, audit


def build() -> tuple[dict[str, object], dict[str, object]]:
    return build_from_sources(OPERATIONAL_SOURCE, MERCH_SOURCE, DIRECTORY_SOURCE)


def preserve_generated_at(payload: dict[str, object]) -> None:
    """Evita commits y despliegues vacíos cuando los tres motores no cambiaron."""
    if not OUTPUT.is_file():
        return
    try:
        existing = json.loads(OUTPUT.read_text(encoding="utf-8"))
        previous_generated_at = existing.get("meta", {}).get("generatedAt")
        candidate = {**payload, "meta": {**payload["meta"], "generatedAt": previous_generated_at}}
        if candidate == existing:
            payload["meta"]["generatedAt"] = previous_generated_at
    except (json.JSONDecodeError, OSError, TypeError):
        return


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Genera, valida y muestra un resumen")
    args = parser.parse_args()
    payload, audit = build()
    preserve_generated_at(payload)
    atomic_json(OUTPUT, payload)
    atomic_json(AUDIT_OUTPUT, audit, pretty=True)
    summary = {
        "status": audit["status"],
        "latestDate": payload["meta"]["latestDate"],
        "stores": audit["checks"]["directoryStores"],
        "operationalUnits": audit["checks"]["groupedOperationalUnits"],
        "merchUnits": audit["checks"]["merchUnits"],
        "dailyRows": audit["checks"]["dailyRows"],
        "merchDailyRows": audit["checks"]["merchDailyRows"],
    }
    print(json.dumps(summary, ensure_ascii=False))
    if args.check and audit["status"] != "ok":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
