import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AuditEvent } from "../api/types";

export function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [entityType, setEntityType] = useState("");

  useEffect(() => {
    const qs = entityType ? `?entityType=${encodeURIComponent(entityType)}` : "";
    api.get<{ events: AuditEvent[] }>(`/audit${qs}`).then((r) => setEvents(r.events));
  }, [entityType]);

  return (
    <div>
      <h1>Audit Log</h1>
      <div className="panel">
        <div className="field" style={{ maxWidth: 260 }}>
          <label>Filter by entity type</label>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">All</option>
            <option value="CalibrationRecord">Calibration Record</option>
            <option value="User">User</option>
          </select>
        </div>
        {!events ? (
          <div className="empty-state">Loading…</div>
        ) : events.length === 0 ? (
          <div className="empty-state">No events.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>Entity</th>
                  <th>User</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="mono small">{e.eventType}</td>
                    <td className="small">{e.entityType}{e.entityId ? ` #${e.entityId.slice(0, 8)}` : ""}</td>
                    <td>{e.user?.fullName ?? "system"}</td>
                    <td>{e.summary}</td>
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
