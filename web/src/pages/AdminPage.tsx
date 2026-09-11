import { useEffect, useState } from "react";
import { api } from "../api/client";

interface AdminUser { id: string; email: string; fullName: string; role: string; active: boolean }
interface AdminAsset { id: string; assetNumber: string; description: string; customer: { name: string }; site: { label: string }; defaultProcedure: { name: string } | null }
interface AdminCustomer { id: string; name: string; sites: { id: string; label: string; city: string; state: string }[]; contacts: { id: string; name: string; phone: string | null; email: string | null }[]; assets: unknown[] }

export function AdminPage() {
  const [tab, setTab] = useState<"users" | "customers" | "assets">("users");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [customers, setCustomers] = useState<AdminCustomer[] | null>(null);
  const [assets, setAssets] = useState<AdminAsset[] | null>(null);

  useEffect(() => {
    api.get<{ users: AdminUser[] }>("/admin/users").then((r) => setUsers(r.users));
    api.get<{ customers: AdminCustomer[] }>("/admin/customers").then((r) => setCustomers(r.customers));
    api.get<{ assets: AdminAsset[] }>("/admin/assets").then((r) => setAssets(r.assets));
  }, []);

  return (
    <div>
      <h1>Admin</h1>
      <p className="muted small">Read-only for this demo — user, customer, and asset management screens are a follow-up.</p>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button className={tab === "users" ? "primary" : ""} onClick={() => setTab("users")}>Users</button>
        <button className={tab === "customers" ? "primary" : ""} onClick={() => setTab("customers")}>Customers</button>
        <button className={tab === "assets" ? "primary" : ""} onClick={() => setTab("assets")}>Assets</button>
      </div>

      {tab === "users" && (
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th></tr></thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id}><td>{u.fullName}</td><td>{u.email}</td><td>{u.role}</td><td>{u.active ? "Yes" : "No"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "customers" && (
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>Sites</th><th>Contacts</th></tr></thead>
            <tbody>
              {customers?.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.sites.map((s) => `${s.label} (${s.city}, ${s.state})`).join("; ")}</td>
                  <td>{c.contacts.map((ct) => ct.name).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "assets" && (
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>Asset #</th><th>Description</th><th>Customer</th><th>Site</th><th>Default Procedure</th></tr></thead>
            <tbody>
              {assets?.map((a) => (
                <tr key={a.id}>
                  <td className="mono">{a.assetNumber}</td>
                  <td>{a.description}</td>
                  <td>{a.customer.name}</td>
                  <td>{a.site.label}</td>
                  <td>{a.defaultProcedure?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
