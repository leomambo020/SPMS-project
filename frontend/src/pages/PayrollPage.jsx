import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { payrollApi, employeesApi } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import {
  PageHeader, Card, Field, FormError, LoadingState, ErrorState,
  EmptyState, Pagination, formatDate, formatMoney,
} from '../components/ui';

export default function PayrollPage() {
  const { user } = useAuth();
  const isHR = user?.role === 'hr_admin';
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    employeeId: '',
    month: new Date().toISOString().slice(0, 7) + '-01',
    basicSalary: '',
    deductions: '',
    datePaid: '',
  });
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, error, refetch } = useApi(
    () => payrollApi.list({ page, limit: 20 }),
    [page]
  );

  // Only HR sees the employee picker; employees just view their own payslips.
  const { data: employeesData } = useApi(
    () => (isHR ? employeesApi.list({ limit: 100 }) : Promise.resolve(null)),
    [isHR]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const basic = Number(form.basicSalary);
    const deductions = Number(form.deductions || 0);
    if (!form.employeeId) {
      setFormError('Employee is required.');
      return;
    }
    if (!form.basicSalary || basic < 0) {
      setFormError('Basic salary must be a non-negative number.');
      return;
    }
    if (deductions < 0) {
      setFormError('Deductions must be non-negative.');
      return;
    }
    if (deductions > basic) {
      setFormError('Deductions cannot exceed basic salary.');
      return;
    }

    setSubmitting(true);
    try {
      await payrollApi.process({
        employeeId: Number(form.employeeId),
        month: form.month,
        basicSalary: basic,
        deductions,
        datePaid: form.datePaid || undefined,
      });
      setFormSuccess('Payroll processed. Payslip notice emailed.');
      setForm((f) => ({ ...f, employeeId: '', basicSalary: '', deductions: '' }));
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
        title="Payroll"
        subtitle={isHR ? 'Process monthly payroll and view all records.' : 'View your payslips.'}
      />

      {isHR && (
        <div className="two-col">
          <Card title="Process payroll">
            <form onSubmit={handleSubmit} className="stack">
              <Field label="Employee" required>
                <select
                  value={form.employeeId}
                  onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                  required
                >
                  <option value="">Select employee…</option>
                  {employeesData?.data?.map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      #{emp.employee_id} — {emp.full_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Month (1st of month)" required>
                <input
                  type="month"
                  value={form.month.slice(0, 7)}
                  onChange={(e) => setForm((f) => ({ ...f, month: e.target.value + '-01' }))}
                  required
                />
              </Field>

              <Field label="Basic salary" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.basicSalary}
                  onChange={(e) => setForm((f) => ({ ...f, basicSalary: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </Field>

              <Field label="Deductions">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.deductions}
                  onChange={(e) => setForm((f) => ({ ...f, deductions: e.target.value }))}
                  placeholder="0.00"
                />
              </Field>

              <Field label="Date paid">
                <input
                  type="date"
                  value={form.datePaid}
                  onChange={(e) => setForm((f) => ({ ...f, datePaid: e.target.value }))}
                />
              </Field>

              {formSuccess && <div className="form-success">{formSuccess}</div>}
              <FormError error={formError} />

              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Processing…' : 'Process payroll'}
              </button>
            </form>
          </Card>

          <Card title="Summary">
            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState error={error} onRetry={refetch} />
            ) : data?.data?.length ? (
              <div className="stack">
                {data.data.slice(0, 6).map((p) => (
                  <div className="summary-row" key={p.payroll_id}>
                    <span>{formatDate(p.month)} — #{p.employee_id}</span>
                    <span className="text-success">{formatMoney(p.net_pay)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No payroll records yet." />
            )}
          </Card>
        </div>
      )}

      <Card title={isHR ? 'All payroll records' : 'Your payslips'}>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data?.data?.length ? (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Month</th>
                  {isHR && <th>Employee ID</th>}
                  <th>Basic salary</th>
                  <th>Deductions</th>
                  <th>Net pay</th>
                  <th>Date paid</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p) => (
                  <tr key={p.payroll_id}>
                    <td>{formatDate(p.month)}</td>
                    {isHR && <td>{p.employee_id}</td>}
                    <td>{formatMoney(p.basic_salary)}</td>
                    <td>{formatMoney(p.deductions)}</td>
                    <td className="text-success">{formatMoney(p.net_pay)}</td>
                    <td>{formatDate(p.date_paid)}</td>
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
          <EmptyState message="No payroll records found." />
        )}
      </Card>
    </div>
  );
}