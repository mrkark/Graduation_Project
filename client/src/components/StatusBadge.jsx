const LABELS = { approved: 'Одобрено', pending: 'На модерации', rejected: 'Отклонено' };

export default function StatusBadge({ status }) {
  if (!status) return null;
  return <span className={`badge badge-${status}`}>{LABELS[status] || status}</span>;
}
