#!/usr/bin/env python3
"""Pruebas de regresión para CSV variables y Directorio extensible."""

from __future__ import annotations

import tempfile
import unittest
import zipfile
from pathlib import Path

from build_data import csv_records, read_directory


def make_directory(path: Path) -> None:
    rows = [
        ["CC", "Tienda", "Región", "DM", "Tipo Tienda", "Lo que funciona"],
        ["38115", "Zona Azul", "Centro Norte", "Vanessa Carreño Rios", "Cafe", "Daily plan visible"],
        ["49999", "Nueva Tienda", "Centro Sur", "DM Nueva Región", "Drive Thru", "Venta sugerida"],
    ]
    sheet_rows = []
    for number, row in enumerate(rows, 1):
        cells = "".join(
            f'<c r="{chr(65 + column)}{number}" t="inlineStr"><is><t>{value}</t></is></c>'
            for column, value in enumerate(row)
        )
        sheet_rows.append(f'<row r="{number}">{cells}</row>')
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("xl/workbook.xml", '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Directorio" sheetId="1" r:id="rId1"/></sheets></workbook>')
        archive.writestr("xl/_rels/workbook.xml.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/></Relationships>')
        archive.writestr("xl/worksheets/sheet1.xml", f'<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>{"".join(sheet_rows)}</sheetData></worksheet>')


class EngineTests(unittest.TestCase):
    def test_directory_accepts_new_regions_rows_and_benchmark(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "Directorio.xlsx"
            make_directory(path)
            directory, by_cc = read_directory(path)
        self.assertEqual(len(directory), 2)
        self.assertEqual(by_cc["49999"]["region"], "Centro Sur")
        self.assertEqual(by_cc["38115"]["benchmark"], "Daily plan visible")
        self.assertEqual(by_cc["49999"]["storeType"], "Drive Thru")

    def test_operational_csv_accepts_preamble_and_variable_width(self) -> None:
        content = "Reporte BI\nTiendas,Mes,Semana,Dia,Productos,Indicadores,,\n38115,Ago,32,8/5/2026,Cake Pop Choco,USD,,12\n38115,Ago,32,8/6/2026,Galleta,USD,,9,\n"
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "operativo.csv"
            path.write_text(content, encoding="utf-8")
            records, profile = csv_records(path, has_product=True)
        self.assertEqual(len(records), 2)
        self.assertEqual(profile["valueColumn"], 8)
        self.assertEqual(set(profile["rowWidths"]), {"8", "9"})

    def test_merch_csv_accepts_utf16_and_changed_row_count(self) -> None:
        content = "Cubo Merch\nTiendas,Mes,Semana,Dia,Indicadores,\n38115,Ago,32,8/5/2026,USD,4\n38117,Ago,32,8/5/2026,USD,7\n38119,Ago,32,8/6/2026,USD,2\n"
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "merch.csv"
            path.write_text(content, encoding="utf-16")
            records, profile = csv_records(path, has_product=False)
        self.assertEqual(len(records), 3)
        self.assertEqual(profile["stores"], 3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
