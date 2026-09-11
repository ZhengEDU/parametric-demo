# Assumptions Log

Per the "work autonomously" instruction: every place a company-controlled
detail was unknown, a fictional/configurable value or a documented
engineering choice was used instead of stopping to ask. Logged here in the
order they came up.

## Source material
- **Seven real sample documents have now been supplied** (see
  `docs/DOCUMENT_ANALYSIS.md` for the full per-file inspection):
  `20260817.003` (Blood Collection Monitor, weight-set-shaped table),
  `20260805.004` (Class F Weight Set), `20260813.011` (Digital
  Stopwatch), `20260806.009` / `20260806.010` (Laboratory Refrigerators,
  Temp with Uncertainty column), and `20260819.004` / `20260819.006`
  (CO2 Incubators, nested Local/Rees-Probe × Temperature/Humidity/CO2
  groups).
- The Weight Set / stopwatch files confirm the **10-column table**
  (Target Value, Units, Standard, As Found, Deviation, Standard, As
  Left, Deviation, Cal Tolerance, Adjustment Made — no Uncertainty) used
  for **Demo Type B**.
- The refrigerator files confirm the **11-column table with an
  Uncertainty column** (same 10 columns plus `Uncertainty` inserted
  before `Cal Tolerance`) predicted for **Demo Type A (Temp/RH)** — this
  is no longer a guess, it matches a real file exactly, including column
  order. One real formatting detail this caught and fixed: Uncertainty
  is printed as a **plain magnitude with no ± sign** (e.g. `0.0072`,
  or `N/A` when not applicable), while Cal Tolerance always carries the
  ± sign (e.g. `±1.000`) — the seed data originally prefixed both with
  `±`; fixed in `server/prisma/seed.ts`.
- The existing "Lab Incubator" demo asset (`PBR-0344`) was originally a
  guessed 3-row Temp/RH-only dataset. It's been rebuilt from the CO2
  Incubator certs' real numeric shape: 6 groups (Local ×
  Temperature/Humidity/CO2, Rees Probe × Temperature/Humidity/CO2),
  using the `temp-rh-meter` renderer/template unchanged (11-column shape
  already matched). Verified by generating an actual `.docx` from the
  seeded data and diffing its table output against the real cert's
  printed values — deviations, unsigned Uncertainty, and `±`-signed
  Cal Tolerance all match exactly. This is a flattened representation
  of the real file's true 2-level nested grouping (Local/Rees Probe >
  parameter), not a pixel-identical layout — see "Deferred/simplified"
  below.
- The CO2 Incubator files show a **real instance of the nested-group
  pattern** (`MeasurementGroup.parentGroupId`) that was previously only
  hypothesized for the Weathering Tester: two top-level groups ("Local",
  "Rees Probe"), each containing Temperature/Humidity/CO2 subgroups.
  This validates the schema's nested-group design but is a *different*
  instrument family than the brief's Weathering Tester — **Demo Type C
  (Weathering Tester) is still demo-authored, not real-derived**; the
  CO2 Incubator pattern hasn't been built as its own procedure/asset
  type. If the user wants it added, the schema already supports it
  without migration.
- Demo Type D (Preventative Maintenance checklist) still has **no
  supplied real file** — remains demo-authored from the brief's written
  description.
- All real files' customer names, contacts, addresses and phone numbers
  are treated as sensitive: the raw files live in
  `samples/word-documents/` and are `.gitignore`d, never committed; only
  fictional data derived in their place is committed.

### Second batch — 24 more real certificates (31 total)
Supplied 2026-09-11, spanning 2026-06-02 through 2026-09-08, 8 customers,
~15 instrument families (pH Meter, Viscometer, Laboratory Refrigerator,
Portable Balance, Pallet Scale, Temperature Transmitter, Oxygen Gas
Monitor, CO2 Monitor, Digital Optical Tachometer, True RMS Multimeter,
Digital Test Gauge, Type T Thermocouple, Environmental Chamber, plus the
original Weight Set/Stopwatch/CO2-Incubator/Blood-Monitor families).
Findings, most to least confident:

- **Column header label is column-count-dependent, not free choice.**
  100% consistent across every sample: the 11-column table (Uncertainty
  present) always labels its Standard columns **"Standard Reading"**;
  the 10-column table (no Uncertainty) always uses plain **"Standard"**.
  Our `temp-rh-meter` template had "Standard" on the 11-column table —
  wrong. Fixed in `tools/build_temp_rh_template.py`.
- **The "Issue Date ... Certificate #3865.01" header line's trailing
  number is a constant, not a per-job value.** Confirmed byte-identical
  across all 12+ samples that have this header line, regardless of date
  (Jun through Sep) or customer (5 different companies). Not a ticket or
  work-order number as first guessed when only 4 samples existed —
  reproduced now as the same static literal text Parametric's real
  template prints. Fixed in `tools/build_temp_rh_template.py`.
