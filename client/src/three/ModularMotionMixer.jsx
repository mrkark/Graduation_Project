import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import KaratekaLowpolyModel, {
  synthesizeModularClip,
  registerCustomClip,
  resolveClip,
  getCachedClips,
  globalClipCache,
} from './KaratekaLowpolyModel';
import TraditionalDojo from './TraditionalDojo';
import {
  loadCustomLayers,
  saveCustomLayer,
  deleteCustomLayer,
  buildClipFromRecordedFrames,
  generateUnsuJump360Clip,
  loadAdminAnimationOverrides,
  saveAdminAnimationOverride,
  resetAdminAnimationOverride,
} from './customMotionManager';
import {
  loadMediaPipePose,
  mapPoseToAvatarBones,
} from '../utils/mocapPoseTracker';
import { useAuthStore } from '../store/authStore';
import {
  Play,
  RotateCcw,
  Download,
  Copy,
  Check,
  Layers,
  Sliders,
  Compass,
  Camera,
  Trash2,
  Square,
  Sparkles,
  Save,
  BookOpen,
  Zap,
  Shield,
  Radio,
  Settings,
  Flame,
  Activity,
  Scissors,
  CheckCircle2,
} from 'lucide-react';
import './modularMotionMixer.css';

// Пресеты нижнего слоя: Стойки и шаги Шотокан (In-Place)
export const MODULAR_STANCE_PRESETS = [
  { id: 'zenkutsu_dachi_left', name: 'Дзэнкуцу-дати (Левая)', type: 'stance', desc: 'Вес 70/30 на передней ноге, колено над пальцами' },
  { id: 'zenkutsu_dachi_right', name: 'Дзэнкуцу-дати (Правая)', type: 'stance', desc: 'Правосторонняя атакующая стойка' },
  { id: 'kokutsu_dachi_left', name: 'Кокуцу-дати (Защитная)', type: 'stance', desc: 'Вес 30/70 на задней ноге, пятки на одной линии' },
  { id: 'kiba_dachi', name: 'Киба-дати (Всадник)', type: 'stance', desc: 'Низкая устойчивая стойка, колени разведены' },
  { id: 'fudo_dachi', name: 'Фудо-дати (Боевая)', type: 'stance', desc: 'Прочная стойка корней дерева (Сотин)' },
  { id: 'idle_shizentai', name: 'Сидзэнтай (Естественная)', type: 'stance', desc: 'Стойка ожидания и готовности Йой' },
  { id: 'step_forward', name: 'Шаг вперед (Аюми-аси)', type: 'movement', desc: 'Плавный перенос центра тяжести вперед' },
  { id: 'heiko_dachi', name: 'Хэйко-дати (Параллельная)', type: 'stance', desc: 'Стопы на ширине плеч параллельно' },
];

// Пресеты верхнего слоя: Техники рук (удары, блоки, секущие)
export const MODULAR_TECHNIQUE_PRESETS = [
  { id: 'tech_gedan_barai_left', name: 'Гэдан-барай (Нижний блок)', type: 'block', desc: 'Смет нападающего удара в пах/живот (Ханми 45°)' },
  { id: 'tech_oi_zuki_right', name: 'Ой-цуки (Прямой выпад)', type: 'punch', desc: 'Мощный прямой удар кулаком на шаге (Сёмен 0°)' },
  { id: 'gyaku_zuki_right', name: 'Гяку-цуки (Реверсивный контрудар)', type: 'punch', desc: 'Удар противоположной от передней ноги рукой с доворотом таза' },
  { id: 'tech_age_uke_left', name: 'Агэ-укэ (Верхний блок)', type: 'block', desc: 'Защита головы и шеи предплечьем снизу вверх' },
  { id: 'tech_soto_uke_left', name: 'Сото-укэ (Блок снаружи-внутрь)', type: 'block', desc: 'Отбивающий блок круговым движением снаружи' },
  { id: 'tech_uchi_uke_left', name: 'Ути-укэ (Блок изнутри-наружу)', type: 'block', desc: 'Выбивание атакующей руки наружу от бедра' },
  { id: 'tech_shuto_uke_left', name: 'Сюто-укэ (Блок ребром ладони)', type: 'block', desc: 'Классическая защита ребром ладони в Кокуцу-дати' },
  { id: 'tech_uraken_right', name: 'Уракэн-ути (Хлесткий тыльный удар)', type: 'strike', desc: 'Хлесткий щелчок тыльной стороной кулака' },
  { id: 'tech_mae_empi_right', name: 'Маэ-эмпи (Удар локтем вперед)', type: 'strike', desc: 'Сокрушающий таранный удар локтем' },
  { id: 'tech_morote_zuki_right', name: 'Моротэ-цуки (Двойной удар)', type: 'punch', desc: 'Синхронный удар обоими кулаками' },
];

// Пресеты разворотов эмбусэн
export const MODULAR_TURN_PRESETS = [
  { deg: 0, label: '0° (Вперед)' },
  { deg: 90, label: '90° (Влево)' },
  { deg: -90, label: '-90° (Вправо)' },
  { deg: 180, label: '180° (Кругом)' },
  { deg: 270, label: '270° (Разворот назад-вправо)' },
];

