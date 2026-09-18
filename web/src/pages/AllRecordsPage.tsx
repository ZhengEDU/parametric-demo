import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";

interface RecordRow {
  id: string;
  status: string;
  finalStatus: string | null;
  updatedAt: string;
  asset: { description: string; assetNumber: string; customer: { name: string }; nextCalibrationDueAt: string | null };
  procedure: { name: string };
  technician: { fullName: string };
  approval: { approvedAt: string } | null;
  syncEvents: { status: string }[];
}

const PAGE_SIZE = 50;
const ALL_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED_FOR_CORRECTION",
  "RESUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "DOCUMENT_GENERATED",
  "SYNCED_TO_CALIBRATION_CONTROL",
  "READY_FOR_RELEASE",
  "RELEASED",
];

export function AllRecordsPage() {
  const [rows, setRows] = useState<RecordRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dueSoon, setDueSoon] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, dueSoon, query]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), status: statusFilter });
      if (dueSoon) params.set("dueSoon", "true");
      if (query.trim()) params.set("q", query.trim());
      api
        .get<{ records: RecordRow[]; total: number }>(`/review/all?${params.toString()}`)
        .then((r) => {
          setRows(r.records);
          setTotal(r.total);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [page, statusFilter, dueSoon, query]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, page * PAGE_SIZE);

  return (
    <div>
      <h1>All Records</h1>
      <div className="panel">
        <div className="panel-header" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label>Search (customer, asset, serial, technician)</label>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" />
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
            <label>Filter by status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All statuses</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>&nbsp;</label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text)" }}>
              <input type="checkbox" style={{ width: "auto" }} checked={dueSoon} onChange={(e) => setDueSoon(e.target.checked)} />
              Due within 30 days
            </label>
          </div>
        </div>

        {!rows ? (
          <div className="empty-state">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">No records match.</div>
        ) : (
          <>
            <div className="table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
              <table>
                <thead>
                  <tr>
                    <th>Updated</th>
                    <th>Customer</th>
                    <th>Asset</th>
                    <th>Procedure</th>
                    <th>Technician</th>
                    <th>Status</th>
                    <th>Result</th>
                    <th>Next Due</th>
                    <th>Sync</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.updatedAt).toLocaleString()}</td>
                      <td>{r.asset.customer.name}</td>
                      <td>
                        <Link to={`/records/${r.id}`}>{r.asset.description}</Link>
                        <div className="muted small">{r.asset.assetNumber}</div>
                      </td>
                      <td>{r.procedure.name}</td>
                      <td>{r.technician.fullName}</td>
                      <td><StatusBadge value={r.status} /></td>
                      <td><StatusBadge value={r.finalStatus} /></td>
                      <td>{r.asset.nextCalibrationDueAt ? new Date(r.asset.nextCalibrationDueAt).toLocaleDateString() : "—"}</td>
                      <td><StatusBadge value={r.syncEvents[0]?.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="btn-row" style={{ marginTop: 12, justifyContent: "space-between" }}>
              <span className="muted small">
                Showing {rangeStart}–{rangeEnd} of {total.toLocaleString()} records
              </span>
              <div className="btn-row">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>Prev</button>
                <span className="small muted">Page {page} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
