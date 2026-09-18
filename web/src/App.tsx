import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./state/AuthContext";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MyJobsPage } from "./pages/MyJobsPage";
import { NewJobPage } from "./pages/NewJobPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { RecordDetailPage } from "./pages/RecordDetailPage";
import { ReviewQueuePage } from "./pages/ReviewQueuePage";
import { AllRecordsPage } from "./pages/AllRecordsPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { AdminPage } from "./pages/AdminPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="empty-state">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/jobs" element={<MyJobsPage />} />
        <Route path="/jobs/new" element={<NewJobPage />} />
        <Route path="/jobs/:taskId" element={<JobDetailPage />} />
        <Route path="/records" element={<AllRecordsPage />} />
        <Route path="/records/:recordId" element={<RecordDetailPage />} />
        <Route path="/review" element={<ReviewQueuePage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/audit" element={<AuditLogPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
