import { useEffect, useRef, useState } from 'react';
import { mediaApi } from '../../api/endpoints';

export default function MediaAdmin() {
  const [files, setFiles] = useState([]);
  const inputRef = useRef(null);

  function load() {
    mediaApi.list().then((r) => setFiles(r.data.data));
  }
  useEffect(load, []);

  async function handleUpload(e) {
    e.preventDefault();
    const file = inputRef.current.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    await mediaApi.upload(formData);
    inputRef.current.value = '';
    load();
  }

  async function remove(id) {
    if (!confirm('Удалить файл?')) return;
    await mediaApi.remove(id);
    load();
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Медиафайлы (превью-картинки)</h1>
      <form className="washi-panel" style={{ padding: 18, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }} onSubmit={handleUpload}>
        <input type="file" accept="image/*" ref={inputRef} />
        <button className="btn btn-primary" type="submit">Загрузить</button>
      </form>

      <div className="card-grid">
        {files.map((f) => (
          <div key={f.id} className="washi-panel" style={{ padding: 12 }}>
            <img src={f.path} alt={f.originalName} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 4, marginBottom: 8 }} />
            <p style={{ fontSize: '0.8rem', color: 'var(--washi-dim)', wordBreak: 'break-all' }}>{f.originalName}</p>
            <button className="action-btn danger" onClick={() => remove(f.id)}>Удалить</button>
          </div>
        ))}
      </div>
    </div>
  );
}
