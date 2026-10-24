import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { listMyDojos, createDojo, getDojoDetails, inviteUserToDojo, respondDojoInvite } from '../api/dojos';
import { searchUsers } from '../api/friends';
import { HankoSeal } from '../components/ui/JapaneseDecor';
import './DojoPage.css';

export default function DojoPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('my'); // 'my' | 'invites' | 'create'
  const [dojos, setDojos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [createName, setCreateName] = useState('');
  const [createKanji, setCreateKanji] = useState('道場');
  const [createDesc, setCreateDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(null);

  // Selected dojo modal
  const [selectedDojoId, setSelectedDojoId] = useState(null);
  const [selectedDojoData, setSelectedDojoData] = useState(null);
  const [loadingModal, setLoadingModal] = useState(false);

  // Invite search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [inviteStatus, setInviteStatus] = useState({});

  const loadDojos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listMyDojos();
      setDojos(data || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Ошибка загрузки Додзё');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDojos();
  }, []);

  const openDojoDetails = async (id) => {
    setSelectedDojoId(id);
    setSearchQuery('');
    setSearchResults([]);
    setInviteStatus({});
    try {
      setLoadingModal(true);
      const details = await getDojoDetails(id);
      setSelectedDojoData(details);
    } catch (err) {
      alert(err?.response?.data?.error || 'Не удалось открыть информацию о Додзё');
      setSelectedDojoId(null);
    } finally {
      setLoadingModal(false);
    }
  };

  const closeDojoModal = () => {
    setSelectedDojoId(null);
    setSelectedDojoData(null);
  };

  const handleCreateDojo = async (e) => {
    e.preventDefault();
    if (!createName.trim()) return;
    try {
      setSubmitting(true);
      setError(null);
      await createDojo({
        name: createName.trim(),
        kanji: createKanji.trim() || '道場',
        description: createDesc.trim(),
      });
      setFormSuccess('Додзё успешно основано!');
      setCreateName('');
      setCreateDesc('');
      await loadDojos();
      setActiveTab('my');
    } catch (err) {
      setError(err?.response?.data?.error || 'Не удалось создать Додзё');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespondInvite = async (dojoId, accept) => {
    try {
      await respondDojoInvite(dojoId, accept);
      await loadDojos();
    } catch (err) {
      alert(err?.response?.data?.error || 'Ошибка при ответе на приглашение');
    }
  };

  const handleSearchUsers = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      const res = await searchUsers(searchQuery.trim());
      setSearchResults(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleInviteUser = async (targetUserId) => {
    if (!selectedDojoId) return;
    try {
      setInviteStatus((prev) => ({ ...prev, [targetUserId]: 'sending' }));
      await inviteUserToDojo(selectedDojoId, targetUserId);
      setInviteStatus((prev) => ({ ...prev, [targetUserId]: 'sent' }));
      const refreshed = await getDojoDetails(selectedDojoId);
      setSelectedDojoData(refreshed);
    } catch (err) {
      setInviteStatus((prev) => ({ ...prev, [targetUserId]: 'error' }));
      alert(err?.response?.data?.error || 'Не удалось пригласить пользователя');
    }
  };

  const activeDojos = dojos.filter((d) => (d.Status || d.MyStatus) === 'active');
  const invitedDojos = dojos.filter((d) => (d.Status || d.MyStatus) === 'invited');

  return (
    <div className="container dojo-page" style={{ paddingTop: '2rem' }}>
      <div className="catalog-header" style={{ marginBottom: '2rem' }}>
        <div className="catalog-header__top">
          <div className="catalog-header__badge">
            <span className="catalog-header__badge-dot" />
            <span>Школы и братства Сётокан</span>
          </div>
          <HankoSeal text="道場" size="md" variant="gold" shape="round" />
        </div>
        <h1 className="catalog-header__title">
          <span>Залы боевых искусств</span>
          <span className="catalog-header__kanji">道場</span>
        </h1>
        <p className="catalog-header__desc">
          Основывайте собственные Додзё, объединяйте соратников для совместного изучения 26 ката и разборов бункай.
        </p>
      </div>

      {/* Вкладки навигации */}
      <div className="tabs-header" style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'my' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('my')}
        >
          🥋 Мои Додзё ({activeDojos.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'invites' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('invites')}
        >
          📬 Приглашения {invitedDojos.length > 0 && `(${invitedDojos.length})`}
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'create' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('create')}
        >
          ➕ Основать Додзё
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Склоняем поклон перед входом в зал...
        </div>
      ) : (
        <>
          {/* TAB 1: МОИ ДОДЗЁ */}
          {activeTab === 'my' && (
            <div>
              {activeDojos.length === 0 ? (
                <div className="empty-catalog" style={{ textAlign: 'center', padding: '3rem' }}>
                  <span style={{ fontSize: '2.5rem' }}>⛩️</span>
                  <h3>Вы пока не состоите ни в одном Додзё</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    Основать собственную школу или дождитесь приглашения от сэнсэя.
                  </p>
                  <button type="button" className="btn btn-primary" onClick={() => setActiveTab('create')}>
                    Основать Додзё прямо сейчас
                  </button>
                </div>
              ) : (
                <div className="dojo-grid">
                  {activeDojos.map((d) => (
                    <div key={d.Dojo_ID} className="dojo-card">
                      <div className="dojo-card__header">
                        <div className="dojo-card__seal">{d.Kanji || '道'}</div>
                        <div className="dojo-card__info">
                          <div className="dojo-card__name">{d.Name}</div>
                          <div className="dojo-card__sensei">
                            Сэнсэй: <strong>{d.SenseiName || d.Sensei_Name || d.Sensei_Username || 'Мастер'}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="dojo-card__desc">
                        {d.Description || 'Традиционные тренировки ката и бункай Сётокан каратэдо.'}
                      </div>

                      <div className="dojo-card__meta">
                        <span>Участников: <strong>{d.MemberCount || d.MembersCount || 1}</strong></span>
                        <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--gold)' }}>
                          {(d.Role || d.MyRole) === 'sensei' ? '🥋 Сэнсэй' : '🥋 Ученик'}
                        </span>
                      </div>

                      <div className="dojo-card__actions">
                        <button
                          type="button"
                          className="btn btn-subtle"
                          style={{ width: '100%' }}
                          onClick={() => openDojoDetails(d.Dojo_ID)}
                        >
                          Соратники и приглашения →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ПРИГЛАШЕНИЯ */}
          {activeTab === 'invites' && (
            <div>
              {invitedDojos.length === 0 ? (
                <div className="empty-catalog" style={{ textAlign: 'center', padding: '3rem' }}>
                  <span style={{ fontSize: '2.5rem' }}>📭</span>
                  <h3>Новых приглашений нет</h3>
                  <p style={{ color: 'var(--text-muted)' }}>
                    Когда вас пригласят в Додзё, здесь появится свиток с вызовом.
                  </p>
                </div>
              ) : (
                <div className="dojo-grid">
                  {invitedDojos.map((d) => (
                    <div key={d.Dojo_ID} className="dojo-card">
                      <div className="dojo-card__header">
                        <div className="dojo-card__seal">{d.Kanji || '道'}</div>
                        <div className="dojo-card__info">
                          <div className="dojo-card__name">{d.Name}</div>
                          <div className="dojo-card__sensei">
                            Приглашает Сэнсэй: <strong>{d.SenseiName || d.Sensei_Name || d.Sensei_Username || 'Мастер'}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="dojo-card__desc">
                        {d.Description || 'Приглашение вступить в ряды соратников школы.'}
                      </div>

                      <div className="dojo-card__actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleRespondInvite(d.Dojo_ID, true)}
                        >
                          ✓ Вступить
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleRespondInvite(d.Dojo_ID, false)}
                        >
                          ✕ Отклонить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ОСНОВАТЬ ДОДЗЁ */}
          {activeTab === 'create' && (
            <div style={{ maxWidth: '640px', margin: '0 auto', background: 'var(--bg-surface)', padding: '2rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
              <h2 style={{ color: 'var(--gold)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⛩️</span> Основание новой школы
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Основатель Додзё автоматически становится его Сэнсэем и может приглашать соратников.
              </p>

              {formSuccess && (
                <div className="alert alert-success" style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(76, 175, 80, 0.1)', border: '1px solid #4caf50', color: '#81c784', borderRadius: '4px' }}>
                  {formSuccess}
                </div>
              )}

              <form onSubmit={handleCreateDojo}>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Название Додзё *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Например: Додзё Белого Тигра (Byakko Dojo)"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.75rem', background: '#120f0d', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Иероглиф / Печать Додзё (Кандзи)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Например: 道場, 虎, 空, 武"
                    maxLength={4}
                    value={createKanji}
                    onChange={(e) => setCreateKanji(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', background: '#120f0d', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Девиз и описание школы</label>
                  <textarea
                    rows={4}
                    className="form-control"
                    placeholder="Традиции, расписание или правила вашего Додзё..."
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', background: '#120f0d', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px', resize: 'vertical' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !createName.trim()}
                  style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}
                >
                  {submitting ? 'Основание...' : '⛩️ Утвердить и открыть Додзё'}
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {/* МОДАЛЬНОЕ ОКНО ДОДЗЁ С ПРИГЛАШЕНИЕМ СОРАТНИКОВ */}
      {selectedDojoId && (
        <div className="dojo-modal-overlay" onClick={closeDojoModal}>
          <div className="dojo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dojo-modal__header">
              <div className="dojo-modal__title">
                ⛩️ {selectedDojoData?.Name || selectedDojoData?.dojo?.Name || 'Додзё'}
              </div>
              <button type="button" className="dojo-modal__close" onClick={closeDojoModal}>✕</button>
            </div>

            <div className="dojo-modal__body">
              {loadingModal ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Загрузка свитка участников...</div>
              ) : selectedDojoData ? (
                <>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                    {selectedDojoData?.Description || selectedDojoData?.dojo?.Description || 'Совместные тренировки и изучение традиционного Сётокан.'}
                  </p>

                  <h4 style={{ color: 'var(--gold)', marginBottom: '0.75rem' }}>🥋 Участники школы ({selectedDojoData.members?.length || 0})</h4>
                  <div className="dojo-members-list">
                    {selectedDojoData.members?.map((m) => (
                      <div key={m.User_ID} className="dojo-member-item">
                        <div className="dojo-member-user">
                          <div className="dojo-member-avatar">
                            {(m.Display_Name || m.Username)[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.Display_Name || m.Username}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{m.Username}</div>
                          </div>
                        </div>

                        <div>
                          <span className={`dojo-member-role ${m.Role === 'sensei' ? 'dojo-member-role--sensei' : 'dojo-member-role--student'}`}>
                            {m.Role === 'sensei' ? 'Сэнсэй' : 'Ученик'}
                          </span>
                          {m.Status === 'invited' && (
                            <span className="dojo-member-status--invited" style={{ marginLeft: '0.5rem' }}>
                              (ожидает ответа)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Пригласить пользователя */}
                  <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
                    <h4 style={{ color: 'var(--gold)', marginBottom: '0.75rem' }}>✉️ Пригласить соратника в Додзё</h4>
                    <form onSubmit={handleSearchUsers} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                      <input
                        type="text"
                        placeholder="Поиск по имени или логину..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ flex: 1, padding: '0.6rem 0.8rem', background: '#120f0d', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px' }}
                      />
                      <button type="submit" className="btn btn-secondary" disabled={searching}>
                        {searching ? '...' : 'Найти'}
                      </button>
                    </form>

                    {searchResults.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                        {searchResults.map((u) => {
                          const isAlreadyMember = selectedDojoData.members?.some((m) => m.User_ID === u.User_ID);
                          const state = inviteStatus[u.User_ID];

                          return (
                            <div
                              key={u.User_ID}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div className="dojo-member-avatar" style={{ width: '28px', height: '28px', fontSize: '0.75rem' }}>
                                  {(u.Display_Name || u.Username)[0].toUpperCase()}
                                </div>
                                <span style={{ fontSize: '0.85rem' }}>{u.Display_Name || u.Username}</span>
                              </div>

                              {isAlreadyMember ? (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>В Додзё</span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-subtle"
                                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                  disabled={state === 'sending' || state === 'sent'}
                                  onClick={() => handleInviteUser(u.User_ID)}
                                >
                                  {state === 'sending' ? 'Отправка...' : state === 'sent' ? '✓ Приглашён' : '+ Пригласить'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
