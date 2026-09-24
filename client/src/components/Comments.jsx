import { useEffect, useState } from 'react';
import { listComments, createComment, deleteComment } from '../api/comments';
import { useAuthStore } from '../store/authStore';

export default function Comments({ kataId, bunkaiId }) {
  const { user, role } = useAuthStore();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await listComments({ kataId, bunkaiId });
      setComments(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kataId, bunkaiId]);

  async function onSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > 2000) {
      setError('Комментарий слишком длинный (макс. 2000 символов)');
      return;
    }
    setError(null);
    try {
      const comment = await createComment({ text: trimmed, kataId, bunkaiId });
      setComments((c) => [...c, comment]);
      setText('');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Не удалось отправить комментарий');
    }
  }

  async function onDelete(id) {
    if (!confirm('Удалить комментарий?')) return;
    await deleteComment(id);
    setComments((c) => c.filter((x) => x.Comment_ID !== id));
  }

  return (
    <section className="comments">
      <h3>Комментарии</h3>

      <form onSubmit={onSubmit} className="comments__form">
        <textarea
          rows={3}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Поделитесь своим мнением о технике…"
        />
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-gold" type="submit" disabled={!text.trim()}>
          Отправить
        </button>
      </form>

      {loading ? (
        <p className="loading">Загрузка комментариев…</p>
      ) : comments.length === 0 ? (
        <p className="empty-state">Пока нет комментариев. Будьте первым!</p>
      ) : (
        <ul className="comments__list">
          {comments.map((c) => (
            <li key={c.Comment_ID} className="comments__item">
              <div className="comments__meta">
                <span className="comments__author">{c.Author?.Display_Name || c.Author?.Username}</span>
                <span className="comments__date">{new Date(c.Created_At).toLocaleString('ru-RU')}</span>
              </div>
              <p className="comments__text">{c.Text}</p>
              {(c.User_ID === user?.User_ID || role === 'admin') && (
                <button className="comments__delete" onClick={() => onDelete(c.Comment_ID)}>
                  Удалить
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
