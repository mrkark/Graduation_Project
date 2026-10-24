import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';

export default function KarateStudioPage() {
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 1;
    const isSmallScreen = window.innerWidth < 1024;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isSmallScreen || (isTouch && isMobileUA);
  });

  const [showQr, setShowQr] = useState(false);
  const [selectedCam, setSelectedCam] = useState('cam1');
  const [studioOnline, setStudioOnline] = useState(true);
  const [availableIps, setAvailableIps] = useState([]);
  const [publicTunnelUrl, setPublicTunnelUrl] = useState('');
  const [tunnelActive, setTunnelActive] = useState(false);
  const [networkMode, setNetworkMode] = useState('local'); // 'local' по умолчанию для домашнего Wi-Fi
  const [useHttps, setUseHttps] = useState(true); // HTTPS (8088) по умолчанию для камеры
  const [copied, setCopied] = useState(false);
  const [isEditingIp, setIsEditingIp] = useState(false);
  const [customIpInput, setCustomIpInput] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [realIp, setRealIp] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mocap_user_ip');
      if (saved && saved !== '127.0.0.1' && saved !== '10.131.233.47') return saved;
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return window.location.hostname;
      }
    }
    return '192.168.100.28';
  });

  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      try {
        const res = await fetch('/status');
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            const ip = data?.ip;
            if (ip && ip !== '127.0.0.1' && ip !== '10.131.233.47' && !ip.startsWith('172.')) {
              setRealIp((prev) => (prev && prev !== '10.131.233.47' && prev !== '127.0.0.1' ? prev : ip));
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
            const lIp = j?.data?.localIp;
            if (lIp && lIp !== '127.0.0.1' && lIp !== '10.131.233.47' && !lIp.startsWith('172.')) {
              setRealIp((prev) => (prev && prev !== '10.131.233.47' && prev !== '127.0.0.1' ? prev : lIp));
            }
            if (Array.isArray(j?.data?.localIps) && j.data.localIps.length > 0) {
              const filtered = j.data.localIps.filter((item) => item.ip !== '10.131.233.47');
              setAvailableIps(filtered);
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

  const displayHost = (realIp && realIp !== '10.131.233.47' && realIp !== '127.0.0.1')
    ? realIp
    : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
        ? window.location.hostname
        : '192.168.100.28');

  const studioUrl = '/studio';

  const isTunnelAvailable = Boolean(publicTunnelUrl && tunnelActive);
  const activeMode = (networkMode === 'tunnel' && isTunnelAvailable) ? 'tunnel' : (isTunnelAvailable ? networkMode : 'local');

  const activeCamUrl = (activeMode === 'tunnel' && publicTunnelUrl)
    ? `${publicTunnelUrl}/${selectedCam}`
    : `${useHttps ? 'https' : 'http'}://${displayHost}:${useHttps ? '8088' : '8000'}/${selectedCam}`;

  const handleCopyLink = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(activeCamUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSaveCustomIp = (ipToSave) => {
    const trimmed = (ipToSave || customIpInput).trim();
    if (trimmed) {
      setRealIp(trimmed);
      if (typeof window !== 'undefined') {
        localStorage.setItem('mocap_user_ip', trimmed);
      }
      setIsEditingIp(false);
    }
  };

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
      title: 'Камера 1 — Фронтальная (0° · Основание буквы T)',
      desc: 'Установите телефон спереди во весь рост по центру. Отвечает за оси X и Y, лицо, плечи и прямые удары.',
      badgeColor: '#10b981',
    },
    cam2: {
      title: 'Камера 2 — Левая боковая (+90° · Левое плечо буквы T)',
      desc: 'Установите телефон слева под 90°. Считывает физическую глубину Z левой стороны и движения левой руки при прижатии к корпусу.',
      badgeColor: '#06b6d4',
    },
    cam3: {
      title: 'Камера 3 — Правая боковая (-90° · Правое плечо буквы T)',
      desc: 'Установите третий телефон справа под 90°. Считывает физическую глубину Z правой стороны и позицию правого кулака в хикитэ у бедра.',
      badgeColor: '#a855f7',
    },
  };

  useEffect(() => {
    const handleResize = () => {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 1;
      const isSmallScreen = window.innerWidth < 1024;
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobileOrTablet(isSmallScreen || (isTouch && isMobileUA));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobileOrTablet) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 80px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        background: '#0d0e12',
        color: '#e2e8f0',
        textAlign: 'center',
      }}>
        <div style={{
          maxWidth: '520px',
          background: '#161822',
          border: '1px solid #282d3c',
          borderRadius: '16px',
          padding: '2.5rem 1.8rem',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>💻</div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f59e0b', margin: '0 0 0.8rem' }}>
            Доступно только на компьютерах
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 1.6rem' }}>
            Страница <strong>Мокап 3D (Karate Motion Studio)</strong> предназначена исключительно для мониторов ПК и ноутбуков. На планшетах и телефонах 3D-студией с множественными камерами пользоваться неудобно.
          </p>
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '10px',
            padding: '1rem',
            marginBottom: '1.8rem',
            textAlign: 'left',
          }}>
            <p style={{ fontSize: '0.88rem', color: '#fef3c7', margin: 0, lineHeight: 1.5 }}>
              📱 <strong>Как использовать телефон:</strong> откройте эту страницу на компьютере и отсканируйте камерой телефона QR-код — телефон подключится как беспроводная камера захвата движений!
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/kata" className="btn btn-primary" style={{ padding: '0.65rem 1.4rem', textDecoration: 'none' }}>
              🥋 В каталог Ката
            </Link>
            <Link to="/" className="btn btn-subtle" style={{ padding: '0.65rem 1.4rem', textDecoration: 'none' }}>
              ⛩️ На главную
            </Link>
          </div>
        </div>
      </div>
    );
  }

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

          {/* Селектор протокола и настройка IP адреса */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', background: '#13151f', padding: '6px 12px', borderRadius: '8px', border: '1px solid #232738' }}>
            <span style={{ fontSize: '11.5px', color: '#9ca3af' }}>Протокол:</span>
            <button
              type="button"
              onClick={() => setUseHttps(true)}
              style={{
                background: useHttps ? '#10b981' : '#1e2230',
                color: useHttps ? '#000' : '#d1d5db',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🔒 HTTPS (8088)
            </button>
            <button
              type="button"
              onClick={() => setUseHttps(false)}
              style={{
                background: !useHttps ? '#f59e0b' : '#1e2230',
                color: !useHttps ? '#000' : '#d1d5db',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🔓 HTTP (8000)
            </button>

            <span style={{ color: '#4b5563', margin: '0 4px' }}>|</span>

            {isEditingIp ? (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="192.168.100.28"
                  value={customIpInput}
                  onChange={(e) => setCustomIpInput(e.target.value)}
                  style={{
                    background: '#0d0e14',
                    border: '1px solid #10b981',
                    color: '#fff',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '11px',
                    width: '120px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleSaveCustomIp()}
                  style={{ background: '#10b981', color: '#000', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingIp(false)}
                  style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '11px' }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11.5px', color: '#6ee7b7', fontFamily: 'monospace' }}>IP: {displayHost}</span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomIpInput(displayHost);
                    setIsEditingIp(true);
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid #374151',
                    color: '#9ca3af',
                    borderRadius: '4px',
                    padding: '1px 5px',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  ✏️ Сменить
                </button>
              </div>
            )}
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
                  {cid === 'cam1' && '🟢 Камера 1 (Фронт · T-база)'}
                  {cid === 'cam2' && '🔵 Камера 2 (Слева 90° · T-плечо)'}
                  {cid === 'cam3' && '🟣 Камера 3 (Справа 90° · T-плечо)'}
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
            maxWidth: '780px',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <img
                src={qrDataUrl || `/qr/${selectedCam}.png`}
                onError={(e) => { e.currentTarget.src = `http://${displayHost}:8000/qr/${selectedCam}.png`; }}
                alt="QR Code"
                style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: '8px',
                  background: '#fff',
                  padding: '4px',
                  border: `2px solid ${camDescriptions[selectedCam].badgeColor}`,
                }}
              />
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Сканируйте камерой</span>
            </div>

            <div style={{ flex: 1, minWidth: '300px' }}>
              <h4 style={{ color: camDescriptions[selectedCam].badgeColor, fontSize: '15px', marginBottom: '4px', fontWeight: 800 }}>
                {camDescriptions[selectedCam].title}
              </h4>
              <p style={{ color: '#d1d5db', fontSize: '12.5px', lineHeight: 1.45, marginBottom: '8px' }}>
                {camDescriptions[selectedCam].desc}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', background: '#12151e', padding: '6px 10px', borderRadius: '6px', border: '1px solid #232a3b' }}>
                <a
                  href={activeCamUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#6ee7b7', fontWeight: 700, textDecoration: 'underline', fontSize: '12px', fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}
                >
                  {activeCamUrl}
                </a>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{
                    background: copied ? '#10b981' : '#1f2430',
                    color: copied ? '#000' : '#e2e8f0',
                    border: '1px solid #374151',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {copied ? '✓ Скопировано' : '📋 Копия'}
                </button>
              </div>

              {/* Пошаговая инструкция для успешного подключения */}
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '6px', padding: '8px 12px', fontSize: '11.5px', color: '#d1d5db', lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, color: '#10b981', marginBottom: '2px' }}>📱 Инструкция для телефона:</div>
                <div>1. Телефон должен быть в одной сети Wi-Fi с компьютером.</div>
                <div>2. Отсканируйте QR-код и откройте ссылку в мобильном браузере.</div>
                <div>3. При предупреждении о сертификате: на <strong>Android</strong> нажмите <em>«Дополнительно» → «Перейти на сайт»</em>; на <strong>iPhone</strong> нажмите <em>«Показать подробности» → «Посетить сайт»</em>.</div>
                <div>4. Нажмите <strong>«Разрешить»</strong> для доступа к видеокамере.</div>
              </div>
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
