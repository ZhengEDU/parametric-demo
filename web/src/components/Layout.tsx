import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import type { RoleName } from "../api/types";

interface NavItem {
  to: string;
  label: string;
  roles?: RoleName[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/jobs", label: "My Jobs", roles: ["TECHNICIAN", "DOCUMENTATION"] },
  { to: "/review", label: "Review Queue", roles: ["MANAGER", "ADMIN", "AUDITOR"] },
  { to: "/records", label: "All Records", roles: ["MANAGER", "ADMIN", "AUDITOR"] },
  { to: "/documents", label: "Documents" },
  { to: "/templates", label: "Templates", roles: ["ADMIN", "AUDITOR", "MANAGER"] },
  { to: "/audit", label: "Audit Log", roles: ["MANAGER", "ADMIN", "AUDITOR"] },
  { to: "/admin", label: "Admin", roles: ["ADMIN", "AUDITOR", "MANAGER"] },
];

export function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const items = NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(user.role));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Parametric Demo
          <small>Calibration &amp; PM workflow</small>
        </div>
        <nav>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="userbox">
          <div>{user.fullName}</div>
          <div className="role">{user.role}</div>
          <button onClick={() => logout()}>Log out</button>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">DEVELOPMENT DEMO — NOT VALIDATED FOR PRODUCTION CALIBRATION USE</div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
