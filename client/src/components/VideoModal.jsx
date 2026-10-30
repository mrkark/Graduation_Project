import { useEffect } from 'react';
import VideoEmbed from './VideoEmbed';
import { HankoSeal } from './ui/JapaneseDecor';

export default function VideoModal({ isOpen, onClose, videoUrl, title, subtitle }) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !videoUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--surface-dark, #141210)',
          border: '1px solid var(--gold, #d4a24c)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 20px rgba(212, 162, 76, 0.2)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '860px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка модального окна */}
        <div
          style={{
            padding: '1rem 1.4rem',
            borderBottom: '1px solid var(--border, #2a2825)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(212, 162, 76, 0.1) 0%, transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <HankoSeal text="映" size="sm" variant="gold" shape="square" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f5f5f4', letterSpacing: '0.04em' }}>
                {title || 'Видеозапись техники'}
              </h3>
              {subtitle && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #a8a29e)', marginTop: '0.2rem' }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #a8a29e)',
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: '0.4rem',
              lineHeight: 1,
            }}
            title="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* Видеоплеер (16:9) */}
        <div style={{ width: '100%', aspectRatio: '16 / 9', backgroundColor: '#000', position: 'relative' }}>
          <VideoEmbed url={videoUrl} />
        </div>

        {/* Подвал модального окна */}
        <div
          style={{
            padding: '0.8rem 1.4rem',
            borderTop: '1px solid var(--border, #2a2825)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.85rem',
            backgroundColor: 'var(--surface-sunken, #0d0c0a)',
          }}
        >
          <span style={{ color: 'var(--text-muted, #a8a29e)' }}>
            Японские мастера Шотокан Карате-до (JKA / SKIF / WKF)
          </span>

          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-subtle"
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.8rem' }}
            >
              Открыть на YouTube ↗
            </a>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onClose}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
