#!/usr/bin/env python3
"""
One-time generator: turns the real, sanitized-in-place sample
(samples/word-documents/20260817.003.docx) into an "automation-ready"
DOCX template for the Weight Set / mass-calibration procedure.

What this does (Section 8/9 of the product brief):
  - Replaces every real customer/asset value with a docxtemplater
    `{tag}` placeholder, operating per-run (first-run-wins, other runs in
    the same cell/paragraph cleared) so Word's mid-word run splitting
    can't corrupt a naive find/replace.
  - Wraps the "Standards Utilized" data row and the calibration-data
    group/point rows in `{#loop}...{/loop}` blocks so any number of
    standards/points can be rendered later.
  - Strips personally-identifying docProps (creator/lastModifiedBy).
  - Never modifies the source sample in place — writes a new file.

Run: python3 tools/build_weight_set_template.py
Output: server/templates/weight-set/source.docx
"""
import shutil
import zipfile
from pathlib import Path

import docx

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "samples" / "word-documents" / "20260817.003.docx"
OUT_DIR = ROOT / "server" / "templates" / "weight-set"
OUT = OUT_DIR / "source.docx"


def tag_cell(cell, tag_text, paragraph_index=0):
    p = cell.paragraphs[paragraph_index]
    if not p.runs:
        p.add_run(tag_text)
        return
    p.runs[0].text = tag_text
    for r in p.runs[1:]:
        r.text = ""


def set_run(paragraph, run_index, text):
    paragraph.runs[run_index].text = text


def main():
    if not SRC.exists():
        raise SystemExit(f"Source sample not found: {SRC}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    d = docx.Document(str(SRC))

    # --- Title stays static ---
    # d.paragraphs[4] == "CERTIFICATE OF CALIBRATION"

    # --- Environmental Conditions (tab-aligned paragraphs, not a table) ---
    p_temp = d.paragraphs[8]
    set_run(p_temp, 4, "{env_temperature_value}")
    set_run(p_temp, 10, "{env_temperature_as_found_status}")
    set_run(p_temp, 11, "")
    set_run(p_temp, 14, "{env_temperature_as_left_status}")
    set_run(p_temp, 21, "{env_temperature_status}")
    set_run(p_temp, 26, "{calibration_location}")
    set_run(p_temp, 27, "")

    p_hum = d.paragraphs[9]
    set_run(p_hum, 4, "{env_humidity_value}")
    set_run(p_hum, 5, "")

    # --- Signature block: customer name baked into static label ---
    p_sig = d.paragraphs[18]
    set_run(p_sig, 0, "{customer_name}")

    # --- Table 0: metadata grid (9x4) ---
    t0 = d.tables[0]
    tag_cell(t0.rows[0].cells[1], "{certificate_number}")
    tag_cell(t0.rows[0].cells[3], "{asset_number}")
    tag_cell(t0.rows[1].cells[1], "{customer_name}")
    tag_cell(t0.rows[1].cells[3], "{asset_description}")
    tag_cell(t0.rows[2].cells[1], "{customer_address_line1}")
    tag_cell(t0.rows[2].cells[3], "{asset_manufacturer}")
    tag_cell(t0.rows[3].cells[1], "{customer_address_line2}")
    tag_cell(t0.rows[3].cells[3], "{asset_model}")
    tag_cell(t0.rows[4].cells[1], "{customer_city_state_zip}")
    tag_cell(t0.rows[4].cells[3], "{asset_serial_number}")
    tag_cell(t0.rows[5].cells[1], "{customer_contact}")
    tag_cell(t0.rows[5].cells[3], "{asset_accuracy}")
    tag_cell(t0.rows[6].cells[1], "{customer_phone}")
    tag_cell(t0.rows[6].cells[3], "{asset_range}")
    tag_cell(t0.rows[7].cells[1], "{calibration_date}")
    tag_cell(t0.rows[7].cells[3], "{procedure_name}")
    tag_cell(t0.rows[8].cells[1], "{calibration_next_due}")
    tag_cell(t0.rows[8].cells[3], "{calibration_interval}")

    # --- Table 1: Standards Utilized (2x5) -> loop over row 1 ---
    t1 = d.tables[1]
    tag_cell(t1.rows[1].cells[0], "{#standards}{standard_id_number}")
    tag_cell(t1.rows[1].cells[1], "{standard_manufacturer}")
    tag_cell(t1.rows[1].cells[2], "{standard_model_number}")
    tag_cell(t1.rows[1].cells[3], "{standard_description}")
    tag_cell(t1.rows[1].cells[4], "{standard_cal_due}{/standards}")

    # --- Table 2: Calibration Data (8x10) ---
    # Row 0 = static headers. Row 1 = group-label row (gridSpan), opens the
    # {#groups} loop. Row 2 = the single templated point row, opens+closes
    # {#points} and closes {#groups}. Rows 3-7 are the redundant hardcoded
    # extra data points from the original 6-row sample table — remove them,
    # the {#points} loop will regenerate as many rows as the data provides.
    t2 = d.tables[2]
    tag_cell(t2.rows[1].cells[0], "{#groups}{group_name}")

    r2 = t2.rows[2]
    tag_cell(r2.cells[0], "{#points}{point_target_value}")
    tag_cell(r2.cells[1], "{point_unit}")
    tag_cell(r2.cells[2], "{point_standard_as_found}")
    tag_cell(r2.cells[3], "{point_as_found}")
    tag_cell(r2.cells[4], "{point_deviation_as_found}")
    tag_cell(r2.cells[5], "{point_standard_as_left}")
    tag_cell(r2.cells[6], "{point_as_left}")
    tag_cell(r2.cells[7], "{point_deviation_as_left}")
    tag_cell(r2.cells[8], "{point_cal_tolerance}")
    tag_cell(r2.cells[9], "{point_adjustment_made}{/points}{/groups}")

    tbl_xml = t2._tbl
    rows_to_remove = [t2.rows[i]._tr for i in range(3, 8)]
    for tr in rows_to_remove:
        tbl_xml.remove(tr)

    # --- Table 3: Comments (1x1, 2 paragraphs) ---
    t3 = d.tables[3]
    tag_cell(t3.rows[0].cells[0], "{comments}", paragraph_index=1)

    d.save(str(OUT))

    # Strip personally-identifying document properties (author names) from
    # the saved copy — python-docx doesn't expose core.xml editing cleanly,
    # so patch the zip directly.
    _strip_core_props(OUT)

    print(f"Wrote {OUT}")


def _strip_core_props(path: Path):
    tmp = path.with_suffix(".tmp.docx")
    with zipfile.ZipFile(path, "r") as zin:
        names = zin.namelist()
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
            for name in names:
                data = zin.read(name)
                if name == "docProps/core.xml":
                    text = data.decode("utf-8")
                    text = text.replace(
                        "<dc:title>CALIBRATION REPORT</dc:title>",
                        "<dc:title>CALIBRATION CERTIFICATE - AUTOMATION-READY DEMO TEMPLATE</dc:title>",
                    )
                    import re

                    text = re.sub(r"<dc:creator>.*?</dc:creator>", "<dc:creator>Parametric Demo</dc:creator>", text)
                    text = re.sub(
                        r"<cp:lastModifiedBy>.*?</cp:lastModifiedBy>",
                        "<cp:lastModifiedBy>Parametric Demo</cp:lastModifiedBy>",
                        text,
                    )
                    data = text.encode("utf-8")
                zout.writestr(name, data)
    shutil.move(str(tmp), str(path))


if __name__ == "__main__":
    main()
