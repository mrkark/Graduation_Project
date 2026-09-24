import { useState, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import KarateMasterModel from '../three/KarateMasterModel';
import { SHOTOKAN_STANCES } from '../three/KaratekaAvatar';
import TraditionalDojo from '../three/TraditionalDojo';
import './MotionLabPage.css';

// Описания динамических техник для информационной панели
const TECHNIQUE_DESCRIPTIONS = {
  choku_zuki: {
    label: '👊 Чоку-цуки (Прямой удар кулаком на месте)',
    desc: 'Базовый прямой удар кулаком со спиральным вращением предплечья (кимэ) и одновременным мощным отводом второй руки в хикитэ у ребер.',
  },
  oi_zuki: {
    label: '👊 Ой-цуки (Прямой удар с выпадом в чудан)',
    desc: 'Базовый пробивающий удар с шагом вперед из стойки Йой в Дзэнкуцу-дати. Ударная рука наносит прямой удар с вращением кулака, вторая рука резко срывается в хикитэ у бедра.',
  },
  gyaku_zuki: {
    label: '💥 Гяку-цуки (Обратный реверсивный удар от бедра)',
    desc: 'Один из самых мощных и фундаментальных ударов каратэ. Наносится разноименной рукой от бедра с максимальным взрывным вращением таза и фиксацией кимэ.',
  },
  kizami_zuki: {
    label: '⚡ Кизами-цуки (Быстрый передний удар — джеб каратэ)',
    desc: 'Хлесткий жалящий удар передней рукой в верхний уровень (дзёдан) с микро-подшагом и мгновенным возвратом в стойку готовности Йой.',
  },
  ren_zuki: {
    label: '🔄 Рэн-цуки (Связка «двойка»: левый джеб + правый прямой)',
    desc: 'Классическая серия из двух непрерывных ударов руками: первый удар открывает оборону соперника, второй наносит сокрушительный урон.',
  },
  uraken_uchi: {
    label: '🥊 Уракэн-учи (Хлесткий удар тыльной стороной кулака)',
    desc: 'Круговой удар тыльной стороной кулака в висок или нос. Выполняется за счет резкого щелчка локтевого сустава и запястья.',
  },
  tetsui_uchi: {
    label: '🔨 Тэтцуи-учи (Удар кулаком-молотом сверху-вниз)',
    desc: 'Нисходящий сокрушительный удар основанием сжатого кулака (молот) по ключице или затылку противника.',
  },
  empi_uchi: {
    label: '💥 Эмпи-учи / Хидзи-атэ (Сокрушительный удар локтем)',
    desc: 'Круговой удар локтем (маваси-эмпи) на короткой дистанции. Ладонь второй руки встречает кулак для максимального концентрированного импульса.',
  },
  shuto_uchi: {
    label: '✋ Сюто-учи (Рубящий удар ребром открытой ладони)',
    desc: 'Диагональный рубящий удар ребром ладони (рука-меч) в область шеи или ключицы, с взведением ладони от противоположного уха.',
  },
  morote_zuki: {
    label: '⚡ Моротэ-цуки (Двойной параллельный удар двумя кулаками)',
    desc: 'Одновременный пробивающий удар обоими кулаками вперед на уровне груди из двойного хикитэ. Пробивает блок противника.',
  },
  hook: {
    label: '🥊 Каги-цуки (Боковой крюк кулаком в корпус)',
    desc: 'Боковой крюк согнутой рукой в подреберье в низкой укорененной стойке Киба-дати.',
  },
  age_uke: {
    label: '🛡️ Агэ-укэ (Верхний восходящий блок головы)',
    desc: 'Восходящий блок предплечьем под углом 45° над лбом для отражения атак сверху.',
  },
  soto_uke: {
    label: '🛡️ Сото-укэ (Блок предплечьем снаружи-внутрь)',
    desc: 'Мощный сбивающий блок предплечьем снаружи-внутрь от уха к центральной линии корпуса в стойке Дзэнкуцу-дати.',
  },
  uchi_uke: {
    label: '🛡️ Ути-укэ (Блок предплечьем изнутри-наружу)',
    desc: 'Защитный блок предплечьем снизу-вверх и наружу из-под противоположного локтя со сжатым кулаком.',
  },
  gedan_barai: {
    label: '🥋 Гэдан-барай (Нижний смет предплечьем)',
    desc: 'Канонический нижний смет атакующих ударов в пах или средний уровень с отводом второй руки в хикитэ.',
  },
  shuto_uke: {
    label: '✋ Сюто-укэ (Блок ребром ладони в Кокуцу-дати)',
    desc: 'Защитный блок открытой ладонью с распределением 70% веса на согнутой задней ноге.',
  },
  mae_geri: {
    label: '🦶 Маэ-гэри (Прямой хлесткий удар ногой)',
    desc: 'Прямой удар подушечками пальцев стопы (коси) в корпус с подъемом колена и резким щелчком.',
  },
  yoko_geri: {
    label: '🦶 Ёко-гэри кэкоми (Боковой проникающий удар ногой)',
    desc: 'Сокрушительный линейный удар ребром стопы (сокуто) с высоким подъемом колена к груди и полным включением таза.',
  },
  kick: {
    label: '🔄 Маваси-гэри (Круговой удар ногой)',
    desc: 'Взрывной круговой удар ногой по дуге с доворотом опорной стопы на 180°.',
  },
  mawashi_geri: {
    label: '🔄 Маваси-гэри (Круговой удар ногой)',
    desc: 'Взрывной круговой удар ногой по дуге с доворотом опорной стопы на 180°.',
  },
  ushiro_geri: {
    label: '🦶 Усиро-гэри (Удар ногой назад пяткой)',
    desc: 'Прямолинейный удар пяткой (какато) назад с поворотом головы через плечо для контроля цели и балансирующим наклоном корпуса.',
  },
  step: {
    label: '🥋 Цуги-аси (Скользящий подшаг)',
    desc: 'Быстрое сокращение дистанции (ма-ай) для входа в атаку без потери равновесия.',
  },
};

export default function MotionLabPage() {
  const [mode, setMode] = useState('bunkai-2'); // 'kata' | 'bunkai-2' | 'bunkai-3'
  const [masterStance, setMasterStance] = useState('ready'); // По умолчанию каноническая стойка Йой (ноги на ширине плеч, руки вниз и вперед)
  const [activeClip, setActiveClip] = useState(null);
  const [performer, setPerformer] = useState('all'); // 'all' | 'tori' | 'uke'
  const [cameraView, setCameraView] = useState('free'); // 'free' | 'front' | 'side' | 'top'
  const controlsRef = useRef();

  function triggerTechnique(clipId) {
    setActiveClip(null);
    setTimeout(() => {
      setActiveClip(clipId);
    }, 30);
  }

  function resetToYoi() {
    setMasterStance('ready');
    setActiveClip(null);
  }

  function setView(view) {
    setCameraView(view);
    if (!controlsRef.current) return;
    if (view === 'front') {
      controlsRef.current.object.position.set(0, 1.15, 2.6);
      controlsRef.current.target.set(0, 0.95, 0);
    } else if (view === 'side') {
      controlsRef.current.object.position.set(2.8, 1.15, 0);
      controlsRef.current.target.set(0, 0.95, 0);
    } else if (view === 'top') {
      controlsRef.current.object.position.set(0, 4.2, 0.1);
      controlsRef.current.target.set(0, 0, 0);
    } else {
      controlsRef.current.object.position.set(1.6, 1.25, 2.4);
      controlsRef.current.target.set(0, 0.95, 0);
    }
  }

  // Определение информации для карточки текущего движения
  const currentActionInfo = activeClip
    ? TECHNIQUE_DESCRIPTIONS[activeClip] || { label: activeClip, desc: 'Техника в исполнении мастера' }
    : SHOTOKAN_STANCES[masterStance] || SHOTOKAN_STANCES.ready;

  return (
    <div className="motion-lab-page">
      {/* Заголовок страницы */}
      <div className="motion-lab__header">
        <div className="motion-lab__title-wrap">
          <span style={{ fontSize: '2.2rem' }}>🥋</span>
          <div>
            <h1>3D Додзё Лаборатория (Motion Lab)</h1>
            <p className="motion-lab__desc">
              Интерактивная трёхмерная симуляция традиционного зала Шотокан. Начальное положение всех аватаров — каноническая стойка <strong>Йой</strong> (ноги на ширине плеч, руки опущены вниз и вперед). Отрабатывайте удары руками (цуки, учи), блоки и синхронный кихон в реальном времени.
            </p>
          </div>
        </div>
      </div>

      {/* Верхняя панель конфигурации поединка и стоек */}
      <div className="motion-lab__config-panel">
        {/* Формат демонстрации */}
        <div className="config-group">
          <label>Формат демонстрации в Додзё</label>
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn ${mode === 'kata' ? 'active' : ''}`}
              onClick={() => setMode('kata')}
            >
              🥋 Одиночное Ката (Тори)
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'bunkai-2' ? 'active' : ''}`}
              onClick={() => setMode('bunkai-2')}
            >
              ⚔️ Спарринг Бункай (2 Мастера)
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'bunkai-3' ? 'active' : ''}`}
              onClick={() => setMode('bunkai-3')}
            >
              👥 Бункай на 3 человека (Шотокан)
            </button>
          </div>
        </div>

        {/* Исполнитель техники (если в зале больше 1 мастера) */}
        {mode !== 'kata' && (
          <div className="config-group">
            <label>Исполнитель техники в зале</label>
            <div className="mode-toggle">
              <button
                type="button"
                className={`mode-btn ${performer === 'all' ? 'active' : ''}`}
                onClick={() => setPerformer('all')}
                title="Все мастера выполняют удар одновременно"
              >
                👥 Все аватары (Синхронно)
              </button>
              <button
                type="button"
                className={`mode-btn ${performer === 'tori' ? 'active' : ''}`}
                onClick={() => setPerformer('tori')}
                title="Только главный мастер Тори"
              >
                🥋 Тори (Белое кимоно)
              </button>
              <button
                type="button"
                className={`mode-btn ${performer === 'uke' ? 'active' : ''}`}
                onClick={() => setPerformer('uke')}
                title="Только нападающий Укэ"
              >
                ⚔️ Укэ (Синее кимоно)
              </button>
            </div>
          </div>
        )}

        {/* Выбор стойки */}
        <div className="config-group">
          <label htmlFor="master-stance-select">Каноническая стойка (База)</label>
          <select
            id="master-stance-select"
            style={{
              padding: '8px 12px',
              borderRadius: 4,
              backgroundColor: '#171310',
              color: '#ffffff',
              border: '1px solid var(--color-gold)',
              fontSize: '0.94rem',
              fontWeight: 500,
            }}
            value={masterStance}
            onChange={(e) => {
              setMasterStance(e.target.value);
              setActiveClip(null);
            }}
          >
            {Object.keys(SHOTOKAN_STANCES).map((k) => (
              <option key={k} value={k} style={{ backgroundColor: '#1a1613', color: '#ffffff' }}>
                {SHOTOKAN_STANCES[k].label}
              </option>
            ))}
          </select>
        </div>

        {/* Ракурс камеры */}
        <div className="config-group">
          <label>Ракурс камеры в зале</label>
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn ${cameraView === 'free' ? 'active' : ''}`}
              onClick={() => setView('free')}
            >
              🔄 360° Свободный
            </button>
            <button
              type="button"
              className={`mode-btn ${cameraView === 'front' ? 'active' : ''}`}
              onClick={() => setView('front')}
            >
              👁 Спереди
            </button>
            <button
              type="button"
              className={`mode-btn ${cameraView === 'side' ? 'active' : ''}`}
              onClick={() => setView('side')}
            >
              📐 Профиль
            </button>
            <button
              type="button"
              className={`mode-btn ${cameraView === 'top' ? 'active' : ''}`}
              onClick={() => setView('top')}
            >
              🧭 Сверху
            </button>
          </div>
        </div>

        {/* 1. БЛОК УДАРОВ РУКАМИ (ЦУКИ И УЧИ) */}
        <div className="config-group" style={{ flex: '1 1 100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ color: 'var(--color-gold)', fontWeight: 700, fontSize: '0.92rem' }}>
              👊 Удары руками каратэ Шотокан (Цуки и Учи — из стойки Йой)
            </label>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              10 базовых техник рук с возвратом в Йой
            </span>
          </div>
          <div className="mode-toggle" style={{ flexWrap: 'wrap', gap: 6 }}>
            <button
              type="button"
              className={`mode-btn btn-strike ${activeClip === 'choku_zuki' ? 'active' : ''}`}
              onClick={() => triggerTechnique('choku_zuki')}
            >
              👊 Чоку-цуки (Прямой удар)
            </button>
            <button
              type="button"
              className={`mode-btn btn-strike ${activeClip === 'oi_zuki' ? 'active' : ''}`}
              onClick={() => triggerTechnique('oi_zuki')}
            >
              👊 Ой-цуки (Прямой с выпадом)
            </button>
            <button
              type="button"
              className={`mode-btn btn-strike ${activeClip === 'gyaku_zuki' ? 'active' : ''}`}
              onClick={() => triggerTechnique('gyaku_zuki')}
            >
              💥 Гяку-цуки (Реверс от бедра)
            </button>
            <button
              type="button"
              className={`mode-btn btn-strike ${activeClip === 'kizami_zuki' ? 'active' : ''}`}
              onClick={() => triggerTechnique('kizami_zuki')}
            >
              ⚡ Кизами-цуки (Передний джеб)
            </button>
            <button
              type="button"
              className={`mode-btn btn-strike ${activeClip === 'ren_zuki' ? 'active' : ''}`}
              onClick={() => triggerTechnique('ren_zuki')}
            >
              🔄 Рэн-цуки (Двойка ударов)
            </button>
            <button
              type="button"
              className={`mode-btn btn-strike ${activeClip === 'uraken_uchi' ? 'active' : ''}`}
              onClick={() => triggerTechnique('uraken_uchi')}
            >
              🥊 Уракэн-учи (Бэкфист дзёдан)
            </button>
            <button
              type="button"
              className={`mode-btn btn-strike ${activeClip === 'tetsui_uchi' ? 'active' : ''}`}
              onClick={() => triggerTechnique('tetsui_uchi')}
            >
              🔨 Тэтцуи-учи (Удар-молот)
            </button>
            <button
              type="button"
              className={`mode-btn btn-strike ${activeClip === 'empi_uchi' ? 'active' : ''}`}
              onClick={() => triggerTechnique('empi_uchi')}
            >
              💥 Эмпи-учи (Удар локтем)
            </button>
            <button
              type="button"
              className={`mode-btn btn-strike ${activeClip === 'shuto_uchi' ? 'active' : ''}`}
              onClick={() => triggerTechnique('shuto_uchi')}
            >
              ✋ Сюто-учи (Рубящий ладонью)
            </button>
            <button
              type="button"
              className={`mode-btn btn-strike ${activeClip === 'morote_zuki' ? 'active' : ''}`}
              onClick={() => triggerTechnique('morote_zuki')}
            >
              ⚡ Моротэ-цуки (Двойной удар)
            </button>
            <button
              type="button"
              className={`mode-btn btn-strike ${activeClip === 'hook' ? 'active' : ''}`}
              onClick={() => triggerTechnique('hook')}
            >
              🥊 Каги-цуки (Крюк в корпус)
            </button>
          </div>
        </div>

        {/* 2. БЛОКИ И УДАРЫ НОГАМИ */}
        <div className="config-group" style={{ flex: '1 1 100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ color: 'var(--washi-dim)', fontWeight: 600, fontSize: '0.88rem' }}>
              🛡️ Защитные блоки и удары ногами (Гэри / Укэ)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`mode-btn btn-yoi-reset ${!activeClip && masterStance === 'ready' ? 'active' : ''}`}
                onClick={resetToYoi}
                title="Сбросить всех аватаров в исходную стойку Йой (ноги на ширине плеч, руки вниз и вперед)"
              >
                🧘 Стойка Йой (Исходная позиция)
              </button>
            </div>
          </div>
          <div className="mode-toggle" style={{ flexWrap: 'wrap', gap: 6 }}>
            <button
              type="button"
              className={`mode-btn ${activeClip === 'age_uke' ? 'active' : ''}`}
              onClick={() => triggerTechnique('age_uke')}
            >
              🛡️ Агэ-укэ (Верхний блок головы)
            </button>
            <button
              type="button"
              className={`mode-btn ${activeClip === 'soto_uke' ? 'active' : ''}`}
              onClick={() => triggerTechnique('soto_uke')}
            >
              🛡️ Сото-укэ (Блок снаружи)
            </button>
            <button
              type="button"
              className={`mode-btn ${activeClip === 'uchi_uke' ? 'active' : ''}`}
              onClick={() => triggerTechnique('uchi_uke')}
            >
              🛡️ Ути-укэ (Блок изнутри)
            </button>
            <button
              type="button"
              className={`mode-btn ${activeClip === 'gedan_barai' ? 'active' : ''}`}
              onClick={() => triggerTechnique('gedan_barai')}
            >
              🥋 Гэдан-барай (Нижний смет)
            </button>
            <button
              type="button"
              className={`mode-btn ${activeClip === 'shuto_uke' ? 'active' : ''}`}
              onClick={() => triggerTechnique('shuto_uke')}
            >
              ✋ Сюто-укэ (Блок ребром ладони)
            </button>
            <button
              type="button"
              className={`mode-btn ${activeClip === 'mae_geri' ? 'active' : ''}`}
              onClick={() => triggerTechnique('mae_geri')}
            >
              🦶 Маэ-гэри (Прямой удар ногой)
            </button>
            <button
              type="button"
              className={`mode-btn ${activeClip === 'yoko_geri' ? 'active' : ''}`}
              onClick={() => triggerTechnique('yoko_geri')}
            >
              🦶 Ёко-гэри (Боковой удар)
            </button>
            <button
              type="button"
              className={`mode-btn ${activeClip === 'kick' || activeClip === 'mawashi_geri' ? 'active' : ''}`}
              onClick={() => triggerTechnique('mawashi_geri')}
            >
              🔄 Маваси-гэри (Круговой удар)
            </button>
            <button
              type="button"
              className={`mode-btn ${activeClip === 'ushiro_geri' ? 'active' : ''}`}
              onClick={() => triggerTechnique('ushiro_geri')}
            >
              🦶 Усиро-гэри (Удар назад)
            </button>
            <button
              type="button"
              className={`mode-btn ${activeClip === 'step' ? 'active' : ''}`}
              onClick={() => triggerTechnique('step')}
            >
              🥋 Цуги-аси (Подшаг)
            </button>
          </div>
        </div>
      </div>

      {/* Полноэкранная интерактивная 3D-сцена Додзё */}
      <div className="motion-lab__workspace">
        <div className="workspace-panel scene-3d-panel">
          <div className="panel-badge-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-approved">3D Традиционное Додзё (WebGL)</span>
              <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>
                {activeClip ? `Приём: ${currentActionInfo.label}` : currentActionInfo.label}
              </span>
              {mode !== 'kata' && (
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
                  ({performer === 'all' ? 'Синхронно: все бойцы' : performer === 'tori' ? 'Исполняет Тори' : 'Исполняет Укэ'})
                </span>
              )}
            </div>
            <span>Левая кнопка мыши: вращение • Колесо: приближение</span>
          </div>

          <div className="canvas-container">
            <Canvas shadows camera={{ position: [0, 1.1, 2.45], fov: 42 }} style={{ width: '100%', height: '100%' }}>
              <color attach="background" args={['#18120d']} />

              {/* Теплое гармоничное освещение традиционного зала */}
              <ambientLight intensity={0.95} color="#fff6eb" />
              <directionalLight
                position={[4, 6, 4]}
                intensity={1.6}
                color="#fffcf5"
                castShadow
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
              />
              <pointLight position={[-3, 2, -2]} intensity={0.7} color="#f5b358" />
              <pointLight position={[3, 2, -2]} intensity={0.7} color="#f5b358" />

              {/* Полная 3D среда японского Додзё: деревянный пол, татами, перегородки сёдзи, камидза, свиток и фонари */}
              <TraditionalDojo />

              {/* Мастера в кимоно, стоящие прямо на татами Y = 0 */}
              <Suspense fallback={null}>
                {/* Главный мастер (Тори) в белоснежном доги с черным поясом */}
                <group position={[0, 0, 0]}>
                  <KarateMasterModel
                    role="tori"
                    stance={masterStance}
                    activeClip={(performer === 'all' || performer === 'tori') ? activeClip : null}
                  />
                </group>

                {/* Первый спарринг-партнер (Укэ) в темно-синем доги */}
                {(mode === 'bunkai-2' || mode === 'bunkai-3') && (
                  <group position={[1.4, 0, 0.2]} rotation={[0, -Math.PI * 0.75, 0]}>
                    <KarateMasterModel
                      role="uke"
                      stance={masterStance}
                      activeClip={(performer === 'all' || performer === 'uke') ? activeClip : null}
                    />
                  </group>
                )}

                {/* Второй нападающий (Укэ-2) в графитовом доги */}
                {mode === 'bunkai-3' && (
                  <group position={[-1.3, 0, 0.75]} rotation={[0, Math.PI * 0.45, 0]}>
                    <KarateMasterModel
                      role="uke2"
                      stance={masterStance}
                      activeClip={performer === 'all' ? activeClip : null}
                    />
                  </group>
                )}
              </Suspense>

              {/* Мягкие естественные тени на татами */}
              <ContactShadows position={[0, 0.003, 0]} opacity={0.75} scale={8} blur={2.0} far={2.2} />

              <OrbitControls
                ref={controlsRef}
                minDistance={1.3}
                maxDistance={6.5}
                maxPolarAngle={Math.PI / 2 - 0.03}
                target={[0, 0.95, 0]}
              />
            </Canvas>
          </div>

          {/* Информационная панель текущей техники/стойки под сценой */}
          <div className="scene-controls">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-gold)' }}>
                  {activeClip ? 'Исполняемый приём каратэ' : 'Текущее положение (Стойка)'}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-washi)', marginTop: 2 }}>
                  {currentActionInfo.label}
                </div>
                <div style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', marginTop: 4, maxWidth: '75ch', lineHeight: 1.35 }}>
                  {currentActionInfo.desc}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={resetToYoi}
                  style={{ border: '1px solid var(--color-gold)', color: 'var(--color-gold)' }}
                >
                  🧘 В стойку Йой
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-gold"
                  onClick={() => setView('free')}
                >
                  🔄 Сброс камеры
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