- **Certificate Number sequence is NOT a simple global monotonic
  counter**, contrary to the assumption made with only 7 samples. Plotting
  all 31 `YYYYMMDD.NNN` values in date order shows the `NNN` is not
  strictly increasing across dates (e.g. `20260625.007` through `.014`,
  then `20260626.008`/`.009` — lower than `.014` despite being a later
  date). More likely scoped per work order or per customer than truly
  global. `server/src/services/documentGeneration.ts`
  (`nextCertificateNumber`) still uses a simple global
  documents-generated count — right format, uncertain scope. Left as-is;
  the format fix (this doc, "Document fidelity fixes") is high-confidence,
  the exact scope of `NNN` is not, and no incorrect certificate number
  is visibly implausible to someone reading one in isolation.
- **A newer real template revision exists that isn't reflected anywhere
  in this app.** The 6 most recent samples (2026-08-31 onward, Bachem
  Americas and Element Materials Technology) render "Environmental
  Conditions" as an actual 2-row Word **table** (Temperature/Humidity
  rows with Condition-As-Found/As-Left/Status/Location columns) instead
  of the tab-aligned paragraph block every earlier sample and this app's
  templates use. **Not implemented** — this is a real, dated template
  evolution at Parametric that the app has no equivalent code path for
  yet; flagging rather than guessing which format is "more current" for
  production use.
- **A single-document, multi-table calibration pattern exists.** The
  True RMS Multimeter sample (`20260831.011`) has **two** separate
  Calibration Data tables (26 rows + 39 rows — DCV/ACV/ACA/DCA/Ohms/
  Frequency, too many points/functions for one table) in one
  certificate. The schema's Section/Group model could represent this,
  but no template in this app currently supports more than one
  `{#groups}...{/groups}` loop per document. Not implemented — a rare
  pattern (1 of 31 samples) not worth the template-authoring risk right
  now; documented for if a similarly complex asset type comes up.
  Similarly, `20260831.023`/`.024` (Digital Test Gauge) show
  `Procedure: See Comments` instead of a `PAR-C-NNN` code — the app's
  `Procedure.name` field can already hold arbitrary text, no schema
  change needed if this pattern is wanted.
- The ILAC G8 boilerplate legal paragraph is **byte-identical across all
  31 samples** — strong confirmation it's truly static company text, as
  already assumed and reused verbatim.
- Every 11-column sample now confirms the **weight-set-shaped 10-column
  table generalizes correctly** to many more instrument families
  (pH Meter, Portable Balance, Pallet Scale, Oxygen/CO2 Monitor) beyond
  the original weight/mass reading — no structural surprises there.
- The existing "Environmental Test Chamber" demo asset (`CMT-0056`) was
  originally a guessed single-group 3-point dataset. Rebuilt from a real
  Environmental Chamber cert's numeric shape (`20260908.014`): renamed to
  match (manufacturer/model/accuracy/range from the real file), 2 groups
  (Temperature × 3 points, Humidity × 4 points) instead of 1 group of 3.
  Verified by generating an actual `.docx` and diffing its table output
  against the real cert's printed values — exact match, including the
  "Standard Reading" header fix above.

## Technology stack (none specified by the user)
- **Backend:** Node.js + TypeScript + Express + Prisma ORM.
- **Database:** PostgreSQL 16, run via Docker Compose
  (`docker-compose.yml`), UUID primary keys throughout.
- **Auth:** JWT in an httpOnly cookie, bcrypt password hashing. Seeded
  demo accounts only (Section 26) — no self-service signup.
- **DOCX generation:** automation-ready template copies (Section 8) with
  `{tag}` / `{#loop}...{/loop}` placeholders injected into existing runs,
  rendered with `docxtemplater` + `pizzip`. Chosen over building
  documents from scratch with `docx`/`python-docx` because it lets the
  original file's exact XML (fonts, shading, borders, header/footer,
  logo) pass through untouched — only text nodes are substituted. See
  `docs/WORD_TEMPLATE_ENGINE.md` for how this was validated.
- **Frontend:** React + TypeScript + Vite, plain CSS (no component
  library) for a dense, professional internal-tool look rather than a
  marketing aesthetic.
- **Testing:** Vitest for unit/integration tests.

## Document fidelity fixes (found by diffing generated output against real certs)
- **Certificate numbers didn't match Parametric's real scheme.** Every
  real certificate is numbered `{calibration date, YYYYMMDD}.{global
  sequence, 3+ digits}` (e.g. `20260806.009`, `20260806.010` same day;
  `20260817.003` another day) — confirmed identical across all 7 real
  samples. The app was generating an unrelated 8-character fragment of
  the record's UUID instead. Fixed in
  `server/src/services/documentGeneration.ts` (`nextCertificateNumber`)
  to follow the real scheme, using a count of documents generated so far
  as the sequence — good enough for this demo's single-actor generate
  flow, not a strictly concurrency-safe atomic counter.
