import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { leaveApi } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import {
  PageHeader, Card, Field, FormError, StatusBadge, LoadingState, ErrorState,
  EmptyState, Pagination, formatDate,
} from '../components/ui';

const LEAVE_TYPES = ['annual', 'sick', 'compassionate'];

export default function LeavePage() {
  const { user } = useAuth();
  const isHR = user?.role === 'hr_admin';
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({});
  const [form, setForm] = useState({
    leaveType: 'annual',
    startDate: '',
    endDate: '',
    reason: '',
    employeeId: '',
  });
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, error, refetch } = useApi(
    () => leaveApi.list({ page, limit: 20, ...filters }),
    [page, filters]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (form.startDate > form.endDate) {
      setFormError('Start date cannot be after end date.');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason || undefined,
      };
      if (isHR && form.employeeId) body.employeeId = Number(form.employeeId);

      await leaveApi.apply(body);
      setFormSuccess('Leave request submitted.');
      setForm((f) => ({ ...f, startDate: '', endDate: '', reason: '' }));
      refetch();
    } catch (err) {
      setFormError(err.message);
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
      <PageHeader title="Leave Requests" subtitle="File a leave request and track its status." />

      <div className="two-col">
        <Card title={isHR ? 'File leave (on behalf of employee)' : 'File a leave request'}>
          <form onSubmit={handleSubmit} className="stack">
            {isHR && (
              <Field label="Employee ID (leave blank for self)" required>
                <input
                  type="number"
                  value={form.employeeId}
                  onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                  placeholder="e.g. 12"
                />
              </Field>
            )}

            <Field label="Leave type" required>
              <select
                value={form.leaveType}
                onChange={(e) => setForm((f) => ({ ...f, leaveType: e.target.value }))}
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </Field>

            <div className="two-field">
              <Field label="Start date" required>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  required
                />
              </Field>
              <Field label="End date" required>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  required
                />
              </Field>
            </div>

            <Field label="Reason">
              <textarea
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                rows={3}
                placeholder="Optional reason for leave"
              />
            </Field>

            {formSuccess && <div className="form-success">{formSuccess}</div>}
            <FormError error={formError} />

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
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
            <Field label="Status">
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </Field>
            {(filters.employeeId || filters.status) && (
              <button className="btn btn-outline btn-sm" onClick={() => { setFilters({}); setPage(1); }}>
                Clear filters
              </button>
            )}
          </div>
        </Card>
      </div>

      <Card title="Leave history">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data?.data?.length ? (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  {isHR && <th>Employee ID</th>}
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((l) => (
                  <tr key={l.leave_id}>
                    <td className="capitalize">{l.leave_type}</td>
                    {isHR && <td>{l.employee_id}</td>}
                    <td>{formatDate(l.start_date)}</td>
                    <td>{formatDate(l.end_date)}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td>{l.reason || '—'}</td>
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
          <EmptyState message="No leave requests found." />
        )}
      </Card>
    </div>
  );
}