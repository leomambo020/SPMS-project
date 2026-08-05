import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { appraisalsApi, employeesApi } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import {
  PageHeader, Card, Field, FormError, LoadingState, ErrorState,
  EmptyState, Pagination,
} from '../components/ui';

function scoreTone(score) {
  if (score >= 80) return 'success';
  if (score >= 60) return 'info';
  if (score >= 40) return 'warning';
  return 'danger';
}

export default function AppraisalsPage() {
  const { user } = useAuth();
  const canSubmit = user?.role === 'supervisor' || user?.role === 'hr_admin';
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    employeeId: '',
    period: '',
    score: '',
    comments: '',
  });
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, error, refetch } = useApi(
    () => appraisalsApi.list({ page, limit: 20 }),
    [page]
  );

  const { data: employeesData } = useApi(
    () => (canSubmit ? employeesApi.list({ limit: 100 }) : Promise.resolve(null)),
    [canSubmit]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const score = Number(form.score);
    if (!form.employeeId) {
      setFormError('Employee is required.');
      return;
    }
    if (!form.period.trim()) {
      setFormError('Period is required (e.g. 2026-Q2).');
      return;
    }
    if (score < 0 || score > 100) {
      setFormError('Score must be between 0 and 100.');
      return;
    }

    setSubmitting(true);
    try {
      await appraisalsApi.submit({
        employeeId: Number(form.employeeId),
        period: form.period.trim(),
        score,
        comments: form.comments || undefined,
      });
      setFormSuccess('Appraisal submitted.');
      setForm((f) => ({ ...f, employeeId: '', score: '', comments: '' }));
      refetch();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Appraisals"
        subtitle={
          canSubmit
            ? 'Submit performance appraisals and view appraisal history.'
            : 'View your performance appraisal history.'
        }
      />

      {canSubmit && (
        <div className="two-col">
          <Card title="Submit appraisal">
            <form onSubmit={handleSubmit} className="stack">
              <Field label="Employee" required>
                <select value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} required>
                  <option value="">Select employee…</option>
                  {employeesData?.data?.map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      #{emp.employee_id} — {emp.full_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Period" required>
                <input
                  type="text"
                  value={form.period}
                  onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                  placeholder="e.g. 2026-Q2"
                  required
                />
              </Field>

              <Field label="Score (0–100)" required>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={form.score}
                  onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
                  placeholder="e.g. 85"
                  required
                />
              </Field>

              <Field label="Comments">
                <textarea
                  value={form.comments}
                  onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
                  rows={3}
                  placeholder="Optional comments"
                />
              </Field>

              {formSuccess && <div className="form-success">{formSuccess}</div>}
              <FormError error={formError} />

              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit appraisal'}
              </button>
            </form>
          </Card>
        </div>
      )}

      <Card title="Appraisal history">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data?.data?.length ? (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Period</th>
                  {user?.role !== 'employee' && <th>Employee ID</th>}
                  <th>Score</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((a) => (
                  <tr key={a.appraisal_id}>
                    <td>{a.period}</td>
                    {user?.role !== 'employee' && <td>{a.employee_id}</td>}
                    <td>
                      <span className={`badge badge-${scoreTone(a.score)}`}>{a.score}</span>
                    </td>
                    <td>{a.comments || '—'}</td>
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
          <EmptyState message="No appraisals found." />
        )}
      </Card>
    </div>
  );
}