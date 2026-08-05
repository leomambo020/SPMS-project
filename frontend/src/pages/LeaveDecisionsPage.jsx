import { useState } from 'react';
import { leaveApi } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import {
  PageHeader, Card, StatusBadge, LoadingState, ErrorState,
  EmptyState, Pagination, formatDate,
} from '../components/ui';
import Modal from '../components/Modal';

export default function LeaveDecisionsPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useApi(
    () => leaveApi.list({ page, limit: 20, status: 'pending' }),
    [page]
  );

  const [decision, setDecision] = useState(null); // { leave, action }
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const openDecision = (leave, action) => {
    setReason('');
    setActionError(null);
    setDecision({ leave, action });
  };

  const submitDecision = async () => {
    setSubmitting(true);
    setActionError(null);
    try {
      await leaveApi.decide(decision.leave.leave_id, {
        status: decision.action,
        reason: reason || undefined,
      });
      setDecision(null);
      refetch();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Leave Decisions" subtitle="Review pending leave requests from your department." />

      <Card title={`Pending requests (page ${page})`}>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data?.data?.length ? (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Type</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((l) => (
                  <tr key={l.leave_id}>
                    <td>{l.employee_id}</td>
                    <td className="capitalize">{l.leave_type}</td>
                    <td>{formatDate(l.start_date)}</td>
                    <td>{formatDate(l.end_date)}</td>
                    <td>{l.reason || '—'}</td>
                    <td className="actions-cell">
                      <button className="btn btn-success btn-sm" onClick={() => openDecision(l, 'approved')}>
                        Approve
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => openDecision(l, 'rejected')}>
                        Reject
                      </button>
                    </td>
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
          <EmptyState message="No pending leave requests." />
        )}
      </Card>

      <Card title="Recently decided" className="mt">
        <RecentDecisions />
      </Card>

      <Modal
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        title={`${decision ? decision.action === 'approved' ? 'Approve' : 'Reject' : ''} leave request`}
      >
        {decision && (
          <div className="stack">
            <p>
              Employee #{decision.leave.employee_id} · {decision.leave.leave_type} ·
              {formatDate(decision.leave.start_date)} → {formatDate(decision.leave.end_date)}
            </p>
            <label className="field">
              <span className="field-label">Note (optional)</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Optional note to the employee"
              />
            </label>
            {actionError && <div className="form-error">{actionError}</div>}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setDecision(null)}>Cancel</button>
              <button
                className={`btn ${decision.action === 'approved' ? 'btn-success' : 'btn-danger'}`}
                disabled={submitting}
                onClick={submitDecision}
              >
                {submitting ? 'Submitting…' : `Confirm ${decision.action}`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function RecentDecisions() {
  const { data, loading, error, refetch } = useApi(
    () => leaveApi.list({ page: 1, limit: 10 }),
    []
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data?.data?.length) return <EmptyState message="No decisions yet." />;

  const decided = data.data.filter((l) => l.status !== 'pending').slice(0, 10);
  if (!decided.length) return <EmptyState message="No decisions made yet." />;

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Employee ID</th>
          <th>Type</th>
          <th>Dates</th>
          <th>Status</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
        {decided.map((l) => (
          <tr key={l.leave_id}>
            <td>{l.employee_id}</td>
            <td className="capitalize">{l.leave_type}</td>
            <td>{formatDate(l.start_date)} → {formatDate(l.end_date)}</td>
            <td><StatusBadge status={l.status} /></td>
            <td>{l.reason || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}