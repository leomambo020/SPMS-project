import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AttendancePage from './pages/AttendancePage';
import LeavePage from './pages/LeavePage';
import LeaveDecisionsPage from './pages/LeaveDecisionsPage';
import PayrollPage from './pages/PayrollPage';
import AppraisalsPage from './pages/AppraisalsPage';
import EmployeesPage from './pages/EmployeesPage';
import DepartmentsPage from './pages/DepartmentsPage';
import ReportsPage from './pages/ReportsPage';
import ChangePasswordPage from './pages/ChangePasswordPage';

function RequireAuth({ children }) {
  const { authenticated } = useAuth();
  if (!authenticated) return <Navigate to="/login" replace />;
  return children;
}

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
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
        <Route path="/" element={<DashboardPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/leave" element={<LeavePage />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/appraisals" element={<AppraisalsPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />

        {/* Supervisor + HR */}
        <Route
          path="/leave/decisions"
          element={
            <RequireRole roles={['supervisor', 'hr_admin']}>
              <LeaveDecisionsPage />
            </RequireRole>
          }
        />

        {/* HR only */}
        <Route
          path="/employees"
          element={
            <RequireRole roles={['hr_admin']}>
              <EmployeesPage />
            </RequireRole>
          }
        />
        <Route
          path="/departments"
          element={
            <RequireRole roles={['hr_admin']}>
              <DepartmentsPage />
            </RequireRole>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireRole roles={['hr_admin']}>
              <ReportsPage />
            </RequireRole>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}