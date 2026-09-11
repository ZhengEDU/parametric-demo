import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";

interface QueueRow {
  id: string;
  status: string;
  submittedAt: string | null;
  asset: { description: string; assetNumber: string; customer: { name: string } };
  procedure: { name: string };
  technician: { fullName: string };
}

export function ReviewQueuePage() {
  const [rows, setRows] = useState<QueueRow[] | null>(null);

  useEffect(() => {
    api.get<{ records: QueueRow[] }>("/review/queue").then((r) => setRows(r.records));
  }, []);

  return (
    <div>
      <h1>Review Queue</h1>
      <div className="panel">
        {!rows ? (
          <div className="empty-state">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">Nothing waiting for review.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Submitted</th>
                  <th>Customer</th>
                  <th>Asset</th>
                  <th>Procedure</th>
                  <th>Technician</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}</td>
                    <td>{r.asset.customer.name}</td>
                    <td>
                      <Link to={`/records/${r.id}`}>{r.asset.description}</Link>
                      <div className="muted small">{r.asset.assetNumber}</div>
                    </td>
                    <td>{r.procedure.name}</td>
                    <td>{r.technician.fullName}</td>
                    <td><StatusBadge value={r.status} /></td>
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
