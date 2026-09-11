# Source Word Documents (sanitized samples)

Drop the sanitized/real Parametric `.docx` files in this folder. This is the
input for the document-analysis phase (`docs/DOCUMENT_ANALYSIS.md`) — nothing
here is used as a live template at runtime; the app only ever works off
copies.

Suggested names (rename however you like, I'll inspect whatever is here):

- `temp-rh-meter-certificate.docx`
- `weight-set-certificate.docx`
- `weathering-tester-certificate.docx`
- `preventative-maintenance-report.docx`
- anything else you want included as architectural ground truth

Notes:
- These should already be sanitized (no real customer names/addresses/phone
  numbers you don't want in git history). If a file still has real customer
  data in it, say so and I'll scrub it into a fictional replacement before
  anything gets committed, or keep it out of git entirely.
- Any format works for now (.docx preferred; .doc/.pdf can be converted if
  that's all that's available).
