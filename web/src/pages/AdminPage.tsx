import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../state/AuthContext";
import type { EquipmentModel, Procedure, ReferenceStandard } from "../api/types";

interface AdminUser { id: string; email: string; fullName: string; role: string; active: boolean }
interface AdminAsset { id: string; assetNumber: string; description: string; customer: { name: string }; site: { label: string }; defaultProcedure: { name: string } | null }
interface AdminCustomer { id: string; name: string; sites: { id: string; label: string; city: string; state: string }[]; contacts: { id: string; name: string; phone: string | null; email: string | null }[]; assets: unknown[] }

const EMPTY_MODEL_FORM = { manufacturer: "", model: "", description: "", accuracy: "", range: "", calibrationIntervalMonths: "", defaultProcedureId: "" };
const EMPTY_STANDARD_FORM = { idNumber: "", manufacturer: "", model: "", description: "", calDue: "" };

export function AdminPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [tab, setTab] = useState<"users" | "customers" | "assets" | "models" | "standards">("users");
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

  function reloadModels() {
    api.get<{ models: EquipmentModel[] }>("/equipment-models").then((r) => setModels(r.models));
  }

  function reloadStandards() {
    api.get<{ standards: ReferenceStandard[] }>("/standards").then((r) => setStandards(r.standards));
  }

  useEffect(() => {
    api.get<{ users: AdminUser[] }>("/admin/users").then((r) => setUsers(r.users));
    api.get<{ customers: AdminCustomer[] }>("/admin/customers").then((r) => setCustomers(r.customers));
    api.get<{ assets: AdminAsset[] }>("/admin/assets").then((r) => setAssets(r.assets));
    reloadModels();
    reloadStandards();
    api.get<{ procedures: Procedure[] }>("/intake/procedures").then((r) => setProcedures(r.procedures));
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

  return (
    <div>
      <h1>Admin</h1>
      <p className="muted small">
        Users, customers, and assets are read-only for this demo. The equipment model catalog below is editable —
        entries here drive the model typeahead on the New Calibration form.
      </p>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button className={tab === "users" ? "primary" : ""} onClick={() => setTab("users")}>Users</button>
        <button className={tab === "customers" ? "primary" : ""} onClick={() => setTab("customers")}>Customers</button>
        <button className={tab === "assets" ? "primary" : ""} onClick={() => setTab("assets")}>Assets</button>
        <button className={tab === "models" ? "primary" : ""} onClick={() => setTab("models")}>Models</button>
        <button className={tab === "standards" ? "primary" : ""} onClick={() => setTab("standards")}>Standards</button>
      </div>

      {tab === "users" && (
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

      {tab === "customers" && (
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

      {tab === "assets" && (
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
          {isAdmin && (
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
                  {isAdmin && <th></th>}
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
                    {isAdmin && (
                      <td>
                        <button type="button" className="flag-btn" title="Remove" onClick={() => handleDeleteModel(m.id)}>✕</button>
                      </td>
                    )}
                  </tr>
                ))}
                {models?.length === 0 && (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="muted">No models in the catalog yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "standards" && (
        <div>
          {isAdmin && (
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
                  {isAdmin && <th></th>}
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
                      {isAdmin && (
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
                  <tr><td colSpan={isAdmin ? 7 : 6} className="muted">No reference standards on file yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
