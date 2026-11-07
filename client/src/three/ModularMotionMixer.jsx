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
  generateUnsuJump360Clip,
  loadAdminAnimationOverrides,
  saveAdminAnimationOverride,
  resetAdminAnimationOverride,
} from './customMotionManager';
import { useAuthStore } from '../store/authStore';
import {
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  Sliders,
  Compass,
  Camera,
  Trash2,
  BookOpen,
  Zap,
  Shield,
  Settings,
  Flame,
  Search,
  Check,
  Video,
  X,
  Footprints,
  User,
  Hand,
  Clock,
  ExternalLink,
  Download,
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
];

// Каталог для админ-калибровки
export const ADMIN_EDITABLE_CATALOG = [
  { group: 'Элитные Ката и Акробатика', items: [
    { id: 'jump_turn_360', name: 'Унсу: Прыжок 360° (Кээтоби-гэри)', jp: '雲手 蹴飛蹴り / Unsu Jump', cat: 'Прыжок' },
    { id: 'kata_unsu', name: 'Унсу: Мастер-прогон ката (雲手)', jp: '雲手 / Unsu', cat: 'Ката' },
    { id: 'heian_shodan', name: 'Хэйан Сёдан: Мастер-прогон', jp: '平安初段 / Heian Shodan', cat: 'Ката' },
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

export default function ModularMotionMixer({ onSwitchToMocap }) {
  const { role, user } = useAuthStore();
  const isAdmin = role === 'admin' || user?.role === 'admin';

  // Tabs: 'mixer' | 'presets' | 'mocap_takes' | 'admin'
  const [activeTab, setActiveTab] = useState('mixer');

  // Mode: 'modular' | 'fullbody'
  const [motionMode, setMotionMode] = useState('modular');

  // Active selections
  const [selectedStance, setSelectedStance] = useState('zenkutsu_dachi_left');
  const [selectedTechnique, setSelectedTechnique] = useState('tech_gedan_barai_left');
  const [selectedFullBody, setSelectedFullBody] = useState('jump_turn_360');
  const [selectedTurn, setSelectedTurn] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [isLooping, setIsLooping] = useState(true);
  const [replayTrigger, setReplayTrigger] = useState(0);

  // Shared presets state
  const [sharedPresets, setSharedPresets] = useState([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [presetFilter, setPresetFilter] = useState('all');
  const [presetSearch, setPresetSearch] = useState('');

  // Create Preset modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPresetTitle, setNewPresetTitle] = useState('');
  const [newPresetCategory, setNewPresetCategory] = useState('combo');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [newPresetAuthor, setNewPresetAuthor] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [modalFeedback, setModalFeedback] = useState(null);

  // Studio takes state
  const [studioTakes, setStudioTakes] = useState([]);
  const [isLoadingTakes, setIsLoadingTakes] = useState(false);

  // Global toast message
  const [toastMessage, setToastMessage] = useState(null);

  // Admin calibration state
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

  // Register Unsu 360 jump clip
  useEffect(() => {
    if (!globalClipCache.has('jump_turn_360')) {
      const unsuClip = generateUnsuJump360Clip('jump_turn_360');
      registerCustomClip('jump_turn_360', unsuClip);
    }
  }, []);

  // Fetch shared presets from server
  const fetchPresets = useCallback(async () => {
    try {
      setIsLoadingPresets(true);
      const res = await fetch('/api/animations/presets');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSharedPresets(json.data);
        }
      }
    } catch (e) {
      console.error('Ошибка загрузки общих пресетов:', e);
    } finally {
      setIsLoadingPresets(false);
    }
  }, []);

  // Fetch studio phone takes
  const fetchStudioTakes = useCallback(async () => {
    try {
      setIsLoadingTakes(true);
      const res = await fetch('/api/record/list');
      if (res.ok) {
        const json = await res.json();
        if (json.recordings && Array.isArray(json.recordings)) {
          setStudioTakes(json.recordings);
        }
      }
    } catch (e) {
      console.error('Ошибка загрузки записей студии:', e);
    } finally {
      setIsLoadingTakes(false);
    }
  }, []);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  useEffect(() => {
    if (activeTab === 'mocap_takes') {
      fetchStudioTakes();
    }
  }, [activeTab, fetchStudioTakes]);

  // Derived objects
  const stanceObj = useMemo(
    () => MODULAR_STANCE_PRESETS.find((s) => s.id === selectedStance) || MODULAR_STANCE_PRESETS[0],
    [selectedStance]
  );

  const techObj = useMemo(
    () => MODULAR_TECHNIQUE_PRESETS.find((t) => t.id === selectedTechnique) || MODULAR_TECHNIQUE_PRESETS[0],
    [selectedTechnique]
  );

  const fullBodyObj = useMemo(
    () => FULL_BODY_DYNAMICS_PRESETS.find((f) => f.id === selectedFullBody) || FULL_BODY_DYNAMICS_PRESETS[0],
    [selectedFullBody]
  );

  const handleReplay = () => {
    setReplayTrigger((prev) => prev + 1);
  };

  // Open Create Preset modal with prefilled data
  const handleOpenCreateModal = () => {
    if (motionMode === 'modular') {
      setNewPresetTitle(`${techObj.name} в ${stanceObj.name}`);
      setNewPresetCategory(techObj.type === 'block' ? 'block' : 'punch');
      setNewPresetDesc(`${techObj.name} с акцентом на ${stanceObj.name}. Угол поворота: ${selectedTurn}°`);
    } else {
      setNewPresetTitle(fullBodyObj.name);
      setNewPresetCategory(fullBodyObj.category || 'combo');
      setNewPresetDesc(fullBodyObj.desc || 'Динамическая форма ката');
    }
    setNewPresetAuthor(user?.username || 'Мастер Додзё');
    setModalFeedback(null);
    setShowCreateModal(true);
  };

  // Save preset to server (shared for ALL users)
  const handleSaveSharedPreset = async () => {
    if (!newPresetTitle.trim()) {
      setModalFeedback({ type: 'error', text: 'Пожалуйста, укажите название пресета' });
      return;
    }

    setIsSavingPreset(true);
    setModalFeedback(null);

    const payload = {
      title: newPresetTitle.trim(),
      description: newPresetDesc.trim(),
      category: newPresetCategory,
      motionMode: motionMode,
      stanceId: motionMode === 'modular' ? selectedStance : null,
      techniqueId: motionMode === 'modular' ? selectedTechnique : null,
      fullBodyClip: motionMode === 'fullbody' ? selectedFullBody : null,
      turnAngle: selectedTurn,
      speed: speed,
      authorName: newPresetAuthor.trim() || user?.username || 'Мастер Додзё',
    };

    try {
      const res = await fetch('/api/animations/presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const item = json.data;
        if (item.AlreadyExisted) {
          setModalFeedback({
            type: 'info',
            text: `ℹ️ Такой пресет уже существует в каталоге (автор: ${item.Author_Name}). Он доступен всем!`,
          });
        } else {
          setModalFeedback({
            type: 'success',
            text: `✓ Пресет "${item.Title}" успешно сохранен и теперь доступен всем пользователям!`,
          });
        }
        await fetchPresets();
        setTimeout(() => {
          setShowCreateModal(false);
          setModalFeedback(null);
        }, 1800);
      } else {
        setModalFeedback({
          type: 'error',
          text: json.message || 'Не удалось сохранить пресет на сервере',
        });
      }
    } catch (err) {
      setModalFeedback({
        type: 'error',
        text: `Ошибка соединения с сервером: ${err.message}`,
      });
    } finally {
      setIsSavingPreset(false);
    }
  };

  // 1-Click apply any shared preset
  const handleApplyPreset = (p) => {
    if (p.Motion_Mode === 'modular') {
      setMotionMode('modular');
      if (p.Stance_ID) setSelectedStance(p.Stance_ID);
      if (p.Technique_ID) setSelectedTechnique(p.Technique_ID);
    } else {
      setMotionMode('fullbody');
      if (p.Full_Body_Clip) setSelectedFullBody(p.Full_Body_Clip);
    }
    setSelectedTurn(p.Turn_Angle !== undefined ? p.Turn_Angle : 0);
    setSpeed(p.Speed !== undefined ? p.Speed : 1.0);
    setReplayTrigger((prev) => prev + 1);

    setActiveTab('mixer');
    setToastMessage(`✓ Загружен пресет: ${p.Title}`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Delete preset (if author or admin)
  const handleDeletePreset = async (e, p) => {
    e.stopPropagation();
    if (!window.confirm(`Удалить пресет "${p.Title}"?`)) return;

    try {
      const res = await fetch(`/api/animations/presets/${p.Preset_ID}`, {
        method: 'DELETE',
        headers: {
          ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
        },
      });
      if (res.ok) {
        setToastMessage(`Пресет "${p.Title}" удален.`);
        setTimeout(() => setToastMessage(null), 3000);
        fetchPresets();
      } else {
        const json = await res.json();
        alert(json.message || 'Ошибка при удалении пресета');
      }
    } catch (err) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  // Filter presets
  const filteredPresets = useMemo(() => {
    return sharedPresets.filter((p) => {
      const matchCat = presetFilter === 'all' || p.Category === presetFilter;
      const matchSearch =
        !presetSearch.trim() ||
        (p.Title && p.Title.toLowerCase().includes(presetSearch.toLowerCase())) ||
        (p.Description && p.Description.toLowerCase().includes(presetSearch.toLowerCase())) ||
        (p.Author_Name && p.Author_Name.toLowerCase().includes(presetSearch.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [sharedPresets, presetFilter, presetSearch]);

  // Admin calibration init
  useEffect(() => {
    let raw = resolveClip(adminSelectedAnim) || globalClipCache.get(adminSelectedAnim);
    if (!raw && adminSelectedAnim === 'jump_turn_360') {
      raw = generateUnsuJump360Clip('jump_turn_360');
    }

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

  const handleAdminApplyTrim = () => {
    const raw = resolveClip(adminSelectedAnim) || globalClipCache.get(adminSelectedAnim);
    if (!raw) return;

    const cloned = raw.clone();
    const newDur = Math.max(0.1, adminTrimEnd - adminTrimStart);

    const newTracks = [];
    cloned.tracks.forEach((track) => {
      const tCopy = track.clone();
      const times = [];
      const values = [];
      const valSize = tCopy.getValueSize();

      for (let i = 0; i < tCopy.times.length; i++) {
        const time = tCopy.times[i];
        if (time >= adminTrimStart && time <= adminTrimEnd) {
          times.push(time - adminTrimStart);
          for (let v = 0; v < valSize; v++) {
            values.push(tCopy.values[i * valSize + v]);
          }
        }
      }

      if (times.length > 0) {
        tCopy.times = new Float32Array(times);
        tCopy.values = new Float32Array(values);
        newTracks.push(tCopy);
      }
    });

    const newClip = new THREE.AnimationClip(
      `calib_${adminSelectedAnim}_${Date.now()}`,
      newDur,
      newTracks
    );
    setAdminActivePreviewClip(newClip);
    setAdminStatusMessage(`✓ Отрезок [${adminTrimStart.toFixed(2)}с – ${adminTrimEnd.toFixed(2)}с] применен к аватару!`);
    setTimeout(() => setAdminStatusMessage(''), 3000);
  };

  const handleAdminSaveOverride = () => {
    saveAdminAnimationOverride(adminSelectedAnim, {
      trimStart: adminTrimStart,
      trimEnd: adminTrimEnd,
      speed: adminSpeed,
      yaw: adminYaw,
      loop: adminLoop,
      title: adminTitle,
      jp: adminJapanese,
      category: adminCategory,
      notes: adminNotes,
    });
    setAdminStatusMessage(`✓ Калибровка "${adminTitle}" сохранена в реестр мастерских канонов!`);
    setTimeout(() => setAdminStatusMessage(''), 3500);
  };

  const handleAdminReset = () => {
    resetAdminAnimationOverride(adminSelectedAnim);
    setAdminTrimStart(0.0);
    setAdminTrimEnd(adminDuration);
    setAdminSpeed(1.0);
    setAdminYaw(0);
    setAdminLoop(false);
    setAdminActivePreviewClip(null);
    setAdminStatusMessage('Сброшено к оригинальному клипу');
    setTimeout(() => setAdminStatusMessage(''), 3000);
  };

  return (
    <div className="modular-mixer-container">
      {/* 3D Видовой экран Додзё */}
      <div className="modular-viewport">
        <Canvas
          shadows
          camera={{ position: [0, 1.4, 3.4], fov: 42 }}
          style={{ width: '100%', height: '100%' }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight
            position={[4, 6, 4]}
            intensity={1.2}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight position={[-3, 4, -3]} intensity={0.5} color="#bfa15f" />

          <TraditionalDojo />

          <group position={[0, 0, 0]}>
            <KaratekaLowpolyModel
              stanceClipName={motionMode === 'modular' ? stanceObj.id : null}
              techniqueClipName={motionMode === 'modular' ? techObj.id : null}
              fullBodyDynamicClipName={motionMode === 'fullbody' ? fullBodyObj.id : null}
              turnAngleDeg={selectedTurn}
              playbackSpeed={speed}
              isLooping={isLooping}
              replayTrigger={replayTrigger}
              activeCustomClip={adminActivePreviewClip}
            />
          </group>

          <ContactShadows position={[0, 0, 0]} opacity={0.65} scale={8} blur={1.8} far={4} />
          <OrbitControls
            enableDamping
            dampingFactor={0.06}
            minDistance={1.2}
            maxDistance={7.0}
            maxPolarAngle={Math.PI / 2 + 0.05}
            target={[0, 0.95, 0]}
          />
        </Canvas>

        {/* Индикатор текущего движения */}
        <div className="modular-active-badge">
          {motionMode === 'fullbody' ? (
            <>
              <Flame size={14} color="#f59e0b" />
              <span>
                Мастер-форма Ката: <strong>{fullBodyObj.name}</strong>
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

        {/* Всплывающее уведомление (Toast) */}
        {toastMessage && (
          <div className="mixer-toast-alert">
            <Check size={14} color="#10b981" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>

      {/* Панель управления микшером */}
      <div className="modular-mixer-controls">
        {/* Баннер перехода к съемке со смартфонов */}
        <div className="mixer-mocap-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={16} color="#10b981" />
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#f1f5f9' }}>
                Съёмка движений через камеры смартфонов
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                AI-захват со всех 3 камер телефона работает на соседней вкладке 3D Додзё
              </div>
            </div>
          </div>
          {onSwitchToMocap && (
            <button
              type="button"
              className="btn-mocap-banner-action"
              onClick={onSwitchToMocap}
            >
              <Video size={12} />
              <span>В 3D Додзё →</span>
            </button>
          )}
        </div>

        {/* Вкладки студии */}
        <div className="modular-tabs">
          <button
            type="button"
            className={`modular-tab-btn ${activeTab === 'mixer' ? 'active' : ''}`}
            onClick={() => setActiveTab('mixer')}
          >
            <Sliders size={14} />
            <span>Синтез движений</span>
          </button>
          <button
            type="button"
            className={`modular-tab-btn ${activeTab === 'presets' ? 'active' : ''}`}
            onClick={() => setActiveTab('presets')}
          >
            <Sparkles size={14} />
            <span>Общие пресеты Додзё ({sharedPresets.length})</span>
          </button>
          <button
            type="button"
            className={`modular-tab-btn ${activeTab === 'mocap_takes' ? 'active' : ''}`}
            onClick={() => setActiveTab('mocap_takes')}
          >
            <Camera size={14} />
            <span>Записи с телефонов</span>
          </button>

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
        {/* ВКЛАДКА 1: СИНТЕЗ И МИКШЕР СТОЕК И УДАРОВ                        */}
        {/* ================================================================= */}
        {activeTab === 'mixer' && (
          <>
            <div className="modular-controls-header">
              <h3>
                <Sliders size={18} />
                <span>Конструктор движений каратэ Шотокан</span>
              </h3>
              <p className="modular-controls-subtitle">
                Выберите стойку и технику: микшер автоматически скомбинирует их в единую форму. Сохраняйте в общедоступные пресеты в один клик!
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
                    {MODULAR_STANCE_PRESETS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`modular-preset-btn ${selectedStance === s.id ? 'active' : ''}`}
                        onClick={() => setSelectedStance(s.id)}
                        title={s.desc}
                      >
                        <span className="modular-preset-title">{s.name}</span>
                        <span className="modular-preset-type">
                          {s.type === 'movement' ? 'Шаг' : 'Стойка'}
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
                    {MODULAR_TECHNIQUE_PRESETS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`modular-preset-btn ${selectedTechnique === t.id ? 'active' : ''}`}
                        onClick={() => setSelectedTechnique(t.id)}
                        title={t.desc}
                      >
                        <span className="modular-preset-title">{t.name}</span>
                        <span className="modular-preset-type">
                          {t.type === 'block' ? 'Блок' : 'Удар'}
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
                  <span>Динамические мастер-формы, прыжки и непрерывные связки</span>
                </label>
                <div className="modular-presets-grid" style={{ maxHeight: '220px' }}>
                  {FULL_BODY_DYNAMICS_PRESETS.map((f) => (
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

            {/* Создание пресета без копирования JSON */}
            <div className="modular-export-actions">
              <button
                type="button"
                className="btn btn-primary modular-action-btn btn-save-preset"
                onClick={handleOpenCreateModal}
              >
                <Sparkles size={15} />
                <span>Создать пресет из этой комбинации</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary modular-action-btn"
                onClick={() => setActiveTab('presets')}
                style={{ padding: '0 16px' }}
                title="Перейти к общему каталогу пресетов"
              >
                <BookOpen size={14} />
                <span>Общие пресеты ({sharedPresets.length})</span>
              </button>
            </div>
          </>
        )}

        {/* ================================================================= */}
        {/* ВКЛАДКА 2: ОБЩИЕ ПРЕСЕТЫ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ                      */}
        {/* ================================================================= */}
        {activeTab === 'presets' && (
          <div className="presets-catalog-view">
            <div className="modular-controls-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3>
                    <Sparkles size={18} color="#10b981" />
                    <span>Общие пресеты Додзё</span>
                  </h3>
                  <p className="modular-controls-subtitle">
                    Единая база комбинаций, созданных пользователями. Нажмите «Загрузить в 3D», чтобы мгновенно воспроизвести любой пресет!
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-save-preset"
                  onClick={() => {
                    setActiveTab('mixer');
                    handleOpenCreateModal();
                  }}
                  style={{ padding: '6px 12px', fontSize: '11.5px' }}
                >
                  <Sparkles size={13} />
                  <span>+ Создать пресет</span>
                </button>
              </div>
            </div>

            {/* Поиск и фильтры по категориям */}
            <div className="presets-filter-bar">
              <div className="presets-search-box">
                <Search size={14} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Поиск по названию или автору..."
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                />
                {presetSearch && (
                  <button type="button" onClick={() => setPresetSearch('')} className="btn-clear-search">
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="presets-categories">
                {[
                  { id: 'all', label: 'Все' },
                  { id: 'block', label: 'Блоки' },
                  { id: 'punch', label: 'Удары руками' },
                  { id: 'kick', label: 'Удары ногами' },
                  { id: 'combo', label: 'Связки' },
                  { id: 'jump', label: 'Прыжки / Акробатика' },
                  { id: 'kata', label: 'Ката' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`preset-cat-chip ${presetFilter === c.id ? 'active' : ''}`}
                    onClick={() => setPresetFilter(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Список пресетов */}
            {isLoadingPresets ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                Загрузка пресетов с сервера...
              </div>
            ) : filteredPresets.length === 0 ? (
              <div className="presets-empty-box">
                <Sparkles size={28} color="#bfa15f" style={{ margin: '0 auto 8px' }} />
                <p>Пресеты по данному фильтру не найдены.</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setActiveTab('mixer');
                    handleOpenCreateModal();
                  }}
                  style={{ marginTop: '8px', fontSize: '11.5px', padding: '6px 14px' }}
                >
                  Создать первый пресет сейчас
                </button>
              </div>
            ) : (
              <div className="presets-cards-grid">
                {filteredPresets.map((p) => {
                  const isOwnerOrAdmin = isAdmin || (user?.User_ID && p.Created_By_User_ID === user.User_ID);
                  const isModular = p.Motion_Mode === 'modular';

                  return (
                    <div key={p.Preset_ID} className="shared-preset-card">
                      <div className="shared-preset-header">
                        <span className={`preset-badge preset-badge--${p.Category || 'combo'}`}>
                          {p.Category || 'комбо'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                            👤 {p.Author_Name}
                          </span>
                          {isOwnerOrAdmin && (
                            <button
                              type="button"
                              className="btn-delete-preset"
                              title="Удалить пресет"
                              onClick={(e) => handleDeletePreset(e, p)}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="shared-preset-title">{p.Title}</div>

                      {p.Description && (
                        <p className="shared-preset-desc">{p.Description}</p>
                      )}

                      <div className="shared-preset-details">
                        {isModular ? (
                          <span>
                            🥋 {p.Stance_ID?.replace('tech_', '') || 'Стойка'} + {p.Technique_ID?.replace('tech_', '') || 'Техника'}
                          </span>
                        ) : (
                          <span>🔥 {p.Full_Body_Clip || 'Динамика цельного тела'}</span>
                        )}
                        <span>· Поворот {p.Turn_Angle}° · {p.Speed}x</span>
                      </div>

                      <div className="shared-preset-footer">
                        <button
                          type="button"
                          className="btn btn-primary btn-apply-preset"
                          onClick={() => handleApplyPreset(p)}
                        >
                          <Play size={12} fill="#000" />
                          <span>Загрузить в 3D</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* ВКЛАДКА 3: ЗАПИСИ С ТЕЛЕФОНОВ (КАМЕРЫ ДОДЗЁ)                     */}
        {/* ================================================================= */}
        {activeTab === 'mocap_takes' && (
          <div className="presets-catalog-view">
            <div className="modular-controls-header">
              <h3>
                <Camera size={18} color="#10b981" />
                <span>Записи дублей с камер смартфонов</span>
              </h3>
              <p className="modular-controls-subtitle">
                Все файлы захвата движения, записанные через телефоны в 3D Додзё (послойно или целиком).
              </p>
            </div>

            {isLoadingTakes ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                Загрузка записей...
              </div>
            ) : studioTakes.length === 0 ? (
              <div className="presets-empty-box">
                <Camera size={28} color="#10b981" style={{ margin: '0 auto 8px' }} />
                <p>Пока нет записанных дублей с камер телефонов.</p>
                {onSwitchToMocap && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onSwitchToMocap}
                    style={{ marginTop: '8px', fontSize: '11.5px', padding: '6px 14px' }}
                  >
                    Перейти в 3D Додзё для съёмки
                  </button>
                )}
              </div>
            ) : (
              <div className="presets-cards-grid">
                {studioTakes.map((take) => (
                  <div key={take.filename} className="shared-preset-card">
                    <div className="shared-preset-header">
                      <span className="preset-badge preset-badge--mocap">
                        📹 MoCap телефон
                      </span>
                      <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                        {take.size_kb} KB
                      </span>
                    </div>

                    <div className="shared-preset-title" style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                      {take.filename}
                    </div>

                    <div className="shared-preset-details">
                      <span>Кадров: {take.frames}</span>
                      <span>· Длительность: {take.duration?.toFixed(1) || '—'}с</span>
                    </div>

                    <div className="shared-preset-footer" style={{ marginTop: '10px' }}>
                      <a
                        href={take.download_url || `/uploads/recordings/${take.filename}`}
                        download
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: '6px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', textDecoration: 'none' }}
                      >
                        <Download size={12} />
                        <span>Скачать файл</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* ВКЛАДКА 4: АДМИН-КАЛИБРОВКА (ТОЛЬКО ДЛЯ АДМИНИСТРАТОРА)           */}
        {/* ================================================================= */}
        {activeTab === 'admin' && isAdmin && (
          <div className="admin-editor-panel">
            <div className="admin-panel-header">
              <Shield size={16} color="#ef4444" />
              <span>Мастерская калибровка анимаций (Только Администратор)</span>
            </div>

            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 700 }}>
                Выберите анимацию для обрезки таймлайна:
              </label>
              <select
                className="preset-select"
                value={adminSelectedAnim}
                onChange={(e) => setAdminSelectedAnim(e.target.value)}
              >
                {ADMIN_EDITABLE_CATALOG.map((group) => (
                  <optgroup key={group.group} label={group.group}>
                    {group.items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="modular-player-toolbar" style={{ marginTop: '10px' }}>
              <button type="button" className="btn btn-primary" onClick={handleAdminApplyTrim}>
                <Play size={13} fill="#000" />
                <span>Проверить в 3D</span>
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleAdminReset}>
                <span>Сбросить</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAdminSaveOverride}
                style={{ background: '#10b981', color: '#000', fontWeight: 800 }}
              >
                <span>Сохранить калибровку</span>
              </button>
            </div>

            {adminStatusMessage && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                {adminStatusMessage}
              </div>
            )}
          </div>
        )}
      </div>

      {/* МОДАЛЬНОЕ ОКНО: СОЗДАНИЕ ОБЩЕГО ПРЕСЕТА */}
      {showCreateModal && (
        <div className="preset-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="preset-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="preset-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#10b981" />
                <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '14px', fontWeight: 800 }}>
                  Создать общий пресет для всех пользователей
                </h4>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="preset-modal-body">
              <div className="preset-preview-pill">
                <span style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                  Комбинация:
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>
                  {motionMode === 'modular'
                    ? `${stanceObj?.name} + ${techObj?.name} (${selectedTurn}°)`
                    : `${fullBodyObj?.name} (${selectedTurn}°)`}
                </span>
              </div>

              <div className="preset-form-group">
                <label>Название пресета:</label>
                <input
                  type="text"
                  value={newPresetTitle}
                  onChange={(e) => setNewPresetTitle(e.target.value)}
                  placeholder="Например: Дзэнкуцу-дати + Гэдан-барай"
                  className="preset-input"
                />
              </div>

              <div className="preset-form-group">
                <label>Категория:</label>
                <select
                  value={newPresetCategory}
                  onChange={(e) => setNewPresetCategory(e.target.value)}
                  className="preset-select"
                >
                  <option value="block">Защитный блок (Укэ)</option>
                  <option value="punch">Удар рукой (Цуки / Ути)</option>
                  <option value="kick">Удар ногой (Гэри)</option>
                  <option value="stance">Стойка / Перемещение (Дати)</option>
                  <option value="combo">Боевая связка (Комбо)</option>
                  <option value="jump">Прыжок / Акробатика</option>
                  <option value="kata">Форма Ката</option>
                </select>
              </div>

              <div className="preset-form-group">
                <label>Описание (подсказка для других пользователей):</label>
                <textarea
                  rows={2}
                  value={newPresetDesc}
                  onChange={(e) => setNewPresetDesc(e.target.value)}
                  placeholder="Краткое описание механики, ханми/сёмен, угла атаки..."
                  className="preset-textarea"
                />
              </div>

              <div className="preset-form-group">
                <label>Автор пресета:</label>
                <input
                  type="text"
                  value={newPresetAuthor}
                  onChange={(e) => setNewPresetAuthor(e.target.value)}
                  placeholder="Ваше имя или никнейм"
                  className="preset-input"
                />
              </div>

              {modalFeedback && (
                <div className={`preset-status-alert ${modalFeedback.type}`}>
                  {modalFeedback.text}
                </div>
              )}
            </div>

            <div className="preset-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-primary btn-save-preset"
                onClick={handleSaveSharedPreset}
                disabled={isSavingPreset}
              >
                {isSavingPreset ? 'Сохранение...' : 'Сохранить для всех пользователей'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
