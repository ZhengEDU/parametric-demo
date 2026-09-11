# Document Analysis

This document records the programmatic OOXML/DOCX inspection of every Word
file supplied as architectural ground truth, per Section 1 of the product
brief. It is a living document — more samples can be dropped into
`samples/word-documents/` and re-analyzed at any time; nothing here is
hand-waved from memory.

Inspection method: `python-docx` (paragraphs, runs, tables, cell text,
fonts/sizes/bold, shading) plus direct `zipfile` inspection of the OOXML
parts (`word/document.xml`, `word/header1.xml`, `word/footer1.xml`,
`docProps/core.xml`, `docProps/app.xml`, embedded media) for structural
details python-docx doesn't expose directly (gridSpan/vMerge counts,
content controls, bookmarks, comments, section properties).

**Real sample files are never committed to this repository.** They contain
real customer names, contacts, addresses and phone numbers and are
`.gitignore`d (`samples/word-documents/*.docx`). Only this analysis, and
the sanitized/fictional automation-ready template copies under
`server/templates/`, are committed.

---

## Sample 1 — `20260817.003.docx` ("Certificate of Calibration")

### Identity / provenance
- **Document family:** `CALIBRATION_CERTIFICATE`
- **Title (docProps/core.xml `dc:title`):** "CALIBRATION REPORT"
- **Creator:** a Parametric employee name (real; redacted here) — `dc:creator`
- **Last modified by:** a different Parametric employee name (real;
  redacted here) — indicates the certificate is drafted by one person and
  finalized/reviewed by another, matching the described two-person
  workflow (data entry → manager check).
- **Created:** 2025-03-17 (template first authored); **Last modified:**
  2026-08-19 (this specific instance, for this specific job).
- **Revision counter:** 34 (`cp:revision`) — consistent with a Word
  document that is copied from a master and hand-edited for each job
  (Word increments this on every save), not a database-backed system.
- **Page count:** 1 (`docProps/app.xml`). Word count: 503.

