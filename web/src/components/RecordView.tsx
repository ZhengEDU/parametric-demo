import { Fragment, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import { getDisplay } from "../lib/cellDisplay";
import { isValidDecimalString, subtractDecimalStrings } from "../lib/precision";
import { useAuth } from "../state/AuthContext";
import { StatusBadge } from "./StatusBadge";
import { UnitHistoryPanel } from "./UnitHistoryPanel";
import type { FormColumn, FullRecord, ReferenceStandard } from "../api/types";

interface Flag {
  fieldRef: string;
  label: string;
  reason: string;
}

const DEFAULT_FLAT_COLUMNS: FormColumn[] = [
  { key: "targetValue", label: "Target Value", type: "text" },
  { key: "unit", label: "Units", type: "text" },
  { key: "standardAsFound", label: "Standard (As Found)", type: "text" },
  { key: "asFound", label: "As Found", type: "text" },
  { key: "deviationAsFound", label: "Deviation (Found)", type: "text", computed: true },
  { key: "standardAsLeft", label: "Standard (As Left)", type: "text" },
  { key: "asLeft", label: "As Left", type: "text" },
  { key: "deviationAsLeft", label: "Deviation (Left)", type: "text", computed: true },
  { key: "calTolerance", label: "Cal Tolerance", type: "text" },
  { key: "adjustmentMade", label: "Adjustment", type: "select", options: ["Yes", "No"] },
];

export function RecordView({ record, onChanged }: { record: FullRecord; onChanged: (r: FullRecord) => void }) {
  const { user } = useAuth();
  const [pointValues, setPointValues] = useState<Record<string, Record<string, string>>>({});
  const [envValues, setEnvValues] = useState<Record<string, { displayValue: string; asFoundStatus: string; asLeftStatus: string; finalStatus: string }>>({});
  const [checklistValues, setChecklistValues] = useState<Record<string, { result: string; notes: string }>>({});
  const [comments, setComments] = useState("");
  const [calLocation, setCalLocation] = useState("");
  const [purpose, setPurpose] = useState("");
  const [serviceReq, setServiceReq] = useState("");
  const [standardIds, setStandardIds] = useState<string[]>([]);
  const [allStandards, setAllStandards] = useState<ReferenceStandard[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [returnComments, setReturnComments] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);

  useEffect(() => {
    const pv: Record<string, Record<string, string>> = {};
    for (const section of record.measurementSections) {
      for (const group of section.groups) {
        for (const point of group.points) {
          const row: Record<string, string> = {};
          for (const [k, v] of Object.entries(point.values)) row[k] = getDisplay(v);
          pv[point.id] = row;
        }
      }
    }
    setPointValues(pv);

    const ev: Record<string, { displayValue: string; asFoundStatus: string; asLeftStatus: string; finalStatus: string }> = {};
    for (const e of record.environmentalObservations) {
      ev[e.id] = { displayValue: e.displayValue ?? "", asFoundStatus: e.asFoundStatus ?? "", asLeftStatus: e.asLeftStatus ?? "", finalStatus: e.finalStatus ?? "" };
    }
    setEnvValues(ev);

    const cv: Record<string, { result: string; notes: string }> = {};
    for (const s of record.pmChecklistSections) {
      for (const i of s.items) cv[i.id] = { result: i.result ?? "", notes: i.notes ?? "" };
    }
    setChecklistValues(cv);

    setComments(record.comments ?? "");
    setCalLocation(record.calibrationLocation ?? "");
    setPurpose(record.purposeOfVisit ?? "");
    setServiceReq(record.serviceRequested ?? "");
    setStandardIds(record.standardUsages.map((u) => u.standard.id));
    setFlags([]);
    setError(null);
  }, [record]);

  useEffect(() => {
    api
      .get<{ standards: ReferenceStandard[] }>("/calibrations/reference-standards")
      .then((r) => setAllStandards(r.standards))
      .catch(() => {});
  }, []);

  const isTechnicianEditable =
    (record.status === "DRAFT" || record.status === "RETURNED_FOR_CORRECTION") &&
    !!user &&
    (user.id === record.technician.id || user.role === "DOCUMENTATION" || user.role === "ADMIN");
  const isManager = user?.role === "MANAGER" || user?.role === "ADMIN";
  const canOpenForReview = isManager && (record.status === "SUBMITTED" || record.status === "RESUBMITTED");
  const canReviewDecide = isManager && record.status === "UNDER_REVIEW";
  const canGenerateDocument = isManager && (record.status === "APPROVED" || record.status === "DOCUMENT_GENERATED");
  const canSync = isManager && record.status === "DOCUMENT_GENERATED";
  const canRelease = isManager && record.status === "READY_FOR_RELEASE";

  const columnsFor = (kind: "measurement-flat" | "measurement-sectioned"): FormColumn[] => {
    const schema = record.procedure.digitalFormTemplateRevision?.formSchema;
    if (schema?.columns && schema.kind === kind) return schema.columns;
    return DEFAULT_FLAT_COLUMNS;
  };

  function setPointField(pointId: string, key: string, value: string) {
    setPointValues((prev) => {
      const row = { ...(prev[pointId] ?? {}), [key]: value };
      const dev1 = subtractDecimalStrings(row.asFound ?? "", row.standardAsFound ?? "");
      if (dev1 != null) row.deviationAsFound = dev1;
      const dev2 = subtractDecimalStrings(row.asLeft ?? "", row.standardAsLeft ?? row.standardAsFound ?? "");
      if (dev2 != null) row.deviationAsLeft = dev2;
      return { ...prev, [pointId]: row };
    });
  }

  function toggleFlag(fieldRef: string, label: string) {
    setFlags((prev) => {
      const existing = prev.find((f) => f.fieldRef === fieldRef);
      if (existing) return prev.filter((f) => f.fieldRef !== fieldRef);
      return [...prev, { fieldRef, label, reason: "" }];
    });
  }
  function setFlagReason(fieldRef: string, reason: string) {
    setFlags((prev) => prev.map((f) => (f.fieldRef === fieldRef ? { ...f, reason } : f)));
  }

  const pendingCorrectionsByRef = useMemo(() => {
    const m = new Map<string, typeof record.corrections>();
    for (const c of record.corrections) {
      if (c.status !== "PENDING") continue;
      const list = m.get(c.fieldRef) ?? [];
      list.push(c);
      m.set(c.fieldRef, list);
    }
    return m;
  }, [record.corrections]);

  async function refetch() {
    const isJob = window.location.pathname.startsWith("/jobs/");
    if (isJob) {
      const res = await api.get<{ task: unknown; record: FullRecord }>(`/jobs/${record.task.id}`);
      onChanged(res.record);
    } else {
      const res = await api.get<{ record: FullRecord }>(`/calibrations/${record.id}`);
      onChanged(res.record);
    }
  }

  async function withBusy(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  function saveDraftPayload() {
    const points = Object.entries(pointValues).map(([pointId, values]) => ({ pointId, values }));
    const environmental = Object.entries(envValues).map(([id, v]) => ({
      id,
      displayValue: v.displayValue,
      numericValue: isValidDecimalString(v.displayValue) ? v.displayValue : null,
      asFoundStatus: v.asFoundStatus || null,
      asLeftStatus: v.asLeftStatus || null,
      finalStatus: v.finalStatus || null,
    }));
    const checklistItems = Object.entries(checklistValues).map(([itemId, v]) => ({ itemId, result: v.result || null, notes: v.notes || null }));
    return {
      comments,
      calibrationLocation: calLocation,
      purposeOfVisit: purpose,
      serviceRequested: serviceReq,
      standardIds,
      points,
      environmental,
      checklistItems,
    };
  }

  async function handleSaveDraft() {
    await withBusy("save", async () => {
      const res = await api.put<{ record: FullRecord }>(`/calibrations/${record.id}/draft`, saveDraftPayload());
      onChanged(res.record);
    });
  }
  async function handleSubmit() {
    await withBusy("submit", async () => {
      await api.put(`/calibrations/${record.id}/draft`, saveDraftPayload());
      const res = await api.post<{ record: FullRecord }>(`/calibrations/${record.id}/submit`);
      onChanged(res.record);
    });
  }
  async function handleOpenForReview() {
    await withBusy("open", async () => {
      await api.post(`/review/${record.id}/open`);
      await refetch();
    });
  }
  async function handleApprove() {
    await withBusy("approve", async () => {
      const res = await api.post<{ record: FullRecord }>(`/review/${record.id}/approve`, { comments: returnComments || undefined });
      onChanged(res.record);
    });
  }
  async function handleReturn() {
    if (flags.length === 0) {
      setError("Flag at least one field before returning for correction.");
      return;
    }
    await withBusy("return", async () => {
      const res = await api.post<{ record: FullRecord }>(`/review/${record.id}/return`, {
        comments: returnComments || undefined,
        flaggedFields: flags.map((f) => ({ fieldRef: f.fieldRef, label: f.label, reason: f.reason || "No reason given" })),
      });
      onChanged(res.record);
    });
  }
  async function handleGenerate() {
    await withBusy("generate", async () => {
      await api.post(`/documents/${record.id}/generate`);
      await refetch();
    });
  }
  async function handleSync() {
    await withBusy("sync", async () => {
      await api.post(`/sync/${record.id}`);
      await refetch();
    });
  }
  async function handleRelease() {
    await withBusy("release", async () => {
      const res = await api.post<{ record: FullRecord }>(`/review/${record.id}/release`);
      onChanged(res.record);
    });
  }
  async function handleAddPoint(groupId: string) {
    await withBusy(`addpoint-${groupId}`, async () => {
      const res = await api.post<{ record: FullRecord }>(`/calibrations/${record.id}/points`, { groupId });
      onChanged(res.record);
    });
  }
  async function handleRemovePoint(pointId: string) {
    await withBusy(`rmpoint-${pointId}`, async () => {
      const res = await api.delete<{ record: FullRecord }>(`/calibrations/${record.id}/points/${pointId}`);
      onChanged(res.record);
    });
  }
  async function handleAddChecklistItem(sectionId: string) {
    const label = window.prompt("Checklist item label:");
    if (!label || !label.trim()) return;
    await withBusy(`additem-${sectionId}`, async () => {
      const res = await api.post<{ record: FullRecord }>(`/calibrations/${record.id}/checklist-items`, { sectionId, label: label.trim() });
      onChanged(res.record);
    });
  }
  async function handleRemoveChecklistItem(itemId: string) {
    await withBusy(`rmitem-${itemId}`, async () => {
      const res = await api.delete<{ record: FullRecord }>(`/calibrations/${record.id}/checklist-items/${itemId}`);
      onChanged(res.record);
    });
  }
  async function handleUploadScan() {
    if (!scanFile) return;
    await withBusy("scan", async () => {
      const form = new FormData();
      form.append("scan", scanFile);
      const res = await api.postForm<{ record: FullRecord }>(`/calibrations/${record.id}/legacy-scan`, form);
      onChanged(res.record);
      setScanFile(null);
    });
  }

  const isChecklist = record.procedure.documentFamily === "PREVENTATIVE_MAINTENANCE_REPORT";
  // Prefer the procedure's actual form schema kind; a "flat" (non-sectioned)
  // procedure can still have several named sub-tables (multiple
  // MeasurementGroups under one MeasurementSection), so section/group count
  // alone isn't reliable. Fall back to the count heuristic only when no
  // schema is configured for the procedure.
  const schemaKind = record.procedure.digitalFormTemplateRevision?.formSchema?.kind;
  const isSectioned = schemaKind ? schemaKind === "measurement-sectioned" : record.measurementSections.length > 1;

  return (
    <div>
      <div className="panel-header">
        <div>
          <h1>
            {record.asset.description} <span className="muted small">({record.asset.assetNumber})</span>
          </h1>
          <div className="muted small">
            {record.asset.customer.name} — {record.asset.site.label} · {record.procedure.name}
          </div>
        </div>
        <StatusBadge value={record.status} />
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="panel">
        <h3>Asset</h3>
        <div className="field-row">
          <div className="field"><label>Asset ID</label>{record.asset.assetNumber}</div>
          <div className="field"><label>Manufacturer / Model</label>{record.asset.manufacturer} {record.asset.model}</div>
          <div className="field"><label>Serial Number</label>{record.asset.serialNumber}</div>
          <div className="field"><label>Site</label>{record.asset.site.label}</div>
          <div className="field"><label>Technician</label>{record.technician.fullName}</div>
          <div className="field"><label>Entry Mode</label>{record.entryMode.replaceAll("_", " ")}</div>
        </div>
        <div className="field-row">
          <div className="field"><label>Calibration Interval</label>{record.asset.calibrationIntervalMonths} months</div>
          <div className="field"><label>Last Calibrated</label>{record.asset.lastCalibratedAt ? new Date(record.asset.lastCalibratedAt).toLocaleDateString() : "—"}</div>
          <div className="field"><label>Next Calibration Due</label>{record.asset.nextCalibrationDueAt ? new Date(record.asset.nextCalibrationDueAt).toLocaleDateString() : "—"}</div>
        </div>
      </div>

      <UnitHistoryPanel assetId={record.asset.id} excludeRecordId={record.id} />

      {record.corrections.length > 0 && (
        <div className="panel">
          <h3>Corrections</h3>
          {record.corrections.map((c) => (
            <div key={c.id} className={c.status === "PENDING" ? "correction-note" : "small muted"} style={{ marginBottom: 6 }}>
              <strong>{c.fieldLabel}</strong> — {c.reason} {c.status === "RESOLVED" ? " (resolved)" : " (pending)"}
            </div>
          ))}
        </div>
      )}

      {!isChecklist && (
        <div className="panel">
          <h3>Calibration Data</h3>
          {record.measurementSections.map((section) => (
            <div key={section.id}>
              {isSectioned && <div className="section-name">{section.name}</div>}
              {section.groups.map((group) => {
                const columns = columnsFor(isSectioned ? "measurement-sectioned" : "measurement-flat");
                const showResult = group.points.some((p) => "result" in p.values) || columns.some((c) => c.key === "result");
                const cols = isSectioned ? columns : columns;
                return (
                  <div key={group.id} style={{ marginBottom: 14 }}>
                    <div className="group-name" style={{ padding: "4px 8px" }}>{group.name}</div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Row</th>
                            {cols.map((c) => (
                              <th key={c.key}>{c.label}</th>
                            ))}
                            {isManager && <th>Flag</th>}
                            {isTechnicianEditable && <th></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {group.points.map((point) => {
                            const values = pointValues[point.id] ?? {};
                            const fieldRef = `point:${point.id}`;
                            const flagged = flags.some((f) => f.fieldRef === fieldRef);
                            const pendingHere = pendingCorrectionsByRef.get(fieldRef);
                            // Derive the row identifier from the live (possibly
                            // edited) Target Value rather than the frozen
                            // point.rowLabel — the two are stored separately,
                            // and if a technician edits Target Value without
                            // this, the row header and the printed certificate
                            // can silently disagree (rowLabel never appears in
                            // the generated Word document, only targetValue
                            // does — see server/src/services/wordViewModels.ts).
                            const rowDisplay = values.targetValue || point.rowLabel;
                            return (
                              <Fragment key={point.id}>
                                <tr>
                                  <td>{rowDisplay}</td>
                                  {cols.map((c) => (
                                    <td key={c.key}>
                                      {isTechnicianEditable && !c.computed ? (
                                        c.type === "select" ? (
                                          <select value={values[c.key] ?? ""} onChange={(e) => setPointField(point.id, c.key, e.target.value)}>
                                            <option value="" />
                                            {(c.options ?? []).map((o) => (
                                              <option key={o} value={o}>{o}</option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            className="cell-input"
                                            type="text"
                                            value={values[c.key] ?? ""}
                                            onChange={(e) => setPointField(point.id, c.key, e.target.value)}
                                          />
                                        )
                                      ) : (
                                        <span className="mono">{values[c.key] ?? ""}</span>
                                      )}
                                    </td>
                                  ))}
                                  {isManager && (
                                    <td>
                                      <button
                                        type="button"
                                        className={`flag-btn ${flagged ? "flagged" : ""}`}
                                        onClick={() => toggleFlag(fieldRef, `${group.name} — ${rowDisplay}`)}
                                        disabled={!canReviewDecide}
                                      >
                                        {flagged ? "★ flagged" : "☆ flag"}
                                      </button>
                                    </td>
                                  )}
                                  {isTechnicianEditable && (
                                    <td>
                                      <button
                                        type="button"
                                        className="flag-btn"
                                        title="Remove row"
                                        onClick={() => handleRemovePoint(point.id)}
                                        disabled={busy !== null}
                                      >
                                        ✕
                                      </button>
                                    </td>
                                  )}
                                </tr>
                                {flagged && (
                                  <tr>
                                    <td colSpan={1 + cols.length + (isManager ? 1 : 0) + (isTechnicianEditable ? 1 : 0)}>
                                      <input
                                        type="text"
                                        placeholder="Reason for flagging this row"
                                        value={flags.find((f) => f.fieldRef === fieldRef)?.reason ?? ""}
                                        onChange={(e) => setFlagReason(fieldRef, e.target.value)}
                                      />
                                    </td>
                                  </tr>
                                )}
                                {pendingHere?.map((c) => (
                                  <tr key={c.id}>
                                    <td colSpan={1 + cols.length + (isManager ? 1 : 0) + (isTechnicianEditable ? 1 : 0)}>
                                      <div className="correction-note">Flagged: {c.reason}</div>
                                    </td>
                                  </tr>
                                ))}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {showResult && null}
                    {isTechnicianEditable && (
                      <button type="button" style={{ marginTop: 6 }} onClick={() => handleAddPoint(group.id)} disabled={busy !== null}>
                        + Add Row
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {isChecklist && (
        <div className="panel">
          <h3>PM Checklist</h3>
          {record.pmChecklistSections.map((section) => (
            <div key={section.id} style={{ marginBottom: 14 }}>
              <div className="group-name" style={{ padding: "4px 8px" }}>{section.name}</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ width: 120 }}>Result</th>
                      <th>Notes</th>
                      {isManager && <th>Flag</th>}
                      {isTechnicianEditable && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((item) => {
                      const v = checklistValues[item.id] ?? { result: "", notes: "" };
                      const fieldRef = `checklist:${item.id}`;
                      const flagged = flags.some((f) => f.fieldRef === fieldRef);
                      const totalCols = 3 + (isManager ? 1 : 0) + (isTechnicianEditable ? 1 : 0);
                      return (
                        <Fragment key={item.id}>
                          <tr>
                            <td>{item.label}</td>
                            <td>
                              {isTechnicianEditable ? (
                                <select value={v.result} onChange={(e) => setChecklistValues((p) => ({ ...p, [item.id]: { ...v, result: e.target.value } }))}>
                                  <option value="" />
                                  <option value="PASS">Pass</option>
                                  <option value="FAIL">Fail</option>
                                  <option value="NOT_APPLICABLE">N/A</option>
                                </select>
                              ) : (
                                <StatusBadge value={v.result || null} />
                              )}
                            </td>
                            <td>
                              {isTechnicianEditable ? (
                                <input type="text" value={v.notes} onChange={(e) => setChecklistValues((p) => ({ ...p, [item.id]: { ...v, notes: e.target.value } }))} />
                              ) : (
                                v.notes
                              )}
                            </td>
                            {isManager && (
                              <td>
                                <button type="button" className={`flag-btn ${flagged ? "flagged" : ""}`} onClick={() => toggleFlag(fieldRef, item.label)} disabled={!canReviewDecide}>
                                  {flagged ? "★" : "☆"}
                                </button>
                              </td>
                            )}
                            {isTechnicianEditable && (
                              <td>
                                <button type="button" className="flag-btn" title="Remove item" onClick={() => handleRemoveChecklistItem(item.id)} disabled={busy !== null}>
                                  ✕
                                </button>
                              </td>
                            )}
                          </tr>
                          {flagged && (
                            <tr>
                              <td colSpan={totalCols}>
                                <input type="text" placeholder="Reason" value={flags.find((f) => f.fieldRef === fieldRef)?.reason ?? ""} onChange={(e) => setFlagReason(fieldRef, e.target.value)} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {isTechnicianEditable && (
                <button type="button" style={{ marginTop: 6 }} onClick={() => handleAddChecklistItem(section.id)} disabled={busy !== null}>
                  + Add Item
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {record.environmentalObservations.length > 0 && (
        <div className="panel">
          <h3>Environmental Conditions</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Reading</th>
                  <th>As Found</th>
                  <th>As Left</th>
                  <th>Status</th>
                  {isManager && <th>Flag</th>}
                </tr>
              </thead>
              <tbody>
                {record.environmentalObservations.map((e) => {
                  const v = envValues[e.id] ?? { displayValue: "", asFoundStatus: "", asLeftStatus: "", finalStatus: "" };
                  const fieldRef = `environmental:${e.id}`;
                  const flagged = flags.some((f) => f.fieldRef === fieldRef);
                  return (
                    <Fragment key={e.id}>
                      <tr>
                        <td style={{ textTransform: "capitalize" }}>{e.parameter}</td>
                        <td>
                          {isTechnicianEditable ? (
                            <input className="cell-input" type="text" value={v.displayValue} onChange={(ev) => setEnvValues((p) => ({ ...p, [e.id]: { ...v, displayValue: ev.target.value } }))} />
                          ) : (
                            <span className="mono">{v.displayValue} {e.unit}</span>
                          )}
                        </td>
                        <td>
                          {isTechnicianEditable ? (
                            <select value={v.asFoundStatus} onChange={(ev) => setEnvValues((p) => ({ ...p, [e.id]: { ...v, asFoundStatus: ev.target.value } }))}>
                              <option value="" />
                              <option value="IN_TOLERANCE">In Tolerance</option>
                              <option value="OUT_OF_TOLERANCE">Out of Tolerance</option>
                              <option value="NOT_APPLICABLE">N/A</option>
                            </select>
                          ) : (
                            <StatusBadge value={v.asFoundStatus || null} />
                          )}
                        </td>
                        <td>
                          {isTechnicianEditable ? (
                            <select value={v.asLeftStatus} onChange={(ev) => setEnvValues((p) => ({ ...p, [e.id]: { ...v, asLeftStatus: ev.target.value } }))}>
                              <option value="" />
                              <option value="IN_TOLERANCE">In Tolerance</option>
                              <option value="OUT_OF_TOLERANCE">Out of Tolerance</option>
                              <option value="NOT_APPLICABLE">N/A</option>
                            </select>
                          ) : (
                            <StatusBadge value={v.asLeftStatus || null} />
                          )}
                        </td>
                        <td>
                          {isTechnicianEditable ? (
                            <select value={v.finalStatus} onChange={(ev) => setEnvValues((p) => ({ ...p, [e.id]: { ...v, finalStatus: ev.target.value } }))}>
                              <option value="" />
                              <option value="PASS">Pass</option>
                              <option value="FAIL">Fail</option>
                              <option value="NOT_APPLICABLE">N/A</option>
                            </select>
                          ) : (
                            <StatusBadge value={v.finalStatus || null} />
                          )}
                        </td>
                        {isManager && (
                          <td>
                            <button type="button" className={`flag-btn ${flagged ? "flagged" : ""}`} onClick={() => toggleFlag(fieldRef, `Environmental — ${e.parameter}`)} disabled={!canReviewDecide}>
                              {flagged ? "★" : "☆"}
                            </button>
                          </td>
                        )}
                      </tr>
                      {flagged && (
                        <tr>
                          <td colSpan={6}>
                            <input type="text" placeholder="Reason" value={flags.find((f) => f.fieldRef === fieldRef)?.reason ?? ""} onChange={(ev) => setFlagReason(fieldRef, ev.target.value)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel">
        <h3>Standards Utilized</h3>
        {isTechnicianEditable ? (
          <div className="field">
            {allStandards.map((s) => (
              <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text)", marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={standardIds.includes(s.id)}
                  onChange={(e) => setStandardIds((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))}
                  style={{ width: "auto" }}
                />
                {s.idNumber} — {s.manufacturer} {s.model} ({s.description})
              </label>
            ))}
          </div>
        ) : (
          <ul>
            {record.standardUsages.map((u) => (
              <li key={u.id}>{u.standard.idNumber} — {u.standard.manufacturer} {u.standard.model} ({u.standard.description})</li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <h3>Notes</h3>
        <div className="field-row">
          <div className="field">
            <label>Calibration Location</label>
            {isTechnicianEditable ? <input type="text" value={calLocation} onChange={(e) => setCalLocation(e.target.value)} /> : <div>{calLocation || "—"}</div>}
          </div>
          {isChecklist && (
            <>
              <div className="field">
                <label>Purpose of Visit</label>
                {isTechnicianEditable ? <input type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} /> : <div>{purpose || "—"}</div>}
              </div>
              <div className="field">
                <label>Service Requested</label>
                {isTechnicianEditable ? <input type="text" value={serviceReq} onChange={(e) => setServiceReq(e.target.value)} /> : <div>{serviceReq || "—"}</div>}
              </div>
            </>
          )}
        </div>
        <div className="field">
          <label>Comments</label>
          {isTechnicianEditable ? <textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} /> : <div>{comments || "—"}</div>}
        </div>
      </div>

      {(record.entryMode === "LEGACY_PAPER" || record.legacyScanFilename) && (
        <div className="panel">
          <h3>Legacy Scan</h3>
          {record.legacyScanFilename && (
            <p className="small">
              Attached: {record.legacyScanFilename} — <a href={`/api/calibrations/${record.id}/legacy-scan`} target="_blank" rel="noreferrer">view</a>
            </p>
          )}
          {(user?.role === "DOCUMENTATION" || user?.role === "ADMIN") && isTechnicianEditable && (
            <div className="btn-row">
              <input type="file" accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => setScanFile(e.target.files?.[0] ?? null)} />
              <button onClick={handleUploadScan} disabled={!scanFile || busy === "scan"}>Upload Scan</button>
            </div>
          )}
        </div>
      )}

      {record.reviews.length > 0 && (
        <div className="panel">
          <h3>Review History</h3>
          {record.reviews.map((r) => (
            <div key={r.id} className="small" style={{ marginBottom: 6 }}>
              <StatusBadge value={r.action} /> by {r.reviewer.fullName} on {new Date(r.createdAt).toLocaleString()}
              {r.comments && <div className="muted">"{r.comments}"</div>}
            </div>
          ))}
        </div>
      )}

      {(record.generatedDocuments.length > 0 || record.syncEvents.length > 0) && (
        <div className="panel">
          <h3>Documents &amp; Sync</h3>
          {record.generatedDocuments.map((d) => (
            <div key={d.id} className="small">
              <a href={`/api/documents/${d.id}/download`}>{d.filename}</a> — generated {new Date(d.generatedAt).toLocaleString()}
            </div>
          ))}
          {record.syncEvents.map((s) => (
            <div key={s.id} className="small">
              <StatusBadge value={s.status} /> {s.ccRecordId ?? ""} {s.failureMessage ?? ""}
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <h3>Actions</h3>
        {(isTechnicianEditable || canReviewDecide || canGenerateDocument) && (
          <div className="btn-row" style={{ marginBottom: 10 }}>
            <a className="btn" href={`/api/documents/${record.id}/preview`} target="_blank" rel="noreferrer">
              Preview Certificate
            </a>
            <span className="muted small">Opens the certificate exactly as it will print, using what's entered so far — nothing is saved by previewing.</span>
          </div>
        )}
        {isTechnicianEditable && (
          <div className="btn-row">
            <button onClick={handleSaveDraft} disabled={busy !== null}>{busy === "save" ? "Saving…" : "Save Draft"}</button>
            <button className="primary" onClick={handleSubmit} disabled={busy !== null}>
              {busy === "submit" ? "Submitting…" : record.status === "RETURNED_FOR_CORRECTION" ? "Resubmit" : "Submit"}
            </button>
          </div>
        )}
        {canOpenForReview && (
          <div className="btn-row">
            <button className="primary" onClick={handleOpenForReview} disabled={busy !== null}>{busy === "open" ? "Opening…" : "Open for Review"}</button>
          </div>
        )}
        {canReviewDecide && (
          <div>
            <div className="field">
              <label>Review comments (optional)</label>
              <input type="text" value={returnComments} onChange={(e) => setReturnComments(e.target.value)} />
            </div>
            <div className="btn-row">
              <button className="primary" onClick={handleApprove} disabled={busy !== null}>{busy === "approve" ? "Approving…" : "Approve"}</button>
              <button className="danger" onClick={handleReturn} disabled={busy !== null}>{busy === "return" ? "Returning…" : `Return for Correction (${flags.length} flagged)`}</button>
            </div>
          </div>
        )}
        {(canGenerateDocument || canSync || canRelease) && (
          <div className="btn-row">
            {canGenerateDocument && (
              <button className="primary" onClick={handleGenerate} disabled={busy !== null}>
                {busy === "generate" ? "Generating…" : record.status === "DOCUMENT_GENERATED" ? "Regenerate Document" : "Generate Document"}
              </button>
            )}
            {canSync && (
              <button className="primary" onClick={handleSync} disabled={busy !== null}>{busy === "sync" ? "Syncing…" : "Sync to Calibration Control"}</button>
            )}
            {canRelease && (
              <button className="primary" onClick={handleRelease} disabled={busy !== null}>{busy === "release" ? "Releasing…" : "Release"}</button>
            )}
          </div>
        )}
        {!isTechnicianEditable && !canOpenForReview && !canReviewDecide && !canGenerateDocument && !canSync && !canRelease && (
          <p className="muted small">No actions available for your role at this stage.</p>
        )}
      </div>
    </div>
  );
}
