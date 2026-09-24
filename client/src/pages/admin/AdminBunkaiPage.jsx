import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBunkai, approveBunkai, rejectBunkai } from '../../api/bunkai';
import StatusBadge from '../../components/StatusBadge';

export default function AdminBunkaiPage() {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await listBunkai({ status, pageSize: 50, sort: 'oldest' });
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function onApprove(id) {
    await approveBunkai(id);
    load();
  }
  async function onReject(id) {
    await rejectBunkai(id);
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
              <th>Ката</th>
              <th>Автор</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.Bunkai_ID}>
                <td>
                  <Link to={`/bunkai/${b.Bunkai_ID}`}>{b.Title}</Link>
                </td>
                <td>{b.Kata?.Title}</td>
                <td>{b.Author?.Display_Name || b.Author?.Username}</td>
                <td>
                  <StatusBadge status={b.Status} />
                </td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-primary" onClick={() => onApprove(b.Bunkai_ID)}>
                      Одобрить
                    </button>
                    <button className="btn btn-danger" onClick={() => onReject(b.Bunkai_ID)}>
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
