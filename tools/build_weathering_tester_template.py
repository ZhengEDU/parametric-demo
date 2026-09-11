#!/usr/bin/env python3
"""
Builds the Weathering Tester automation-ready template (Demo Type C).

Reuses the real sample's shell like the other templates, but the
Calibration Data table needs a 3-level hierarchy (Section > Group > Point)
to represent "Temperature" (points directly) and "Irradiance" (4 channel
groups, each with its own point(s)) per Section 4C of the brief.
Demo-authored — not scanned from a real file. See docs/ASSUMPTIONS.md.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from docx_common import load_shell, move_after, remove, set_cell_text, style_table_borders, HEADER_SHADE, SECTION_SHADE, ROOT

OUT_DIR = ROOT / "server" / "templates" / "weathering-tester"
OUT = OUT_DIR / "source.docx"

COLS = ["Target Value", "Units", "Standard Reading", "As Found", "Deviation", "Tolerance", "Result"]


def tag_cell(cell, tag_text, paragraph_index=0):
    p = cell.paragraphs[paragraph_index]
    if not p.runs:
        p.add_run(tag_text)
        return
    p.runs[0].text = tag_text
    for r in p.runs[1:]:
        r.text = ""


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    d = load_shell()

    p_temp = d.paragraphs[8]
    p_temp.runs[4].text = "{env_temperature_value}"
    p_temp.runs[10].text = "{env_temperature_as_found_status}"
    p_temp.runs[11].text = ""
    p_temp.runs[14].text = "{env_temperature_as_left_status}"
    p_temp.runs[21].text = "{env_temperature_status}"
    p_temp.runs[26].text = "{calibration_location}"
    p_temp.runs[27].text = ""
    p_hum = d.paragraphs[9]
    p_hum.runs[4].text = "{env_humidity_value}"
    p_hum.runs[5].text = ""
    p_sig = d.paragraphs[18]
    p_sig.runs[0].text = "{customer_name}"

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

    t1 = d.tables[1]
    tag_cell(t1.rows[1].cells[0], "{#standards}{standard_id_number}")
    tag_cell(t1.rows[1].cells[1], "{standard_manufacturer}")
    tag_cell(t1.rows[1].cells[2], "{standard_model_number}")
    tag_cell(t1.rows[1].cells[3], "{standard_description}")
    tag_cell(t1.rows[1].cells[4], "{standard_cal_due}{/standards}")

    t3 = d.tables[3]
    tag_cell(t3.rows[0].cells[0], "{comments}", paragraph_index=1)

    old_cal_table = d.tables[2]
    anchor = old_cal_table
    new_tbl = d.add_table(rows=4, cols=7)
    style_table_borders(new_tbl)
    move_after(anchor, new_tbl)
    remove(old_cal_table)

    for ci, label in enumerate(COLS):
        set_cell_text(new_tbl.rows[0].cells[ci], label, bold=True, size=9, shade=HEADER_SHADE)

    # Row 1: SECTION label, full width
    r1 = new_tbl.rows[1]
    section_cell = r1.cells[0]
    for c in r1.cells[1:]:
        section_cell = section_cell.merge(c)
    set_cell_text(section_cell, "{#sections}{section_name}", bold=True, size=10, shade=SECTION_SHADE)

    # Row 2: GROUP label (e.g. "Channel 1"), spans first 2 cols; rest blank
    r2 = new_tbl.rows[2]
    group_cell = r2.cells[0].merge(r2.cells[1])
    _blank = r2.cells[2].merge(r2.cells[6])
    set_cell_text(group_cell, "{#groups}{group_name}", bold=True, size=9)

    # Row 3: templated POINT row
    r3 = new_tbl.rows[3]
    set_cell_text(r3.cells[0], "{#points}{point_target_value}", size=9)
    set_cell_text(r3.cells[1], "{point_unit}", size=9)
    set_cell_text(r3.cells[2], "{point_standard_as_found}", size=9)
    set_cell_text(r3.cells[3], "{point_as_found}", size=9)
    set_cell_text(r3.cells[4], "{point_deviation_as_found}", size=9)
    set_cell_text(r3.cells[5], "{point_cal_tolerance}", size=9)
    set_cell_text(r3.cells[6], "{point_result}{/points}{/groups}{/sections}", size=9)

    d.save(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
