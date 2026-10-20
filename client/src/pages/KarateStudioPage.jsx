import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';

export default function KarateStudioPage() {
  const [showQr, setShowQr] = useState(false);
  const [selectedCam, setSelectedCam] = useState('cam1');
  const [studioOnline, setStudioOnline] = useState(true);
  const [availableIps, setAvailableIps] = useState([]);
  const [publicTunnelUrl, setPublicTunnelUrl] = useState('');
  const [tunnelActive, setTunnelActive] = useState(false);
  const [networkMode, setNetworkMode] = useState('tunnel'); // 'tunnel' | 'local'
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [realIp, setRealIp] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return window.location.hostname;
    }
    return '';
  });

  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        if (mounted) setRealIp((prev) => prev || window.location.hostname);
      }
      try {
        const res = await fetch('/status');
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            if (data?.ip && data.ip !== '127.0.0.1') {
              setRealIp((prev) => prev || data.ip);
            }
            setStudioOnline(true);
          }
        } else if (mounted) {
          setStudioOnline(false);
        }
      } catch {
        if (mounted) setStudioOnline(false);
      }

      try {
        const r = await fetch('/api/mocap/tunnel');
        if (r.ok) {
          const j = await r.json();
          if (mounted) {
            if (j?.data?.localIp && j.data.localIp !== '127.0.0.1') {
              setRealIp((prev) => prev || j.data.localIp);
            }
            if (Array.isArray(j?.data?.localIps) && j.data.localIps.length > 0) {
              setAvailableIps(j.data.localIps);
            }
            if (j?.data?.publicUrl) {
              setPublicTunnelUrl(j.data.publicUrl);
              setTunnelActive(Boolean(j.data.tunnelActive));
            }
          }
        }
      } catch {}
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const displayHost = realIp || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.hostname : '127.0.0.1');
  const studioUrl = '/studio';

  const isTunnelAvailable = Boolean(publicTunnelUrl && tunnelActive);
  const activeMode = (networkMode === 'tunnel' && isTunnelAvailable) ? 'tunnel' : (isTunnelAvailable ? networkMode : 'local');

  const activeCamUrl = (activeMode === 'tunnel' && publicTunnelUrl)
    ? `${publicTunnelUrl}/${selectedCam}`
    : `https://${displayHost}:8088/${selectedCam}`;

  // Генерация динамического QR-кода при смене ссылки
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(activeCamUrl, { width: 256, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl(`/qr/${selectedCam}.png`);
      });
    return () => {
      active = false;
    };
  }, [activeCamUrl, selectedCam]);

  const camDescriptions = {
    cam1: {
      title: 'Камера 1 — Фронтальная (0°)',
      desc: 'Установите телефон спереди во весь рост на уровне солнечного сплетения. Отвечает за оси X и Y, руки, корпус и позицию.',
      badgeColor: '#10b981',
    },
    cam2: {
      title: 'Камера 2 — Боковая глубина (90°)',
      desc: 'Установите второй телефон сбоку. Рассчитывает физическую глубину стоек (ось Z) и длину выпадов дзенкуцу-дати.',
      badgeColor: '#06b6d4',
    },
    cam3: {
      title: 'Камера 3 — Диагональная (45°)',
      desc: 'Установите третий телефон под углом 45°. Устраняет слепые зоны и перекрытия рук при скручиваниях и ударах.',
      badgeColor: '#a855f7',
    },
  };

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column', background: '#0d0e12', overflow: 'hidden' }}>
      {/* Top Banner Toolbar */}
      <div style={{
        background: '#161822',
        borderBottom: '1px solid #282d3c',
        padding: '8px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/kata" style={{ color: 'var(--color-gold, #f59e0b)', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
            <span>←</span> <span>В каталог Ката</span>
          </Link>
          <span style={{ color: '#4b5563' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🥋</span>
            <span style={{ fontWeight: 800, color: '#ffffff', fontSize: '14px', letterSpacing: '0.4px' }}>
              KARATE MOTION STUDIO
            </span>
            {studioOnline ? (
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#10b981',
                fontWeight: 700,
              }}>
                🟢 AI Python Движок Активен (8000 / 8088)
              </span>
            ) : (
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                fontWeight: 700,
              }}>
                🔴 Оффлайн (запустите start_python_mocap.bat)
              </span>
            )}
          </div>
          {availableIps.length > 1 ? (
            <select
              value={realIp}
              onChange={(e) => setRealIp(e.target.value)}
              title="Выберите сетевой IP для подключения телефона"
              style={{
                background: '#1f2430',
                color: '#6ee7b7',
                border: '1px solid #374151',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              {availableIps.map((item) => (
                <option key={item.ip} value={item.ip}>
                  {item.name}: {item.ip}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ color: '#9ca3af', fontSize: '12px', fontFamily: 'monospace' }}>
              IP: {displayHost}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setShowQr(!showQr)}
            style={{
              background: 'linear-gradient(135deg, #059669, #10b981)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 0 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            <span>📱</span>
            <span>{showQr ? 'Скрыть QR' : 'QR для телефона (Камера)'}</span>
          </button>

          <a
            href={studioUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              background: '#252936',
              border: '1px solid #374151',
              color: '#e5e7eb',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🚀</span>
            <span>Открыть во весь экран</span>
          </a>
        </div>
      </div>

      {/* Multi-Camera QR Code Flyout */}
      {showQr && (
        <div style={{
          background: 'rgba(17, 20, 29, 0.98)',
          borderBottom: '1px solid #282d3c',
          padding: '14px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          backdropFilter: 'blur(10px)',
          zIndex: 9,
        }}>
          {/* Network Mode Switcher: 4G/LTE Global vs Local Wi-Fi */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0e1017', padding: '4px', borderRadius: '8px', border: '1px solid #2d3345' }}>
            <button
              type="button"
              onClick={() => setNetworkMode('tunnel')}
              style={{
                background: activeMode === 'tunnel' ? '#2563eb' : 'transparent',
                color: activeMode === 'tunnel' ? '#ffffff' : '#9ca3af',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>🌐</span>
              <span>4G / LTE (Любая сеть / Интернет)</span>
              {isTunnelAvailable ? (
                <span style={{ fontSize: '10px', background: '#10b981', color: '#000', padding: '1px 5px', borderRadius: '4px' }}>АКТИВЕН</span>
              ) : (
                <span style={{ fontSize: '10px', background: '#eab308', color: '#000', padding: '1px 5px', borderRadius: '4px' }}>ОФФЛАЙН</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setNetworkMode('local')}
              style={{
                background: activeMode === 'local' ? '#10b981' : 'transparent',
                color: activeMode === 'local' ? '#000000' : '#9ca3af',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>🏠</span>
              <span>Локальный Wi-Fi (В одной сети с ПК)</span>
            </button>
          </div>

          {/* Camera Switcher Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {['cam1', 'cam2', 'cam3'].map((cid) => {
              const active = selectedCam === cid;
              const info = camDescriptions[cid];
              return (
                <button
                  key={cid}
                  type="button"
                  onClick={() => setSelectedCam(cid)}
                  style={{
                    background: active ? info.badgeColor : '#1e2230',
                    color: active ? '#000000' : '#d1d5db',
                    border: `1px solid ${active ? info.badgeColor : '#374151'}`,
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cid === 'cam1' && '🟢 Камера 1 (Фронт)'}
                  {cid === 'cam2' && '🔵 Камера 2 (Сбоку 90°)'}
                  {cid === 'cam3' && '🟣 Камера 3 (Диагональ 45°)'}
                </button>
              );
            })}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
            flexWrap: 'wrap',
            maxWidth: '750px',
          }}>
            <img
              src={qrDataUrl || `/qr/${selectedCam}.png`}
              onError={(e) => { e.currentTarget.src = `http://${displayHost}:8000/qr/${selectedCam}.png`; }}
              alt="QR Code"
              style={{
                width: '128px',
                height: '128px',
                borderRadius: '8px',
                background: '#fff',
                padding: '4px',
                border: `2px solid ${camDescriptions[selectedCam].badgeColor}`,
              }}
            />
            <div style={{ flex: 1, minWidth: '280px' }}>
              <h4 style={{ color: camDescriptions[selectedCam].badgeColor, fontSize: '15px', marginBottom: '4px', fontWeight: 800 }}>
                {camDescriptions[selectedCam].title}
              </h4>
              <p style={{ color: '#d1d5db', fontSize: '12.5px', lineHeight: 1.45, marginBottom: '6px' }}>
                {camDescriptions[selectedCam].desc}
              </p>
              <div style={{ fontSize: '11.5px', color: '#9ca3af', marginBottom: '6px' }}>
                💡 <i>Все подключенные камеры объединяются в <b>одну общую 3D-модель</b> каратиста без дублирования.</i>
              </div>
              <div style={{ fontSize: '12px', fontFamily: 'monospace', color: camDescriptions[selectedCam].badgeColor, wordBreak: 'break-all' }}>
                {activeMode === 'tunnel' ? '🌐 Глобальная ссылка (4G / Интернет): ' : '🏠 Локальная ссылка (Wi-Fi): '}
                <a href={activeCamUrl} target="_blank" rel="noreferrer" style={{ color: '#6ee7b7', fontWeight: 700, textDecoration: 'underline' }}>
                  {activeCamUrl}
                </a>
              </div>
              {activeMode === 'tunnel' ? (
                <div style={{ fontSize: '11px', color: isTunnelAvailable ? '#10b981' : '#f59e0b', marginTop: '4px' }}>
                  {isTunnelAvailable ? (
                    '✅ Телефон может быть в ЛЮБОЙ сети (4G/5G/LTE/другой Wi-Fi). Доступно отовсюду!'
                  ) : (
                    '⚠️ Туннель не запущен. Для удаленного захвата запустите start_mocap_tunnel.bat'
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                  (При первом открытии по локальной сети подтвердите сертификат: «Дополнительно» → «Перейти на сайт»)
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowQr(false)}
              style={{
                background: 'transparent',
                border: '1px solid #4b5563',
                color: '#d1d5db',
                borderRadius: '6px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                alignSelf: 'flex-start',
              }}
            >
              ✕ Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Main Viewport */}
      {studioOnline ? (
        <iframe
          src={studioUrl}
          title="Karate Motion Studio"
          style={{
            width: '100%',
            flex: 1,
            border: 'none',
            background: '#111216',
          }}
          allow="camera; microphone; accelerometer; gyroscope"
        />
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '30px',
          textAlign: 'center',
          color: '#e5e7eb',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🥋</div>
          <h2 style={{ fontSize: '1.4rem', color: '#f59e0b', marginBottom: '10px' }}>
            Python AI Сервер MoCap не запущен
          </h2>
          <p style={{ maxWidth: '560px', color: '#9ca3af', lineHeight: 1.6, marginBottom: '20px', fontSize: '0.95rem' }}>
            Для работы захвата движений через Python-движок запустите файл <code>start_python_mocap.bat</code> в корне проекта или скрипт <code>karate_motion_studio/run_web_studio.bat</code>.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.location.reload()}
              style={{ padding: '10px 24px' }}
            >
              🔄 Проверить подключение
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
