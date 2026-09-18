import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../state/AuthContext";
import type { EquipmentModel, FormSchema, Procedure, ReferenceStandard } from "../api/types";

interface AdminUser { id: string; email: string; fullName: string; role: string; active: boolean }
interface AdminAsset { id: string; assetNumber: string; description: string; customer: { name: string }; site: { label: string }; defaultProcedure: { name: string } | null }
interface AdminCustomer { id: string; name: string; sites: { id: string; label: string; city: string; state: string }[]; contacts: { id: string; name: string; phone: string | null; email: string | null }[]; assets: unknown[] }
type Tab = "users" | "customers" | "assets" | "models" | "standards" | "measurements";

const EMPTY_MODEL_FORM = { manufacturer: "", model: "", description: "", accuracy: "", range: "", calibrationIntervalMonths: "", defaultProcedureId: "" };
const EMPTY_STANDARD_FORM = { idNumber: "", manufacturer: "", model: "", description: "", calDue: "" };

// Presets so "what are we measuring" turns directly into the right unit
// choices, instead of an admin having to remember/type them from scratch.
// "Custom" leaves the options box for free entry of anything not listed.
const MEASUREMENT_TYPE_PRESETS: Record<string, string[]> = {
  Temperature: ["°C", "°F", "K"],
  "Pressure": ["psi", "bar", "kPa", "inHg"],
  Vacuum: ["Torr", "mbar", "inHg", "Pa"],
  "Mass / Weight": ["g", "kg", "lb", "oz"],
  Humidity: ["%RH"],
  Length: ["mm", "cm", "in", "ft"],
  Electrical: ["V", "A", "Ω"],
  Custom: [],
};

