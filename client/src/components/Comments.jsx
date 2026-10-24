import { useEffect, useState, useRef } from 'react';
import { listComments, createComment, deleteComment } from '../api/comments';
import { useAuthStore } from '../store/authStore';
import { HankoSeal } from './ui/JapaneseDecor';
import './Comments.css';

// Задача 22: Формат даты "ДД.ММ.ГГГГ" (только дата, без времени)
function formatDateOnly(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

// Задача 25: Парсинг цитаты ответа в стиле Telegram
function parseCommentText(rawText) {
  if (!rawText) return { isReply: false, body: '' };
  const quoteMatch = rawText.match(/^>\s*\*\*([^*]+)\*\*:\s*([^\n]+)\n\n([\s\S]*)$/);
  if (quoteMatch) {
    return {
      isReply: true,
      replyAuthor: quoteMatch[1],
      replySnippet: quoteMatch[2],
      body: quoteMatch[3],
    };
  }
  return {
    isReply: false,
    body: rawText,
  };
}

export default function Comments({ kataId, bunkaiId }) {
  const { user, role } = useAuthStore();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // Задача 25: объект комментария, на который отвечаем
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const feedEndRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const data = await listComments({ kataId, bunkaiId });
      setComments(data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kataId, bunkaiId]);

  function handleStartReply(comment) {
    setReplyingTo(comment);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed.length > 2000) {
      setError('Комментарий слишком длинный (макс. 2000 символов)');
      return;
    }
    setError(null);

    // Задача 25: Если есть ответ на комментарий, форматируем в Telegram-стиле
    let payloadText = trimmed;
    if (replyingTo) {
      const targetAuthor = replyingTo.Author?.Display_Name || replyingTo.Author?.Username || 'Пользователь';
      const parsedTarget = parseCommentText(replyingTo.Text);
      const cleanSnippet = (parsedTarget.body || '').replace(/\n/g, ' ').slice(0, 70);
      payloadText = `> **${targetAuthor}**: ${cleanSnippet}\n\n${trimmed}`;
    }

    try {
      const comment = await createComment({ text: payloadText, kataId, bunkaiId });
      setComments((c) => [...c, comment]);
      setText('');
      setReplyingTo(null);
      setTimeout(() => {
        feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Не удалось отправить комментарий');
    }
  }

  async function onDelete(id) {
    if (!confirm('Удалить этот комментарий?')) return;
    await deleteComment(id);
    setComments((c) => c.filter((x) => x.Comment_ID !== id));
  }

  return (
    <section className="comments-container">
      {/* Шапка обсуждения */}
      <div className="comments-header">
        <h3 className="comments-header__title">
          <HankoSeal text="語" size="sm" variant="gold" shape="square" />
          <span>Обсуждение и боевые нюансы</span>
        </h3>
        <span className="comments-header__count">{comments.length} сообщений</span>
      </div>

      {/* Список комментариев в стиле Telegram (Задача 24) */}
      {loading ? (
        <p className="loading">Загрузка сообщений…</p>
      ) : comments.length === 0 ? (
        <div className="tg-empty-feed">
          <HankoSeal text="空" size="md" variant="vermilion" shape="circle" />
          <p style={{ margin: 0, fontWeight: 600 }}>Пока нет комментариев</p>
          <span style={{ fontSize: '0.85rem' }}>Задайте вопрос или поделитесь нюансом выполнения техники!</span>
        </div>
      ) : (
        <div className="tg-feed">
          {comments.map((c) => {
            const isOwn = c.User_ID === user?.User_ID;
            const authorName = c.Author?.Display_Name || c.Author?.Username || 'Пользователь';
            const dateStr = formatDateOnly(c.Created_At);
            const { isReply, replyAuthor, replySnippet, body } = parseCommentText(c.Text);
            const canDelete = isOwn || role === 'admin';

            return (
              <div
                key={c.Comment_ID}
                className={`tg-bubble-wrap ${isOwn ? 'tg-bubble-wrap--own' : 'tg-bubble-wrap--other'}`}
              >
                <div className={`tg-bubble ${isOwn ? 'tg-bubble--own' : 'tg-bubble--other'}`}>
                  {/* Задача 22: Формат "Ник пользователя дата" без времени с пробелом */}
                  <div className="tg-bubble__header">
                    <span className="tg-bubble__author-date">
                      {authorName} {dateStr}
                    </span>

                    <div className="tg-bubble__actions">
                      {/* Задача 25: Кнопка Ответить */}
                      <button
                        type="button"
                        className="tg-reply-action-btn"
                        onClick={() => handleStartReply(c)}
                        title="Ответить на комментарий"
                      >
                        ↩ Ответить
                      </button>

                      {/* Задача 23: Новый дизайн кнопки Удалить */}
                      {canDelete && (
                        <button
                          type="button"
                          className="tg-delete-action-btn"
                          onClick={() => onDelete(c.Comment_ID)}
                          title="Удалить сообщение"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Задача 25: Отображение блока ответа (Telegram Quote) */}
                  {isReply && (
                    <div className="tg-quote-block">
                      <div className="tg-quote-content">
                        <span className="tg-quote-author">Ответ для {replyAuthor}</span>
                        <span className="tg-quote-text">{replySnippet}</span>
                      </div>
                    </div>
                  )}

                  {/* Текст сообщения */}
                  <p className="tg-bubble__text">{body}</p>
                </div>
              </div>
            );
          })}
          <div ref={feedEndRef} />
        </div>
      )}

      {/* Поле ввода в стиле Telegram с панелью ответа (Задачи 24, 25) */}
      <form
        onSubmit={onSubmit}
        className={`tg-input-form ${replyingTo ? 'tg-input-form--with-reply' : ''}`}
      >
        {/* Панель предпросмотра ответа (Задача 25) */}
        {replyingTo && (
          <div className="tg-reply-preview-bar">
            <div className="tg-reply-preview-content">
              <span className="tg-reply-preview-label">
                В ответ: {replyingTo.Author?.Display_Name || replyingTo.Author?.Username || 'Пользователь'}
              </span>
              <span className="tg-reply-preview-snippet">
                {parseCommentText(replyingTo.Text).body}
              </span>
            </div>
            <button
              type="button"
              className="tg-reply-preview-close"
              onClick={() => setReplyingTo(null)}
              title="Отменить ответ"
            >
              ✕
            </button>
          </div>
        )}

        <div className="tg-input-box">
          <textarea
            ref={inputRef}
            rows={2}
            maxLength={2000}
            className="tg-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            placeholder={
              replyingTo
                ? `Напишите ответ для ${replyingTo.Author?.Display_Name || replyingTo.Author?.Username}… (Enter для отправки)`
                : 'Напишите комментарий… (Enter для отправки, Shift+Enter для новой строки)'
            }
          />
          <button
            type="submit"
            className="tg-send-btn"
            disabled={!text.trim()}
            title="Отправить сообщение"
          >
            ➤
          </button>
        </div>
        {error && <p className="error-text" style={{ marginTop: '0.4rem' }}>{error}</p>}
      </form>
    </section>
  );
}
