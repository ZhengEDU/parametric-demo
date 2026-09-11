import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { CalibrationTask } from "../api/types";
import { StatusBadge } from "../components/StatusBadge";

export function MyJobsPage() {
  const [tasks, setTasks] = useState<CalibrationTask[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<{ tasks: CalibrationTask[] }>("/jobs/mine").then((r) => setTasks(r.tasks));
  }, []);

  return (
    <div>
      <h1>My Jobs</h1>
      <div className="panel">
        {!tasks ? (
          <div className="empty-state">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">No jobs assigned to you.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Scheduled</th>
                  <th>Customer</th>
                  <th>Asset</th>
                  <th>Procedure</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="clickable-row" onClick={() => navigate(`/jobs/${t.id}`)}>
                    <td>{new Date(t.scheduledDate).toLocaleDateString()}</td>
                    <td>{t.asset.customer.name}</td>
                    <td>
                      <Link to={`/jobs/${t.id}`}>{t.asset.description}</Link>
                      <div className="muted small">{t.asset.assetNumber}</div>
                    </td>
                    <td>{t.procedure.name}</td>
                    <td><StatusBadge value={t.calibrationRecord?.status} /></td>
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
