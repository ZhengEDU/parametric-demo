#!/usr/bin/env python3
"""
Builds the Preventative Maintenance Report automation-ready template
(Demo Type D). Fundamentally different from the calibration-certificate
templates: a checklist (Section > Item, with Pass/Fail/N/A + notes)
instead of a measurement table, per Section 4D of the brief.

Reuses the real sample's shell (logo, header/footer, fonts, metadata
grid, environmental conditions, signature block pattern) but swaps the
title, the calibration-specific decision-rule paragraph, and the two
data tables. Demo-authored — not scanned from a real file. See
docs/ASSUMPTIONS.md.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from docx_common import load_shell, move_after, remove, set_cell_text, style_table_borders, HEADER_SHADE, SECTION_SHADE, ROOT

OUT_DIR = ROOT / "server" / "templates" / "preventative-maintenance"
OUT = OUT_DIR / "source.docx"

COLS = ["Item", "Result", "Notes"]


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

    # Title
    d.paragraphs[4].runs[0].text = "PREVENTATIVE MAINTENANCE REPORT"

    # Environmental Conditions (kept — ambient conditions during service visit)
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

    # Metadata grid — same asset/customer fields, reused as-is. A few
    # static labels are relabeled to read correctly for a service report
    # rather than a calibration certificate (the underlying field keys are
    # unchanged so the same asset/customer data still populates them).
    set_cell_text(d.tables[0].rows[0].cells[0], "Report Number", bold=True, size=10)
    set_cell_text(d.tables[0].rows[7].cells[0], "Date of Service", bold=True, size=10)
    set_cell_text(d.tables[0].rows[8].cells[0], "Next Service Due", bold=True, size=10)
    set_cell_text(d.tables[0].rows[8].cells[2], "Service Interval", bold=True, size=10)

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

    # Remove "Standards Utilized" heading + table (not applicable to PM)
    standards_heading = d.paragraphs[10]
    old_standards_table = d.tables[1]
    anchor = standards_heading

    purpose_p = d.add_paragraph()
    purpose_p.add_run("Purpose of Visit:  ").bold = True
    purpose_p.add_run("{purpose_of_visit}")
    move_after(anchor, purpose_p)
    anchor = purpose_p

    service_p = d.add_paragraph()
    service_p.add_run("Service / Repair Requested:  ").bold = True
    service_p.add_run("{service_requested}")
    move_after(anchor, service_p)
    anchor = service_p

    checklist_heading = d.add_paragraph()
    checklist_heading.add_run("Service Checklist").bold = True
    move_after(anchor, checklist_heading)
    anchor = checklist_heading

    remove(standards_heading)
    remove(old_standards_table)

    # Replace "Calibration Data" heading + table with the checklist table
    cal_heading = d.paragraphs[12] if len(d.paragraphs) > 12 else None
    # After the removals above, paragraph indices shifted; find by text instead.
    cal_heading = next(p for p in d.paragraphs if p.text.strip() == "Calibration Data")
    old_cal_table = d.tables[1]  # standards table already removed, this is now index 1
    checklist_tbl = d.add_table(rows=3, cols=3)
    style_table_borders(checklist_tbl)
    move_after(anchor, checklist_tbl)
    remove(cal_heading)
    remove(old_cal_table)

    for ci, label in enumerate(COLS):
        set_cell_text(checklist_tbl.rows[0].cells[ci], label, bold=True, size=9, shade=HEADER_SHADE)

    r1 = checklist_tbl.rows[1]
    section_cell = r1.cells[0].merge(r1.cells[1]).merge(r1.cells[2]) if False else r1.cells[0]
    section_cell = r1.cells[0]
    for c in [r1.cells[1], r1.cells[2]]:
        section_cell = section_cell.merge(c)
    set_cell_text(section_cell, "{#sections}{section_name}", bold=True, size=10, shade=SECTION_SHADE)

    r2 = checklist_tbl.rows[2]
    set_cell_text(r2.cells[0], "{#items}{item_label}", size=9)
    set_cell_text(r2.cells[1], "{item_result}", size=9)
    set_cell_text(r2.cells[2], "{item_notes}{/items}{/sections}", size=9)

    # Decision-rule legal paragraph: calibration-tolerance language doesn't
    # fit a maintenance report — swap for a short PM-appropriate statement.
    legal_p = next(p for p in d.paragraphs if p.text.startswith("The results in this report relate only"))
    legal_p.runs[0].text = (
        "This report documents preventative maintenance services performed and "
        "observations recorded at the time of service. It does not constitute a "
        "calibration certificate. "
    )
    for r in legal_p.runs[1:]:
        r.text = ""

    # Signature block relabeling
    perf_p = next(p for p in d.paragraphs if p.text.startswith("Calibration performed by"))
    perf_p.runs[0].text = "Service performed by:"
    perf_p.runs[10].text = "Reviewed by"

    cust_p = next(p for p in d.paragraphs if "reviewed by:" in p.text and p.runs[0].text != "Service performed by:")
    cust_p.runs[0].text = "{customer_name}"
    cust_p.runs[1].text = " representative review:"

    t_comments = d.tables[-1]
    tag_cell(t_comments.rows[0].cells[0], "{comments}", paragraph_index=1)

    d.save(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