- **The Temp/RH-family template was missing a header line.** All 4 real
  Temp/RH-shaped certs (`20260806.009`/`.010`, `20260819.004`/`.006`)
  open with an "Issue Date: {date} ... Certificate #{n}" line above the
  title; the Weight Set sample this shell was originally cloned from
  (before those 4 files existed) doesn't have it, so neither did our
  `temp-rh-meter` template. Added the "Issue Date" half (reusing the
  same `{calibration_date}` already in the metadata grid) in
  `tools/build_temp_rh_template.py`. Deliberately did **not** fabricate
  the second "Certificate #3865.01"-style number — it's identical across
  all 4 samples regardless of calibration date, so it's evidently some
  other identifier (plausibly a work-order/job-ticket number) whose
  generation rule isn't established by the samples on hand. The
  Weight-Set/Digital-Stopwatch template correctly still has no such line
  (matches its own 3 real samples, none of which have one).
- Also fixed two correctness bugs surfaced while investigating this: the
  UI's "Row" column could silently disagree with an edited Target Value
  (`web/src/components/RecordView.tsx`), and the draft-save endpoint
  trusted client-sent Deviation and never validated numeric input
  (`server/src/services/calibrationWorkflow.ts` — Deviation is now
  always server-recomputed from Standard/reading, non-numeric input is
  rejected). Explicitly did **not** add a "Standard and reading must
  share the same decimal scale" rule — the real CO2 Incubator certs show
  the reference standard legitimately read to finer resolution than the
  DUT (e.g. `4.859` vs `5.0`), so that rule would reject valid data.

## Fictional demo data
- Fictional customer: **Pacific BioResearch** (Anaheim/Southern-California
  area, fictional address/phone/contacts).
- A second fictional customer, **Coastline Materials Testing**, was added
  for the Weathering Tester scenario so the demo isn't a single-customer
  world.
- Fictional assets, one per demo document type (Section 25), fictional
  serials/asset numbers, fictional `ccAssetId` values.
- Demo user passwords: seeded, clearly demo-only (see `README.md`).

## Calculation / decision rules
- All calculation and decision logic is intentionally simple and labeled
  `DEMO-CALC-*` / `DEMO-DECISION-*` in the UI and in code — see
  `docs/QUALITY_LIMITATIONS.md`. No written formula/spec was ever
  provided, so these remain labeled DEMO and are still not to be
  presented as Parametric's official documented procedure.
- That said, the 7 real certificates now on hand are consistent with
  both rules, across 5 instrument families:
  - **`DEMO-CALC-1`** (`deviation = reading − standard`) matches every
    deviation value in every real file exactly (e.g. `10.058 − 10.000 =
    +0.058`; `5.0 − 5.727 = −0.727`).
  - **`DEMO-DECISION-1`** (out-of-tolerance if `|deviation| >
    tolerance`; final status follows As-Left when present) matches
    every real file's printed Pass/In-Tolerance outcome. It's also
    exactly what Parametric's own boilerplate paragraph (present
    verbatim in every real file) states in writing: *"Parametric
    follows the Decision Rule of Simple Acceptance in accordance with
    ILAC G8 ... reporting the acceptance limit equal to the tolerance
    limit"* — i.e. compare the raw reading to the stated tolerance
    directly, not an uncertainty-expanded/contracted limit. The
    separate `Uncertainty` column is reported for information but is
    **not** folded into the accept/reject decision — confirmed by
    real data, not assumed.
  - One nuance confirmed by `20260806.009`: `Adjustment Made = Yes`
    even when As-Found was already in tolerance (technician adjusted
    anyway to tighten the reading) — the decision rule already
    modeled this correctly (adjustment is independent of OOT status).

## Deferred/simplified for demo scope
- Visual (drag-and-drop) template field mapper: **not built**. Field
  mappings are seeded as data (rows in `WordFieldMapping`, editable via
  Prisma/SQL or a future admin UI), per Section 30's explicit allowance
  ("mapping configuration may be stored in code/JSON" for V1). The admin
  UI can *view* mappings.
- Legacy remote data-entry scan upload (Section 18) is implemented with a
  blank/fictional placeholder scan image, not a real scanned worksheet.
- Playwright E2E was scoped down to the extent time allowed; see the
  final report for exactly what ran.
- The real CO2 Incubator certs' true **2-level nested grouping** (Local
  vs. Rees Probe, each split into Temperature/Humidity/CO2) is
  represented as 6 flat, compound-named groups ("Local — Temperature",
  etc.) rather than an actual nested `MeasurementGroup.parentGroupId`
  render path. The schema and data already support the real 2-level
  nesting; only the Word template's docxtemplater loop and the
  `wordViewModels.ts` builder would need a third nesting level
  (`{#sections}{#groups}{#subgroups}{#points}`) to render it exactly as
  the real file does. Flattening was chosen to reuse the existing,
  already-verified `temp-rh-meter` template rather than hand-author a
  new triple-nested OOXML loop without being able to visually proof it
  in Word.
