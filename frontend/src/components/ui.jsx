// Small shared UI primitives used across pages.

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {title && <div className="card-title">{title}</div>}
      {children}
    </div>
  );
}

export function Badge({ children, tone = 'default' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const tones = {
    active: 'success',
    on_leave: 'warning',
    exited: 'danger',
    present: 'success',
    late: 'warning',
    absent: 'danger',
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    annual: 'info',
    sick: 'info',
    compassionate: 'info',
  };
  return <Badge tone={tones[status] || 'default'}>{status.replace(/_/g, ' ')}</Badge>;
}

export function Spinner() {
  return <div className="spinner" aria-label="Loading" />;
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="loading-state">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="error-state">
      <p>{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <button className="btn btn-outline" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }) {
  return <div className="empty-state">{message}</div>;
}

export function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button
        className="btn btn-outline btn-sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        ← Prev
      </button>
      <span className="pagination-info">
        Page {page} of {totalPages}
      </span>
      <button
        className="btn btn-outline btn-sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}

export function Field({ label, children, required = false }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required && <span className="required"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function FormError({ error }) {
  if (!error) return null;
  return <div className="form-error">{error}</div>;
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

export function formatMoney(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value));
}