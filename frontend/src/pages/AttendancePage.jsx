import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { attendanceApi } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import {
  PageHeader, Card, Field, FormError, StatusBadge, LoadingState, ErrorState,
  EmptyState, Pagination, formatDate,
} from '../components/ui';

export default function AttendancePage() {
  const { user } = useAuth();
  const isHR = user?.role === 'hr_admin';
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({});
  const [punchForm, setPunchForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    timeIn: '',
    timeOut: '',
    status: 'present',
    employeeId: '',
  });
  const [punchError, setPunchError] = useState(null);
  const [punchSuccess, setPunchSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, error, refetch } = useApi(
    () => attendanceApi.list({ page, limit: 20, ...filters }),
    [page, filters]
  );

  const handlePunch = async (e) => {
    e.preventDefault();
    setPunchError(null);
    setPunchSuccess(null);
    setSubmitting(true);
    try {
      const body = {
        date: punchForm.date,
        timeIn: punchForm.timeIn || null,
        timeOut: punchForm.timeOut || null,
        status: punchForm.status,
      };
      if (isHR && punchForm.employeeId) body.employeeId = Number(punchForm.employeeId);

      await attendanceApi.punch(body);
      setPunchSuccess('Attendance recorded.');
      setPunchForm((f) => ({ ...f, timeIn: '', timeOut: '' }));
      refetch();
    } catch (err) {
      setPunchError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value || undefined }));
  };

  return (
    <div>
      <PageHeader title="Attendance" subtitle={isHR ? 'Record and view attendance across the organization.' : 'Punch in/out and view your attendance history.'} />

      <div className="two-col">
        <Card title={isHR ? 'Record attendance' : 'Punch attendance'}>
          <form onSubmit={handlePunch} className="stack">
            {isHR && (
              <Field label="Employee ID (leave blank for self)" required>
                <input
                  type="number"
                  value={punchForm.employeeId}
                  onChange={(e) => setPunchForm((f) => ({ ...f, employeeId: e.target.value }))}
                  placeholder="e.g. 12"
                />
              </Field>
            )}

            <Field label="Date" required>
              <input
                type="date"
                value={punchForm.date}
                onChange={(e) => setPunchForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </Field>

            <div className="two-field">
              <Field label="Time in">
                <input
                  type="time"
                  value={punchForm.timeIn}
                  onChange={(e) => setPunchForm((f) => ({ ...f, timeIn: e.target.value }))}
                />
              </Field>
              <Field label="Time out">
                <input
                  type="time"
                  value={punchForm.timeOut}
                  onChange={(e) => setPunchForm((f) => ({ ...f, timeOut: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Status" required>
              <select
                value={punchForm.status}
                onChange={(e) => setPunchForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
              </select>
            </Field>

            {punchSuccess && <div className="form-success">{punchSuccess}</div>}
            <FormError error={punchError} />

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save attendance'}
            </button>
          </form>
        </Card>

        <Card title="Filters">
          <div className="stack">
            {isHR && (
              <Field label="Employee ID">
                <input
                  type="number"
                  value={filters.employeeId || ''}
                  onChange={(e) => handleFilterChange('employeeId', e.target.value)}
                  placeholder="All employees"
                />
              </Field>
            )}
            <div className="two-field">
              <Field label="From">
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                />
              </Field>
              <Field label="To">
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Status">
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
              </select>
            </Field>
            {(filters.employeeId || filters.dateFrom || filters.dateTo || filters.status) && (
              <button className="btn btn-outline btn-sm" onClick={() => { setFilters({}); setPage(1); }}>
                Clear filters
              </button>
            )}
          </div>
        </Card>
      </div>

      <Card title="Attendance records">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data?.data?.length ? (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  {isHR && <th>Employee ID</th>}
                  <th>Time in</th>
                  <th>Time out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((a) => (
                  <tr key={a.attendance_id}>
                    <td>{formatDate(a.date)}</td>
                    {isHR && <td>{a.employee_id}</td>}
                    <td>{a.time_in || '—'}</td>
                    <td>{a.time_out || '—'}</td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState message="No attendance records found." />
        )}
      </Card>
    </div>
  );
}