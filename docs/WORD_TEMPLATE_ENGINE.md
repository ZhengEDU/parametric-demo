# Word Template Engine

## Goal

Preserve Parametric's real Word certificate/report layouts exactly —
fonts, shading, borders, merged cells, header/footer/logo, boilerplate
legal text, signature block — while letting the application inject
structured data into them, without ever modifying the master file.

## Library choice: `python-docx` (offline, one-time template authoring) + `docxtemplater`/`pizzip` (runtime rendering)

Section 7 of the brief asks to investigate whether `python-docx` alone is
sufficient, and to use lower-level OOXML manipulation if not. Findings:

- **`python-docx` alone is not a good fit for runtime generation.** It has
  no built-in templating/placeholder-substitution concept — you'd have to
  hand-write "find this text, replace with that text" logic against a
  live document on every request, including reproducing every
  Word-autoformat run-splitting quirk (see below) at request time. That's
  slow to write correctly and fragile.
- **`python-docx` is a good fit for one-time template *authoring*** —
  walking the real sample's paragraphs/tables/runs, understanding exactly
  how Word split the document into runs, and writing `{tag}` placeholders
  into the correct runs while leaving every formatting property (bold,
  size, shading, borders, gridSpan) untouched. This happens once per
  template revision, offline, produces a checked-in `.docx`, and is
  reviewable like any other source file.
- **`docxtemplater` (+ `pizzip`) is used at runtime** to actually render a
  copy of that authored template against a JSON data object. It operates
  purely on OOXML text nodes it finds inside existing runs/paragraphs/
  table rows — it never touches layout, styles, headers, footers, or
  media, so everything that isn't a `{tag}` passes through byte-for-byte.
  The whole document is validated as real OOXML after rendering (opened
  and asserted with `python-docx` in the test suite), not just trusted to
  work.

This combination was chosen over generating documents from scratch with
`docx`/`python-docx` (Section 7 explicitly prioritizes *fidelity* over
using one implementation library) — building a Word document
programmatically from primitives would require re-deriving every style
Parametric already has correct in their real file, with no guarantee of
matching it exactly.

## The run-splitting problem, and why tagging is per-run, not find/replace

Word frequently splits what looks like one piece of text into multiple
XML `<w:r>` runs — from spell-check boundaries, ± glyph insertion, manual
retyping, etc. `docs/DOCUMENT_ANALYSIS.md` documents concrete examples
from the real sample (`"20260817" + "." + "003"` as three runs for one
certificate number; `"±" + "4" + ".0" + "0"` as four runs for one
tolerance value). A naive `document.xml.replace("HemaCare", ...)` on the
raw XML would work by luck here but breaks the moment a value is split
mid-string, and can also corrupt XML if a split lands inside a tag
boundary. The tagging scripts (`tools/build_*_template.py`) instead
always operate through `python-docx`'s object model: set the **first
run** in the cell/paragraph to the placeholder tag, and blank every other
run in that same cell/paragraph — never a blind string search/replace.

## Repeating rows: how the loops actually work

`docxtemplater`'s core (free) loop syntax — `{#array}...{/array}` — repeats
whatever XML sits between the tags. When the opening tag is placed in the
first cell of a table row and the closing tag in the last cell of a
(possibly different, later) row, the **whole row range** repeats per array
element, including merged/`gridSpan` cells and all formatting. This is
core, not a paid add-on, and was verified empirically (not assumed) — see
`tools/test_render_weight_set.js` and the equivalent throwaway scripts
used during development for the other three templates, all of which:
render real nested data, save a `.docx`, and re-open it with `python-docx`
to assert the exact row count, cell text, and that bold/size/shading/
`gridSpan` survived. Confirmed nesting depths:

- **2 levels** (Standards: flat loop over one row) — Weight Set, Temp/RH.
- **2 levels** (Group → Point) — Weight Set, Temp/RH calibration tables.
- **3 levels** (Section → Group → Point) — Weathering Tester
  (`{#sections}{#groups}{#points}...{/points}{/groups}{/sections}`),
  proven with a real Temperature (1 implicit group) + Irradiance (4
  channel groups) render.
- **2 levels** (Section → Item) — Preventative Maintenance checklist.

The template-authoring scripts keep exactly **one** real row per repeat
level (deleting the sample's extra hardcoded rows) so the loop produces
precisely as many rows as the data provides — not the original row count
plus extras.

## Runtime rendering pipeline (`server/src/services/wordRenderer/`)

1. Load the `WordTemplateRevision.storagePath` file from disk (never the
   original `templates/*/source.docx` in place — always read-only, copied
   into memory via `pizzip`).
2. Build a plain JSON data object from the `CalibrationRecord` (or PM
   record) via a per-family "view model" function — this is the one and
   only place business data crosses into template-specific field/tag
   names (`docs/DATA_MODEL.md` "Precision" section: every numeric cell is
   rendered from its stored `displayValue` string, never reformatted).
3. `docxtemplater.render(data)`.
4. Write the output buffer to `server/storage/generated/`, compute its
   SHA-256, and persist a `GeneratedDocument` row (Section 24) — the
   generation endpoint fails closed: if rendering throws, no
   `GeneratedDocument` row is written and the calibration record's
   workflow state does not advance (see the self-review in
   `docs/QUALITY_LIMITATIONS.md`).

## Field mapping storage

Per Section 30/31, the mapping between business field keys
(`customer.name`, `asset.serialNumber`, …) and the literal template tags
(`{customer_name}`, `{asset_serial_number}`, …) is stored as data —
`WordFieldMapping` rows, seeded from `server/templates/*/mapping.json` —
not hard-coded inside rendering logic, so a future visual mapper can edit
these rows without code changes. The renderer itself only knows "take the
view model, call docxtemplater" — it has no per-field business logic.

## Template lifecycle

`WordTemplate` (one per family+procedure) → `WordTemplateRevision`
(uploaded file, SHA-256, `status` = `DRAFT` / `ACTIVE_DEMO` / `RETIRED`).
Generating a certificate always copies the *file on disk* referenced by
the revision's `storagePath` into a new output file — the master under
`server/templates/` is never opened in write mode by the running
application, only by the offline `tools/build_*.py` authoring scripts.