// Динамические техники цельного тела (Full-Body Kata & Acrobatics)
// Включая уникальные движения мастера ката Унсу (Keetobi-geri 360 jump), комбинации и удары ногами
export const FULL_BODY_DYNAMICS_PRESETS = [
  {
    id: 'jump_turn_360',
    name: 'Унсу: Прыжок 360° (Кээтоби-гэри)',
    category: 'jump',
    desc: 'Взлет на 1.62м с разворотом на 360°, горизонтальным ударом ногой в воздухе и уходом в партерный смет на татами',
    badge: 'Unsu 雲手',
  },
  {
    id: 'kata_unsu',
    name: 'Унсу: Мастер-прогон ката (雲手)',
    category: 'kata',
    desc: 'Полный эталонный прогон элитного мастерского ката Унсу (Руки-облака) со всеми акробатическими переходами',
    badge: 'Master Kata',
  },
  {
    id: 'heian_shodan',
    name: 'Хэйан Сёдан: Мастер-прогон',
    category: 'kata',
    desc: 'Каноническое базовое ката Шотокан (21 форма: Дзэнкуцу-дати, Ой-цуки, Агэ-укэ, Тэцуи-ути)',
    badge: 'Kata',
  },
  {
    id: 'mae_geri_gyaku_zuki',
    name: 'Маэ-гэри + Гяку-цуки (Связка)',
    category: 'combo',
    desc: 'Проникающий удар ногой вперед с мгновенным нокаутирующим реверсивным ударом кулака',
    badge: 'Комбо',
  },
  {
    id: 'age_uke_gyaku_zuki',
    name: 'Агэ-укэ + Гяку-цуки (Связка)',
    category: 'combo',
    desc: 'Встречный верхний блок с последующей контратакой противоположным кулаком с доворотом таза',
    badge: 'Комбо',
  },
  {
    id: 'gankaku_shuto',
    name: 'Ганкаку-дати + Сюто-укэ (Журавль)',
    category: 'kata',
    desc: 'Баланс на одной ноге (Цуруаси-дати) с синхронным блоком ребром ладони',
    badge: 'Gankaku',
  },
  {
    id: 'mae_geri',
    name: 'Маэ-гэри (Прямой удар ногой)',
    category: 'kick',
    desc: 'Классический хлесткий или проникающий удар подушечками пальцев стопы (Тюсоку)',
    badge: 'Удар ногой',
  },
  {
    id: 'mawashi_geri',
    name: 'Маваси-гэри (Круговой удар ногой)',
    category: 'kick',
    desc: 'Мощный круговой удар подъемом стопы или коси в корпус или голову с выносом колена',
    badge: 'Удар ногой',
  },
  {
    id: 'yoko_geri',
    name: 'Ёко-гэри кэкоми (Боковой таранный)',
    category: 'kick',
    desc: 'Сокрушающий боковой удар ребром стопы (Сокуто) по прямой траектории',
    badge: 'Удар ногой',
  },
  {
    id: 'ushiro_geri',
    name: 'Усиро-гэри (Удар назад с разворотом)',
    category: 'kick',
    desc: 'Неожиданный мощный удар пяткой назад с быстрым доворотом таза через спину',
    badge: 'Удар ногой',
  },
  {
    id: 'choku_zuki',
    name: 'Тёку-цуки (Прямой удар на месте)',
    category: 'punch',
    desc: 'Фундаментальный прямой удар из стойки Сидзэнтай с полным закручиванием кулака',
    badge: 'Удар рукой',
  },
  {
    id: 'uraken_uchi',
    name: 'Уракэн-ути (Удар тыльной стороной)',
    category: 'strike',
    desc: 'Хлесткий секущий щелчок тыльной стороной кулака в висок или нос',
    badge: 'Удар рукой',
  },
  {
    id: 'empi_uchi',
    name: 'Эмпи-ути (Удар локтем)',
    category: 'strike',
    desc: 'Ближний разрушительный таранный удар локтем вперед-вверх',
    badge: 'Удар рукой',
  },
  {
    id: 'shuto_uchi',
    name: 'Сюто-ути (Секущий удар ребром ладони)',
    category: 'strike',
    desc: 'Рассекающий удар открытой ладонью в шею или ключицу',
    badge: 'Удар рукой',
  },
];

// Каталог готовых анимаций для панели Администратора
export const ADMIN_EDITABLE_CATALOG = [
  { group: 'Ката и акробатика', items: [
    { id: 'jump_turn_360', name: 'Унсу: Прыжок 360° (Кээтоби-гэри)', jp: '雲手 蹴飛蹴り / Unsu Keetobi-geri', cat: 'Прыжок' },
    { id: 'kata_unsu', name: 'Унсу (Мастер-ката 雲手)', jp: '雲手 / Unsu', cat: 'Ката' },
    { id: 'heian_shodan', name: 'Хэйан Сёдан', jp: '平安初段 / Heian Shodan', cat: 'Ката' },
    { id: 'mae_geri_gyaku_zuki', name: 'Маэ-гэри + Гяку-цуки', jp: '前蹴 逆突き / Combo', cat: 'Связка' },
    { id: 'age_uke_gyaku_zuki', name: 'Агэ-укэ + Гяку-цуки', jp: '揚受 逆突き / Combo', cat: 'Связка' },
    { id: 'gankaku_shuto', name: 'Ганкаку-дати + Сюто-укэ', jp: '岩鶴 鶴足立ち 手刀受け', cat: 'Ката' },
  ]},
  { group: 'Удары руками (Цуки и Ути)', items: [
    { id: 'choku_zuki', name: 'Тёку-цуки (Прямой удар)', jp: '直突き / Choku-zuki', cat: 'Удар рукой' },
    { id: 'oi_zuki', name: 'Ой-цуки (Удар с выпадом)', jp: '追突き / Oi-zuki', cat: 'Удар рукой' },
    { id: 'gyaku_zuki', name: 'Гяку-цуки (Реверсивный удар)', jp: '逆突き / Gyaku-zuki', cat: 'Удар рукой' },
    { id: 'kizami_zuki', name: 'Кидзами-цуки (Джеб передней рукой)', jp: '刻み突き / Kizami-zuki', cat: 'Удар рукой' },
    { id: 'ren_zuki', name: 'Рэн-цуки (Двойной удар)', jp: '連突き / Ren-zuki', cat: 'Удар рукой' },
    { id: 'sanbon_zuki', name: 'Санбон-цуки (Тройной удар)', jp: '三本突き / Sanbon-zuki', cat: 'Удар рукой' },
    { id: 'uraken_uchi', name: 'Уракэн-ути (Тыльный удар)', jp: '裏拳打ち / Uraken-uchi', cat: 'Удар рукой' },
    { id: 'tetsui_uchi', name: 'Тэцуи-ути (Удар кулаком-молотом)', jp: '鉄槌打ち / Tetsui-uchi', cat: 'Удар рукой' },
    { id: 'empi_uchi', name: 'Эмпи-ути (Удар локтем)', jp: '猿臂打ち / Empi-uchi', cat: 'Удар рукой' },
    { id: 'shuto_uchi', name: 'Сюто-ути (Удар ребром ладони)', jp: '手刀打ち / Shuto-uchi', cat: 'Удар рукой' },
    { id: 'morote_zuki', name: 'Моротэ-цуки (Двойной удар)', jp: '諸手突き / Morote-zuki', cat: 'Удар рукой' },
  ]},
  { group: 'Защитные блоки (Укэ)', items: [
    { id: 'gedan_barai', name: 'Гэдан-барай (Нижний блок)', jp: '下段払い / Gedan-barai', cat: 'Блок' },
    { id: 'age_uke', name: 'Агэ-укэ (Верхний блок)', jp: '揚げ受け / Age-uke', cat: 'Блок' },
    { id: 'soto_uke', name: 'Сото-укэ (Блок снаружи-внутрь)', jp: '外受け / Soto-uke', cat: 'Блок' },
    { id: 'uchi_uke', name: 'Ути-укэ (Блок изнутри-наружу)', jp: '内受け / Uchi-uke', cat: 'Блок' },
    { id: 'shuto_uke', name: 'Сюто-укэ (Блок ребром ладони)', jp: '手刀受け / Shuto-uke', cat: 'Блок' },
    { id: 'manji_uke', name: 'Мандзи-укэ (Двойной разноуровневый блок)', jp: '卍受け / Manji-uke', cat: 'Блок' },
  ]},
  { group: 'Удары ногами (Гэри)', items: [
    { id: 'mae_geri', name: 'Маэ-гэри (Прямой удар)', jp: '前蹴り / Mae-geri', cat: 'Удар ногой' },
    { id: 'mawashi_geri', name: 'Маваси-гэри (Круговой удар)', jp: '回し蹴り / Mawashi-geri', cat: 'Удар ногой' },
    { id: 'yoko_geri', name: 'Ёко-гэри кэкоми (Боковой таранный)', jp: '横蹴り蹴込み / Yoko-geri', cat: 'Удар ногой' },
    { id: 'ushiro_geri', name: 'Усиро-гэри (Удар пяткой назад)', jp: '後ろ蹴り / Ushiro-geri', cat: 'Удар ногой' },
  ]},
  { group: 'Стойки Шотокан (Дати)', items: [
    { id: 'stance_zenkutsu', name: 'Дзэнкуцу-дати', jp: '前屈立ち / Zenkutsu-dachi', cat: 'Стойка' },
    { id: 'stance_kokutsu', name: 'Кокуцу-дати', jp: '後屈立ち / Kokutsu-dachi', cat: 'Стойка' },
    { id: 'stance_kiba', name: 'Киба-дати', jp: '騎馬立ち / Kiba-dachi', cat: 'Стойка' },
    { id: 'stance_fudo', name: 'Фудо-дати', jp: '不動立ち / Fudo-dachi', cat: 'Стойка' },
    { id: 'stance_ready', name: 'Сидзэнтай (Йой)', jp: '自然体 / Shizentai', cat: 'Стойка' },
  ]},
];

