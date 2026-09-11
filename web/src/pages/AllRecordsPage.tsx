import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";

interface RecordRow {
  id: string;
  status: string;
  finalStatus: string | null;
  updatedAt: string;
  asset: { description: string; assetNumber: string; customer: { name: string } };
  procedure: { name: string };
  technician: { fullName: string };
  approval: { approvedAt: string } | null;
  syncEvents: { status: string }[];
}

export function AllRecordsPage() {
  const [rows, setRows] = useState<RecordRow[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    api.get<{ records: RecordRow[] }>("/review/all").then((r) => setRows(r.records));
  }, []);

  const statuses = useMemo(() => Array.from(new Set((rows ?? []).map((r) => r.status))).sort(), [rows]);
  const filtered = useMemo(() => (rows ?? []).filter((r) => statusFilter === "ALL" || r.status === statusFilter), [rows, statusFilter]);

  return (
    <div>
      <h1>All Records</h1>
      <div className="panel">
        <div className="panel-header">
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label>Filter by status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
              ))}
            </select>
          </div>
        </div>
        {!rows ? (
          <div className="empty-state">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No records match.</div>
        ) : (
          <div className="table-wrap">
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
                  <th>Sync</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
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
                    <td><StatusBadge value={r.syncEvents[0]?.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
