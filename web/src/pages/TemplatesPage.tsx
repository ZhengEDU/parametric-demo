import { Fragment, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../state/AuthContext";
import type { WordTemplateRevision } from "../api/types";

export function TemplatesPage() {
  const { user } = useAuth();
  const [revisions, setRevisions] = useState<WordTemplateRevision[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ revisions: WordTemplateRevision[] }>("/templates").then((r) => setRevisions(r.revisions));
  }, []);

  async function generateTest(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/templates/${id}/generate-test`, {
        method: "POST",
        credentials: "include",
        headers: { "X-Parametric-Demo-Client": "1" },
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate test document");
    }
  }

  return (
    <div>
      <h1>Word Templates</h1>
      {error && <div className="error-box">{error}</div>}
      <div className="panel">
        {!revisions ? (
          <div className="empty-state">Loading…</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Revision</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>Used by procedures</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {revisions.map((rev) => (
                  <Fragment key={rev.id}>
                    <tr>
                      <td>{rev.wordTemplate.name}</td>
                      <td>{rev.revision}</td>
                      <td>{rev.status}</td>
                      <td>{new Date(rev.uploadedAt).toLocaleDateString()} {rev.uploadedBy ? `by ${rev.uploadedBy.fullName}` : ""}</td>
                      <td>{rev.activeForProcedures.map((p) => p.name).join(", ") || "—"}</td>
                      <td className="btn-row">
                        <button onClick={() => setExpanded(expanded === rev.id ? null : rev.id)}>
                          {expanded === rev.id ? "Hide mappings" : "View mappings"}
                        </button>
                        {user?.role === "ADMIN" && <button onClick={() => generateTest(rev.id)}>Generate Test Doc</button>}
                      </td>
                    </tr>
                    {expanded === rev.id && (
                      <tr>
                        <td colSpan={6}>
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr><th>Field Key</th><th>Placeholder</th><th>Description</th></tr>
                              </thead>
                              <tbody>
                                {rev.fieldMappings.map((m) => (
                                  <tr key={m.id}>
                                    <td className="mono">{m.fieldKey}</td>
                                    <td className="mono">{m.placeholderTag}</td>
                                    <td>{m.description}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
