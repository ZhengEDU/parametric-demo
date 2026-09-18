import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiBase } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { StatusBadge } from "./StatusBadge";
import type { AssetHistoryRecord } from "../api/types";

const PRIVILEGED_ROLES = ["MANAGER", "ADMIN", "AUDITOR", "DOCUMENTATION"];
// Most assets have a handful of real visits — an asset with a long synthetic
// or decades-long history shouldn't turn "look at this job" into "scroll
// through a hundred-row table" by default.
const COLLAPSED_ROW_COUNT = 8;

/** Shown on a calibration record so a technician on site (or a reviewer)
 * can see every prior visit to this same physical asset — and pull up the
 * certificate from any of them — without leaving the job they're on. */
export function UnitHistoryPanel({ assetId, excludeRecordId }: { assetId: string; excludeRecordId?: string }) {
  const { user } = useAuth();
  const [records, setRecords] = useState<AssetHistoryRecord[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setRecords(null);
    setExpanded(false);
    api.get<{ records: AssetHistoryRecord[] }>(`/assets/${assetId}/history`).then((r) => setRecords(r.records));
  }, [assetId]);

  const history = (records ?? []).filter((r) => r.id !== excludeRecordId);
  const visible = expanded ? history : history.slice(0, COLLAPSED_ROW_COUNT);

  return (
    <div className="panel">
      <h3>Unit History</h3>
      {!records ? (
        <div className="muted small">Loading…</div>
      ) : history.length === 0 ? (
        <div className="muted small">No prior calibrations on file for this asset.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Procedure</th>
                <th>Technician</th>
                <th>Status</th>
                <th>Result</th>
                <th>Certificate</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const date = r.approval?.approvedAt ?? r.submittedAt ?? r.createdAt;
                const canViewFull = !!user && (PRIVILEGED_ROLES.includes(user.role) || r.technician.id === user.id);
                const doc = r.generatedDocuments[0];
                return (
                  <tr key={r.id}>
                    <td>{new Date(date).toLocaleDateString()}</td>
                    <td>{r.procedure.name}</td>
                    <td>{r.technician.fullName}</td>
                    <td><StatusBadge value={r.status} /></td>
                    <td><StatusBadge value={r.finalStatus} /></td>
                    <td>
                      {doc && (
                        <a className="btn" href={`${apiBase}/api/documents/${doc.id}/download`} target="_blank" rel="noreferrer">
                          Download
                        </a>
                      )}
                      {canViewFull && (
                        <Link to={`/records/${r.id}`} className="muted small" style={{ marginLeft: doc ? 8 : 0 }}>
                          View record
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {history.length > COLLAPSED_ROW_COUNT && (
            <button type="button" className="muted small" style={{ marginTop: 8 }} onClick={() => setExpanded(!expanded)}>
              {expanded ? "Show fewer" : `Show all ${history.length} prior visits`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
