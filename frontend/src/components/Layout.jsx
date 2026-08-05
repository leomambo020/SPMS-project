import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const ROLE_LABELS = {
  employee: 'Employee',
  supervisor: 'Supervisor',
  hr_admin: 'HR Admin',
};

function NavItem({ to, children, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      {children}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isHR = user?.role === 'hr_admin';
  const isSupervisor = user?.role === 'supervisor' || isHR;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">SP</span>
          <div>
            <div className="brand-name">SPMS</div>
            <div className="brand-sub">Personnel Management</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavItem to="/" end>Dashboard</NavItem>
          <NavItem to="/attendance">Attendance</NavItem>
          <NavItem to="/leave">My Leave</NavItem>
          <NavItem to="/payroll">Payroll</NavItem>
          <NavItem to="/appraisals">Appraisals</NavItem>

          {isSupervisor && <NavItem to="/leave/decisions">Leave Decisions</NavItem>}

          {isHR && (
            <>
              <div className="nav-section">Administration</div>
              <NavItem to="/employees">Employees</NavItem>
              <NavItem to="/departments">Departments</NavItem>
              <NavItem to="/reports">Reports</NavItem>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{user?.role?.[0]?.toUpperCase()}</div>
            <div>
              <div className="user-role">{ROLE_LABELS[user?.role] || user?.role}</div>
              <div className="user-id">Employee #{user?.employeeId}</div>
            </div>
          </div>
          <NavLink to="/change-password" className="nav-item small">Change Password</NavLink>
          <button className="btn btn-ghost btn-block" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}