import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listKata, approveKata, rejectKata } from '../../api/kata';
import StatusBadge from '../../components/StatusBadge';

export default function AdminKataPage() {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await listKata({ status, pageSize: 50, sort: 'oldest' });
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function onApprove(id) {
    await approveKata(id);
    load();
  }
  async function onReject(id) {
    await rejectKata(id);
    load();
  }

  return (
    <div>
      <div className="field" style={{ maxWidth: 260, marginBottom: '1rem' }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">На модерации</option>
          <option value="approved">Одобренные</option>
          <option value="rejected">Отклонённые</option>
        </select>
      </div>

      {loading ? (
        <p className="loading">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">Материалов нет.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Автор</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map((k) => (
              <tr key={k.Kata_ID}>
                <td>
                  <Link to={`/kata/${k.Kata_ID}`}>{k.Title}</Link>
                </td>
                <td>{k.Author?.Display_Name || k.Author?.Username}</td>
                <td>
                  <StatusBadge status={k.Status} />
                </td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-primary" onClick={() => onApprove(k.Kata_ID)}>
                      Одобрить
                    </button>
                    <button className="btn btn-danger" onClick={() => onReject(k.Kata_ID)}>
                      Отклонить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