export default function ModularMotionMixer() {
  // Авторизация и роль пользователя: проверка прав администратора
  const { role, user } = useAuthStore();
  const isAdmin = role === 'admin' || user?.role === 'admin';

  // Активная вкладка студии: 'mixer' | 'recorder' | 'library' | 'admin'
  const [activeTab, setActiveTab] = useState('mixer');

  // Режим микшера: 'modular' (Сборка слоев) или 'fullbody' (Динамика цельного тела / Унсу)
  const [motionMode, setMotionMode] = useState('modular'); // 'modular' | 'fullbody'

  // Пользовательские сохраненные слои
  const [customLayers, setCustomLayers] = useState(() => loadCustomLayers());

  // Выбранные слои в модульном режиме
  const [selectedStance, setSelectedStance] = useState('zenkutsu_dachi_left');
  const [selectedTechnique, setSelectedTechnique] = useState('tech_gedan_barai_left');

  // Выбранное движение в режиме цельного тела (Full-Body / Ката / Унсу)
  const [selectedFullBody, setSelectedFullBody] = useState('jump_turn_360');

  // Общие параметры воспроизведения
  const [selectedTurn, setSelectedTurn] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [isLooping, setIsLooping] = useState(true);
  const [replayTrigger, setReplayTrigger] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  // Тонкая настройка биомеханики (доворот корпуса Ханми 45° / Сёмен 0°)
  const [layerAdjustments, setLayerAdjustments] = useState({
    torsoTwist: 0,
  });

  // =========================================================================
  // СОСТОЯНИЕ РЕЖИМА АДМИНИСТРАТОРА: РЕДАКТОР АНИМАЦИЙ
  // =========================================================================
  const [adminSelectedAnim, setAdminSelectedAnim] = useState('jump_turn_360');
  const [adminDuration, setAdminDuration] = useState(2.0);
  const [adminTrimStart, setAdminTrimStart] = useState(0.0);
  const [adminTrimEnd, setAdminTrimEnd] = useState(2.0);
  const [adminSpeed, setAdminSpeed] = useState(1.0);
  const [adminYaw, setAdminYaw] = useState(0);
  const [adminLoop, setAdminLoop] = useState(false);
  const [adminTitle, setAdminTitle] = useState('Унсу: Прыжок 360° (Кээтоби-гэри)');
  const [adminJapanese, setAdminJapanese] = useState('雲手 蹴飛蹴り / Unsu Keetobi-geri');
  const [adminCategory, setAdminCategory] = useState('Прыжок');
  const [adminNotes, setAdminNotes] = useState('Канонический 360° прыжок ката Унсу с выносом ноги и приземлением в партерный смет');
  const [adminStatusMessage, setAdminStatusMessage] = useState('');
  const [adminTrackCount, setAdminTrackCount] = useState(0);
  const [adminActivePreviewClip, setAdminActivePreviewClip] = useState(null);

  // Инициализация при смене редактируемой анимации админом
  useEffect(() => {
    let raw = resolveClip(adminSelectedAnim) || globalClipCache.get(adminSelectedAnim);
    if (!raw && adminSelectedAnim === 'jump_turn_360') {
      raw = generateUnsuJump360Clip('jump_turn_360');
    }

    // Поиск метаданных в каталоге
    let foundMeta = null;
    for (const group of ADMIN_EDITABLE_CATALOG) {
      const it = group.items.find((x) => x.id === adminSelectedAnim);
      if (it) {
        foundMeta = it;
        break;
      }
    }

    const dur = raw ? raw.duration : 1.5;
    setAdminDuration(dur);
    setAdminTrimStart(0.0);
    setAdminTrimEnd(dur);
    setAdminTrackCount(raw ? raw.tracks.length : 0);
    setAdminActivePreviewClip(null);

    if (foundMeta) {
      setAdminTitle(foundMeta.name);
      setAdminJapanese(foundMeta.jp || '');
      setAdminCategory(foundMeta.cat || 'Техника');
    } else {
      setAdminTitle(adminSelectedAnim);
    }
  }, [adminSelectedAnim]);

  // При монтировании регистрируем все кастомные слои в Three.js
  useEffect(() => {
    customLayers.forEach((layer) => {
      if (layer.clipJson) {
        try {
          const parsed = THREE.AnimationClip.parse(layer.clipJson);
          registerCustomClip(layer.id, parsed);
        } catch (err) {
          console.warn('Ошибка инициализации кастомного клипа:', err);
        }
      }
    });

    // Регистрация прыжка Унсу 360°
    if (!globalClipCache.has('jump_turn_360')) {
      const unsuClip = generateUnsuJump360Clip('jump_turn_360');
      registerCustomClip('jump_turn_360', unsuClip);
    }
  }, [customLayers]);

  // Общий список стоек (стандартные + созданные пользователем)
  const allStances = useMemo(() => {
    const customStances = customLayers
      .filter((l) => l.layerType === 'lower')
      .map((l) => ({
        id: l.id,
        name: l.name,
        type: 'custom',
        desc: 'Пользовательская стойка (Запись MoCap)',
      }));
    return [...MODULAR_STANCE_PRESETS, ...customStances];
  }, [customLayers]);

  // Общий список техник (стандартные + созданные пользователем)
  const allTechniques = useMemo(() => {
    const customTechs = customLayers
      .filter((l) => l.layerType === 'upper')
      .map((l) => ({
        id: l.id,
        name: l.name,
        type: 'custom',
        desc: 'Пользовательская техника (Запись MoCap)',
      }));
    return [...MODULAR_TECHNIQUE_PRESETS, ...customTechs];
  }, [customLayers]);

  // Общий список динамических движений цельного тела
  const allFullBodyPresets = useMemo(() => {
    const customFull = customLayers
      .filter((l) => l.layerType === 'full')
      .map((l) => ({
        id: l.id,
        name: l.name,
        category: 'custom',
        desc: `Пользовательская запись цельного тела (${l.duration?.toFixed(1) || '—'}с)`,
        badge: 'Мой MoCap',
      }));
    return [...FULL_BODY_DYNAMICS_PRESETS, ...customFull];
  }, [customLayers]);

  const stanceObj = useMemo(
    () => allStances.find((s) => s.id === selectedStance) || allStances[0],
    [selectedStance, allStances]
  );

  const techObj = useMemo(
    () => allTechniques.find((t) => t.id === selectedTechnique) || allTechniques[0],
    [selectedTechnique, allTechniques]
  );

  const fullBodyObj = useMemo(
    () => allFullBodyPresets.find((f) => f.id === selectedFullBody) || allFullBodyPresets[0],
    [selectedFullBody, allFullBodyPresets]
  );

  const handleReplay = () => {
    setReplayTrigger((prev) => prev + 1);
  };

  const copyKataStepJson = () => {
    const stepCode = motionMode === 'fullbody'
      ? {
          description: fullBodyObj.name,
          fullBodyDynamicClip: selectedFullBody,
          category: fullBodyObj.category,
          turnAngleDeg: selectedTurn,
          speed: speed,
        }
      : {
          description: `${techObj.name} в стойке ${stanceObj.name}`,
          stance: selectedStance,
          technique: selectedTechnique,
          turnAngleDeg: selectedTurn,
          modularExecution: true,
          displacement: [0, 0, selectedStance.includes('step') ? 1.2 : 0],
        };
    navigator.clipboard?.writeText(JSON.stringify(stepCode, null, 2));
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // =========================================================================
  // СОСТОЯНИЕ РЕЖИМА 1: ЗАПИСЬ С КАМЕРЫ (AI MOCAP RECORDER)
  // =========================================================================
  const [recorderLayerType, setRecorderLayerType] = useState('full'); // 'full' | 'upper' | 'lower'
  const [camActive, setCamActive] = useState(false);
  const [camStatus, setCamStatus] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [recordProgress, setRecordProgress] = useState(0);
  const [newLayerName, setNewLayerName] = useState('');
  const [recordedPreviewClip, setRecordedPreviewClip] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const poseInstanceRef = useRef(null);
  const capturedFramesRef = useRef([]);
  const recordStartRef = useRef(0);
  const animFrameIdRef = useRef(null);

  // Остановка камеры
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCamActive(false);
    setIsRecording(false);
    setCountdown(0);
    setCamStatus('');
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Запуск камеры и подключение MediaPipe Pose
  const startCamera = async () => {
    try {
      setCamStatus('Инициализация веб-камеры и AI нейросети...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCamStatus('Загрузка MediaPipe Pose...');
      const pose = await loadMediaPipePose();
      poseInstanceRef.current = pose;

      pose.onResults((results) => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        ctx.clearRect(0, 0, cvs.width, cvs.height);

        const lms = results.poseLandmarks;
        if (lms && lms.length >= 33) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3;

          const connections = [
            [11, 12], [11, 13], [13, 15],
            [12, 14], [14, 16],
            [11, 23], [12, 24], [23, 24],
            [23, 25], [25, 27],
            [24, 26], [26, 28],
          ];

          for (const [i, j] of connections) {
            const p1 = lms[i];
            const p2 = lms[j];
            if (p1 && p2 && (p1.visibility ?? 1) > 0.4 && (p2.visibility ?? 1) > 0.4) {
              ctx.beginPath();
              ctx.moveTo(p1.x * cvs.width, p1.y * cvs.height);
              ctx.lineTo(p2.x * cvs.width, p2.y * cvs.height);
              ctx.stroke();
            }
          }

          ctx.fillStyle = '#ffd700';
          for (let idx of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
            const pt = lms[idx];
            if (pt && (pt.visibility ?? 1) > 0.4) {
              ctx.beginPath();
              ctx.arc(pt.x * cvs.width, pt.y * cvs.height, 4, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          if (capturedFramesRef.current && isRecording) {
            const mapped = mapPoseToAvatarBones(lms, results.poseWorldLandmarks || lms);
            if (mapped && mapped.bones) {
              const t = (Date.now() - recordStartRef.current) / 1000;
              capturedFramesRef.current.push({ t, bones: mapped.bones });
            }
          }
        }
      });

      const processFrame = async () => {
        if (videoRef.current && videoRef.current.readyState >= 2 && poseInstanceRef.current) {
          try {
            await poseInstanceRef.current.send({ image: videoRef.current });
          } catch {}
        }
        animFrameIdRef.current = requestAnimationFrame(processFrame);
      };

      setCamActive(true);
      setCamStatus('Камера активна. Займите исходную позицию перед объективом.');
      animFrameIdRef.current = requestAnimationFrame(processFrame);
    } catch (err) {
      console.error('Ошибка активации камеры:', err);
      setCamStatus(`Ошибка доступа к камере: ${err.message || 'Не удалось получить поток'}`);
      setCamActive(false);
    }
  };

  const triggerRecording = () => {
    setCountdown(3);
    const countTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countTimer);
          startActualCapture();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startActualCapture = () => {
    capturedFramesRef.current = [];
    recordStartRef.current = Date.now();
    setIsRecording(true);
    setRecordProgress(0);

    const maxDuration = recorderLayerType === 'full' ? 5000 : 4000;
    const stepInterval = 100;
    let elapsed = 0;

    const progTimer = setInterval(() => {
      elapsed += stepInterval;
      setRecordProgress(Math.min(100, Math.round((elapsed / maxDuration) * 100)));

      if (elapsed >= maxDuration) {
        clearInterval(progTimer);
        stopActualCapture();
      }
    }, stepInterval);
  };

  const stopActualCapture = () => {
    setIsRecording(false);
    const frames = capturedFramesRef.current || [];
    if (frames.length < 5) {
      setCamStatus('Недостаточно кадров для генерации анимации. Попробуйте еще раз.');
      return;
    }

    const totalDur = (Date.now() - recordStartRef.current) / 1000;
    const clipName = `custom_cam_${Date.now()}`;
    const clip = buildClipFromRecordedFrames({
      name: clipName,
      layerType: recorderLayerType,
      recordedFrames: frames,
      totalDuration: totalDur,
    });

    if (clip) {
      registerCustomClip(clipName, clip);
      setRecordedPreviewClip(clip);
      const typeLabel = recorderLayerType === 'full' ? 'динамики' : (recorderLayerType === 'upper' ? 'удара' : 'стойки');
      setNewLayerName(`Запись ${typeLabel} #${frames.length}`);
      setCamStatus(`Запись завершена! Захвачено ${frames.length} кадров (${totalDur.toFixed(1)}с). Введите название.`);

      // Мгновенный предпросмотр в 3D
      if (recorderLayerType === 'full') {
        setMotionMode('fullbody');
        setSelectedFullBody(clipName);
      } else if (recorderLayerType === 'upper') {
        setMotionMode('modular');
        setSelectedTechnique(clipName);
      } else {
        setMotionMode('modular');
        setSelectedStance(clipName);
      }
    }
  };

  const handleSaveRecordedLayer = () => {
    if (!recordedPreviewClip) return;
    const layerId = recordedPreviewClip.name;
    const layer = {
      id: layerId,
      name: newLayerName.trim() || `Кастомная техника (${layerId.slice(-4)})`,
      layerType: recorderLayerType,
      source: 'camera',
      duration: recordedPreviewClip.duration,
      createdAt: new Date().toISOString(),
      clipJson: recordedPreviewClip.toJSON(),
    };

    saveCustomLayer(layer);
    setCustomLayers(loadCustomLayers());
    setRecordedPreviewClip(null);
    setCamStatus('Движение успешно сохранено в вашей личной библиотеке!');
    setActiveTab('mixer');
  };

  // Удаление кастомного слоя
  const handleDeleteCustomLayer = (id) => {
    deleteCustomLayer(id);
    setCustomLayers(loadCustomLayers());
    if (selectedStance === id) setSelectedStance('zenkutsu_dachi_left');
    if (selectedTechnique === id) setSelectedTechnique('tech_gedan_barai_left');
    if (selectedFullBody === id) setSelectedFullBody('jump_turn_360');
  };

  // Экспорт JSON слоя
  const handleExportCustomLayerJson = (layer) => {
    const blob = new Blob([JSON.stringify(layer, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${layer.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // =========================================================================
  // ОБРАБОТЧИКИ АДМИНИСТРАТОРА
  // =========================================================================
  const handleAdminTest3D = () => {
    let source = resolveClip(adminSelectedAnim) || globalClipCache.get(adminSelectedAnim);
    if (!source && adminSelectedAnim === 'jump_turn_360') {
      source = generateUnsuJump360Clip('jump_turn_360');
    }
    if (!source) {
      setAdminStatusMessage('Клип не найден в памяти');
      return;
    }

    try {
      const fps = 60;
      const startFrame = Math.max(0, Math.round(adminTrimStart * fps));
      const endFrame = Math.max(startFrame + 1, Math.round(adminTrimEnd * fps));
      const subName = `admin_sub_${adminSelectedAnim}_${Date.now()}`;
      const sub = THREE.AnimationUtils.subclip(source, subName, startFrame, endFrame, fps);

      registerCustomClip(subName, sub);
      setAdminActivePreviewClip(sub);
      setMotionMode('fullbody');
      setSelectedFullBody(subName);
      setSelectedTurn(adminYaw);
      setSpeed(adminSpeed);
      setIsLooping(adminLoop);
      setReplayTrigger((prev) => prev + 1);
      setAdminStatusMessage(`Тест запущен: [${adminTrimStart.toFixed(2)}с – ${adminTrimEnd.toFixed(2)}с]`);
    } catch (err) {
      console.error('Ошибка нарезки клипа админа:', err);
      setAdminStatusMessage(`Ошибка: ${err.message}`);
    }
  };

  const handleAdminSave = () => {
    saveAdminAnimationOverride(adminSelectedAnim, {
      title: adminTitle,
      japanese: adminJapanese,
      category: adminCategory,
      notes: adminNotes,
      trimStart: adminTrimStart,
      trimEnd: adminTrimEnd,
      speed: adminSpeed,
      yaw: adminYaw,
      loop: adminLoop,
    });
    setAdminStatusMessage('Изменения успешно сохранены в реестр анимаций!');
    setTimeout(() => setAdminStatusMessage(''), 3000);
  };

  const handleAdminReset = () => {
    resetAdminAnimationOverride(adminSelectedAnim);
    setAdminTrimStart(0.0);
    setAdminTrimEnd(adminDuration);
    setAdminSpeed(1.0);
    setAdminYaw(0);
    setAdminLoop(false);
    setAdminActivePreviewClip(null);
    setAdminStatusMessage('Параметры сброшены к оригинальным значениям.');
  };

  const handleAdminExportJson = () => {
    let clip = adminActivePreviewClip || resolveClip(adminSelectedAnim) || globalClipCache.get(adminSelectedAnim);
    if (!clip && adminSelectedAnim === 'jump_turn_360') {
      clip = generateUnsuJump360Clip('jump_turn_360');
    }
    if (!clip) return;

    const exportData = {
      id: adminSelectedAnim,
      title: adminTitle,
      japanese: adminJapanese,
      category: adminCategory,
      notes: adminNotes,
      duration: clip.duration,
      tracksCount: clip.tracks.length,
      clipJson: clip.toJSON(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${adminSelectedAnim}_edited.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Эффективный активный клип для 3D персонажа
  const effectiveActiveClip = motionMode === 'fullbody' ? selectedFullBody : null;
  const effectiveLowerClip = motionMode === 'modular' ? selectedStance : null;
  const effectiveUpperClip = motionMode === 'modular' ? selectedTechnique : null;

  return (
    <div className="modular-mixer-container">
      {/* 3D Вьюпорт Додзё */}
      <div className="modular-mixer-viewport">
        <Canvas camera={{ position: [0, 1.35, 3.2], fov: 42 }} shadows>
          <color attach="background" args={['#0e0d0c']} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[4, 6, 3]} intensity={1.3} castShadow shadow-mapSize={1024} />
          <directionalLight position={[-3, 4, -2]} intensity={0.4} color="#ffd4a3" />

          <TraditionalDojo />

          <group position={[0, 0, 0]}>
            <KaratekaLowpolyModel
              role="tori"
              activeClip={effectiveActiveClip}
              modularLowerClip={effectiveLowerClip}
              modularUpperClip={effectiveUpperClip}
              modularTurn={selectedTurn}
              modularLoop={isLooping}
              speed={speed}
              replayTrigger={replayTrigger}
              layerAdjustments={layerAdjustments}
            />
          </group>

          <ContactShadows position={[0, 0.005, 0]} opacity={0.7} scale={8} blur={1.4} far={4} />
          <OrbitControls
            target={[0, 0.82, 0]}
            maxPolarAngle={Math.PI / 2 - 0.02}
            minDistance={1.1}
            maxDistance={6.0}
            enableDamping
          />
        </Canvas>

        {/* Наложение бейджа активного движения */}
        <div className="modular-viewport-badge">
          {motionMode === 'fullbody' ? (
            <>
              <Activity size={14} color="#ffd700" />
              <span>
                Динамика: <strong>{fullBodyObj.name}</strong> ({fullBodyObj.badge || 'Цельное тело'})
              </span>
            </>
          ) : (
            <>
              <Layers size={14} color="#bfa15f" />
              <span>
                Модульный синтез: <strong>{stanceObj.name}</strong> + <strong>{techObj.name}</strong>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Панель управления студией */}
      <div className="modular-mixer-controls">
        {/* Вкладки переключения студии */}
        <div className="modular-tabs">
          <button
            type="button"
            className={`modular-tab-btn ${activeTab === 'mixer' ? 'active' : ''}`}
            onClick={() => setActiveTab('mixer')}
          >
            <Sliders size={14} />
            <span>Микшер и Ката</span>
          </button>
          <button
            type="button"
            className={`modular-tab-btn ${activeTab === 'recorder' ? 'active' : ''}`}
            onClick={() => setActiveTab('recorder')}
          >
            <Camera size={14} />
            <span>Запись MoCap</span>
          </button>
          <button
            type="button"
            className={`modular-tab-btn ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
          >
            <BookOpen size={14} />
            <span>Мои движения ({customLayers.length})</span>
          </button>

          {/* Вкладка только для Администратора */}
          {isAdmin && (
            <button
              type="button"
              className={`modular-tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
              style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}
            >
              <Shield size={14} color="#ef4444" />
              <span style={{ color: '#f87171' }}>Редактор (Админ)</span>
            </button>
          )}
        </div>

        {/* ================================================================= */}
        {/* ВКЛАДКА 1: МИКШЕР И КАТА (СИНТЕЗ ИЛИ ДИНАМИКА ЦЕЛЬНОГО ТЕЛА)      */}
        {/* ================================================================= */}
        {activeTab === 'mixer' && (
          <>
            <div className="modular-controls-header">
              <h3>
                <Sliders size={18} />
                <span>3D Студия движений каратэ Шотокан</span>
              </h3>
              <p className="modular-controls-subtitle">
                Комбинируйте стойки и техники по слоям или воспроизводите непрерывные динамические формы ката (включая акробатику Унсу)
              </p>
            </div>

            {/* Переключатель режимов: Модульный синтез vs Динамика Ката */}
            <div className="modular-mode-selector">
              <button
                type="button"
                className={`modular-mode-btn ${motionMode === 'modular' ? 'active' : ''}`}
                onClick={() => setMotionMode('modular')}
              >
                <Layers size={14} />
                <span>Модульный синтез (Стойка + Техника)</span>
              </button>
              <button
                type="button"
                className={`modular-mode-btn ${motionMode === 'fullbody' ? 'active' : ''}`}
                onClick={() => setMotionMode('fullbody')}
              >
                <Flame size={14} color="#f59e0b" />
                <span>Динамика Ката (Цельное тело / Унсу)</span>
              </button>
            </div>

            {/* РЕЖИМ А: МОДУЛЬНЫЙ СИНТЕЗ СЛОЕВ */}
            {motionMode === 'modular' && (
              <>
                {/* Секция 1: Нижний слой (Стойка / Шаг) */}
                <div className="modular-section">
                  <label className="modular-section-label">
                    <span className="badge-tag badge-tag--lower">НИЖНИЙ СЛОЙ</span>
                    <span>Стойка / Шаг (Таз + Ноги In-Place)</span>
                  </label>
                  <div className="modular-presets-grid">
                    {allStances.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`modular-preset-btn ${selectedStance === s.id ? 'active' : ''} ${s.type === 'custom' ? 'modular-preset-btn--custom' : ''}`}
                        onClick={() => setSelectedStance(s.id)}
                        title={s.desc}
                      >
                        <span className="modular-preset-title">{s.name}</span>
                        <span className="modular-preset-type">
                          {s.type === 'custom' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Sparkles size={10} color="var(--gold, #bfa15f)" /> Мой MoCap
                            </span>
                          ) : s.type === 'movement' ? (
                            'Шаг'
                          ) : (
                            'Стойка'
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Секция 2: Верхний слой (Техника рук) */}
                <div className="modular-section">
                  <label className="modular-section-label">
                    <span className="badge-tag badge-tag--upper">ВЕРХНИЙ СЛОЙ</span>
                    <span>Техника рук (Удары, Блоки, Скручивание)</span>
                  </label>
                  <div className="modular-presets-grid">
                    {allTechniques.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`modular-preset-btn ${selectedTechnique === t.id ? 'active' : ''} ${t.type === 'custom' ? 'modular-preset-btn--custom' : ''}`}
                        onClick={() => setSelectedTechnique(t.id)}
                        title={t.desc}
                      >
                        <span className="modular-preset-title">{t.name}</span>
                        <span className="modular-preset-type">
                          {t.type === 'custom' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Sparkles size={10} color="var(--gold, #bfa15f)" /> Мой MoCap
                            </span>
                          ) : t.type === 'block' ? (
                            'Блок'
                          ) : (
                            'Удар'
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* РЕЖИМ Б: ДИНАМИКА КАТА И АКРОБАТИКА ЦЕЛЬНОГО ТЕЛА (УНСУ) */}
            {motionMode === 'fullbody' && (
              <div className="modular-section">
                <label className="modular-section-label">
                  <span className="badge-tag" style={{ background: '#451a03', color: '#fbbf24', border: '1px solid #78350f' }}>
                    ЦЕЛЬНОЕ ТЕЛО & УНСУ
                  </span>
                  <span>Динамические мастер-формы, прыжки и непрерывные приемы</span>
                </label>
                <div className="modular-presets-grid" style={{ maxHeight: '220px' }}>
                  {allFullBodyPresets.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`modular-preset-btn ${selectedFullBody === f.id ? 'active' : ''}`}
                      onClick={() => setSelectedFullBody(f.id)}
                      title={f.desc}
                    >
                      <span className="modular-preset-title">{f.name}</span>
                      <span className="modular-preset-type" style={{ color: '#fbbf24' }}>
                        {f.badge || 'Цельное тело'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Секция: Разворот эмбусэн */}
            <div className="modular-section">
              <label className="modular-section-label">
                <Compass size={14} />
                <span>Ориентация / Разворот эмбусэн (Root Yaw)</span>
              </label>
              <div className="modular-turn-selector">
                {MODULAR_TURN_PRESETS.map((turn) => (
                  <button
                    key={turn.deg}
                    type="button"
                    className={`modular-turn-btn ${selectedTurn === turn.deg ? 'active' : ''}`}
                    onClick={() => setSelectedTurn(turn.deg)}
                  >
                    {turn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Секция: Плеер и управление скоростью */}
            <div className="modular-player-toolbar">
              <button type="button" className="btn btn-primary modular-play-btn" onClick={handleReplay}>
                <RotateCcw size={15} />
                <span>Перезапуск</span>
              </button>

              <label className="modular-checkbox-label">
                <input
                  type="checkbox"
                  checked={isLooping}
                  onChange={(e) => setIsLooping(e.target.checked)}
                />
                <span>Зациклить</span>
              </label>

              <div className="modular-speed-pills">
                {[0.5, 0.75, 1.0, 1.25].map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    className={`modular-speed-pill ${speed === sp ? 'active' : ''}`}
                    onClick={() => setSpeed(sp)}
                  >
                    {sp}x
                  </button>
                ))}
              </div>
            </div>

            {/* Кнопки интеграции и копирования кода */}
            <div className="modular-export-actions">
              <button
                type="button"
                className="btn btn-secondary modular-action-btn"
                onClick={copyKataStepJson}
              >
                {copiedCode ? <Check size={15} color="#2ed573" /> : <Copy size={15} />}
                <span>{copiedCode ? 'Скопировано в буфер!' : 'Копировать JSON для Ката'}</span>
              </button>
            </div>
          </>
        )}

        {/* ================================================================= */}
        {/* ВКЛАДКА 2: ЗАПИСЬ С КАМЕРЫ (AI MOCAP RECORDER)                   */}
        {/* ================================================================= */}
        {activeTab === 'recorder' && (
          <div className="mocap-recorder-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0, color: 'var(--gold, #bfa15f)', fontSize: '0.98rem' }}>
                  AI MoCap Запись с веб-камеры
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #999)' }}>
                  Захват движений через нейросеть MediaPipe Pose: цельное тело, удары руками или стойки
                </p>
              </div>
              {camActive && (
                <button type="button" className="btn btn-danger" onClick={stopCamera} style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                  Отключить камеру
                </button>
              )}
            </div>

            {/* Выбор записываемого слоя: Цельное тело, Верх или Низ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              <button
                type="button"
                className={`modular-preset-btn ${recorderLayerType === 'full' ? 'active' : ''}`}
                onClick={() => setRecorderLayerType('full')}
              >
                <span className="modular-preset-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Flame size={13} color="#f59e0b" />
                  <span>Цельное тело</span>
                </span>
                <span className="modular-preset-type">Прыжки, удары, Унсу</span>
              </button>
              <button
                type="button"
                className={`modular-preset-btn ${recorderLayerType === 'upper' ? 'active' : ''}`}
                onClick={() => setRecorderLayerType('upper')}
              >
                <span className="modular-preset-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Shield size={13} color="var(--gold, #bfa15f)" />
                  <span>Верхний слой</span>
                </span>
                <span className="modular-preset-type">Руки и корпус</span>
              </button>
              <button
                type="button"
                className={`modular-preset-btn ${recorderLayerType === 'lower' ? 'active' : ''}`}
                onClick={() => setRecorderLayerType('lower')}
              >
                <span className="modular-preset-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Zap size={13} color="var(--gold, #bfa15f)" />
                  <span>Нижний слой</span>
                </span>
                <span className="modular-preset-type">Стойки и шаги</span>
              </button>
            </div>

            {/* Окно камеры и оверлея скелета */}
            <div className="recorder-cam-wrapper">
              <video
                ref={videoRef}
                className="recorder-video"
                playsInline
                muted
                style={{ display: camActive ? 'block' : 'none' }}
              />
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="recorder-canvas-overlay"
                style={{ display: camActive ? 'block' : 'none' }}
              />

              {!camActive && (
                <div className="recorder-cam-placeholder">
                  <div className="recorder-cam-icon-circle">
                    <Camera size={34} color="var(--gold, #bfa15f)" />
                  </div>
                  <div className="recorder-cam-title">Веб-камера выключена</div>
                  <p className="recorder-cam-desc">
                    Включите камеру для AI захвата движений мастера каратэ и сохранения собственных анимаций
                  </p>
                  <button type="button" className="btn btn-primary recorder-cam-start-btn" onClick={startCamera}>
                    <Camera size={16} />
                    <span>Включить веб-камеру</span>
                  </button>
                </div>
              )}

              {/* Обратный отсчет 3.. 2.. 1.. */}
              {countdown > 0 && (
                <div className="countdown-overlay">
                  <div className="countdown-num">{countdown}</div>
                  <div style={{ color: '#fff', fontSize: '0.9rem' }}>Приготовьтесь к выполнению движения!</div>
                </div>
              )}

              {/* Индикатор записи */}
              {isRecording && (
                <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.7)', padding: '4px 10px', borderRadius: 4, zIndex: 10 }}>
                  <div className="record-pulse-dot" />
                  <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700 }}>ИДЕТ ЗАПИСЬ ({recordProgress}%)</span>
                </div>
              )}
            </div>

            {camStatus && (
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: 4 }}>
                {camStatus}
              </div>
            )}

            {/* Кнопки управления записью */}
            {camActive && !recordedPreviewClip && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {!isRecording ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={triggerRecording}
                    disabled={countdown > 0}
                  >
                    <Radio size={16} color="#ef4444" />
                    <span>Начать запись (обратный отсчет 3с)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ flex: 1, padding: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={stopActualCapture}
                  >
                    <Square size={14} color="#fff" />
                    <span>Завершить запись досрочно</span>
                  </button>
                )}
              </div>
            )}

            {/* Сохранение после записи */}
            {recordedPreviewClip && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '12px', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <strong style={{ color: '#10b981', fontSize: '0.88rem' }}>✓ Запись успешно преобразована в 3D клип!</strong>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#d1d5db' }}>
                  Движение сейчас проигрывается на 3D аватаре Тори слева. Введите название и сохраните в библиотеку.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newLayerName}
                    onChange={(e) => setNewLayerName(e.target.value)}
                    placeholder="Например: Мой удар ногой маваси"
                    style={{ flex: 1, background: '#111', border: '1px solid #374151', borderRadius: 4, padding: '6px 10px', color: '#fff', fontSize: '0.82rem' }}
                  />
                  <button type="button" className="btn btn-gold" onClick={handleSaveRecordedLayer}>
                    <Save size={14} />
                    <span>Сохранить в Мои движения</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* ВКЛАДКА 3: МОИ СОХРАНЕННЫЕ ДВИЖЕНИЯ (БИБЛИОТЕКА)                 */}
        {/* ================================================================= */}
        {activeTab === 'library' && (
          <div>
            <div className="modular-controls-header">
              <h3>
                <BookOpen size={18} />
                <span>Библиотека моих движений</span>
              </h3>
              <p className="modular-controls-subtitle">
                Все записанные вами с веб-камеры и кастомные движения каратэ
              </p>
            </div>

            {customLayers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 6, border: '1px dashed #374151', color: 'var(--text-secondary)' }}>
                <p style={{ margin: 0, fontSize: '0.86rem' }}>У вас пока нет сохраненных анимаций.</p>
                <div style={{ marginTop: '0.8rem', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button type="button" className="btn btn-primary" onClick={() => setActiveTab('recorder')}>
                    <Camera size={13} />
                    <span>Записать с веб-камеры</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="custom-layers-list">
                {customLayers.map((layer) => (
                  <div key={layer.id} className="custom-layer-card">
                    <div className="custom-layer-meta">
                      <strong>{layer.name}</strong>
                      <div className="custom-layer-sub">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {layer.layerType === 'full' ? (
                            <Flame size={12} color="#f59e0b" />
                          ) : layer.layerType === 'upper' ? (
                            <Shield size={12} color="var(--gold, #bfa15f)" />
                          ) : (
                            <Zap size={12} color="var(--gold, #bfa15f)" />
                          )}
                          {layer.layerType === 'full' ? 'Цельное тело' : (layer.layerType === 'upper' ? 'Верхний слой' : 'Нижний слой')}
                        </span>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Camera size={12} color="#10b981" />
                          <span>Запись с камеры</span>
                        </span>
                      </div>
                    </div>

                    <div className="custom-layer-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                        onClick={() => {
                          if (layer.layerType === 'full') {
                            setMotionMode('fullbody');
                            setSelectedFullBody(layer.id);
                          } else if (layer.layerType === 'upper') {
                            setMotionMode('modular');
                            setSelectedTechnique(layer.id);
                          } else {
                            setMotionMode('modular');
                            setSelectedStance(layer.id);
                          }
                          setActiveTab('mixer');
                        }}
                      >
                        Применить в 3D
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: '5px 8px' }}
                        title="Скачать JSON"
                        onClick={() => handleExportCustomLayerJson(layer)}
                      >
                        <Download size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '5px 8px' }}
                        title="Удалить"
                        onClick={() => handleDeleteCustomLayer(layer.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* ВКЛАДКА 4: РЕДАКТОР АНИМАЦИЙ (ТОЛЬКО ДЛЯ АДМИНИСТРАТОРА)          */}
        {/* ================================================================= */}
        {isAdmin && activeTab === 'admin' && (
          <div className="admin-editor-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h4 style={{ margin: 0, color: '#f87171', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Shield size={16} />
                    <span>Редактор готовых анимаций библиотеки</span>
                  </h4>
                  <span className="admin-badge">Admin Mode</span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #999)' }}>
                  Обрезка фаз (Trim), регулировка темпа, поворот, редактирование метаданных и экспорт клипов
                </p>
              </div>
            </div>

            {/* Выбор анимации для редактирования */}
            <div className="admin-input-group">
              <label className="admin-input-label">Выберите анимацию из каталога Шотокан:</label>
              <select
                className="admin-select-input"
                value={adminSelectedAnim}
                onChange={(e) => setAdminSelectedAnim(e.target.value)}
              >
                {ADMIN_EDITABLE_CATALOG.map((grp) => (
                  <optgroup key={grp.group} label={grp.group}>
                    {grp.items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.cat})
                      </option>
                    ))}
                  </optgroup>
                ))}
                {customLayers.length > 0 && (
                  <optgroup label="Пользовательские записи">
                    {customLayers.map((l) => (
                      <option key={l.id} value={l.id}>
                        [MoCap] {l.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Инспектор дорожек и длительности */}
            <div style={{ display: 'flex', gap: 12, background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: 4, fontSize: '0.78rem', color: '#9ca3af' }}>
              <span>Длительность оригинала: <strong style={{ color: '#fff' }}>{adminDuration.toFixed(2)}с</strong></span>
              <span>•</span>
              <span>Костей/дорожек: <strong style={{ color: '#fff' }}>{adminTrackCount}</strong></span>
              <span>•</span>
              <span>Выбранный срез: <strong style={{ color: '#fcd34d' }}>{(adminTrimEnd - adminTrimStart).toFixed(2)}с</strong></span>
            </div>

            {/* Таймлайн и Обрезка (Trim Start / Trim End) */}
            <div className="admin-timeline-container">
              <div className="admin-timeline-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Scissors size={14} color="#f59e0b" />
                  <span>Обрезка временных границ клипа (Trim):</span>
                </span>
                <span style={{ fontFamily: 'monospace', color: '#fbbf24' }}>
                  {adminTrimStart.toFixed(2)}с — {adminTrimEnd.toFixed(2)}с
                </span>
              </div>

              {/* Визуальная шкала таймлайна */}
              <div className="admin-timeline-track">
                <div
                  className="admin-timeline-active-slice"
                  style={{
                    left: `${adminDuration > 0 ? (adminTrimStart / adminDuration) * 100 : 0}%`,
                    width: `${adminDuration > 0 ? ((adminTrimEnd - adminTrimStart) / adminDuration) * 100 : 100}%`,
                  }}
                />
              </div>

              {/* Ползунки начала и конца */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#9ca3af', marginBottom: 2 }}>
                    <span>Начало (Trim Start):</span>
                    <strong>{adminTrimStart.toFixed(2)}с</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(0.1, adminTrimEnd - 0.05)}
                    step="0.05"
                    value={adminTrimStart}
                    onChange={(e) => setAdminTrimStart(parseFloat(e.target.value))}
                    className="pose-range-input"
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#9ca3af', marginBottom: 2 }}>
                    <span>Конец (Trim End):</span>
                    <strong>{adminTrimEnd.toFixed(2)}с</strong>
                  </div>
                  <input
                    type="range"
                    min={adminTrimStart + 0.05}
                    max={Math.max(0.2, adminDuration)}
                    step="0.05"
                    value={adminTrimEnd}
                    onChange={(e) => setAdminTrimEnd(parseFloat(e.target.value))}
                    className="pose-range-input"
                  />
                </div>
              </div>
            </div>

            {/* Настройки скорости и угла поворота */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="admin-input-group">
                <label className="admin-input-label">Скорость исполнения: {adminSpeed.toFixed(2)}x</label>
                <input
                  type="range"
                  min="0.25"
                  max="2.0"
                  step="0.05"
                  value={adminSpeed}
                  onChange={(e) => setAdminSpeed(parseFloat(e.target.value))}
                  className="pose-range-input"
                />
              </div>
              <div className="admin-input-group">
                <label className="admin-input-label">Разворот Yaw: {adminYaw}°</label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="15"
                  value={adminYaw}
                  onChange={(e) => setAdminYaw(parseInt(e.target.value, 10))}
                  className="pose-range-input"
                />
              </div>
            </div>

            {/* Поля метаданных для каталога */}
            <div className="admin-meta-grid">
              <div className="admin-input-group">
                <label className="admin-input-label">Название (RU):</label>
                <input
                  type="text"
                  className="admin-text-input"
                  value={adminTitle}
                  onChange={(e) => setAdminTitle(e.target.value)}
                />
              </div>
              <div className="admin-input-group">
                <label className="admin-input-label">Японское название (Romaji/Kanji):</label>
                <input
                  type="text"
                  className="admin-text-input"
                  value={adminJapanese}
                  onChange={(e) => setAdminJapanese(e.target.value)}
                />
              </div>
            </div>

            <div className="admin-meta-grid">
              <div className="admin-input-group">
                <label className="admin-input-label">Категория:</label>
                <select
                  className="admin-select-input"
                  value={adminCategory}
                  onChange={(e) => setAdminCategory(e.target.value)}
                >
                  <option value="Удар рукой">Удар рукой (Цуки / Ути)</option>
                  <option value="Блок">Защитный блок (Укэ)</option>
                  <option value="Удар ногой">Удар ногой (Гэри)</option>
                  <option value="Прыжок">Прыжок / Акробатика (Унсу)</option>
                  <option value="Ката">Ката (Мастер-прогон)</option>
                  <option value="Стойка">Стойка (Дати)</option>
                  <option value="Связка">Связка / Комбо</option>
                </select>
              </div>
              <div className="admin-input-group">
                <label className="admin-input-label">Зацикливание при тесте:</label>
                <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 8 }}>
                  <input
                    type="checkbox"
                    id="adminLoopCheck"
                    checked={adminLoop}
                    onChange={(e) => setAdminLoop(e.target.checked)}
                  />
                  <label htmlFor="adminLoopCheck" style={{ fontSize: '0.82rem', color: '#d1d5db', cursor: 'pointer' }}>
                    Повторять непрерывно
                  </label>
                </div>
              </div>
            </div>

            <div className="admin-input-group">
              <label className="admin-input-label">Примечание по биомеханике и кимэ:</label>
              <textarea
                className="admin-text-input"
                rows="2"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>

            {adminStatusMessage && (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', padding: '6px 12px', borderRadius: 4, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} />
                <span>{adminStatusMessage}</span>
              </div>
            )}

            {/* Панель действий администратора */}
            <div className="admin-actions-bar">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAdminTest3D}
                style={{ padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Play size={14} />
                <span>Проверить срез в 3D</span>
              </button>
              <button
                type="button"
                className="btn btn-gold"
                onClick={handleAdminSave}
                style={{ padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Save size={14} />
                <span>Сохранить изменения</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAdminExportJson}
                style={{ padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={14} />
                <span>Экспорт JSON</span>
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleAdminReset}
                title="Сбросить к оригиналу"
                style={{ padding: '8px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <RotateCcw size={13} />
                <span>Сброс</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
