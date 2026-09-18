import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { Customer, CustomerSite, EquipmentAsset, EquipmentModel, Procedure } from "../api/types";

const TODAY = new Date().toISOString().slice(0, 10);

export function NewJobPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Customer
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [newCustomerName, setNewCustomerName] = useState("");

  // Site
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [siteId, setSiteId] = useState<string>("");
  const [newSite, setNewSite] = useState({ label: "", addressLine1: "", addressLine2: "", city: "", state: "", zip: "" });

  // Asset
  const [assets, setAssets] = useState<EquipmentAsset[]>([]);
  const [assetQuery, setAssetQuery] = useState("");
  const [assetId, setAssetId] = useState<string>("");
  const [newAsset, setNewAsset] = useState({
    assetNumber: "",
    description: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    accuracy: "",
    range: "",
    calibrationIntervalMonths: "12",
  });

  // Model catalog typeahead — lets a tech adding a new asset type e.g.
  // "A01000X" and get "A01-000X" suggested back (see normalizeModelText on
  // the server), then autofill manufacturer/accuracy/range/interval/
  // procedure from the catalog entry instead of retyping a spec sheet.
  const [modelSuggestions, setModelSuggestions] = useState<EquipmentModel[]>([]);
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);
  const modelBlurTimer = useRef<ReturnType<typeof setTimeout>>();

  // Procedure + schedule
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [procedureId, setProcedureId] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState(TODAY);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get<{ customers: Customer[] }>(`/intake/customers?q=${encodeURIComponent(customerQuery)}`).then((r) => setCustomers(r.customers));
    }, 200);
    return () => clearTimeout(t);
  }, [customerQuery]);

  useEffect(() => {
    api.get<{ procedures: Procedure[] }>("/intake/procedures").then((r) => setProcedures(r.procedures));
  }, []);

  useEffect(() => {
    setSiteId("");
    setSites([]);
    setAssetId("");
    setAssets([]);
    if (!customerId) return;
    api.get<{ sites: CustomerSite[] }>(`/intake/customers/${customerId}/sites`).then((r) => setSites(r.sites));
  }, [customerId]);

  useEffect(() => {
    setAssetId("");
    if (!siteId) {
      setAssets([]);
      return;
    }
    const t = setTimeout(() => {
      api.get<{ assets: EquipmentAsset[] }>(`/intake/sites/${siteId}/assets?q=${encodeURIComponent(assetQuery)}`).then((r) => setAssets(r.assets));
    }, 200);
    return () => clearTimeout(t);
  }, [siteId, assetQuery]);

  const isNewCustomer = customerId === "__new__";
  const isNewSite = siteId === "__new__";
  const isNewAsset = assetId === "__new__";

  useEffect(() => {
    if (!isNewAsset || !newAsset.model.trim()) {
      setModelSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .get<{ models: EquipmentModel[] }>(`/equipment-models?q=${encodeURIComponent(newAsset.model.trim())}`)
        .then((r) => setModelSuggestions(r.models));
    }, 200);
    return () => clearTimeout(t);
  }, [isNewAsset, newAsset.model]);

  function selectModelSuggestion(m: EquipmentModel) {
    setNewAsset({
      ...newAsset,
      manufacturer: m.manufacturer,
      model: m.model,
      accuracy: m.accuracy ?? newAsset.accuracy,
      range: m.range ?? newAsset.range,
      calibrationIntervalMonths: m.calibrationIntervalMonths != null ? String(m.calibrationIntervalMonths) : newAsset.calibrationIntervalMonths,
    });
    if (m.defaultProcedureId) setProcedureId(m.defaultProcedureId);
    setShowModelSuggestions(false);
    setModelSuggestions([]);
  }

  async function handleSubmit() {
    setError(null);
    if (!procedureId) return setError("Select a procedure.");
    if (!scheduledDate) return setError("Select a scheduled date.");
    if (!isNewCustomer && !customerId) return setError("Select or add a customer.");
    if (!isNewSite && !siteId) return setError("Select or add a site.");
    if (!isNewAsset && !assetId) return setError("Select or add an asset.");

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { procedureId, scheduledDate };
      if (isNewCustomer) {
        if (!newCustomerName.trim()) throw new ApiError(400, "VALIDATION_ERROR", "New customer name is required");
        body.newCustomer = { name: newCustomerName.trim() };
      } else {
        body.customerId = customerId;
      }
      if (isNewSite) {
        body.newSite = newSite;
      } else {
        body.siteId = siteId;
      }
      if (isNewAsset) {
        body.newAsset = { ...newAsset, calibrationIntervalMonths: Number(newAsset.calibrationIntervalMonths) };
      } else {
        body.assetId = assetId;
      }
      const res = await api.post<{ taskId: string }>("/intake/jobs", body);
      navigate(`/jobs/${res.taskId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start calibration");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>New Calibration</h1>
      <p className="muted small">
        Pick the customer, site, and asset this visit is for — or add new ones on the fly — then start filling in
        calibration data. <Link to="/jobs">Back to My Jobs</Link>
      </p>

      {error && <div className="error-box">{error}</div>}

      <div className="panel">
        <h3>Customer</h3>
        <div className="field-row">
          <div className="field" style={{ flex: 2 }}>
            <label>Search customers</label>
            <input type="text" placeholder="Type to search…" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label>Customer</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new__">+ Add a new customer</option>
            </select>
          </div>
        </div>
        {isNewCustomer && (
          <div className="field">
            <label>New customer name</label>
            <input type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
          </div>
        )}
      </div>

      {(customerId || isNewCustomer) && (
        <div className="panel">
          <h3>Site</h3>
          {!isNewCustomer && (
            <div className="field">
              <label>Site</label>
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                <option value="">Select a site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} — {s.addressLine1}, {s.city} {s.state}
                  </option>
                ))}
                <option value="__new__">+ Add a new site</option>
              </select>
            </div>
          )}
          {(isNewSite || isNewCustomer) && (
            <div className="field-row">
              <div className="field"><label>Site label</label><input type="text" value={newSite.label} onChange={(e) => setNewSite({ ...newSite, label: e.target.value })} /></div>
              <div className="field"><label>Address line 1</label><input type="text" value={newSite.addressLine1} onChange={(e) => setNewSite({ ...newSite, addressLine1: e.target.value })} /></div>
              <div className="field"><label>Address line 2</label><input type="text" value={newSite.addressLine2} onChange={(e) => setNewSite({ ...newSite, addressLine2: e.target.value })} /></div>
              <div className="field"><label>City</label><input type="text" value={newSite.city} onChange={(e) => setNewSite({ ...newSite, city: e.target.value })} /></div>
              <div className="field"><label>State</label><input type="text" value={newSite.state} onChange={(e) => setNewSite({ ...newSite, state: e.target.value })} /></div>
              <div className="field"><label>ZIP</label><input type="text" value={newSite.zip} onChange={(e) => setNewSite({ ...newSite, zip: e.target.value })} /></div>
            </div>
          )}
        </div>
      )}

      {(siteId || isNewSite || isNewCustomer) && (
        <div className="panel">
          <h3>Asset / Unit Under Test</h3>
          {!isNewSite && !isNewCustomer && (
            <div className="field-row">
              <div className="field" style={{ flex: 2 }}>
                <label>Search assets (number, description, serial)</label>
                <input type="text" placeholder="Type to search…" value={assetQuery} onChange={(e) => setAssetQuery(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 2 }}>
                <label>Asset</label>
                <select
                  value={assetId}
                  onChange={(e) => {
                    setAssetId(e.target.value);
                    const asset = assets.find((a) => a.id === e.target.value);
                    if (asset?.defaultProcedureId) setProcedureId(asset.defaultProcedureId);
                  }}
                >
                  <option value="">Select an asset…</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.assetNumber} — {a.description} (S/N {a.serialNumber})</option>
                  ))}
                  <option value="__new__">+ Add a new asset</option>
                </select>
              </div>
            </div>
          )}
          {(isNewAsset || isNewSite || isNewCustomer) && (
            <div className="field-row">
              <div className="field"><label>Asset number</label><input type="text" value={newAsset.assetNumber} onChange={(e) => setNewAsset({ ...newAsset, assetNumber: e.target.value })} /></div>
              <div className="field"><label>Description</label><input type="text" value={newAsset.description} onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })} /></div>
              <div className="field"><label>Manufacturer</label><input type="text" value={newAsset.manufacturer} onChange={(e) => setNewAsset({ ...newAsset, manufacturer: e.target.value })} /></div>
              <div className="field typeahead">
                <label>Model</label>
                <input
                  type="text"
                  value={newAsset.model}
                  onChange={(e) => {
                    setNewAsset({ ...newAsset, model: e.target.value });
                    setShowModelSuggestions(true);
                  }}
                  onFocus={() => setShowModelSuggestions(true)}
                  onBlur={() => {
                    // Delay so a click on a suggestion registers before the list unmounts.
                    modelBlurTimer.current = setTimeout(() => setShowModelSuggestions(false), 150);
                  }}
                  placeholder="Type to match the catalog…"
                  autoComplete="off"
                />
                {showModelSuggestions && modelSuggestions.length > 0 && (
                  <div className="typeahead-menu">
                    {modelSuggestions.map((m) => (
                      <div
                        key={m.id}
                        className="typeahead-item"
                        onMouseDown={(e) => {
                          e.preventDefault(); // keep the input's focus/blur from firing before the click
                          clearTimeout(modelBlurTimer.current);
                          selectModelSuggestion(m);
                        }}
                      >
                        <div className="model">{m.model}</div>
                        <div className="manufacturer">{m.manufacturer}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="field"><label>Serial number</label><input type="text" value={newAsset.serialNumber} onChange={(e) => setNewAsset({ ...newAsset, serialNumber: e.target.value })} /></div>
              <div className="field"><label>Accuracy</label><input type="text" value={newAsset.accuracy} onChange={(e) => setNewAsset({ ...newAsset, accuracy: e.target.value })} /></div>
              <div className="field"><label>Range</label><input type="text" value={newAsset.range} onChange={(e) => setNewAsset({ ...newAsset, range: e.target.value })} /></div>
              <div className="field">
                <label>Calibration interval (months)</label>
                <input type="text" value={newAsset.calibrationIntervalMonths} onChange={(e) => setNewAsset({ ...newAsset, calibrationIntervalMonths: e.target.value })} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="panel">
        <h3>Procedure &amp; Schedule</h3>
        <div className="field-row">
          <div className="field">
            <label>Procedure</label>
            <select value={procedureId} onChange={(e) => setProcedureId(e.target.value)}>
              <option value="">Select a procedure…</option>
              {procedures.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Scheduled date</label>
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="btn-row">
        <button className="primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Starting…" : "Start Calibration"}
        </button>
      </div>
    </div>
  );
}
