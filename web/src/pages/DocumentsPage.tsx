import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface DocumentRow {
  id: string;
  filename: string;
  status: string;
  generatedAt: string;
  calibrationRecord: { id: string; asset: { description: string; assetNumber: string; customer: { name: string } }; procedure: { name: string } };
  generatedBy: { fullName: string };
}

export function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentRow[] | null>(null);

  useEffect(() => {
    api.get<{ documents: DocumentRow[] }>("/documents").then((r) => setDocs(r.documents));
  }, []);

  return (
    <div>
      <h1>Generated Documents</h1>
      <div className="panel">
        {!docs ? (
          <div className="empty-state">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="empty-state">No documents generated yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Generated</th>
                  <th>Customer</th>
                  <th>Asset</th>
                  <th>Procedure</th>
                  <th>File</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td>{new Date(d.generatedAt).toLocaleString()}</td>
                    <td>{d.calibrationRecord.asset.customer.name}</td>
                    <td>
                      <Link to={`/records/${d.calibrationRecord.id}`}>{d.calibrationRecord.asset.description}</Link>
                      <div className="muted small">{d.calibrationRecord.asset.assetNumber}</div>
                    </td>
                    <td>{d.calibrationRecord.procedure.name}</td>
                    <td><a href={`/api/documents/${d.id}/download`}>{d.filename}</a></td>
                    <td>{d.generatedBy.fullName}</td>
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
