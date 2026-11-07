import { useState, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Monitor,
  Smartphone,
  Camera,
  Video,
  Layers,
  Home,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Lock,
  Unlock,
  Shield,
  Zap,
  Edit3,
  Copy,
  Check,
  X,
  RefreshCw,
  Globe,
  Maximize2,
  QrCode,
  BookOpen,
  Play,
  Square,
  Download,
  Film,
  Sparkles,
  Trash2,
} from 'lucide-react';

import './KarateStudio.css';
const ModularMotionMixer = lazy(() => import('../three/ModularMotionMixer'));

function checkIsMobileOrTablet() {
  if (typeof window === 'undefined') return false;
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isMobileOrTabletUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|PlayBook|Silk/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSmallOrTabletWidth = window.innerWidth <= 1180;
  return isSmallOrTabletWidth || isMobileOrTabletUA || (isTouch && window.innerWidth <= 1366);
}

export default function KarateStudioPage() {
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(checkIsMobileOrTablet);
  const [activeStudioTab, setActiveStudioTab] = useState('live_mocap');

  // Recording State: Exactly TWO modes: 'full' (целиком) vs 'layered' (по слоям)
  const [recMode, setRecMode] = useState('full'); // 'full' | 'layered'
  const [activeLayer, setActiveLayer] = useState('lower'); // 'lower' | 'upper' | 'fingers'
  const [isRecording, setIsRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [lastSavedFile, setLastSavedFile] = useState(null);
  const [isSubmittingRec, setIsSubmittingRec] = useState(false);
  const [layersData, setLayersData] = useState({
    lower: { recorded: false, frames_count: 0, duration: 0 },
    upper: { recorded: false, frames_count: 0, duration: 0 },
    fingers: { recorded: false, frames_count: 0, duration: 0 },
  });

  // QR Modal State
  const [showQr, setShowQr] = useState(false);
  const [selectedCam, setSelectedCam] = useState('cam1');
  const [studioOnline, setStudioOnline] = useState(true);
  const [availableIps, setAvailableIps] = useState([]);
  const [publicTunnelUrl, setPublicTunnelUrl] = useState('');
  const [tunnelActive, setTunnelActive] = useState(false);
  const [networkMode, setNetworkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mocap_network_mode');
      if (saved) return saved;
    }
    return 'tunnel';
  });
  const [selectedPort, setSelectedPort] = useState('8088');
  const [copied, setCopied] = useState(false);
  const [isEditingIp, setIsEditingIp] = useState(false);
  const [customIpInput, setCustomIpInput] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrRefreshCounter, setQrRefreshCounter] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realIp, setRealIp] = useState(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const urlIp = searchParams.get('ip');
      if (urlIp && urlIp !== '127.0.0.1' && !urlIp.startsWith('172.')) return urlIp;
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return window.location.hostname;
      }
      const saved = localStorage.getItem('mocap_user_ip');
      if (saved && saved !== '127.0.0.1' && !saved.startsWith('172.') && saved !== '192.168.100.28' && saved !== '192.168.100.6') return saved;
    }
    return '';
  });

  const layerMeta = {
    lower: {
      name: 'Ноги и стойки',
      short: '1. Ноги',
      icon: '🦵',
      desc: 'Стойки, приседания, перемещения по татами',
      color: '#10b981',
    },
    upper: {
      name: 'Корпус, руки и голова',
      short: '2. Корпус и голова',
      icon: '🥋',
      desc: 'Удары руками, блоки, повороты корпуса, наклон головы и взгляд (Metsuke)',
      color: '#3b82f6',
    },
    fingers: {
      name: 'Кисти и пальцы',
      short: '3. Пальцы (доп.)',
      icon: '✊',
      desc: 'Тонкая дозапись кулаков (сэйкэн), ладоней (сюто, нукитэ) и пальцев',
      color: '#a855f7',
    },
  };

  const camDescriptions = {
    cam1: {
      title: 'Камера 1 — Фронтальная (0°)',
      short: 'Фронт (0°)',
      desc: 'Установите телефон спереди во весь рост по центру. Считывает ширину X, высоту Y, лицо, плечи и прямые удары.',
      badgeColor: '#10b981',
      role: 'Главная база захвата',
    },
    cam2: {
      title: 'Камера 2 — Левая боковая (+90°)',
      short: 'Слева (+90°)',
      desc: 'Установите телефон слева под 90°. Считывает физическую глубину Z, стойки и заведение рук за голову.',
      badgeColor: '#06b6d4',
      role: 'Левый 3D профиль Z',
    },
    cam3: {
      title: 'Камера 3 — Правая боковая (-90°)',
      short: 'Справа (-90°)',
      desc: 'Установите телефон справа под 90°. Считывает физическую глубину Z правой стороны и кулак в хикитэ.',
      badgeColor: '#a855f7',
      role: 'Правый 3D профиль Z',
    },
  };

  // Status check loop
  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      try {
        const res = await fetch('/status');
        if (res.ok) {
          if (mounted) setStudioOnline(true);
        } else if (mounted) {
          setStudioOnline(false);
        }
      } catch {
        if (mounted) setStudioOnline(false);
      }

      // Record status
      try {
        const rRec = await fetch('/api/record/status');
        if (rRec.ok) {
          const dRec = await rRec.json();
          if (mounted) {
            setIsRecording(Boolean(dRec.is_recording));
            if (typeof dRec.duration === 'number') setRecDuration(dRec.duration);
            if (dRec.last_recording) setLastSavedFile(dRec.last_recording);
          }
        }
      } catch {}

      // Layer status
      try {
        const rLayer = await fetch('/api/record/layer/status');
        if (rLayer.ok) {
          const dLayer = await rLayer.json();
          if (mounted && dLayer?.layers) {
            setLayersData(dLayer.layers);
            if (dLayer.recording_mode) setRecMode(dLayer.recording_mode);
            const sLayer = dLayer.active_layer === "head_fingers" ? "fingers" : dLayer.active_layer;
            if (sLayer && ['lower', 'upper', 'fingers'].includes(sLayer)) {
              setActiveLayer((prev) => {
                if (['lower', 'upper', 'fingers'].includes(prev) && !dLayer.is_recording) {
                  return prev;
                }
                return sLayer;
              });
            }
          }
        }
      } catch {}

      // Tunnel info
      try {
        const r = await fetch('/api/mocap/tunnel');
        if (r.ok) {
          const j = await r.json();
          if (mounted && j?.data) {
            const lIp = j.data.localIp;
            if (lIp && lIp !== '127.0.0.1' && !lIp.startsWith('172.')) {
              setRealIp((prev) => (prev && prev !== '192.168.100.6' ? prev : lIp));
            }
            if (Array.isArray(j.data.localIps) && j.data.localIps.length > 0) {
              setAvailableIps(j.data.localIps);
            }
            if (j.data.publicUrl) {
              setPublicTunnelUrl(j.data.publicUrl);
              const isAct = Boolean(j.data.tunnelActive);
              setTunnelActive(isAct);
              if (isAct && !localStorage.getItem('mocap_network_mode')) {
                setNetworkMode('tunnel');
              }
            }
          }
        }
      } catch {}
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Duration timer
  useEffect(() => {
    let t = null;
    if (isRecording) {
      t = setInterval(() => {
        setRecDuration((d) => d + 1);
      }, 1000);
    }
    return () => {
      if (t) clearInterval(t);
    };
  }, [isRecording]);

  // Layer switch
  const handleSelectLayer = async (layer) => {
    setActiveLayer(layer);
    try {
      await fetch(`/api/record/layer/select?layer=${layer}`, { method: 'POST' });
    } catch (e) {
      console.error('Error selecting layer:', e);
    }
  };

  // Mode switch
  const handleSwitchMode = async (mode) => {
    setRecMode(mode);
    try {
      await fetch(`/api/record/mode?mode=${mode}`, { method: 'POST' });
      if (mode === 'layered') {
        const cur = ['lower', 'upper', 'fingers'].includes(activeLayer) ? activeLayer : 'lower';
        setActiveLayer(cur);
        await fetch(`/api/record/layer/select?layer=${cur}`, { method: 'POST' });
      }
    } catch (e) {
      console.error('Error switching recording mode:', e);
    }
  };

  // Toggle record
  const handleToggleRecord = async () => {
    if (isSubmittingRec) return;
    setIsSubmittingRec(true);
    try {
      if (!isRecording) {
        const url = recMode === 'layered'
          ? `/api/record/layer/start?layer=${activeLayer}`
          : '/api/record/start';
        const res = await fetch(url, { method: 'POST' });
        if (res.ok) {
          setIsRecording(true);
          setRecDuration(0);
        }
      } else {
        const url = recMode === 'layered'
          ? '/api/record/layer/stop'
          : '/api/record/stop';
        const res = await fetch(url, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setIsRecording(false);
          if (data && data.filename) {
            setLastSavedFile(data);
          }
          if (recMode === 'layered') {
            const rL = await fetch('/api/record/layer/status');
            if (rL.ok) {
              const dL = await rL.json();
              if (dL?.layers) setLayersData(dL.layers);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error toggling record:', e);
    } finally {
      setIsSubmittingRec(false);
    }
  };

  // Merge layers
  const handleMergeLayers = async () => {
    if (isSubmittingRec) return;
    setIsSubmittingRec(true);
    try {
      const res = await fetch('/api/record/layer/merge', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.filename) {
          setLastSavedFile(data);
        }
      }
    } catch (e) {
      console.error('Error merging layers:', e);
    } finally {
      setIsSubmittingRec(false);
    }
  };

  // Clear layers
  const handleClearLayers = async () => {
    try {
      const res = await fetch('/api/record/layer/clear', { method: 'POST' });
      if (res.ok) {
        setLayersData({
          lower: { recorded: false, frames_count: 0, duration: 0 },
          upper: { recorded: false, frames_count: 0, duration: 0 },
          fingers: { recorded: false, frames_count: 0, duration: 0 },
        });
        handleSelectLayer('lower');
      }
    } catch (e) {
      console.error('Error clearing layers:', e);
    }
  };

  const displayHost = (realIp && realIp !== '127.0.0.1' && !realIp.startsWith('172.'))
    ? realIp
    : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
        ? window.location.hostname
        : (availableIps[0]?.ip || '10.129.167.47'));

  // Use embedded mode so iframe doesn't render duplicate headers/buttons
  const studioEmbeddedUrl = '/studio?embedded=1';
  const studioStandaloneUrl = '/studio';

  const isTunnelAvailable = Boolean(publicTunnelUrl && tunnelActive);
  const activeMode = (networkMode === 'local') ? 'local' : (isTunnelAvailable ? 'tunnel' : 'local');
  const portProtocol = (selectedPort === '8000' || selectedPort === '5173') ? 'http' : 'https';
  const activeCamUrl = (activeMode === 'tunnel' && publicTunnelUrl)
    ? `${publicTunnelUrl}/${selectedCam}`
    : `${portProtocol}://${displayHost}:${selectedPort}/${selectedCam}`;

  const handleCopyLink = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(activeCamUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleRefreshQrAndIp = async () => {
    setIsRefreshing(true);
    try {
      const r = await fetch('/api/mocap/refresh', { method: 'POST' });
      if (r.ok) {
        const j = await r.json();
        if (j?.data?.localIp) {
          setRealIp(j.data.localIp);
          if (Array.isArray(j.data.localIps)) setAvailableIps(j.data.localIps);
        }
      }
    } catch {
      try {
        const r2 = await fetch('/api/mocap/tunnel');
        if (r2.ok) {
          const j2 = await r2.json();
          if (j2?.data?.localIp) setRealIp(j2.data.localIp);
        }
      } catch {}
    } finally {
      setQrRefreshCounter((c) => c + 1);
      setTimeout(() => setIsRefreshing(false), 700);
    }
  };

  const handleSaveCustomIp = async (ipToSave) => {
    const trimmed = (ipToSave || customIpInput).trim();
    if (trimmed) {
      setRealIp(trimmed);
      if (typeof window !== 'undefined') {
        localStorage.setItem('mocap_user_ip', trimmed);
      }
      setIsEditingIp(false);
      try {
        await fetch('/api/mocap/tunnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ localIp: trimmed }),
        });
      } catch {}
      setQrRefreshCounter((c) => c + 1);
    }
  };

  // Dynamic QR generation
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(activeCamUrl, {
      width: 260,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl(`/qr/${selectedCam}.png?ip=${displayHost}&port=${selectedPort}&t=${Date.now()}`);
      });
    return () => {
      active = false;
    };
  }, [activeCamUrl, selectedCam, qrRefreshCounter]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileOrTablet(checkIsMobileOrTablet());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const countRecordedLayers = Object.values(layersData).filter((l) => l && l.recorded).length;
  const coreRecordedCount = (layersData.lower?.recorded ? 1 : 0) + (layersData.upper?.recorded ? 1 : 0);
  const timeFormatted = Math.floor(recDuration / 60).toString().padStart(2, '0') + ':' + Math.floor(recDuration % 60).toString().padStart(2, '0');

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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.2rem' }}>
            <Monitor size={56} color="#f59e0b" />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f59e0b', margin: '0 0 0.8rem' }}>
            Доступно только на компьютерах
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 1.6rem' }}>
            Страница <strong>Мокап 3D (Karate Motion Studio)</strong> предназначена для мониторов ПК и ноутбуков. На смартфонах и планшетах открывайте QR-код камеры.
          </p>
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '10px',
            padding: '1rem',
            marginBottom: '1.8rem',
            textAlign: 'left',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
          }}>
            <Smartphone size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '0.88rem', color: '#fef3c7', margin: 0, lineHeight: 1.5 }}>
              <strong>Как подключить телефон:</strong> откройте эту страницу на ПК и отсканируйте камерой телефона QR-код — телефон сразу подключится как камера захвата!
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/kata" className="btn btn-primary" style={{ padding: '0.65rem 1.4rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <BookOpen size={15} />
              <span>В каталог Ката</span>
            </Link>
            <Link to="/" className="btn btn-subtle" style={{ padding: '0.65rem 1.4rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Home size={15} />
              <span>На главную</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column', background: '#0b0c10', overflow: 'hidden' }}>
      
      {/* SINGLE UNIFIED TOP TOOLBAR */}
      <div className="studio-topbar">
        {/* Left: Navigation & Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/kata" className="studio-btn-back">
            <span>←</span> <span>Ката</span>
          </Link>
          <span style={{ color: '#374151' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Video size={17} color="#f59e0b" />
            <span className="studio-title-badge">
              KARATE MOCAP STUDIO
            </span>
            <span className={`studio-status-pill ${studioOnline ? 'online' : 'offline'}`}>
              {studioOnline ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
              <span>{studioOnline ? 'AI готов' : 'Оффлайн'}</span>
            </span>
          </div>
        </div>

        {/* Center: THE CLEAN RECORDING CONTROLS */}
        <div className="studio-controls-dock">
          {/* Segmented Switch: ONLY TWO CHOICES */}
          <div className="studio-mode-deck">
            <button
              type="button"
              onClick={() => handleSwitchMode('full')}
              className={`studio-mode-pill ${recMode === 'full' ? 'active full' : ''}`}
              title="Записать всю анимацию целиком за один дубль"
            >
              <Film size={12} />
              <span>Целиком</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('layered')}
              className={`studio-mode-pill ${recMode === 'layered' ? 'active layered' : ''}`}
              title="Создавать анимацию послойно: 1. Ноги и стойки + 2. Корпус с руками и головой (+ опционально пальцы)"
            >
              <Layers size={12} />
              <span>По слоям ({coreRecordedCount}/2)</span>
            </button>
          </div>

          {/* Conditional Control Area */}
          {recMode === 'full' ? (
            /* Mode 1: Full-Body Recording */
            <button
              type="button"
              onClick={handleToggleRecord}
              disabled={isSubmittingRec}
              className={`studio-rec-btn ${isRecording ? 'recording' : 'idle'}`}
            >
              {isRecording ? <Square size={12} fill="#ef4444" /> : <Play size={12} fill="#ffffff" />}
              <span>{isRecording ? `СТОП ЗАПИСЬ (${timeFormatted})` : 'НАЧАТЬ ЗАПИСЬ (REC)'}</span>
            </button>
          ) : (
            /* Mode 2: Layered Recording */
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Layer Selection Pills */}
              <div className="studio-layers-deck">
                {['lower', 'upper', 'fingers'].map((key) => {
                  const meta = layerMeta[key] || layerMeta.upper;
                  const isSelected = activeLayer === key;
                  const isDone = Boolean(layersData[key]?.recorded || (key === 'fingers' && layersData.head_fingers?.recorded));

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectLayer(key)}
                      className={`studio-layer-chip ${isSelected ? 'active' : ''} ${isDone ? 'done' : ''}`}
                      style={{
                        background: isSelected ? meta.color : undefined,
                        color: isSelected ? (key === 'lower' ? '#000000' : '#ffffff') : undefined,
                      }}
                      title={meta.desc}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.short}</span>
                      {isDone && <span style={{ fontWeight: 800 }}>✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Record current layer button */}
              <button
                type="button"
                onClick={handleToggleRecord}
                disabled={isSubmittingRec}
                className={`studio-rec-btn ${isRecording ? 'recording' : 'idle'}`}
              >
                {isRecording ? <Square size={11} fill="#ef4444" /> : <Play size={11} fill="#ffffff" />}
                <span>{isRecording ? `СТОП СЛОЙ (${timeFormatted})` : `Записать ${(layerMeta[activeLayer] || layerMeta.upper).name}`}</span>
              </button>

              {/* Merge into Kata Button */}
              {countRecordedLayers > 0 && (
                <button
                  type="button"
                  onClick={handleMergeLayers}
                  disabled={isSubmittingRec}
                  className="studio-btn-merge"
                  title="Объединить слои в один итоговый файл анимации Ката"
                >
                  <Sparkles size={12} />
                  <span>Собрать Ката</span>
                </button>
              )}

              {/* Reset Layers Button */}
              {countRecordedLayers > 0 && (
                <button
                  type="button"
                  onClick={handleClearLayers}
                  className="studio-btn-clear"
                  title="Сбросить записанные слои"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Studio Tabs, QR button & Fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Tab Switcher */}
          <div className="studio-tab-deck">
            <button
              type="button"
              onClick={() => setActiveStudioTab('live_mocap')}
              className={`studio-tab-btn ${activeStudioTab === 'live_mocap' ? 'active dojo' : ''}`}
            >
              <Camera size={12} />
              <span>3D Додзё</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveStudioTab('mixer')}
              className={`studio-tab-btn ${activeStudioTab === 'mixer' ? 'active mixer' : ''}`}
            >
              <Layers size={12} />
              <span>Микшер</span>
            </button>
          </div>

          {/* QR Button */}
          <button
            type="button"
            onClick={() => setShowQr(!showQr)}
            className={`studio-btn-qr ${showQr ? 'active' : ''}`}
          >
            <QrCode size={13} />
            <span>{showQr ? 'Скрыть QR' : 'Камера телефона (QR)'}</span>
          </button>

          {/* Fullscreen external */}
          <a
            href={studioStandaloneUrl}
            target="_blank"
            rel="noreferrer"
            className="studio-btn-external"
            title="Открыть MoCap студию в отдельном окне"
          >
            <Maximize2 size={13} />
          </a>
        </div>
      </div>

      {/* REDESIGNED CYBER-DOJO QR CODE MODAL WITH INTERACTIVE T-SCHEME */}
      {showQr && (
        <div style={{
          background: 'rgba(11, 13, 20, 0.98)',
          borderBottom: '2px solid rgba(245, 158, 11, 0.35)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.85)',
          zIndex: 9,
          maxHeight: '82vh',
          overflowY: 'auto',
        }}>
          {/* Modal Header */}
          <div style={{ width: '100%', maxWidth: '860px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🥋</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.4px' }}>
                  ПОДКЛЮЧЕНИЕ СМАРТФОНОВ · Т-СХЕМА КАМЕР ДОДЗЁ
                </h3>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Работает с <strong>любым количеством телефонов (1, 2 или 3)</strong>: можно начать даже с одного!
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowQr(false)}
              className="studio-modal-close-btn"
            >
              <X size={13} />
              <span>Закрыть</span>
            </button>
          </div>

          {/* INTERACTIVE TOP-DOWN T-SCHEME CAMERA MAP */}
          <div style={{
            width: '100%',
            maxWidth: '860px',
            background: 'radial-gradient(ellipse at center, #171b29 0%, #0d0f17 100%)',
            border: '1px solid #283045',
            borderRadius: '12px',
            padding: '14px 18px',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                📐 Нажмите на камеру на схеме, чтобы сгенерировать QR-код:
              </span>
            </div>

            {/* T-Scheme Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              {/* Top: Cam 1 (Frontal 0°) */}
              <button
                type="button"
                onClick={() => setSelectedCam('cam1')}
                className={`studio-t-cam-card cam1 ${selectedCam === 'cam1' ? 'active' : ''}`}
              >
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: '#10b981', fontWeight: 800, fontSize: '12px' }}>
                    📹 КАМЕРА 1 (ФРОНТ · 0°)
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '10px' }}>
                    Основание T · Во весь рост спереди (X/Y оси, лицо, кулаки)
                  </div>
                </div>
                {selectedCam === 'cam1' && (
                  <span style={{ background: '#10b981', color: '#000', fontSize: '9px', fontWeight: 800, padding: '2px 5px', borderRadius: '4px' }}>
                    ВЫБРАНА
                  </span>
                )}
              </button>

              {/* Vertical connector line */}
              <div style={{ width: '2px', height: '18px', background: 'linear-gradient(to bottom, #10b981, #f59e0b)' }} />

              {/* Middle row: Cam 2 (Left) --- Karateka Center --- Cam 3 (Right) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', flexWrap: 'wrap' }}>
                {/* Cam 2 Left */}
                <button
                  type="button"
                  onClick={() => setSelectedCam('cam2')}
                  className={`studio-t-cam-card cam2 ${selectedCam === 'cam2' ? 'active' : ''}`}
                >
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06b6d4', boxShadow: '0 0 6px #06b6d4' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ color: '#06b6d4', fontWeight: 800, fontSize: '11.5px' }}>
                      📹 КАМЕРА 2 (СЛЕВА · +90°)
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '9.5px' }}>
                      Левый 3D профиль Z · Заведение за голову
                    </div>
                  </div>
                  {selectedCam === 'cam2' && (
                    <span style={{ background: '#06b6d4', color: '#000', fontSize: '8.5px', fontWeight: 800, padding: '2px 4px', borderRadius: '4px' }}>
                      ВЫБРАНА
                    </span>
                  )}
                </button>

                {/* Horizontal Connector Left */}
                <div style={{ width: '22px', height: '2px', background: 'linear-gradient(to right, #06b6d4, #f59e0b)' }} />

                {/* Center: Dojo Athlete */}
                <div style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '2px dashed #f59e0b',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '18px' }}>🥋</div>
                  <div style={{ color: '#fef08a', fontWeight: 800, fontSize: '10.5px' }}>
                    Каратист
                  </div>
                  <div style={{ color: '#f59e0b', fontSize: '9px' }}>
                    Лицом к Камере 1
                  </div>
                </div>

                {/* Horizontal Connector Right */}
                <div style={{ width: '22px', height: '2px', background: 'linear-gradient(to right, #f59e0b, #a855f7)' }} />

                {/* Cam 3 Right */}
                <button
                  type="button"
                  onClick={() => setSelectedCam('cam3')}
                  className={`studio-t-cam-card cam3 ${selectedCam === 'cam3' ? 'active' : ''}`}
                >
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7', boxShadow: '0 0 6px #a855f7' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ color: '#a855f7', fontWeight: 800, fontSize: '11.5px' }}>
                      📹 КАМЕРА 3 (СПРАВА · -90°)
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '9.5px' }}>
                      Правый 3D профиль Z · Кулак в хикитэ
                    </div>
                  </div>
                  {selectedCam === 'cam3' && (
                    <span style={{ background: '#a855f7', color: '#fff', fontSize: '8.5px', fontWeight: 800, padding: '2px 4px', borderRadius: '4px' }}>
                      ВЫБРАНА
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Network Switcher: 4G Global vs Local Wi-Fi */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0e1017', padding: '3px', borderRadius: '8px', border: '1px solid #2d3345' }}>
            <button
              type="button"
              onClick={() => {
                setNetworkMode('tunnel');
                if (typeof window !== 'undefined') localStorage.setItem('mocap_network_mode', 'tunnel');
              }}
              className={`studio-net-pill ${activeMode === 'tunnel' ? 'active' : ''}`}
            >
              <Globe size={12} />
              <span>Интернет 4G / LTE (Разные сети)</span>
              {isTunnelAvailable && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setNetworkMode('local');
                if (typeof window !== 'undefined') localStorage.setItem('mocap_network_mode', 'local');
              }}
              className={`studio-net-pill ${activeMode === 'local' ? 'active' : ''}`}
            >
              <Wifi size={12} />
              <span>Один Wi-Fi (Одна сеть)</span>
            </button>
          </div>

          {/* QR Code Presentation Box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            flexWrap: 'wrap',
            maxWidth: '800px',
            background: '#111420',
            border: `1px solid ${camDescriptions[selectedCam].badgeColor}40`,
            borderRadius: '12px',
            padding: '14px 18px',
          }}>
            {/* Left: High-Contrast QR Code */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
              <div style={{
                padding: '5px',
                background: '#ffffff',
                borderRadius: '8px',
                boxShadow: `0 0 16px ${camDescriptions[selectedCam].badgeColor}33`,
              }}>
                <img
                  src={qrDataUrl || `http://${displayHost}:8000/qr/${selectedCam}.png?port=${selectedPort}&t=${qrRefreshCounter}`}
                  onError={(e) => { e.currentTarget.src = `http://${displayHost}:8000/qr/${selectedCam}.png?port=${selectedPort}&t=` + Date.now(); }}
                  alt="QR Code"
                  style={{
                    width: '140px',
                    height: '140px',
                    display: 'block',
                  }}
                />
              </div>
              <span style={{ fontSize: '10.5px', color: '#9ca3af', fontWeight: 600 }}>
                Наведите камеру смартфона
              </span>
            </div>

            {/* Right: Camera Details, Direct Link & Instructions */}
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
                <span style={{
                  background: camDescriptions[selectedCam].badgeColor,
                  color: selectedCam === 'cam3' ? '#ffffff' : '#000000',
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '4px',
                }}>
                  {camDescriptions[selectedCam].role}
                </span>
                <h4 style={{ color: camDescriptions[selectedCam].badgeColor, fontSize: '14px', margin: 0, fontWeight: 800 }}>
                  {camDescriptions[selectedCam].title}
                </h4>
              </div>
              <p style={{ color: '#d1d5db', fontSize: '11.5px', lineHeight: 1.45, marginBottom: '8px' }}>
                {camDescriptions[selectedCam].desc}
              </p>

              {/* Direct Copyable Link */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', background: '#090b10', padding: '5px 8px', borderRadius: '6px', border: '1px solid #232a3b' }}>
                <a
                  href={activeCamUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#6ee7b7', fontWeight: 700, textDecoration: 'underline', fontSize: '11.5px', fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}
                >
                  {activeCamUrl}
                </a>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`studio-btn-copy ${copied ? 'copied' : 'idle'}`}
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
                </button>
              </div>

              {/* Mobile Quick Steps */}
              <div style={{ background: 'rgba(37, 99, 235, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', padding: '7px 10px', fontSize: '10.5px', color: '#cbd5e1', lineHeight: 1.4 }}>
                1. Отсканируйте QR или перейдите по ссылке выше в <strong>Safari / Chrome</strong> на телефоне.<br />
                2. Нажмите <strong>«Разрешить»</strong> для доступа к камере — видеопоток сразу оживит 3D каратиста на ПК!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SAVED RECORDING NOTIFICATION TOAST */}
      {lastSavedFile && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          borderBottom: '1px solid #10b981',
          padding: '7px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#d1fae5',
          fontSize: '12px',
          zIndex: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={15} color="#10b981" />
            <span>
              <strong>Ката анимация сохранена:</strong> {lastSavedFile.filename} ({lastSavedFile.frames || 0} кадров{lastSavedFile.duration ? ', ' + lastSavedFile.duration + ' сек' : ''})
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href={lastSavedFile.download_url || ('/uploads/recordings/' + lastSavedFile.filename)}
              download={lastSavedFile.filename}
              style={{
                background: '#10b981',
                color: '#000000',
                padding: '4px 10px',
                borderRadius: '5px',
                fontWeight: 800,
                fontSize: '11px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Download size={11} />
              <span>Скачать JSON</span>
            </a>
            <button
              type="button"
              onClick={() => setLastSavedFile(null)}
              style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '2px' }}
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT: Clean, Full-Height 3D Dojo Viewport */}
      {activeStudioTab === 'live_mocap' ? (
        <div style={{ flex: 1, position: 'relative', background: '#0b0c10', overflow: 'hidden' }}>
          <iframe
            src={studioEmbeddedUrl}
            title="Karate Motion Studio Viewport"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#0b0c10',
            }}
            allow="camera; microphone; accelerometer; gyroscope"
          />
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '16px', background: '#0b0c10' }}>
          <Suspense fallback={<div style={{ height: '100%', minHeight: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>Загрузка 3D микшера…</div>}>
            <ModularMotionMixer />
          </Suspense>
        </div>
      )}
    </div>
  );
}