export function AdminPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManageAdmin = user?.role === "ADMIN" || user?.role === "AUDITOR";
  const canEditCatalogs = user?.role === "ADMIN" || user?.role === "MANAGER";

  const requestedTab = searchParams.get("tab") as Tab | null;
  const [tab, setTabState] = useState<Tab>(() => {
    if (requestedTab) return requestedTab;
    return canManageAdmin ? "users" : "models";
  });
  function setTab(t: Tab) {
    setTabState(t);
    setSearchParams((p) => {
      p.set("tab", t);
      return p;
    });
  }

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [customers, setCustomers] = useState<AdminCustomer[] | null>(null);
  const [assets, setAssets] = useState<AdminAsset[] | null>(null);
  const [models, setModels] = useState<EquipmentModel[] | null>(null);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [modelForm, setModelForm] = useState(EMPTY_MODEL_FORM);
  const [modelError, setModelError] = useState<string | null>(null);
  const [savingModel, setSavingModel] = useState(false);
  const [standards, setStandards] = useState<ReferenceStandard[] | null>(null);
  const [standardForm, setStandardForm] = useState(EMPTY_STANDARD_FORM);
  const [standardError, setStandardError] = useState<string | null>(null);
  const [savingStandard, setSavingStandard] = useState(false);
  const [measureProcedures, setMeasureProcedures] = useState<Procedure[] | null>(null);
  const [unitDrafts, setUnitDrafts] = useState<Record<string, { preset: string; options: string }>>({});
  const [savingUnitsFor, setSavingUnitsFor] = useState<string | null>(null);
  const [unitsError, setUnitsError] = useState<string | null>(null);

  function reloadModels() {
    api.get<{ models: EquipmentModel[] }>("/equipment-models").then((r) => setModels(r.models));
  }

  function reloadStandards() {
    api.get<{ standards: ReferenceStandard[] }>("/standards").then((r) => setStandards(r.standards));
  }

  function reloadMeasurementProcedures() {
    api.get<{ procedures: Procedure[] }>("/procedures").then((r) => setMeasureProcedures(r.procedures));
  }

  useEffect(() => {
    if (canManageAdmin) {
      api.get<{ users: AdminUser[] }>("/admin/users").then((r) => setUsers(r.users));
      api.get<{ customers: AdminCustomer[] }>("/admin/customers").then((r) => setCustomers(r.customers));
      api.get<{ assets: AdminAsset[] }>("/admin/assets").then((r) => setAssets(r.assets));
    }
    reloadModels();
    reloadStandards();
    reloadMeasurementProcedures();
    api.get<{ procedures: Procedure[] }>("/intake/procedures").then((r) => setProcedures(r.procedures));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddModel() {
    setModelError(null);
    if (!modelForm.manufacturer.trim() || !modelForm.model.trim()) {
      setModelError("Manufacturer and Model are required.");
      return;
    }
    setSavingModel(true);
    try {
      await api.post("/equipment-models", {
        ...modelForm,
        calibrationIntervalMonths: modelForm.calibrationIntervalMonths ? Number(modelForm.calibrationIntervalMonths) : undefined,
        defaultProcedureId: modelForm.defaultProcedureId || undefined,
      });
      setModelForm(EMPTY_MODEL_FORM);
      reloadModels();
    } catch (err) {
      setModelError(err instanceof ApiError ? err.message : "Failed to add model");
    } finally {
      setSavingModel(false);
    }
  }

  async function handleDeleteModel(id: string) {
    if (!window.confirm("Remove this model from the catalog? Existing assets already using it are unaffected.")) return;
    await api.delete(`/equipment-models/${id}`);
    reloadModels();
  }

  async function handleAddStandard() {
    setStandardError(null);
    if (!standardForm.idNumber.trim() || !standardForm.manufacturer.trim() || !standardForm.model.trim() || !standardForm.description.trim() || !standardForm.calDue) {
      setStandardError("ID number, manufacturer, model, description, and calibration due date are all required.");
      return;
    }
    setSavingStandard(true);
    try {
      await api.post("/standards", standardForm);
      setStandardForm(EMPTY_STANDARD_FORM);
      reloadStandards();
    } catch (err) {
      setStandardError(err instanceof ApiError ? err.message : "Failed to add standard");
    } finally {
      setSavingStandard(false);
    }
  }

  async function handleToggleStandardActive(s: ReferenceStandard) {
    await api.patch(`/standards/${s.id}`, { active: !s.active });
    reloadStandards();
  }

  function unitColumnOf(p: Procedure): { type: string; options?: string[] } | null {
    const schema = p.digitalFormTemplateRevision?.formSchema as FormSchema | undefined;
    const col = schema?.columns?.find((c) => c.key === "unit");
    return col ? { type: col.type, options: col.options } : null;
  }

  function draftFor(p: Procedure) {
    if (unitDrafts[p.id]) return unitDrafts[p.id];
    const current = unitColumnOf(p);
    return { preset: "Custom", options: current?.options?.join(", ") ?? "" };
  }

  function setDraft(procedureId: string, next: { preset: string; options: string }) {
    setUnitDrafts((prev) => ({ ...prev, [procedureId]: next }));
  }

  async function handleSaveUnits(procedureId: string) {
    setUnitsError(null);
    const draft = draftFor(measureProcedures!.find((p) => p.id === procedureId)!);
    const options = draft.options.split(",").map((o) => o.trim()).filter(Boolean);
    setSavingUnitsFor(procedureId);
    try {
      await api.patch(`/procedures/${procedureId}/units`, { options });
      reloadMeasurementProcedures();
    } catch (err) {
      setUnitsError(err instanceof ApiError ? err.message : "Failed to save units");
    } finally {
      setSavingUnitsFor(null);
    }
  }

  async function handleRevertUnits(procedureId: string) {
    setUnitsError(null);
    setSavingUnitsFor(procedureId);
    try {
      await api.patch(`/procedures/${procedureId}/units`, { options: [] });
      setUnitDrafts((prev) => ({ ...prev, [procedureId]: { preset: "Custom", options: "" } }));
      reloadMeasurementProcedures();
    } catch (err) {
      setUnitsError(err instanceof ApiError ? err.message : "Failed to revert units");
    } finally {
      setSavingUnitsFor(null);
    }
  }

  const measurableProcedures = useMemo(() => (measureProcedures ?? []).filter((p) => unitColumnOf(p) !== null), [measureProcedures]);

  return (
    <div>
      <h1>Admin</h1>
      <p className="muted small">
        {canManageAdmin
          ? "Users, customers, and assets are read-only for this demo. Models, Standards, and Measurement Setup below are editable."
          : "Models, Standards, and Measurement Setup below are editable for your role."}
      </p>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        {canManageAdmin && (
          <>
            <button className={tab === "users" ? "primary" : ""} onClick={() => setTab("users")}>Users</button>
            <button className={tab === "customers" ? "primary" : ""} onClick={() => setTab("customers")}>Customers</button>
            <button className={tab === "assets" ? "primary" : ""} onClick={() => setTab("assets")}>Assets</button>
          </>
        )}
        <button className={tab === "models" ? "primary" : ""} onClick={() => setTab("models")}>Models</button>
        <button className={tab === "standards" ? "primary" : ""} onClick={() => setTab("standards")}>Standards</button>
        <button className={tab === "measurements" ? "primary" : ""} onClick={() => setTab("measurements")}>Measurement Setup</button>
      </div>

      {tab === "users" && canManageAdmin && (
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th></tr></thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id}><td>{u.fullName}</td><td>{u.email}</td><td>{u.role}</td><td>{u.active ? "Yes" : "No"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "customers" && canManageAdmin && (
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>Sites</th><th>Contacts</th></tr></thead>
            <tbody>
              {customers?.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.sites.map((s) => `${s.label} (${s.city}, ${s.state})`).join("; ")}</td>
                  <td>{c.contacts.map((ct) => ct.name).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "assets" && canManageAdmin && (
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>Asset #</th><th>Description</th><th>Customer</th><th>Site</th><th>Default Procedure</th></tr></thead>
            <tbody>
              {assets?.map((a) => (
                <tr key={a.id}>
                  <td className="mono">{a.assetNumber}</td>
                  <td>{a.description}</td>
                  <td>{a.customer.name}</td>
                  <td>{a.site.label}</td>
                  <td>{a.defaultProcedure?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "models" && (
        <div>
          {canEditCatalogs && (
            <div className="panel">
              <h3>Add a Model</h3>
              <p className="muted small">
                Entries here are what the New Calibration form's Model field suggests — a tech typing "A01000X" will
                match a catalog entry stored as "A01-000X" (dashes/spacing/case are ignored when matching).
              </p>
              {modelError && <div className="error-box">{modelError}</div>}
              <div className="field-row">
                <div className="field">
                  <label>Manufacturer</label>
                  <input type="text" value={modelForm.manufacturer} onChange={(e) => setModelForm({ ...modelForm, manufacturer: e.target.value })} />
                </div>
                <div className="field">
                  <label>Model</label>
                  <input type="text" value={modelForm.model} onChange={(e) => setModelForm({ ...modelForm, model: e.target.value })} placeholder="e.g. A01-000X" />
                </div>
                <div className="field">
                  <label>Description</label>
                  <input type="text" value={modelForm.description} onChange={(e) => setModelForm({ ...modelForm, description: e.target.value })} />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Accuracy</label>
                  <input type="text" value={modelForm.accuracy} onChange={(e) => setModelForm({ ...modelForm, accuracy: e.target.value })} />
                </div>
                <div className="field">
                  <label>Range</label>
                  <input type="text" value={modelForm.range} onChange={(e) => setModelForm({ ...modelForm, range: e.target.value })} />
                </div>
                <div className="field">
                  <label>Calibration interval (months)</label>
                  <input type="text" value={modelForm.calibrationIntervalMonths} onChange={(e) => setModelForm({ ...modelForm, calibrationIntervalMonths: e.target.value })} />
                </div>
                <div className="field">
                  <label>Default procedure</label>
                  <select value={modelForm.defaultProcedureId} onChange={(e) => setModelForm({ ...modelForm, defaultProcedureId: e.target.value })}>
                    <option value="">None</option>
                    {procedures.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="btn-row">
                <button className="primary" onClick={handleAddModel} disabled={savingModel}>
                  {savingModel ? "Adding…" : "Add Model"}
                </button>
              </div>
            </div>
          )}

          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Manufacturer</th>
                  <th>Model</th>
                  <th>Accuracy</th>
                  <th>Range</th>
                  <th>Interval</th>
                  <th>Default Procedure</th>
                  {canEditCatalogs && <th></th>}
                </tr>
              </thead>
              <tbody>
                {models?.map((m) => (
                  <tr key={m.id}>
                    <td>{m.manufacturer}</td>
                    <td className="mono">{m.model}</td>
                    <td>{m.accuracy ?? "—"}</td>
                    <td>{m.range ?? "—"}</td>
                    <td>{m.calibrationIntervalMonths ? `${m.calibrationIntervalMonths} mo` : "—"}</td>
                    <td>{m.defaultProcedure?.name ?? "—"}</td>
                    {canEditCatalogs && (
                      <td>
                        <button type="button" className="flag-btn" title="Remove" onClick={() => handleDeleteModel(m.id)}>✕</button>
                      </td>
                    )}
                  </tr>
                ))}
                {models?.length === 0 && (
                  <tr><td colSpan={canEditCatalogs ? 7 : 6} className="muted">No models in the catalog yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "standards" && (
        <div>
          {canEditCatalogs && (
            <div className="panel">
              <h3>Add a Reference Standard</h3>
              <p className="muted small">
                Standards added here appear in the "Standards Utilized" picker technicians use while filling out a
                calibration record. Retiring one (instead of deleting it) keeps it visible on any past record that
                already cites it.
              </p>
              {standardError && <div className="error-box">{standardError}</div>}
              <div className="field-row">
                <div className="field">
                  <label>ID number</label>
                  <input type="text" value={standardForm.idNumber} onChange={(e) => setStandardForm({ ...standardForm, idNumber: e.target.value })} placeholder="e.g. STD-0142" />
                </div>
                <div className="field">
                  <label>Manufacturer</label>
                  <input type="text" value={standardForm.manufacturer} onChange={(e) => setStandardForm({ ...standardForm, manufacturer: e.target.value })} />
                </div>
                <div className="field">
                  <label>Model</label>
                  <input type="text" value={standardForm.model} onChange={(e) => setStandardForm({ ...standardForm, model: e.target.value })} />
                </div>
              </div>
              <div className="field-row">
                <div className="field" style={{ flex: 2 }}>
                  <label>Description</label>
                  <input type="text" value={standardForm.description} onChange={(e) => setStandardForm({ ...standardForm, description: e.target.value })} placeholder="e.g. Class F 1kg mass set, NIST-traceable" />
                </div>
                <div className="field">
                  <label>Calibration due date</label>
                  <input type="date" value={standardForm.calDue} onChange={(e) => setStandardForm({ ...standardForm, calDue: e.target.value })} />
                </div>
              </div>
              <div className="btn-row">
                <button className="primary" onClick={handleAddStandard} disabled={savingStandard}>
                  {savingStandard ? "Adding…" : "Add Standard"}
                </button>
              </div>
            </div>
          )}

          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID Number</th>
                  <th>Manufacturer</th>
                  <th>Model</th>
                  <th>Description</th>
                  <th>Cal Due</th>
                  <th>Active</th>
                  {canEditCatalogs && <th></th>}
                </tr>
              </thead>
              <tbody>
                {standards?.map((s) => {
                  const overdue = s.active && new Date(s.calDue) < new Date();
                  return (
                    <tr key={s.id}>
                      <td className="mono">{s.idNumber}</td>
                      <td>{s.manufacturer}</td>
                      <td>{s.model}</td>
                      <td>{s.description}</td>
                      <td style={overdue ? { color: "var(--danger)", fontWeight: 600 } : undefined}>{new Date(s.calDue).toLocaleDateString()}{overdue ? " (overdue)" : ""}</td>
                      <td>{s.active ? "Yes" : "No"}</td>
                      {canEditCatalogs && (
                        <td>
                          <button type="button" className="flag-btn" onClick={() => handleToggleStandardActive(s)}>
                            {s.active ? "Retire" : "Reactivate"}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {standards?.length === 0 && (
                  <tr><td colSpan={canEditCatalogs ? 7 : 6} className="muted">No reference standards on file yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "measurements" && (
        <div>
          <div className="panel">
            <h3>Measurement Setup</h3>
            <p className="muted small">
              Pick what a procedure's calibration table actually measures, and the Units column on every job that
              uses it becomes a dropdown limited to the right choices (e.g. Temperature → °C/°F/K) instead of a
              technician free-typing it row by row. Procedures with a checklist-style table (no numeric readings)
              aren't listed here — there's nothing to configure.
            </p>
            {unitsError && <div className="error-box">{unitsError}</div>}
            {!measureProcedures ? (
              <div className="muted small">Loading…</div>
            ) : measurableProcedures.length === 0 ? (
              <div className="muted small">No procedures with a configurable Units column.</div>
            ) : (
              measurableProcedures.map((p) => {
                const current = unitColumnOf(p);
                const draft = draftFor(p);
                const saving = savingUnitsFor === p.id;
                return (
                  <div key={p.id} className="panel" style={{ background: "var(--neutral-bg)" }}>
                    <div className="field-row" style={{ alignItems: "flex-end" }}>
                      <div style={{ minWidth: 220 }}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div className="muted small">
                          Current: {current?.type === "select" ? `Dropdown — ${current.options?.join(", ")}` : "Free text (any value allowed)"}
                        </div>
                      </div>
                      {canEditCatalogs ? (
                        <>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>Measuring</label>
                            <select
                              value={draft.preset}
                              onChange={(e) => {
                                const preset = e.target.value;
                                const options = MEASUREMENT_TYPE_PRESETS[preset]?.join(", ") ?? draft.options;
                                setDraft(p.id, { preset, options });
                              }}
                            >
                              {Object.keys(MEASUREMENT_TYPE_PRESETS).map((k) => (
                                <option key={k} value={k}>{k}</option>
                              ))}
                            </select>
                          </div>
                          <div className="field" style={{ marginBottom: 0, flex: 2 }}>
                            <label>Unit options (comma-separated)</label>
                            <input
                              type="text"
                              value={draft.options}
                              onChange={(e) => setDraft(p.id, { preset: draft.preset, options: e.target.value })}
                              placeholder="e.g. °C, °F, K"
                            />
                          </div>
                          <div className="btn-row" style={{ marginBottom: 0 }}>
                            <button className="primary" disabled={saving} onClick={() => handleSaveUnits(p.id)}>
                              {saving ? "Saving…" : "Save"}
                            </button>
                            {current?.type === "select" && (
                              <button disabled={saving} onClick={() => handleRevertUnits(p.id)}>Revert to free text</button>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="muted small">Only Admin/Manager can change this.</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
