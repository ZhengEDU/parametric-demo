import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { DashboardStats } from "../api/types";
import { useAuth } from "../state/AuthContext";

const TILES: { key: keyof DashboardStats; label: string }[] = [
  { key: "assignedToday", label: "Assigned Today" },
  { key: "draft", label: "Draft" },
  { key: "awaitingReview", label: "Awaiting Review" },
  { key: "returnedForCorrection", label: "Returned For Correction" },
  { key: "approvedToday", label: "Approved Today" },
  { key: "documentsGenerated", label: "Documents Generated" },
  { key: "syncFailures", label: "Sync Failures" },
  { key: "manualTranscriptionStepsEliminated", label: "Manual Steps Eliminated" },
];

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.get<DashboardStats>("/dashboard").then(setStats).catch(() => setStats(null));
  }, []);

  return (
    <div>
      <h1>Welcome, {user?.fullName}</h1>
      <p className="muted">Role: {user?.role}</p>
      {!stats ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <div className="kpi-grid">
          {TILES.map((t) => (
            <div className="kpi-tile" key={t.key}>
              <div className="value">{stats[t.key]}</div>
              <div className="label">{t.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
