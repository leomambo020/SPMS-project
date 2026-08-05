import { useState } from 'react';
import { departmentsApi, employeesApi } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import {
  PageHeader, Card, Field, FormError, LoadingState, ErrorState, EmptyState,
} from '../components/ui';
import Modal from '../components/Modal';

export default function DepartmentsPage() {
  const { data, loading, error, refetch } = useApi(() => departmentsApi.list(), []);
  const { data: employeesData } = useApi(() => employeesApi.list({ limit: 100 }), []);

  const [modal, setModal] = useState(null); // 'create' | 'edit' | null
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ deptName: '', supervisorId: '' });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setForm({ deptName: '', supervisorId: '' });
    setFormError(null);
    setModal('create');
  };

  const openEdit = (dept) => {
    setEditing(dept);
    setForm({ deptName: dept.dept_name, supervisorId: dept.supervisor_id ? String(dept.supervisor_id) : '' });
    setFormError(null);
    setModal('edit');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const body = {
        deptName: form.deptName,
        supervisorId: form.supervisorId ? Number(form.supervisorId) : null,
      };
      if (modal === 'create') {
        await departmentsApi.create(body);
      } else {
        await departmentsApi.update(editing.dept_id, body);
      }
      setModal(null);
      refetch();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (dept) => {
    if (!window.confirm(`Delete department "${dept.dept_name}"? This cannot be undone.`)) return;
    try {
      await departmentsApi.remove(dept.dept_id);
      refetch();
    } catch (err) {
      window.alert(err.message);
    }
  };

  const supervisorName = (id) => {
    const emp = employeesData?.data?.find((e) => e.employee_id === id);
    return emp ? emp.full_name : id ? `#${id}` : '—';
  };

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle="Organize employees into departments and assign supervisors."
        actions={<button className="btn btn-primary" onClick={openCreate}>+ New department</button>}
      />

      <Card title={`Departments (${data?.data?.length ?? 0})`}>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data?.data?.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Supervisor</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((d) => (
                <tr key={d.dept_id}>
                  <td>{d.dept_id}</td>
                  <td>{d.dept_name}</td>
                  <td>{supervisorName(d.supervisor_id)}</td>
                  <td className="actions-cell">
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(d)}>Edit</button>
                    <button className="btn btn-danger-outline btn-sm" onClick={() => handleDelete(d)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No departments yet." />
        )}
      </Card>

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'New department' : `Edit ${editing?.dept_name || ''}`}
      >
        <form onSubmit={handleSubmit} className="stack modal-form">
          <Field label="Department name" required>
            <input
              type="text"
              value={form.deptName}
              onChange={(e) => setForm((f) => ({ ...f, deptName: e.target.value }))}
              required
            />
          </Field>
          <Field label="Supervisor">
            <select
              value={form.supervisorId}
              onChange={(e) => setForm((f) => ({ ...f, supervisorId: e.target.value }))}
            >
              <option value="">No supervisor</option>
              {employeesData?.data
                ?.filter((e) => e.employment_status !== 'exited')
                .map((emp) => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    #{emp.employee_id} — {emp.full_name}
                  </option>
                ))}
            </select>
          </Field>

          <FormError error={formError} />

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}