### Page layout
- Letter, portrait: `w:pgSz w:w="12240" w:h="15840"`.
- Margins: top 1440 twips (1"), right 1440 (1"), bottom 720 (0.5"),
  left 1440 (1"), header 720 (0.5"), footer 1008 (0.7").
- Single section (`w:sectPr`), one header reference, one footer reference.
- No explicit page breaks (`w:br w:type="page"` count = 0) — consistent
  with the 1-page result.

### Header / footer / logo
- Header (`word/header1.xml`) contains one anchored image
  (`word/media/image1.png`, 411×119 px, RGBA PNG) — the Parametric Inc.
  logo (stacked "P" mark + wordmark). No header text.
- Footer (`word/footer1.xml`) contains only a page-number field:
  `Page {PAGE} of {NUMPAGES}` → rendered text runs `["Page ", "1", " of ", "1"]`.
- Company contact line appears as a **body paragraph at the bottom of the
  page**, not in the true Word footer: *"Parametric Inc, 4065 E La Palma
  Ave, Suite C, Anaheim, CA 92807. P: 714.694.6500, F: 714.694.6501"*
  (3 runs). This is Parametric's real registered office and is treated as
  **static boilerplate**, safe to reuse verbatim in the demo (it is the
  company's own address, not a customer's).

### Fonts / styles
- Document default font: Times New Roman (`w:docDefaults/w:rPrDefault`).
- Title "CERTIFICATE OF CALIBRATION": bold, 18pt (`sz` 228600 EMU ÷ 12700 = 18pt), centered, own paragraph.
- Field labels in the metadata grid (e.g. "Certificate Number"): bold, 10pt.
- Calibration-table column headers (e.g. "Target Value"): bold, 9pt, with
  light-gray cell shading (`w:shd w:fill="E6E6E6"`) — 15 shaded cells
  total (the header row + the "Mass" group-label row, see below).
- No content controls (`w:sdt` count = 0), no comments
  (`w:commentReference` count = 0). One auto-generated `_GoBack` bookmark
  (Word's own autosave artifact, not meaningful). **Confirms Section 8's
  premise: this file has no merge fields, bookmarks, or automation
  placeholders — an automation-ready copy must add its own tagging.**

### Body structure (top to bottom)

1. **Title** — "CERTIFICATE OF CALIBRATION" (own paragraph, centered, bold 18pt).
2. **Metadata grid — Table 1 of 4, 9 rows × 4 columns**, label/value pairs
   in a 2×2-per-row grid (label | value | label | value):

   | Row | Col A (label) | Col B (value) | Col C (label) | Col D (value) |
   |---|---|---|---|---|
   | 0 | Certificate Number | *(cert #)* | Asset Number | *(asset #)* |
   | 1 | Customer | *(customer name)* | Description | *(asset description)* |
   | 2 | Address | *(address line 1)* | Manufacturer | *(manufacturer)* |
   | 3 | *(blank)* | *(address line 2)* | Model | *(model)* |
   | 4 | *(blank)* | *(city, state zip)* | Serial Number | *(serial #)* |
   | 5 | Contact Person | *(contact name)* | Accuracy | *(accuracy spec)* |
   | 6 | Phone | *(phone)* | Range | *(range spec)* |
   | 7 | Date Calibrated | *(date, "17Aug2026" format)* | Procedure | *(procedure name)* |
   | 8 | Next Due Date | *(month/year, "Aug2027" format)* | Cal Interval | *(interval, "12 Months")* |

   No `gridSpan`/`vMerge` in this table — the multi-line address is just
   two rows with an empty label cell, not a merged cell. One cell
   (`Certificate Number` value) is split across 3 runs (`"20260817"`,
   `"."`, `"003"`) purely from Word's autoformatting — not semantically
   meaningful, but it means a naive whole-paragraph find/replace would
   miss or corrupt it; **tagging must operate per-cell (first-run-wins,
   clear remaining runs), not via blind string search/replace.**

3. **Environmental Conditions block — NOT a table.** Rendered as
   tab-aligned body paragraphs (3 paragraphs: header row, Temperature row,
   Humidity row), each with many short whitespace/tab runs from manual
   Word tab-stop alignment. Columns (by position): *Parameter |
   Reading | Condition As Found | Condition As Left | Status |
   Calibration Location*. In this instance, Humidity has only a reading
   (`58.2 %RH`) with the remaining columns blank — As-Found/As-Left/Status
   tracking was only filled in for Temperature (`21.7 °C`, "In Tolerance"
   / "In Tolerance" / "Pass" / "Field Calibration"). **This proves
   environmental-condition tracking is per-parameter and optional per
   column — the data model must not require every column for every row.**
   This section is present regardless of what asset is being calibrated —
   it is ambient-condition context for the calibration event itself, not
   part of the asset-specific measurement table below.

4. **"Standards Utilized" — Table 2 of 4, 2 rows × 5 columns**: header row
   (ID Number, Manufacturer, Model Number, Description, Cal Due) + exactly
   one data row in this sample. Structurally a repeating table (one row
   per reference standard used); this instance only used one standard.

5. **"Calibration Data" — Table 3 of 4, 8 rows × 10 columns.** This is the
   asset-specific measurement table and it is **structurally identical to
   the "Weight Set" 10-column layout described in the product brief**
   (Target Value, Units, Standard, As Found, Deviation, Standard, As Left,
   Deviation, Cal Tolerance, Adjustment Made — **no Uncertainty column**),
   even though the asset being calibrated in this instance is described as
   a "Blood Collection Monitor" (a mass/weight-reading device, calibrated
   against a certified weight set) rather than a literal weight-set
   product. The table has a real, load-bearing use of `gridSpan`:
   - Row 0: column headers, bold 9pt, gray-shaded.
   - **Row 1 is a group-label row**, not a data row: 4 physical cells
     (confirmed against the document-wide `gridSpan` element count of 4 —
     python-docx's `row.cells` accessor repeats a spanned cell once per
     grid column it covers, so raw per-cell iteration over-counts spans;
     cross-checking against the true XML element count was necessary to
     get this right): `gridSpan=2` cell reading "Mass" (covers Target
     Value + Units), `gridSpan=3` (blank, covers the As-Found trio),
     `gridSpan=3` (blank, covers the As-Left trio), `gridSpan=2` (blank,
     covers Cal Tolerance + Adjustment Made). **This is precisely a
     `MeasurementSection`/`MeasurementGroup` name row** — the same pattern
     the brief describes for the Weathering Tester's "Temperature" /
     "Irradiance" section headers — proving the grouped-table concept is
     already latent in the real document format, not an invented
     abstraction.
   - Rows 2–7: six data points (target values 0/200/400/600/800/1000
     grams), each a plain (non-merged) row of 10 cells.
   - **Precision finding:** target values are stored as bare integers
     ("0", "200" … "1000") while standard/found/left readings use 2
     decimal places ("0.00", "200.00" …) and deviations show explicit
     sign for non-zero values ("+2.00"). Tolerance values scale with
     target value magnitude (±2.00 up to ±10.00) — **tolerance is
     per-point, not a single certificate-wide constant.**
   - One cell (`±2.00`) is split across 2 runs, another (`±4.00`) across
     4 runs, another (`±6.00`) across 2, `±8.00` across 4, `±10.00` across
     2 — all purely from Word autoformatting of the ± glyph plus decimal
     entry. Same per-cell, first-run-wins tagging implication as above.
   - "Adjustment Made" is "Yes" for every row in this instance (every
     point was adjusted) — this document does not happen to demonstrate a
     mixed adjusted/not-adjusted table, but the column clearly supports
     per-point Yes/No.

6. **Comments — Table 4 of 4, 1×1.** Two paragraphs inside the single
   cell: static label "Comments: " then the free-text comment ("Unit
   found within tolerance, adjusted closer to within specifications.").

7. **Decision-rule / traceability boilerplate** — one long static
   paragraph citing ILAC G8 simple acceptance, ISO/IEC 17025, ANSI/NCSL
   Z540-1-1994, and a coverage-factor statement (k=2, ~95% confidence).
   **This is Parametric's real, existing compliance language.** It is
   reused verbatim as static text in the automation-ready copies (never
   edited or regenerated by the demo), but the demo app itself makes no
   compliance claims of its own — see `docs/QUALITY_LIMITATIONS.md`.

8. **Signature block** — "Calibration performed by: __________ Calibration
   reviewed by: __________" then, on the next line, **"<Customer Name>
   reviewed by: __________ Date: __________"**. Note the customer's name
   is baked directly into the static label text of the third signature
   line, not just into the data grid above — i.e. **this specific file is
   already a customer-specific copy of a more generic master**, not the
   generic master itself. The automation-ready copy tags this label too
   (`{customer_name} reviewed by:`).

9. **Company address line** (see Header/footer above).

### Fields identified as automatable (→ `WordFieldMapping.fieldKey`)
`certificate.number`, `asset.number`, `customer.name`,
`customer.addressLine1`, `customer.addressLine2`, `customer.cityStateZip`,
`asset.description`, `asset.manufacturer`, `asset.model`,
`asset.serialNumber`, `customer.contact`, `asset.accuracy`, `asset.range`,
`customer.phone`, `calibration.date`, `procedure.name`,
`calibration.nextDue`, `calibration.interval`, `environment.temperature`,
`environment.temperatureAsFoundStatus`, `environment.temperatureAsLeftStatus`,
`environment.temperatureStatus`, `calibration.location`,
`environment.humidity`, standards table (repeating),
calibration data table (repeating group → repeating point), `comments`.

### What differs from the brief's assumed structures
- No file provided so far uses `vMerge` (vertical cell merge) — only
  horizontal `gridSpan`, and only in one row of one table. Don't assume
  vertical merges exist until a sample shows one.
- The Environmental Conditions section is **paragraph/tab-based**, not a
  Word table — the renderer for that section must operate on
  tab-delimited runs, not `python-docx`/table cell APIs.
- "Standards Utilized" and "Calibration Data" are **separate physical
  tables**, not sections of one big table.
- The calibration table's group-label row (`gridSpan`) is easy to miss
  with naive row/column counting — confirmed only by cross-checking the
  document-wide `<w:gridSpan>` element count against per-cell dumps.

### Not yet observed (because only one sample has been supplied)
Vertical merges, multi-page certificates, uncertainty columns, multiple
measurement sections/channels in one table, checklist-style content, and
digital signatures/images-as-signatures have **not** been seen in a real
file yet. Demo Types A, C, and D (Temp/RH with Uncertainty, Weathering
Tester's grouped channels, and the Preventative Maintenance checklist) are
therefore built as **clearly-labeled representative/fictional templates**
that reuse this real file's shell (logo, header/footer, fonts, legal
boilerplate, signature block layout) but invent the body table/checklist
structure from the brief's written description rather than from a scanned
file. See `docs/ASSUMPTIONS.md`. If real samples for those families are
provided later, this document and the corresponding templates should be
regenerated from them.

---

## Samples 2–7 — six more real certificates supplied

Six more real `.docx` files were dropped into `samples/word-documents/`:
`20260805.004`, `20260806.009`, `20260806.010`, `20260813.011`,
`20260819.004`, `20260819.006`. Inspected with the same `python-docx`
method. Full per-cell dumps are not reproduced here (see the extraction
script used, or re-run inspection) — this section records what each
one confirms or changes versus Sample 1's analysis above.

### `20260805.004` — Class F Weight Set (Troemner, ImmunityBio)
Same shell as Sample 1. Calibration Data table: **10 columns, no
Uncertainty**, 21 data points across the mg/g/kg range, plus the same
`gridSpan=2` "Mass" group-label row pattern. **Confirms Demo Type B's
10-column shape is correct** and extends the evidence beyond a single
6-row table to a 21-row one — same column semantics hold at scale.

### `20260813.011` — Digital Stopwatch (single-point Time procedure)
Same 10-column shape, but only **one data row** (`86,400 Sec/Day`).
Confirms the table shape is not size- or unit-specific — works
identically for a single-point time-drift check as for a 21-point mass
sweep. `Target Value` group label here is "Time" instead of "Mass".

### `20260806.009` / `20260806.010` — Laboratory Refrigerators (Temp)
**First real evidence for Demo Type A.** Calibration Data table is
**11 columns**: `Target Value | Units | Standard Reading | As Found |
Deviation | Standard Reading | As Left | Deviation | Uncertainty | Cal
Tolerance | Adjustment Made` — Uncertainty inserted right before Cal
Tolerance, exactly where the brief's Type A description and the
existing `temp-rh-meter` template already put it. Column order and
labels match the demo template with no changes needed.

Formatting detail the demo data got wrong: **Uncertainty has no ± sign**
(`0.0072`), only **Cal Tolerance** does (`±1.000`). Fixed in
`server/prisma/seed.ts` and `server/src/services/sampleTemplateData.ts`
(both previously prefixed Uncertainty with `±`).

`20260806.009` also shows `Adjustment Made = Yes` on a point whose
As-Found deviation (`-0.727`) was already within tolerance (`±1.000`) —
i.e. adjustment and out-of-tolerance are independent facts, which
`DEMO-DECISION-1` already modeled as such (see `docs/ASSUMPTIONS.md`).

### `20260819.004` / `20260819.006` — CO2 Incubators
**New structural pattern, not previously seen:** the Calibration Data
table has **two top-level row groups, "Local" and "Rees Probe"**
(the built-in sensor vs. an external Rees-brand reference probe), and
**each of those contains three parameter subgroups — Temperature,
Humidity, CO2** — each with its own single-point row, 11 columns
(Uncertainty included; `N/A` for the CO2 row since ANSI/NCSL
Z540-1-1994 doesn't define one). This is a real, two-level instance of
exactly the nested-group concept the schema already supports via
`MeasurementGroup.parentGroupId` (previously only hypothesized for the
Weathering Tester's Temperature/Irradiance channels). **Not yet built
as its own procedure/asset type** — Demo Type C (Weathering Tester)
remains demo-authored and untouched; this is logged as ground truth in
case a CO2-Incubator-shaped procedure is wanted later.

`20260819.006`'s Table 2 additionally has a duplicated/malformed
`Target Value` header column (13 raw grid columns instead of 11,
Word-autoformatting artifact) — a reminder that per-cell inspection,
not fixed column-index assumptions, is required when parsing real
files.

### What still has no real sample
Demo Type D (Preventative Maintenance checklist) and Demo Type C
(Weathering Tester, as literally described in the brief — grouped
Temperature/Irradiance channels on a weathering chamber) remain
demo-authored, not real-derived.

---

## Samples 8–31 — 24 more real certificates (31 total)

Supplied 2026-09-11: 13 more instrument families across 4 more customers
(Cal-Western Manufacturers, AstraZeneca, Bachem Americas, Element
Materials Technology), dated 2026-06-02 through 2026-09-08. Full findings
are in `docs/ASSUMPTIONS.md` ("Second batch — 24 more real
certificates") rather than duplicated here, since most of what this batch
confirmed or changed is about generation rules (certificate numbering,
column labels, template revisions) rather than new document structure.
Two fixes applied from it: the 11-column table's Standard-column header
is "Standard Reading" not "Standard" (`tools/build_temp_rh_template.py`),
and the "Certificate #3865.01" trailing text on the Issue Date line is
confirmed constant, not a per-job number, and now reproduced verbatim.
