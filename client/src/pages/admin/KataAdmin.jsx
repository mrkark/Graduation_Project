import { useEffect, useState } from 'react';
import { kataApi } from '../../api/endpoints';

const emptyKata = { name: '', nameJp: '', style: '', kyuLevel: '', description: '', youtubeUrl: '' };
const emptySeq = { name: '', startTime: '', endTime: '' };
const emptyMovement = { name: '', nameJp: '', stance: '', direction: '', youtubeUrl: '', startTime: '' };

export default function KataAdmin() {
  const [kataList, setKataList] = useState([]);
  const [form, setForm] = useState(emptyKata);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedKata, setSelectedKata] = useState(null);
  const [seqForm, setSeqForm] = useState(emptySeq);
  const [movementForms, setMovementForms] = useState({}); // sequenceId -> form state

  function load() {
    kataApi.list().then((r) => setKataList(r.data.data));
  }
  useEffect(load, []);

  function loadStructure(id) {
    setSelectedId(id);
    kataApi.getOne(id).then((r) => setSelectedKata(r.data.data));
  }

  async function createSequence(e) {
    e.preventDefault();
    await kataApi.createSequence({ ...seqForm, kataId: selectedId, order: (selectedKata?.sequences?.length || 0) + 1 });
    setSeqForm(emptySeq);
    loadStructure(selectedId);
  }

  async function createMovement(sequenceId, e) {
    e.preventDefault();
    const form = movementForms[sequenceId] || emptyMovement;
    const seq = selectedKata.sequences.find((s) => s.id === sequenceId);
    await kataApi.createMovement({ ...form, sequenceId, order: (seq?.movements?.length || 0) + 1 });
    setMovementForms((f) => ({ ...f, [sequenceId]: emptyMovement }));
    loadStructure(selectedId);
  }

  async function removeSequence(id) {
    if (!confirm('Удалить последовательность вместе с движениями?')) return;
    await kataApi.deleteSequence(id);
    loadStructure(selectedId);
  }

  async function removeMovement(id) {
    if (!confirm('Удалить движение вместе с его бункай?')) return;
    await kataApi.deleteMovement(id);
    loadStructure(selectedId);
  }

  async function createKata(e) {
    e.preventDefault();
    await kataApi.create(form);
    setForm(emptyKata);
    load();
  }

  async function removeKata(id) {
    if (!confirm('Удалить это ката вместе со всеми последовательностями?')) return;
    await kataApi.remove(id);
    load();
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Управление ката</h1>

      <form className="washi-panel" style={{ padding: 18, marginBottom: 24 }} onSubmit={createKata}>
        <h3 style={{ marginBottom: 12 }}>Новое ката</h3>
        <div className="admin-form-grid">
          <input placeholder="Название (рус)" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Название (яп)" value={form.nameJp} onChange={(e) => setForm({ ...form, nameJp: e.target.value })} />
          <input placeholder="Стиль" required value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })} />
          <input placeholder="Уровень кю" value={form.kyuLevel} onChange={(e) => setForm({ ...form, kyuLevel: e.target.value })} />
          <input placeholder="Ссылка YouTube" value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} style={{ gridColumn: '1 / -1' }} />
          <textarea placeholder="Описание" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ gridColumn: '1 / -1' }} />
        </div>
        <button className="btn btn-primary" type="submit">Создать ката</button>
      </form>

      <table className="admin-table">
        <thead><tr><th>Название</th><th>Стиль</th><th>Уровень</th><th>Действия</th></tr></thead>
        <tbody>
          {kataList.map((k) => (
            <tr key={k.id}>
              <td>{k.name} <span style={{ color: 'var(--washi-dim)' }}>{k.nameJp}</span></td>
              <td>{k.style}</td>
              <td>{k.kyuLevel}</td>
              <td>
                <button className="action-btn" onClick={() => loadStructure(k.id)}>Структура</button>
                <a className="action-btn" href={`/kata/${k.id}`} target="_blank" rel="noreferrer">Открыть</a>
                <button className="action-btn danger" onClick={() => removeKata(k.id)}>Удалить</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedKata && (
        <div className="washi-panel" style={{ padding: 18, marginTop: 24 }}>
          <h3 style={{ marginBottom: 14 }}>Структура: {selectedKata.name}</h3>

          <form className="admin-form-grid" onSubmit={createSequence} style={{ marginBottom: 20 }}>
            <input placeholder="Название последовательности" required value={seqForm.name} onChange={(e) => setSeqForm({ ...seqForm, name: e.target.value })} />
            <input placeholder="Начало (сек)" type="number" value={seqForm.startTime} onChange={(e) => setSeqForm({ ...seqForm, startTime: e.target.value })} />
            <button className="btn btn-primary" type="submit" style={{ gridColumn: '1 / -1', justifySelf: 'start' }}>+ Последовательность</button>
          </form>

          {(selectedKata.sequences || []).map((seq) => (
            <div key={seq.id} style={{ marginBottom: 18, paddingLeft: 12, borderLeft: '2px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: 'var(--gold-soft)' }}>{seq.name}</strong>
                <button className="action-btn danger" onClick={() => removeSequence(seq.id)}>Удалить последов.</button>
              </div>

              <ul style={{ margin: '10px 0', paddingLeft: 18, color: 'var(--washi-dim)', fontSize: '0.88rem' }}>
                {(seq.movements || []).map((mv) => (
                  <li key={mv.id} style={{ marginBottom: 4 }}>
                    {mv.name} ({mv.nameJp}) — {mv.stance}
                    <button className="action-btn danger" style={{ marginLeft: 8 }} onClick={() => removeMovement(mv.id)}>×</button>
                  </li>
                ))}
              </ul>

              <form
                className="admin-form-grid"
                onSubmit={(e) => createMovement(seq.id, e)}
              >
                <input
                  placeholder="Название движения"
                  required
                  value={movementForms[seq.id]?.name || ''}
                  onChange={(e) => setMovementForms((f) => ({ ...f, [seq.id]: { ...(f[seq.id] || emptyMovement), name: e.target.value } }))}
                />
                <input
                  placeholder="Стойка"
                  value={movementForms[seq.id]?.stance || ''}
                  onChange={(e) => setMovementForms((f) => ({ ...f, [seq.id]: { ...(f[seq.id] || emptyMovement), stance: e.target.value } }))}
                />
                <input
                  placeholder="Таймкод (сек)"
                  type="number"
                  value={movementForms[seq.id]?.startTime || ''}
                  onChange={(e) => setMovementForms((f) => ({ ...f, [seq.id]: { ...(f[seq.id] || emptyMovement), startTime: e.target.value } }))}
                />
                <button className="btn" type="submit" style={{ justifySelf: 'start' }}>+ Движение</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
