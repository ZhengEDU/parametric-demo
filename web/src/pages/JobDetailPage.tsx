import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { FullRecord } from "../api/types";
import { RecordView } from "../components/RecordView";

export function JobDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [record, setRecord] = useState<FullRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ task: unknown; record: FullRecord }>(`/jobs/${taskId}`)
      .then((res) => setRecord(res.record))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load job"));
  }, [taskId]);

  if (error) return <div className="error-box">{error} — <Link to="/jobs">back to jobs</Link></div>;
  if (!record) return <div className="empty-state">Loading…</div>;
  return <RecordView record={record} onChanged={setRecord} />;
}
