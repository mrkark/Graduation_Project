import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { listMyDojos, createDojo, getDojoDetails, inviteUserToDojo, respondDojoInvite, updateDojo, deleteDojo } from '../api/dojos';
import { searchUsers, listFriends } from '../api/friends';
import { HankoSeal } from '../components/ui/JapaneseDecor';
import './DojoPage.css';

function getSealFontSize(kanji) {
  const text = (kanji || '道場').trim();
  if (text.length <= 1) return '1.5rem';
  if (text.length === 2) return '1.05rem';
  if (text.length === 3) return '0.85rem';
  return '0.75rem';
}

export default function DojoPage() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam === 'invites' ? 'invites' : tabParam === 'create' ? 'create' : 'my');
  const [dojos, setDojos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tabParam && ['my', 'invites', 'create'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Form state
  const [createName, setCreateName] = useState('');
  const [createKanji, setCreateKanji] = useState('道場');
  const [createDesc, setCreateDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(null);

  // Edit dojo state
  const [editingDojo, setEditingDojo] = useState(null);
  const [editName, setEditName] = useState('');
  const [editKanji, setEditKanji] = useState('道場');
  const [editDesc, setEditDesc] = useState('');
  const [updating, setUpdating] = useState(false);

  // Selected dojo modal
  const [selectedDojoId, setSelectedDojoId] = useState(null);
  const [selectedDojoData, setSelectedDojoData] = useState(null);
  const [loadingModal, setLoadingModal] = useState(false);

  // Quick invite from friends
  const [friendsList, setFriendsList] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

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
      setLoadingFriends(true);
      const [details, friends] = await Promise.all([
        getDojoDetails(id),
        listFriends().catch(() => []),
      ]);
      setSelectedDojoData(details);
      setFriendsList(friends || []);
    } catch (err) {
      alert(err?.response?.data?.error || 'Не удалось открыть информацию о Додзё');
      setSelectedDojoId(null);
    } finally {
      setLoadingModal(false);
      setLoadingFriends(false);
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
      setCreateKanji('道場');
      await loadDojos();
      setActiveTab('my');
    } catch (err) {
      setError(err?.response?.data?.error || 'Не удалось создать Додзё');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (d) => {
    setEditingDojo(d);
    setEditName(d.Name || '');
    setEditKanji(d.Kanji || '道場');
    setEditDesc(d.Description || '');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingDojo || !editName.trim()) return;
    try {
      setUpdating(true);
      await updateDojo(editingDojo.Dojo_ID, {
        name: editName.trim(),
        kanji: editKanji.trim() || '道場',
        description: editDesc.trim(),
      });
      setEditingDojo(null);
      await loadDojos();
      if (selectedDojoId === editingDojo.Dojo_ID) {
        const refreshed = await getDojoDetails(selectedDojoId);
        setSelectedDojoData(refreshed);
      }
    } catch (err) {
      alert(err?.response?.data?.error || 'Не удалось обновить Додзё');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteDojo = async (dojoId, dojoName) => {
    if (!window.confirm(`Вы уверены, что хотите распустить и навсегда закрыть Додзё «${dojoName}»? Это действие нельзя отменить.`)) {
      return;
    }
    try {
      await deleteDojo(dojoId);
      if (selectedDojoId === dojoId) {
        closeDojoModal();
      }
      await loadDojos();
    } catch (err) {
      alert(err?.response?.data?.error || 'Не удалось распустить Додзё');
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
          onClick={() => switchTab('my')}
        >
          🥋 Мои Додзё ({activeDojos.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'invites' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => switchTab('invites')}
        >
          📬 Приглашения {invitedDojos.length > 0 && `(${invitedDojos.length})`}
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'create' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => switchTab('create')}
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
                        <div className="dojo-card__seal" style={{ fontSize: getSealFontSize(d.Kanji) }}>
                          {d.Kanji || '道場'}
                        </div>
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

                      <div className="dojo-card__actions" style={{ flexDirection: 'column', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-subtle"
                          style={{ width: '100%' }}
                          onClick={() => openDojoDetails(d.Dojo_ID)}
                        >
                          Соратники и приглашения →
                        </button>

                        {((d.Role || d.MyRole) === 'sensei' || d.Creator_ID === user?.User_ID) && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', width: '100%' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                              onClick={() => handleStartEdit(d)}
                            >
                              ✏️ Изменить
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                              onClick={() => handleDeleteDojo(d.Dojo_ID, d.Name)}
                            >
                              🗑️ Распустить
                            </button>
                          </div>
                        )}
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
                        <div className="dojo-card__seal" style={{ fontSize: getSealFontSize(d.Kanji) }}>
                          {d.Kanji || '道場'}
                        </div>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                <div className="dojo-modal__title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ⛩️ {selectedDojoData?.Name || selectedDojoData?.dojo?.Name || 'Додзё'}
                </div>
                {((selectedDojoData?.MyRole === 'sensei') || (selectedDojoData?.Creator_ID === user?.User_ID)) && (
                  <div style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto', marginRight: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                      onClick={() => handleStartEdit(selectedDojoData?.dojo || selectedDojoData)}
                    >
                      ✏️ Изменить
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                      onClick={() => handleDeleteDojo(selectedDojoId, selectedDojoData?.Name || selectedDojoData?.dojo?.Name)}
                    >
                      🗑️ Распустить
                    </button>
                  </div>
                )}
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

                    {/* Быстрый выбор из друзей */}
                    <div style={{ marginBottom: '1.25rem', background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--gold-soft)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>👥</span> Быстрый выбор из друзей ({friendsList.length}):
                      </div>
                      {loadingFriends ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Загрузка соратников...</div>
                      ) : friendsList.length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>В вашем списке друзей пока нет соратников. Добавьте друзей во вкладке «Соратники».</div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.3rem' }}>
                          {friendsList.map((f) => {
                            const memberInfo = selectedDojoData.members?.find((m) => m.User_ID === f.User_ID);
                            const state = inviteStatus[f.User_ID];
                            const isInvited = memberInfo?.Status === 'invited' || state === 'sent';
                            const isActive = memberInfo?.Status === 'active';

                            return (
                              <div
                                key={f.User_ID}
                                style={{
                                  flexShrink: 0,
                                  background: '#161310',
                                  border: '1px solid var(--border-subtle)',
                                  borderRadius: '6px',
                                  padding: '8px 10px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '5px',
                                  width: '105px',
                                  textAlign: 'center',
                                }}
                              >
                                <div className="dojo-member-avatar" style={{ width: '30px', height: '30px', fontSize: '0.8rem' }}>
                                  {(f.Display_Name || f.Username || '?')[0].toUpperCase()}
                                </div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                                  {f.Display_Name || f.Username}
                                </div>

                                {isActive ? (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>✓ В Додзё</span>
                                ) : isInvited ? (
                                  <span style={{ fontSize: '0.7rem', color: '#eab308' }}>Приглашён</span>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ padding: '2px 8px', fontSize: '0.72rem', width: '100%', marginTop: '2px' }}
                                    disabled={state === 'sending'}
                                    onClick={() => handleInviteUser(f.User_ID)}
                                  >
                                    {state === 'sending' ? '...' : '+ Позвать'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

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

      {/* МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ ДОДЗЁ */}
      {editingDojo && (
        <div className="dojo-modal-overlay" onClick={() => setEditingDojo(null)}>
          <div className="dojo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="dojo-modal__header">
              <div className="dojo-modal__title">✏️ Редактирование Додзё</div>
              <button type="button" className="dojo-modal__close" onClick={() => setEditingDojo(null)}>✕</button>
            </div>
            <div className="dojo-modal__body">
              <form onSubmit={handleSaveEdit}>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Название Додзё *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.75rem', background: '#120f0d', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Иероглиф / Печать Додзё (Кандзи)</label>
                  <input
                    type="text"
                    className="form-control"
                    maxLength={4}
                    value={editKanji}
                    onChange={(e) => setEditKanji(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', background: '#120f0d', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Девиз и описание школы</label>
                  <textarea
                    rows={4}
                    className="form-control"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', background: '#120f0d', border: '1px solid var(--border)', color: '#fff', borderRadius: '4px', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditingDojo(null)}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={updating || !editName.trim()}
                  >
                    {updating ? 'Сохранение...' : 'Сохранить изменения'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
