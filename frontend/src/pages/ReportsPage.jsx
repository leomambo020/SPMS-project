import { useState } from 'react';
import { reportsApi } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import {
  PageHeader, Card, StatusBadge, LoadingState, ErrorState, EmptyState, formatMoney,
} from '../components/ui';

function ReportCard({ title, children }) {
  return <Card title={title}>{children}</Card>;
}

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const staffing = useApi(() => reportsApi.staffing(), []);
  const attendance = useApi(() => reportsApi.attendance({ dateFrom, dateTo }), [dateFrom, dateTo]);
  const leave = useApi(() => reportsApi.leave(), []);
  const payroll = useApi(() => reportsApi.payroll(), []);

  return (
    <div>
      <PageHeader title="Reports" subtitle="HR analytics across the organization." />

      <div className="report-grid">
        <ReportCard title="Staffing summary">
          <StaffingTable data={staffing.data} loading={staffing.loading} error={staffing.error} onRetry={staffing.refetch} />
        </ReportCard>

        <ReportCard title="Attendance summary">
          <div className="filter-row mb">
            <label className="field">
              <span className="field-label">From</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">To</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
          </div>
          <AttendanceTable data={attendance.data} loading={attendance.loading} error={attendance.error} onRetry={attendance.refetch} />
        </ReportCard>

        <ReportCard title="Leave summary">
          <LeaveTable data={leave.data} loading={leave.loading} error={leave.error} onRetry={leave.refetch} />
        </ReportCard>

        <ReportCard title="Payroll summary">
          <PayrollTable data={payroll.data} loading={payroll.loading} error={payroll.error} onRetry={payroll.refetch} />
        </ReportCard>
      </div>
    </div>
  );
}

function ReportBody({ loading, error, onRetry, children }) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  return children;
}

function StaffingTable({ data, loading, error, onRetry }) {
  const rows = data?.data;
  return (
    <ReportBody loading={loading} error={error} onRetry={onRetry}>
      {rows?.length ? (
        <table className="table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Headcount</th>
              <th>Active</th>
              <th>On leave</th>
              <th>Exited</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dept_id}>
                <td>{r.dept_name}</td>
                <td>{r.headcount}</td>
                <td>{r.active_count}</td>
                <td>{r.on_leave_count}</td>
                <td>{r.exited_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState message="No staffing data." />
      )}
    </ReportBody>
  );
}

function AttendanceTable({ data, loading, error, onRetry }) {
  const rows = data?.data;
  const total = rows?.reduce((sum, r) => sum + Number(r.count || 0), 0) || 0;
  return (
    <ReportBody loading={loading} error={error} onRetry={onRetry}>
      {rows?.length ? (
        <table className="table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Count</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.status}>
                <td><StatusBadge status={r.status} /></td>
                <td>{r.count}</td>
                <td>{total ? Math.round((Number(r.count) / total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState message="No attendance data for this range." />
      )}
    </ReportBody>
  );
}

function LeaveTable({ data, loading, error, onRetry }) {
  const rows = data?.data;
  return (
    <ReportBody loading={loading} error={error} onRetry={onRetry}>
      {rows?.length ? (
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Status</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="capitalize">{r.leave_type}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState message="No leave data." />
      )}
    </ReportBody>
  );
}

function PayrollTable({ data, loading, error, onRetry }) {
  const rows = data?.data;
  return (
    <ReportBody loading={loading} error={error} onRetry={onRetry}>
      {rows?.length ? (
        <table className="table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Paid</th>
              <th>Total basic</th>
              <th>Total deductions</th>
              <th>Total net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.month}</td>
                <td>{r.employees_paid}</td>
                <td>{formatMoney(r.total_basic_salary)}</td>
                <td>{formatMoney(r.total_deductions)}</td>
                <td className="text-success">{formatMoney(r.total_net_pay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState message="No payroll data." />
      )}
    </ReportBody>
  );
}