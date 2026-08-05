import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { attendanceApi, leaveApi, payrollApi, appraisalsApi, departmentsApi } from '../api/endpoints';
import { PageHeader, Card, StatusBadge, LoadingState, ErrorState, EmptyState, formatDate, formatMoney } from '../components/ui';

const ROLE_LABELS = {
  employee: 'Employee',
  supervisor: 'Supervisor',
  hr_admin: 'HR Admin',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      attendanceApi.list({ limit: 5 }),
      leaveApi.list({ limit: 5 }),
      payrollApi.list({ limit: 5 }),
      appraisalsApi.list({ limit: 5 }),
      departmentsApi.list(),
    ])
      .then(([attendance, leave, payroll, appraisals, departments]) => {
        if (!cancelled) {
          setData({ attendance, leave, payroll, appraisals, departments });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <LoadingState label="Loading dashboard…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const deptName = data.departments?.data?.find((d) => d.dept_id === user?.deptId)?.dept_name;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${ROLE_LABELS[user?.role] || 'User'}`}
        subtitle={
          user?.deptId
            ? `Employee #${user.employeeId} · ${deptName || `Department #${user.deptId}`}`
            : `Employee #${user.employeeId}`
        }
      />

      <div className="stat-grid">
        <Card className="stat-card">
          <div className="stat-value">{data.attendance?.pagination?.total ?? 0}</div>
          <div className="stat-label">Attendance records</div>
        </Card>
        <Card className="stat-card">
          <div className="stat-value">{data.leave?.pagination?.total ?? 0}</div>
          <div className="stat-label">Leave requests</div>
        </Card>
        <Card className="stat-card">
          <div className="stat-value">{data.payroll?.pagination?.total ?? 0}</div>
          <div className="stat-label">Payslips</div>
        </Card>
        <Card className="stat-card">
          <div className="stat-value">{data.appraisals?.pagination?.total ?? 0}</div>
          <div className="stat-label">Appraisals</div>
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card title="Recent Attendance">
          {data.attendance?.data?.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time in</th>
                  <th>Time out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.attendance.data.map((a) => (
                  <tr key={a.attendance_id}>
                    <td>{formatDate(a.date)}</td>
                    <td>{a.time_in || '—'}</td>
                    <td>{a.time_out || '—'}</td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No attendance records yet." />
          )}
        </Card>

        <Card title="Recent Leave">
          {data.leave?.data?.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.leave.data.map((l) => (
                  <tr key={l.leave_id}>
                    <td className="capitalize">{l.leave_type}</td>
                    <td>{formatDate(l.start_date)}</td>
                    <td>{formatDate(l.end_date)}</td>
                    <td><StatusBadge status={l.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No leave requests yet." />
          )}
        </Card>

        <Card title="Recent Payroll">
          {data.payroll?.data?.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Basic</th>
                  <th>Deductions</th>
                  <th>Net pay</th>
                </tr>
              </thead>
              <tbody>
                {data.payroll.data.map((p) => (
                  <tr key={p.payroll_id}>
                    <td>{formatDate(p.month)}</td>
                    <td>{formatMoney(p.basic_salary)}</td>
                    <td>{formatMoney(p.deductions)}</td>
                    <td>{formatMoney(p.net_pay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No payroll records yet." />
          )}
        </Card>

        <Card title="Recent Appraisals">
          {data.appraisals?.data?.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Score</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {data.appraisals.data.map((a) => (
                  <tr key={a.appraisal_id}>
                    <td>{a.period}</td>
                    <td>{a.score}</td>
                    <td>{a.comments || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No appraisals yet." />
          )}
        </Card>
      </div>
    </div>
  );
}