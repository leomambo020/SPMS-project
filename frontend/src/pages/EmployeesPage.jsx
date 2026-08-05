import { useState } from 'react';
import { employeesApi, departmentsApi } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import {
  PageHeader, Card, Field, FormError, StatusBadge, LoadingState, ErrorState,
  EmptyState, Pagination, formatDate,
} from '../components/ui';
import Modal from '../components/Modal';

const EMPTY_FORM = {
  fullName: '',
  jobTitle: '',
  contactInfo: '',
  deptId: '',
  employmentStatus: 'active',
  dateHired: '',
  username: '',
  password: '',
  role: 'employee',
};

export default function EmployeesPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({});
  const [modal, setModal] = useState(null); // 'create' | 'edit' | null
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, error, refetch } = useApi(
    () => employeesApi.list({ page, limit: 20, ...filters }),
    [page, filters]
  );

  const { data: departmentsData } = useApi(() => departmentsApi.list(), []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormSuccess(null);
    setModal('create');
  };

  const openEdit = (emp) => {
    setEditing(emp);
    setForm({
      fullName: emp.full_name,
      jobTitle: emp.job_title,
      contactInfo: emp.contact_info,
      deptId: emp.dept_id ? String(emp.dept_id) : '',
      employmentStatus: emp.employment_status,
      dateHired: emp.date_hired ? emp.date_hired.slice(0, 10) : '',
      username: '',
      password: '',
      role: 'employee',
    });
    setFormError(null);
    setFormSuccess(null);
    setModal('edit');
  };

  const closeModal = () => {
    setModal(null);
    setEditing(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);

    try {
      const base = {
        fullName: form.fullName,
        jobTitle: form.jobTitle,
        contactInfo: form.contactInfo,
        deptId: form.deptId ? Number(form.deptId) : undefined,
        employmentStatus: form.employmentStatus,
        dateHired: form.dateHired || undefined,
      };

      if (modal === 'create') {
        const body = { ...base };
        if (form.username && form.password) {
          body.account = {
            username: form.username,
            password: form.password,
            role: form.role,
          };
        }
        await employeesApi.create(body);
        setFormSuccess('Employee created.');
      } else {
        await employeesApi.update(editing.employee_id, base);
        setFormSuccess('Employee updated.');
      }

      closeModal();
      refetch();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOffboard = async (emp) => {
    if (!window.confirm(`Set ${emp.full_name} as exited?`)) return;
    try {
      await employeesApi.update(emp.employee_id, { employmentStatus: 'exited' });
      refetch();
    } catch (err) {
      window.alert(err.message);
    }
  };

  const handleFilterChange = (key, value) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value || undefined }));
  };

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Manage employee records. Use 'Mark exited' for routine offboarding instead of deletion."
        actions={<button className="btn btn-primary" onClick={openCreate}>+ New employee</button>}
      />

      <Card title="Filters">
        <div className="filter-row">
          <Field label="Department">
            <select value={filters.deptId || ''} onChange={(e) => handleFilterChange('deptId', e.target.value)}>
              <option value="">All departments</option>
              {departmentsData?.data?.map((d) => (
                <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={filters.employmentStatus || ''} onChange={(e) => handleFilterChange('employmentStatus', e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="on_leave">On leave</option>
              <option value="exited">Exited</option>
            </select>
          </Field>
          {(filters.deptId || filters.employmentStatus) && (
            <button className="btn btn-outline btn-sm align-end" onClick={() => { setFilters({}); setPage(1); }}>
              Clear filters
            </button>
          )}
        </div>
      </Card>

      <Card title={`Employee list (${data?.pagination?.total ?? 0})`}>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data?.data?.length ? (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Job title</th>
                  <th>Department</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Hired</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((emp) => {
                  const dept = departmentsData?.data?.find((d) => d.dept_id === emp.dept_id);
                  return (
                    <tr key={emp.employee_id}>
                      <td>{emp.employee_id}</td>
                      <td>{emp.full_name}</td>
                      <td>{emp.job_title}</td>
                      <td>{dept?.dept_name || (emp.dept_id ? `#${emp.dept_id}` : '—')}</td>
                      <td>{emp.contact_info}</td>
                      <td><StatusBadge status={emp.employment_status} /></td>
                      <td>{formatDate(emp.date_hired)}</td>
                      <td className="actions-cell">
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(emp)}>Edit</button>
                        {emp.employment_status !== 'exited' && (
                          <button className="btn btn-outline btn-sm" onClick={() => handleOffboard(emp)}>Mark exited</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState message="No employees found." />
        )}
      </Card>

      <Modal
        open={Boolean(modal)}
        onClose={closeModal}
        title={modal === 'create' ? 'New employee' : `Edit ${editing?.full_name || ''}`}
      >
        <form onSubmit={handleSubmit} className="stack modal-form">
          <Field label="Full name" required>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              required
            />
          </Field>
          <Field label="Job title" required>
            <input
              type="text"
              value={form.jobTitle}
              onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
              required
            />
          </Field>
          <Field label="Contact info / notification email" required>
            <input
              type="email"
              value={form.contactInfo}
              onChange={(e) => setForm((f) => ({ ...f, contactInfo: e.target.value }))}
              required
            />
          </Field>
          <div className="two-field">
            <Field label="Department">
              <select value={form.deptId} onChange={(e) => setForm((f) => ({ ...f, deptId: e.target.value }))}>
                <option value="">Unassigned</option>
                {departmentsData?.data?.map((d) => (
                  <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Employment status">
              <select value={form.employmentStatus} onChange={(e) => setForm((f) => ({ ...f, employmentStatus: e.target.value }))}>
                <option value="active">Active</option>
                <option value="on_leave">On leave</option>
                <option value="exited">Exited</option>
              </select>
            </Field>
          </div>
          <Field label="Date hired">
            <input
              type="date"
              value={form.dateHired}
              onChange={(e) => setForm((f) => ({ ...f, dateHired: e.target.value }))}
            />
          </Field>

          {modal === 'create' && (
            <>
              <div className="form-divider">Login account (optional)</div>
              <div className="two-field">
                <Field label="Username">
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Password (min 10 chars)">
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    autoComplete="new-password"
                  />
                </Field>
              </div>
              <Field label="Role">
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                  <option value="employee">Employee</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="hr_admin">HR Admin</option>
                </select>
              </Field>
            </>
          )}

          <FormError error={formError} />
          {formSuccess && <div className="form-success">{formSuccess}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : modal === 'create' ? 'Create employee' : 'Save changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}