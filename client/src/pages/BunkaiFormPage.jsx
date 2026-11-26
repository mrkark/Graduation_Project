import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { getBunkai, createBunkai, updateBunkai, getBunkaiSteps, saveBunkaiSteps } from '../api/bunkai';
import { listKata } from '../api/kata';
import { listClips } from '../api/animations';
import { useAuthStore } from '../store/authStore';
import TechniquePicker from '../components/TechniquePicker';
import { X, Swords, Trophy, Layers, Plus, Trash2, Zap, Shield, BookOpen, Ruler, AlertTriangle, Sparkles, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Copy, ArrowLeft, ArrowRight, Save } from 'lucide-react';
import { buildStepsFromDb, HEIAN_SHODAN_BUNKAI_18_STEPS, formEpisodeToEngineStep, episodeToDbStep } from '../three/bunkaiScenarioEngine';
const BunkaiMultiAvatarPlayer = lazy(() => import('../three/BunkaiMultiAvatarPlayer'));
import './BunkaiEditor.css';

// Атакующие техники Тори (Синее доги — атакующий / нападающий)
const TORI_CLIPS = [
  { id: 'tech_oi_zuki_right', label: 'Ой-цуки правой (Прямой выпад в голову / Дзёдан)' },
  { id: 'oi_zuki_jodan_right', label: 'Ой-цуки Дзёдан правой (удар в голову)' },
  { id: 'oi_zuki_jodan_left', label: 'Ой-цуки Дзёдан левой (удар в голову)' },
  { id: 'oi_zuki_right', label: 'Ой-цуки правой (Классический выпад)' },
  { id: 'oi_zuki_left', label: 'Ой-цуки левой (Классический выпад)' },
  { id: 'tech_jodan_zuki_right', label: 'Дзёдан-дзуки правой (Полный клип)' },
  { id: 'gyaku_zuki_left', label: 'Гяку-цуки левой (Реверсивный удар)' },
  { id: 'gyaku_zuki_right', label: 'Гяку-цуки правой (Реверсивный удар)' },
  { id: 'jodan_zuki_right', label: 'Кидзами / Дзёдан-дзуки правой' },
  { id: 'jodan_zuki_left', label: 'Кидзами / Дзёдан-дзуки левой' },
  { id: 'kick_mae_geri_right', label: 'Маэ-гэри правой (Прямой удар ногой)' },
  { id: 'mae_geri_right', label: 'Маэ-гэри правой (Удар ногой)' },
  { id: 'mae_geri_left', label: 'Маэ-гэри левой (Прямой удар ногой)' },
  { id: 'choku_zuki', label: 'Чоку-цуки (Прямой удар кулаком)' },
  { id: 'mawashi_geri', label: 'Маваси-гэри (Круговой удар ногой)' },
  { id: 'yoko_geri', label: 'Ёко-гэри (Боковой пробивающий удар)' },
  { id: 'ushiro_geri', label: 'Усиро-гэри (Удар пяткой назад)' },
  { id: 'ren_zuki', label: 'Рэн-цуки (Двойка кулаками)' },
  { id: 'sanbon_zuki', label: 'Санбон-цуки (Тройной пробивающий)' },
  { id: 'kizami_zuki', label: 'Кизами-цуки (Встречный джеб)' },
  { id: 'hook', label: 'Хук / Боковой с размаха' },
  { id: 'enter_zenkutsu_left', label: 'Вход в Хидари Дзэнкуцу-дати' },
  { id: 'turn_into_zenkutsu_right', label: 'Разворот 180° в Миги Дзэнкуцу-дати' },
  { id: 'step_backward_left', label: 'Шаг назад левой ногой' },
  { id: 'step_backward_right', label: 'Шаг назад правой ногой' },
  { id: 'step_backward', label: 'Отход шагом назад в Хэйко-дати' },
  { id: 'zenkutsu_dachi_right', label: 'Стойка Миги Дзэнкуцу-дати (Фиксация)' },
  { id: 'zenkutsu_dachi_left', label: 'Стойка Хидари Дзэнкуцу-дати (Фиксация)' },
  { id: 'stance_musubi', label: 'Мусуби-дати (Стойка поклона Рэй)' },
  { id: 'heiko_dachi', label: 'Хэйко-дати (Стойка готовности)' },
  { id: 'idle_shizentai', label: 'Сидзэнтай / Укэми (Ожидание / партер)' },
];

// Защитные блоки и контратаки Укэ (Белое доги — защищающийся / контратакующий)
const UKE_CLIPS = [
  { id: 'age_uke_left', label: 'Агэ-укэ левой (Верхний восходящий блок)' },
  { id: 'age_uke_right', label: 'Гяку Агэ-укэ правой (Верхний блок / рычаг локтя)' },
  { id: 'tech_age_uke_left', label: 'Агэ-укэ левой (Полный клип)' },
  { id: 'gedan_barai_left', label: 'Гэдан-барай левой (Нижний смет)' },
  { id: 'gedan_barai_right', label: 'Гэдан-барай правой (Нижний смет)' },
  { id: 'tech_gedan_barai_left', label: 'Гэдан-барай левой (Полный клип)' },
  { id: 'tech_haishu_uke_left', label: 'Хайван / Хайсю-укэ левой' },
  { id: 'tech_uchi_uke_left', label: 'Нагаси / Ути-укэ левой (Отводящий блок)' },
  { id: 'tech_uchi_uke_right', label: 'Нагаси / Ути-укэ правой (Отводящий блок)' },
  { id: 'tech_shuto_uke_right', label: 'Сюто-укэ правой (Блок ребром ладони)' },
  { id: 'tech_shuto_uke_left', label: 'Сюто-укэ левой (Удар/блок ребром ладони)' },
  { id: 'tech_shuto_uchi_right', label: 'Дзёдан Сюто-учи правой (Удар ребром ладони)' },
  { id: 'tech_shuto_uchi_left', label: 'Дзёдан Сюто-учи левой (Удар ребром ладони)' },
  { id: 'tech_haishu_uke_right', label: 'Хайван / Хайсю-укэ правой' },
  { id: 'tech_tettsui_right', label: 'Тэтцуи правой (Удар основанием кулака)' },
  { id: 'tech_tate_zuki_right', label: 'Отоши / Татэ-дзуки правой (Добивание в партере)' },
  { id: 'tech_tate_zuki_left', label: 'Отоши / Татэ-дзуки левой (Добивание)' },
  { id: 'gyaku_zuki_right', label: 'Гяку-цуки правой (Реверсивный контрудар)' },
  { id: 'gyaku_zuki_left', label: 'Гяку-цуки левой (Реверсивный контрудар)' },
  { id: 'tech_gyaku_zuki_right', label: 'Гяку-цуки правой (Полный клип)' },
  { id: 'shuto_uke', label: 'Сюто-укэ (Блок ребром ладони)' },
  { id: 'soto_uke', label: 'Сото-укэ (Блок снаружи-внутрь)' },
  { id: 'uchi_uke', label: 'Ути-укэ (Блок изнутри-наружу)' },
  { id: 'kick_nami_gaeshi_right', label: 'Аши-барай (Подсечка правой ногой)' },
  { id: 'kick_nami_gaeshi_left', label: 'Аши-барай (Подсечка левой ногой)' },
  { id: 'enter_zenkutsu_right', label: 'Вход в Миги Дзэнкуцу-дати' },
  { id: 'step_forward_right', label: 'Проход вперёд в Миги Дзэнкуцу-дати' },
  { id: 'turn_into_zenkutsu_left', label: 'Разворот в Хидари Дзэнкуцу-дати' },
  { id: 'step_backward_right', label: 'Шаг назад правой ногой' },
  { id: 'step_backward', label: 'Отход шагом назад в Хэйко-дати' },
  { id: 'zenkutsu_dachi_left', label: 'Стойка Хидари Дзэнкуцу-дати (Фиксация)' },
  { id: 'zenkutsu_dachi_right', label: 'Стойка Миги Дзэнкуцу-дати (Фиксация)' },
  { id: 'strike_above_elbow', label: 'Удар выше локтя (Болевой прием на руку)' },
  { id: 'strike_throat_left', label: 'Удар в горло (Атэми в шею)' },
  { id: 'empi_uchi', label: 'Эмпи-учи (Сокрушительный удар локтем)' },
  { id: 'uraken_uchi', label: 'Уракэн-учи (Бэкфист в висок)' },
  { id: 'tetsui_uchi', label: 'Тэтцуи-учи (Удар-молот)' },
  { id: 'step_turn_shiko', label: 'Разворот в стойку Сико-дати' },
  { id: 'otoshi_zuki_ground', label: 'Отоши-дзуки (Добивание в партере)' },
  { id: 'fallen_ukemi', label: 'Укэми (Падение со страховкой на татами)' },
  { id: 'standup_to_zenkutsu', label: 'Подъем с татами в Дзэнкуцу-дати' },
  { id: 'ippon_seoi_nage', label: 'Иппон Сэои-нагэ (Бросок через плечо)' },
  { id: 'deashi_harai', label: 'Дэаси-харай (Сметающая подсечка)' },
  { id: 'stance_musubi', label: 'Мусуби-дати (Стойка поклона Рэй)' },
  { id: 'heiko_dachi', label: 'Хэйко-дати (Стойка готовности)' },
  { id: 'idle_shizentai', label: 'Сидзэнтай (Естественная позиция)' },
];

const STANCE_OPTIONS = [
  {
    group: 'Дзэнкуцу-дати (前屈立ち / Выпад вперед)',
    options: [
      { value: 'zenkutsu_dachi_left', label: 'Левая Дзэнкуцу-дати (Хидари)' },
      { value: 'zenkutsu_dachi_right', label: 'Правая Дзэнкуцу-дати (Миги)' },
    ],
  },
  {
    group: 'Кокуцу-дати (後屈立ち / Защитная стойка)',
    options: [
      { value: 'kokutsu_dachi_left', label: 'Левая Кокуцу-дати (Хидари)' },
      { value: 'kokutsu_dachi_right', label: 'Правая Кокуцу-дати (Миги)' },
    ],
  },
  {
    group: 'Фудо-дати (不動立ち / Боевая стойка Сочин)',
    options: [
      { value: 'fudo_dachi', label: 'Левая Фудо-дати (Хидари)' },
      { value: 'fudo_dachi_right', label: 'Правая Фудо-дати (Миги)' },
    ],
  },
  {
    group: 'Симметричные и специальные стойки',
    options: [
      { value: 'kiba_dachi', label: 'Киба-дати (Стойка всадника)' },
      { value: 'stance_shiko', label: 'Сико-дати (Квадратная стойка)' },
      { value: 'heiko_dachi', label: 'Хэйко-дати (Параллельная)' },
      { value: 'stance_heisoku', label: 'Хэйсоку-дати (Сомкнутая спиной)' },
      { value: 'stance_musubi', label: 'Мусуби-дати (Поклон рэй)' },
      { value: 'stance_neko_left', label: 'Хидари Нэкоаси-дати (Кошачья)' },
      { value: 'fallen_ukemi', label: 'Партер (Страховка Укэми)' },
      { value: 'idle_shizentai', label: 'Сидзэнтай (Естественная позиция)' },
    ],
  },
];

const PHASES = [
  'Атака и реакция',
  'Встречный сбив (Укэ)',
  'Уход с линии (Тайсабаки)',
  'Залом сустава (Кансэцу)',
  'Бросок / сваливание (Нагэ)',
  'Контрудар (Атэми)',
  'Фиксация и контроль (Дзансин)',
];

const emptyEpisode = () => ({
  attacker: '1 (Тори — атакующий)',
  attackAngle: '0°',
  attackAngleDeg: 0,
  combatDistance: 1.45,
  toriEndAngleDeg: 0,
  ukeEndAngleDeg: 180,
  toriClip: 'tech_oi_zuki_right',
  toriStance: 'zenkutsu_dachi_right',
  toriFinalStance: '',
  toriLandingMode: 'auto',
  ukeClip: 'tech_age_uke_left',
  ukeStance: 'zenkutsu_dachi_left',
  ukeFinalStance: '',
  ukeLandingMode: 'auto',
  uke2Clip: 'idle_shizentai',
  attackTechnique: 'Ой-цуки дзедан (прямой выпад кулаком Тори)',
  toriMovement: 'Прямой выпад вперед по оси Z',
  toriCounter: 'Смещение с линии атаки во внешний угол под 35° (Тай-сабаки) + блок Агэ-укэ',
  phase: 'Встречный сбив (Укэ)',
  outcome: 'Блокирование удара и выведение из равновесия (Кудзуси)',
});

function getMaaiInfo(dist) {
  if (dist < 1.10) {
    return {
      name: 'Чика-ма (近間)',
      desc: 'Ближний бой, захваты, клинч и заломы суставов',
      className: 'maai-zone--chika',
    };
  }
  if (dist <= 1.80) {
    return {
      name: 'Иссоку-итто (一足一刀)',
      desc: 'Дистанция одного шага и удара (базовая боевая дистанция каратэ)',
      className: 'maai-zone--issoku',
    };
  }
  return {
    name: 'То-ма (遠間)',
    desc: 'Дальняя дистанция маневрирования и входа в атаку',
    className: 'maai-zone--toma',
  };
}

function engineStepToFormEpisode(st, idx, participantCount = 2) {
  const toriPart = st.participants?.find((p) => p.role === 'tori') || {};
  const ukePart = st.participants?.find((p) => p.role === 'uke' || p.role === 'uke1') || {};
  const uke2Part = st.participants?.find((p) => p.role === 'uke2') || {};

  let phase = st.phase || 'Атака и реакция';
  if (!st.phase) {
    if (st.contactType === 'block_gedan' || st.contactType === 'block_haivan' || st.contactType === 'block_jodan' || st.contactType === 'block_gyaku_age_uke') phase = 'Встречный сбив (Укэ)';
    if (st.contactType === 'joint_lock') phase = 'Залом сустава (Кансэцу)';
    if (st.contactType === 'sweep_fall') phase = 'Бросок / сваливание (Нагэ)';
    if (st.contactType === 'strike_chudan' || st.contactType === 'strike_throat' || st.contactType === 'punch_body' || st.contactType === 'punch_head') phase = 'Контрудар (Атэми)';
  }

  return {
    attacker: participantCount === 3 ? 'Укэ 1 и Укэ 2' : '1 (Тори — атакующий)',
    attackAngle: `${st.attackAngleDeg || 0}°`,
    attackAngleDeg: st.attackAngleDeg || 0,
    toriAngleOffsetDeg: st.toriAngleOffsetDeg || 0,
    ukeEvasionAngleDeg: st.ukeEvasionAngleDeg || 0,
    combatDistance: st.optimalDistance || 1.45,
    isCustomDistance: Boolean(st.isCustomDistance),
    toriEndAngleDeg: st.toriEndAngleDeg !== undefined ? st.toriEndAngleDeg : (st.scenarioAngles?.toriAngleDeg ?? (st.toriTrajectory?.endYaw !== undefined ? Math.round((st.toriTrajectory.endYaw * 180) / Math.PI) : 0)),
    ukeEndAngleDeg: st.ukeEndAngleDeg !== undefined ? st.ukeEndAngleDeg : (st.scenarioAngles?.ukeAngleDeg ?? (st.ukeTrajectory?.endYaw !== undefined ? Math.round((st.ukeTrajectory.endYaw * 180) / Math.PI) : 180)),
    orientationModeTori: st.orientationModeTori,
    orientationModeUke: st.orientationModeUke,
    customToriPosX: st.customToriPosX,
    customToriPosZ: st.customToriPosZ,
    customUkePosX: st.customUkePosX,
    customUkePosZ: st.customUkePosZ,
    toriClip: toriPart.clipName || 'heiko_dachi',
    toriStance: toriPart.stance || 'zenkutsu_dachi_right',
    toriFinalStance: toriPart.finalStance || '',
    toriLandingMode: toriPart.landingMode || 'auto',
    toriDelaySeconds: toriPart.delaySeconds ?? 0.0,
    toriActionType: st.toriActionType || toriPart.actionType || 'stance',
    ukeClip: ukePart.clipName || 'heiko_dachi',
    ukeStance: ukePart.stance || 'zenkutsu_dachi_left',
    ukeFinalStance: ukePart.finalStance || '',
    ukeLandingMode: ukePart.landingMode || 'auto',
    ukeDelaySeconds: ukePart.delaySeconds ?? 0.08,
    ukeActionType: st.ukeActionType || ukePart.actionType || 'stance',
    ukeIsGround: Boolean(ukePart.isGround),
    uke2Clip: uke2Part.clipName || 'idle_shizentai',
    uke2AngleDeg: st.uke2AngleDeg,
    attackTechnique: st.title || `Шаг ${idx + 1}`,
    toriMovement: st.toriMovement || (st.displacementTori ? `Смещение: [${st.displacementTori.join(', ')}]` : 'Прямой выпад вперед по оси Z'),
    toriCounter: st.description || 'Смещение с линии атаки + защита',
    phase,
    outcome: st.outcome || st.notes || st.description || 'Выведение из равновесия (Кудзуси)',
    notes: st.notes || '',
    duration: st.duration,
    contactType: st.contactType,
    interactionType: st.interactionType,
    tContact: st.tContact,
    isGround: Boolean(st.isGround || toriPart.isGround),
    isRising: Boolean(st.isRising || toriPart.isRising),
    isBow: Boolean(st.isBow),
    backToOpponent: Boolean(st.backToOpponent),
    preserveScenarioYaw: Boolean(st.preserveScenarioYaw),
    toriTurnDir: st.toriTurnDir || 0,
    ukeTurnDir: st.ukeTurnDir || 0,
    scenarioAngles: st.scenarioAngles || null,
    toriTrajectory: st.toriTrajectory || null,
    ukeTrajectory: st.ukeTrajectory || null,
    displacementTori: st.displacementTori || null,
    displacementUke: st.displacementUke || null,
  };
}

export default function BunkaiFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = !!id && !isNaN(Number(id)) && Number(id) > 0;
  const navigate = useNavigate();

  const [form, setForm] = useState({
    kataId: searchParams.get('kataId') || '',
    title: '',
    description: '',
    application: '',
    difficulty: 'beginner',
    videoUrl: '',
    thumbnailUrl: '',
  });

  const [participantMode, setParticipantMode] = useState('2-person'); // '2-person' | '3-person'
  const [episodes, setEpisodes] = useState([emptyEpisode()]);
  const [activeEpisodeIdx, setActiveEpisodeIdx] = useState(0);

  // Отслеживание несохраненных изменений и модальное окно напоминания
  const [isDirty, setIsDirty] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  const { user } = useAuthStore();
  const [notCreatorError, setNotCreatorError] = useState(false);
  const [kataOptions, setKataOptions] = useState([]);
  const [clipsList, setClipsList] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showMediaDetails, setShowMediaDetails] = useState(false);

  // Защита от случайного закрытия вкладки браузера при наличии несохраненных изменений
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  function handleExitAttempt() {
    if (isDirty) {
      setShowExitModal(true);
    } else {
      navigate(-1);
    }
  }

  // Состояние пикера техник: { episodeIndex, targetField: 'attack' | 'counter' }
  const [pickerTarget, setPickerTarget] = useState(null);

  // Карта сопоставления имени клипа и Clip_ID
  const clipIdMap = useMemo(() => {
    const map = new Map();
    clipsList.forEach((c) => {
      if (c.Clip_Name && c.Clip_ID) {
        map.set(c.Clip_Name, c.Clip_ID);
      }
    });
    return map;
  }, [clipsList]);

  useEffect(() => {
    Promise.all([
      listKata({ pageSize: 100, sort: 'title' }),
      listClips().catch(() => []),
    ]).then(([kataRes, clipsRes]) => {
      setKataOptions(kataRes.data || []);
      setClipsList(clipsRes || []);
    });
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    Promise.all([
      getBunkai(id),
      getBunkaiSteps(id).catch(() => []),
    ])
      .then(([b, steps]) => {
        const currentUserId = user?.User_ID ?? user?.userId ?? user?.id;
        const authorId = b?.Author_ID ?? b?.Author?.User_ID;
        const isCreator = Boolean(currentUserId && authorId && Number(currentUserId) === Number(authorId));

        if (!isCreator) {
          setNotCreatorError(true);
          setError('Доступ ограничен: только создатель бункая может изменять движения и параметры данного разбора.');
          setLoading(false);
          return;
        }

        setForm({
          kataId: b.Kata_ID,
          title: b.Title,
          description: b.Description || '',
          application: b.Application || '',
          difficulty: b.Difficulty,
          videoUrl: b.Video_URL || '',
          thumbnailUrl: b.Thumbnail_URL || '',
        });

        if (Array.isArray(steps) && steps.length > 0) {
          const unifiedSteps = buildStepsFromDb(steps);
          const loadedEpisodes = unifiedSteps.map((st, idx) =>
            engineStepToFormEpisode(st, idx, steps[idx]?.participantCount || 2)
          );
          setEpisodes(loadedEpisodes);
          setIsDirty(false);
          if (steps.some((s) => s.participantCount === 3 || s.participants?.some((p) => p.role === 'uke2'))) {
            setParticipantMode('3-person');
          }
        }
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  function update(field) {
    return (e) => {
      setIsDirty(true);
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  function isStanceOnlyClip(clip) {
    const s = String(clip || '').trim().toLowerCase();
    return (
      s === 'heiko_dachi' ||
      s === 'idle_shizentai' ||
      s === 'kiba_dachi' ||
      s === 'fudo_dachi' ||
      s === 'fudo_dachi_right' ||
      s === 'fallen_ukemi' ||
      s.startsWith('zenkutsu_dachi') ||
      s.startsWith('kokutsu_dachi') ||
      s.startsWith('stance_')
    );
  }

  function updateEpisode(index, field, value) {
    setIsDirty(true);
    let normalizedField = field;
    if (field === 'retreatAngleDeg' || field === 'taiSabakiAngleDeg' || field === 'toriEvasionAngleDeg') {
      normalizedField = 'ukeEvasionAngleDeg';
    } else if (field === 'customToriYawDeg' || field === 'toriYaw' || field === 'toriEndYaw') {
      normalizedField = 'toriEndAngleDeg';
    } else if (field === 'customUkeYawDeg' || field === 'ukeYaw' || field === 'ukeEndYaw') {
      normalizedField = 'ukeEndAngleDeg';
    }

    setEpisodes((prev) =>
      prev.map((ep, idx) => {
        if (idx !== index) return ep;
        const patch = { [normalizedField]: value };
        if (normalizedField === 'combatDistance') {
          patch.isCustomDistance = true;
        }
        if (normalizedField === 'toriEndAngleDeg') {
          patch.orientationModeTori = 'mode1_free';
        }
        if (normalizedField === 'ukeEndAngleDeg') {
          patch.orientationModeUke = 'mode1_free';
        }
        if (normalizedField === 'attackAngleDeg') {
          patch.attackAngle = `${value}°`;
        }
        // При смене стойки на шаге со статичной стойкой синхронно обновляем клип и конечную стойку
        if (normalizedField === 'toriStance' && isStanceOnlyClip(ep.toriClip)) {
          patch.toriClip = value;
          if (!ep.toriFinalStance || ep.toriFinalStance === ep.toriStance) {
            patch.toriFinalStance = value;
          }
        }
        if (normalizedField === 'toriFinalStance' && value && isStanceOnlyClip(ep.toriClip)) {
          patch.toriClip = value;
        }
        if (normalizedField === 'ukeStance' && isStanceOnlyClip(ep.ukeClip)) {
          patch.ukeClip = value;
          if (!ep.ukeFinalStance || ep.ukeFinalStance === ep.ukeStance) {
            patch.ukeFinalStance = value;
          }
        }
        if (normalizedField === 'ukeFinalStance' && value && isStanceOnlyClip(ep.ukeClip)) {
          patch.ukeClip = value;
        }
        return { ...ep, ...patch };
      })
    );
  }

  function addEpisode() {
    setIsDirty(true);
    setEpisodes((prev) => {
      const nextEp = {
        ...emptyEpisode(),
        attacker: participantMode === '3-person' && prev.length % 2 !== 0 ? 'Укэ 2 (фланговый)' : '1 (Тори — атакующий)',
      };
      return [...prev, nextEp];
    });
    setActiveEpisodeIdx(episodes.length);
  }

  function removeEpisode(index) {
    if (episodes.length <= 1) return;
    setIsDirty(true);
    setEpisodes((prev) => prev.filter((_, idx) => idx !== index));
    if (activeEpisodeIdx >= episodes.length - 1) {
      setActiveEpisodeIdx(Math.max(0, episodes.length - 2));
    }
  }

  function duplicateEpisode(index) {
    setIsDirty(true);
    const epToCopy = { ...episodes[index] };
    setEpisodes((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, epToCopy);
      return next;
    });
    setActiveEpisodeIdx(index + 1);
  }

  function moveEpisode(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= episodes.length) return;
    setIsDirty(true);
    setEpisodes((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
    setActiveEpisodeIdx(targetIndex);
  }

  function prevStep() {
    if (activeEpisodeIdx > 0) {
      setActiveEpisodeIdx(activeEpisodeIdx - 1);
    }
  }

  function nextStep() {
    if (activeEpisodeIdx < episodes.length - 1) {
      setActiveEpisodeIdx(activeEpisodeIdx + 1);
    } else {
      addEpisode();
    }
  }

  function handleTechniquePicked(tech) {
    if (!pickerTarget) return;
    const { index, field } = pickerTarget;
    if (field === 'attack') {
      updateEpisode(index, 'attackTechnique', `${tech.nameRu} (${tech.kanji}) · ${tech.level}`);
      const matched = TORI_CLIPS.find((c) =>
        c.id.includes(tech.id.replace(/-/g, '_')) ||
        tech.nameRomaji?.toLowerCase().includes(c.id.replace(/_/g, ''))
      );
      if (matched) {
        updateEpisode(index, 'toriClip', matched.id);
      }
    } else {
      updateEpisode(index, 'toriCounter', `${tech.nameRu} (${tech.kanji}) · ${tech.description}`);
      const matched = UKE_CLIPS.find((c) =>
        c.id.includes(tech.id.replace(/-/g, '_')) ||
        tech.nameRomaji?.toLowerCase().includes(c.id.replace(/_/g, ''))
      );
      if (matched) {
        updateEpisode(index, 'ukeClip', matched.id);
      }
    }
    setPickerTarget(null);
  }

  // Генерация шагов для 3D предпросмотра в реальном времени с использованием единого движка
  const previewSteps = useMemo(() => {
    return episodes.map((ep, idx) => formEpisodeToEngineStep(ep, idx, episodes.length));
  }, [episodes]);

  function loadHeianShodanCanonicalTemplate() {
    const heianKata = kataOptions.find((k) =>
      (k.Title || '').toLowerCase().includes('хэйан шодан') ||
      (k.Title || '').toLowerCase().includes('heian shodan') ||
      (k.Title || '').toLowerCase().includes('хейан шодан') ||
      (k.Code || '').toLowerCase().includes('heian_shodan')
    );

    setForm((f) => ({
      ...f,
      kataId: heianKata ? String(heianKata.Kata_ID) : f.kataId,
      title: `Канонический Бункай: Хэйан Шодан (${HEIAN_SHODAN_BUNKAI_18_STEPS.length} шага)`,
      description: 'Официальный пошаговый бункай ката Хэйан Шодан: 1 — Тори (синий, атакующий), 2 — Укэ (белый, защищающийся). Разбор боевого взаимодействия на реальной боевой дистанции с непрерывными переходами и контролем анти-проникновения.',
      difficulty: 'beginner',
    }));

    setParticipantMode('2-person');

    const mappedEpisodes = HEIAN_SHODAN_BUNKAI_18_STEPS.map((step, idx) =>
      engineStepToFormEpisode(step, idx, 2)
    );

    setEpisodes(mappedEpisodes);
    setIsDirty(true);
    setActiveEpisodeIdx(0);
    setError(null);
  }

  async function onSubmit(e) {
    if (e) e.preventDefault();
    setError(null);

    if (!form.kataId || isNaN(Number(form.kataId)) || Number(form.kataId) <= 0) {
      setError('Пожалуйста, выберите связанное ката Шотокан из списка.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!form.title || form.title.trim().length < 2) {
      setError('Пожалуйста, укажите название разбора бункая (от 2 до 200 символов).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);

    const modeLabel =
      participantMode === '3-person'
        ? 'Соревновательный командный бункай (3 участника: Тори + Укэ 1 + Укэ 2)'
        : 'Традиционный парный бункай (2 участника: Тори + Укэ)';

    let formattedApplication = `${modeLabel}\n\n`;
    episodes.forEach((ep, i) => {
      formattedApplication += `[Эпизод ${i + 1}]\n`;
      formattedApplication += `• Фаза: ${ep.phase || 'Встречный сбив'}\n`;
      formattedApplication += `• Атакующий (Тори): под углом ${ep.attackAngleDeg}° (Дистанция: ${ep.combatDistance}м)\n`;
      formattedApplication += `• Атака Тори (Клип: ${ep.toriClip}): ${ep.attackTechnique}\n`;
      formattedApplication += `• Траектория выпада Тори: ${ep.toriMovement}\n`;
      formattedApplication += `• Защита и контратака Укэ 1 (Клип: ${ep.ukeClip}): ${ep.toriCounter}\n`;
      formattedApplication += `• Биомеханический итог: ${ep.outcome}\n\n`;
    });

    if (form.application.trim()) {
      formattedApplication += `Дополнительные примечания:\n${form.application}`;
    }

    try {
      const payload = {
        kataId: Number(form.kataId),
        title: form.title.trim(),
        description: form.description?.trim() || null,
        application: formattedApplication.trim(),
        difficulty: form.difficulty || 'beginner',
        videoUrl: form.videoUrl?.trim() || null,
        thumbnailUrl: form.thumbnailUrl?.trim() || null,
      };
      const bunkai = isEdit ? await updateBunkai(id, payload) : await createBunkai(payload);
      const bunkaiId = bunkai.Bunkai_ID || id;

      const is3Person = participantMode === '3-person';
      const structuredSteps = episodes.map((ep, idx) =>
        episodeToDbStep(ep, idx, clipIdMap, is3Person, episodes.length)
      );

      await saveBunkaiSteps(bunkaiId, structuredSteps).catch((err) => {
        console.warn('Ошибка сохранения структурированных шагов:', err);
      });

      setIsDirty(false);
      navigate(`/bunkai/${bunkaiId}`);
    } catch (err) {
      const apiErr = err.response?.data?.error;
      if (apiErr?.details && Array.isArray(apiErr.details) && apiErr.details.length > 0) {
        const detailList = apiErr.details.map((d) => d.msg || `${d.path}: некорректное значение`).filter(Boolean);
        setError(detailList.length > 0 ? detailList.join('. ') : apiErr.message);
      } else {
        setError(apiErr?.message || err.message || 'Не удалось сохранить бункай');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="loading">Загрузка мастерской бункая…</p>;

  if (notCreatorError) {
    return (
      <div className="container" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: 540, margin: '0 auto', background: '#14141c', padding: '2.5rem 2rem', borderRadius: 12, border: '1px solid #334155', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
          <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
          <h2 style={{ color: '#f8fafc', marginBottom: '0.75rem', fontSize: '1.4rem' }}>Доступ ограничен</h2>
          <p style={{ color: '#cbd5e1', lineHeight: 1.6, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            Этот разбор бункая может редактировать только его создатель. У других пользователей нет прав на изменение движений, стоек и параметров сценария.
          </p>
          <Link
            to={`/bunkai/${id}`}
            className="btn"
            style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', padding: '8px 16px', borderRadius: 6, textDecoration: 'none', fontWeight: 600, display: 'inline-block' }}
          >
            Вернуться к просмотру бункая
          </Link>
        </div>
      </div>
    );
  }

  const currentEp = episodes[activeEpisodeIdx] || episodes[0] || emptyEpisode();
  const currentMaai = getMaaiInfo(currentEp.combatDistance);

  return (
    <div className="bunkai-studio">
      {/* ВЕРХНИЙ БАР СТУДИИ */}
      <header className="bunkai-studio__header">
        <div>
          <h1 className="bunkai-studio__title">
            {isEdit ? 'Редактор бункай' : 'Мастерская разбора бункай'}
          </h1>
          <p className="bunkai-studio__subtitle">
            Тактическое моделирование: 3D-симуляция участников, дистанция Ма-ай и эпизоды боя
          </p>
          {error && (
            <div style={{
              marginTop: '0.85rem',
              padding: '0.75rem 1.15rem',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              borderRadius: 'var(--radius-sm)',
              color: '#ef4444',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><AlertTriangle size={15} color='#ef4444' /> {error}</span>
            </div>
          )}
        </div>

        <div className="bunkai-studio__header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {isDirty && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                color: '#34d399',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
              Несохраненные изменения
            </div>
          )}

          {!isEdit && (
            <button
              type="button"
              className="btn btn-subtle"
              onClick={loadHeianShodanCanonicalTemplate}
              title={`Загрузить официальный ${HEIAN_SHODAN_BUNKAI_18_STEPS.length}-шаговый сценарий бункая Хэйан Шодан`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #475569', color: '#f8fafc', background: '#1e293b' }}
            >
              <Zap size={14} color="#f8fafc" /> Шаблон Хэйан Шодан ({HEIAN_SHODAN_BUNKAI_18_STEPS.length} шага)
            </button>
          )}

          <button
            type="button"
            className="btn"
            onClick={handleExitAttempt}
            disabled={saving}
            style={{
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #475569',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Завершить работу
          </button>

          <button
            type="button"
            className="btn"
            onClick={onSubmit}
            disabled={saving}
            style={{
              background: '#10b981',
              color: '#ffffff',
              border: '1px solid #059669',
              padding: '6px 16px',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Save size={15} color="#ffffff" />
            {saving ? 'Сохранение в БД…' : isEdit ? 'Сохранить бункай' : 'Опубликовать бункай'}
          </button>
        </div>
      </header>

      {/* ВЕРХНЯЯ ПАНЕЛЬ: МЕТАДАННЫЕ И ВЫБОР РЕЖИМА */}
      <section className="bunkai-studio__meta-panel">
        <div className="bunkai-studio__meta-grid">
          <div className="field" style={{ margin: 0 }}>
            <label>Связанное ката Шотокан *</label>
            <select required value={form.kataId} onChange={update('kataId')} disabled={isEdit}>
              <option value="">Выберите ката из списка…</option>
              {kataOptions.map((k) => (
                <option key={k.Kata_ID} value={k.Kata_ID}>
                  {k.Title} {k.Style ? `(${k.Style})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label>Название разбора бункая *</label>
            <input
              required
              value={form.title}
              onChange={update('title')}
              placeholder="Например: Разбор начальной связки Хэйан Шодан против захвата и удара"
            />
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label>Уровень сложности</label>
            <select value={form.difficulty} onChange={update('difficulty')}>
              <option value="beginner">Начальный (Белый / Жёлтый пояс)</option>
              <option value="intermediate">Средний (Зелёный / Синий пояс)</option>
              <option value="advanced">Продвинутый (Коричневый пояс)</option>
              <option value="master">Мастерский (Чёрный пояс / Дан)</option>
            </select>
          </div>
        </div>

        {/* Выбор режима участников: 2 или 3 человека */}
        <div style={{ marginTop: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--gold)', fontWeight: 600, marginBottom: '0.4rem' }}>
            Формат боевого взаимодействия (Участники)
          </label>
          <div className="bunkai-mode-toggle">
            <div
              className={`bunkai-mode-option ${participantMode === '2-person' ? 'active' : ''}`}
              onClick={() => setParticipantMode('2-person')}
            >
              <Swords size={28} color='var(--gold)' />
              <div>
                <strong style={{ color: '#fff', fontSize: '0.92rem' }}>Дуэт (2 участника)</strong>
                <div style={{ fontSize: '0.76rem', color: 'var(--washi-dim)' }}>
                  1 — Тори (синий, атакующий) + 2 — Укэ (белый, защищающийся)
                </div>
              </div>
            </div>

            <div
              className={`bunkai-mode-option bunkai-mode-option--3p ${participantMode === '3-person' ? 'active' : ''}`}
              onClick={() => setParticipantMode('3-person')}
            >
              <Trophy size={28} color='var(--gold)' />
              <div>
                <strong style={{ color: '#fff', fontSize: '0.92rem' }}>Трио (3 участника — Соревновательный бункай)</strong>
                <div style={{ fontSize: '0.76rem', color: 'var(--washi-dim)' }}>
                  Тори + Укэ 1 (фронтальный выпад) + Укэ 2 (фланговая атака)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Дополнительный концепт и ссылки на медиа */}
        <div style={{ marginTop: '1.1rem' }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Тактический сценарий и контекст применения</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={update('description')}
              placeholder="Опишите контекст ситуации (нападение на улице, захват за отвороты кимоно, неожиданная атака с фланга)..."
            />
          </div>
        </div>

        <div style={{ marginTop: '0.8rem' }}>
          <button
            type="button"
            className="btn"
            style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
            onClick={() => setShowMediaDetails(!showMediaDetails)}
          >
            {showMediaDetails ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <ChevronUp size={14} /> Скрыть ссылки на медиа
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <ChevronDown size={14} /> Добавить ссылки на видео / превью
            </span>
          )}
          </button>

          {showMediaDetails && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.8rem' }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Ссылка на видео демонстрации (YouTube)</label>
                <input value={form.videoUrl} onChange={update('videoUrl')} placeholder="https://youtube.com/watch?v=…" />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Ссылка на изображение превью</label>
                <input value={form.thumbnailUrl} onChange={update('thumbnailUrl')} placeholder="https://…" />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ЦЕНТР СТУДИИ: БОЛЬШАЯ 3D-АРЕНА ДОДЗЁ */}
      <section className="bunkai-studio__arena-wrap">
        <div className="bunkai-studio__arena-bar">
          <div className="bunkai-studio__arena-title">
            <Layers size={14} />
            <span>Интерактивная 3D-арена боевого взаимодействия (Тори и Укэ)</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 600 }}>
            {participantMode === '3-person' ? 'Режим: 3 участника (Команда)' : 'Режим: 2 участника (Дуэт)'}
          </span>
        </div>

        <Suspense fallback={<div className="bunkai-preview-stage" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>Загрузка 3D студии бункай…</div>}>
          <BunkaiMultiAvatarPlayer
            steps={previewSteps}
            defaultParticipantMode={participantMode}
            height={480}
            activeStepIndex={activeEpisodeIdx}
            onStepChange={setActiveEpisodeIdx}
            onStepParamChange={(stepIdx, field, val) => updateEpisode(stepIdx, field, val)}
          />
        </Suspense>
      </section>

      {/* ПОШАГОВОЕ РЕДАКТИРОВАНИЕ БУНКАЙ: НАВИГАТОР ПО ШАГАМ (STEPPER) */}
      <section className="bunkai-stepper-section">
        <div className="bunkai-stepper-header">
          <div className="bunkai-stepper-title-wrap">
            <Swords size={16} color="var(--gold)" />
            <h3 className="bunkai-stepper-title">
              Пошаговое моделирование эпизодов (Кэйко-дзюн / 稽古順)
            </h3>
            <span className="bunkai-stepper-count-badge">
              Шаг {activeEpisodeIdx + 1} из {episodes.length}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-subtle"
            onClick={addEpisode}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', border: '1px solid #475569', color: '#f8fafc' }}
            title="Добавить новый шаг в конец сценария"
          >
            <Plus size={14} /> Добавить шаг
          </button>
        </div>

        {/* КОМПАКТНАЯ ЛЕНТА ШАГОВ (STEP TABS) */}
        <div className="bunkai-stepper-tabs-container">
          <div className="bunkai-stepper-tabs">
            {episodes.map((ep, idx) => {
              const isActive = idx === activeEpisodeIdx;
              return (
                <button
                  key={idx}
                  type="button"
                  className={`bunkai-step-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveEpisodeIdx(idx)}
                  title={`Шаг ${idx + 1}: ${ep.attackTechnique} -> ${ep.toriCounter}`}
                >
                  <span className="bunkai-step-tab__num">{idx + 1}</span>
                  <div className="bunkai-step-tab__info">
                    <span className="bunkai-step-tab__title">
                      {ep.attackTechnique ? ep.attackTechnique.split('·')[0].split('(')[0].trim() : `Шаг ${idx + 1}`}
                    </span>
                    <span className="bunkai-step-tab__dist">
                      {ep.combatDistance}м · {ep.phase ? ep.phase.split(' ')[0] : 'Сбив'}
                    </span>
                  </div>
                  {episodes.length > 1 && (
                    <span
                      className="bunkai-step-tab__del"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeEpisode(idx);
                      }}
                      title="Удалить шаг"
                    >
                      <X size={12} />
                    </span>
                  )}
                </button>
              );
            })}

            <button
              type="button"
              className="bunkai-step-tab bunkai-step-tab--add"
              onClick={addEpisode}
              title="Добавить новый шаг"
            >
              <Plus size={15} />
              <span>Новый шаг</span>
            </button>
          </div>
        </div>

        {/* ПАНЕЛЬ ПЕРЕКЛЮЧЕНИЯ И УПРАВЛЕНИЯ ТЕКУЩИМ ШАГОМ */}
        <div className="bunkai-step-control-bar">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={prevStep}
            disabled={activeEpisodeIdx === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ChevronLeft size={16} /> Предыдущий шаг
          </button>

          <div className="bunkai-step-control-indicator">
            <div className="bunkai-step-control-heading">
              <span className="bunkai-step-num-pill">
                第 {activeEpisodeIdx + 1} 幕 · Шаг {activeEpisodeIdx + 1} из {episodes.length}
              </span>
              <span className={`maai-zone-pill ${currentMaai.className}`}>
                {currentMaai.name} ({currentEp.combatDistance.toFixed(2)}м)
              </span>
            </div>
            <div className="bunkai-step-control-sub">
              <strong>{currentEp.phase || 'Встречный сбив'}:</strong>{' '}
              <span style={{ color: '#60a5fa' }}>{currentEp.attackTechnique}</span> против{' '}
              <span style={{ color: '#f8fafc' }}>{currentEp.toriCounter}</span>
            </div>
          </div>

          <div className="bunkai-step-control-actions">
            <button
              type="button"
              className="btn"
              onClick={() => duplicateEpisode(activeEpisodeIdx)}
              title="Создать копию этого шага со всеми параметрами"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
            >
              <Copy size={13} /> Копировать
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => moveEpisode(activeEpisodeIdx, -1)}
              disabled={activeEpisodeIdx === 0}
              title="Переместить шаг влево (ранее по хронологии)"
              style={{ padding: '0.45rem 0.65rem' }}
            >
              <ArrowLeft size={13} />
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => moveEpisode(activeEpisodeIdx, 1)}
              disabled={activeEpisodeIdx === episodes.length - 1}
              title="Переместить шаг вправо (позже по хронологии)"
              style={{ padding: '0.45rem 0.65rem' }}
            >
              <ArrowRight size={13} />
            </button>

            {episodes.length > 1 && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => removeEpisode(activeEpisodeIdx)}
                title="Удалить текущий шаг"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
              >
                <Trash2 size={13} /> Удалить
              </button>
            )}

            <button
              type="button"
              className="btn"
              onClick={nextStep}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f8fafc', color: '#0f172a', border: '1px solid #ffffff', fontWeight: 700, borderRadius: 6, padding: '6px 14px' }}
            >
              {activeEpisodeIdx < episodes.length - 1 ? (
                <>Следующий шаг <ChevronRight size={16} /></>
              ) : (
                <>+ Добавить шаг <Plus size={16} /></>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ИНСПЕКТОР ВЫБРАННОГО ШАГА (3 КОЛОНКИ: АТАКА, МА-АЙ, КОНТРАТАКА) */}
      <section className="bunkai-inspector">
        <div className="bunkai-inspector__header">
          <div>
            <h3 style={{ margin: 0 }}>
              Параметры шага {activeEpisodeIdx + 1} из {episodes.length}
            </h3>
            <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Тонкая настройка анимаций, углов атаки, фазы взаимодействия и дистанции Ма-ай
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span className="badge">Фаза: {currentEp.phase || 'Встречный сбив'}</span>
            {episodes.length > 1 && (
              <button
                type="button"
                className="btn btn-danger"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
                onClick={() => removeEpisode(activeEpisodeIdx)}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Trash2 size={13} /> Удалить шаг</span>
              </button>
            )}
          </div>
        </div>

        <div className="bunkai-inspector__grid">
          {/* КОЛОНКА 1: АТАКА (ТОРИ - СИНЕЕ ДОГИ) */}
          <div className="bunkai-card-column">
            <h4 className="bunkai-card-column__title bunkai-card-column__title--attack" style={{ color: '#60a5fa' }}>
              <Zap size={14} color="#3b82f6" />
              <span>Атака (Тори — Синее доги / 攻撃)</span>
            </h4>

            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--washi-dim)' }}>Атакующий участник:</label>
              <select
                value={currentEp.attacker}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'attacker', e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              >
                <option value="1 (Тори — атакующий)">1 (Тори — нападающий / Синее доги)</option>
                {participantMode === '3-person' && (
                  <option value="Укэ 2 (фланговый)">Укэ 2 (фланговый нападающий)</option>
                )}
                {participantMode === '3-person' && (
                  <option value="Тори и Укэ 2">Одновременная атака (Тори + Укэ 2)</option>
                )}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.76rem', color: '#93c5fd', fontWeight: 600 }}>
                3D-анимация Тори (Синий):
              </label>
              <select
                value={currentEp.toriClip}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'toriClip', e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              >
                {currentEp.toriClip && !TORI_CLIPS.some((c) => c.id === currentEp.toriClip) && (
                  <option value={currentEp.toriClip}>{currentEp.toriClip}</option>
                )}
                {TORI_CLIPS.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.label}
                  </option>
                ))}
                {clipsList.length > 0 && (
                  <optgroup label="Все готовые клипы из библиотеки">
                    {clipsList
                      .map((c) => c.Clip_Name)
                      .filter((name, idx, arr) => name && arr.indexOf(name) === idx && !TORI_CLIPS.some((t) => t.id === name))
                      .map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Начальная и Конечная стойки Тори */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: '0.74rem', color: '#93c5fd' }}>Нач. стойка Тори:</label>
                <select
                  value={currentEp.toriStance || 'zenkutsu_dachi_right'}
                  onChange={(e) => updateEpisode(activeEpisodeIdx, 'toriStance', e.target.value)}
                  style={{ width: '100%', marginTop: 2, fontSize: '0.78rem', padding: '4px 6px' }}
                >
                  {STANCE_OPTIONS.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', color: '#93c5fd' }}>Кон. стойка Тори:</label>
                <select
                  value={currentEp.toriFinalStance || ''}
                  onChange={(e) => updateEpisode(activeEpisodeIdx, 'toriFinalStance', e.target.value)}
                  style={{ width: '100%', marginTop: 2, fontSize: '0.78rem', padding: '4px 6px' }}
                >
                  <option value="">Авто (по сценарию)</option>
                  {STANCE_OPTIONS.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            {/* Контекстные кнопки при ударе ногой Маэ-гэри Тори */}
            {(currentEp.toriClip || '').includes('mae_geri') && (
              <div style={{ padding: '6px 8px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 6, border: '1px solid #334155' }}>
                <div style={{ fontSize: '0.72rem', color: '#93c5fd', fontWeight: 600, marginBottom: 4 }}>
                  Постановка ноги Тори после Маэ-гэри:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button
                    type="button"
                    style={{
                      padding: '4px 6px',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: currentEp.toriLandingMode === 'back' ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)',
                      color: '#fff',
                      border: currentEp.toriLandingMode === 'back' ? '1px solid #60a5fa' : '1px solid #334155',
                    }}
                    onClick={() => {
                      updateEpisode(activeEpisodeIdx, 'toriLandingMode', 'back');
                      updateEpisode(activeEpisodeIdx, 'toriFinalStance', currentEp.toriStance || 'zenkutsu_dachi_right');
                    }}
                  >
                    🔙 Ногу назад
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '4px 6px',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: currentEp.toriLandingMode === 'forward' ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)',
                      color: '#fff',
                      border: currentEp.toriLandingMode === 'forward' ? '1px solid #60a5fa' : '1px solid #334155',
                    }}
                    onClick={() => {
                      updateEpisode(activeEpisodeIdx, 'toriLandingMode', 'forward');
                      updateEpisode(activeEpisodeIdx, 'toriFinalStance', (currentEp.toriStance || '').includes('left') ? 'zenkutsu_dachi_right' : 'zenkutsu_dachi_left');
                    }}
                  >
                    🔜 Ногу вперед
                  </button>
                </div>
              </div>
            )}

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: '0.76rem', margin: 0, color: 'var(--washi-dim)' }}>
                  Техника атаки Тори (Shotokan)
                </label>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => setPickerTarget({ index: activeEpisodeIdx, field: 'attack' })}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><BookOpen size={13} /> Справочник</span>
                </button>
              </div>
              <input
                value={currentEp.attackTechnique}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'attackTechnique', e.target.value)}
                placeholder="Прямой выпад Ой-цуки в голову (Дзёдан)"
              />
            </div>

            {/* Слайдер угла атаки Тори */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 4 }}>
                <span style={{ color: 'var(--washi-dim)' }}>Угол направления атаки:</span>
                <strong style={{ color: '#fff' }}>
                  {currentEp.attackAngleDeg > 0 ? `+${currentEp.attackAngleDeg}°` : `${currentEp.attackAngleDeg}°`}
                  {currentEp.attackAngleDeg === 0 ? ' (Прямо)' : currentEp.attackAngleDeg < 0 ? ' (Слева)' : ' (Справа)'}
                </strong>
              </div>
              <input
                type="range"
                min="-60"
                max="60"
                step="5"
                value={currentEp.attackAngleDeg}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  updateEpisode(activeEpisodeIdx, 'attackAngleDeg', val);
                  updateEpisode(activeEpisodeIdx, 'attackAngle', `${val}°`);
                }}
                style={{ width: '100%', accentColor: '#3b82f6' }}
              />
            </div>

            {/* Конечный угол поворота Тори (Целевой разворот / End Yaw) */}
            <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 6, border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 4 }}>
                <span style={{ color: '#93c5fd', fontWeight: 600 }}>Конечный поворот Тори (Целевой разворот):</span>
                <strong style={{ color: '#fff', fontFamily: 'monospace' }}>
                  {(currentEp.toriEndAngleDeg !== undefined ? currentEp.toriEndAngleDeg : 0) > 0
                    ? `+${currentEp.toriEndAngleDeg !== undefined ? currentEp.toriEndAngleDeg : 0}`
                    : (currentEp.toriEndAngleDeg !== undefined ? currentEp.toriEndAngleDeg : 0)}°
                </strong>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={currentEp.toriEndAngleDeg !== undefined ? currentEp.toriEndAngleDeg : 0}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'toriEndAngleDeg', parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {[0, 45, 90, 180, -90, -45].map((ang) => (
                  <button
                    key={ang}
                    type="button"
                    onClick={() => updateEpisode(activeEpisodeIdx, 'toriEndAngleDeg', ang)}
                    style={{
                      flex: 1,
                      padding: '2px 4px',
                      fontSize: '0.67rem',
                      fontWeight: 600,
                      borderRadius: 4,
                      background: (currentEp.toriEndAngleDeg !== undefined ? currentEp.toriEndAngleDeg : 0) === ang ? '#3b82f6' : '#1e293b',
                      color: (currentEp.toriEndAngleDeg !== undefined ? currentEp.toriEndAngleDeg : 0) === ang ? '#fff' : '#cbd5e1',
                      border: '1px solid #334155',
                      cursor: 'pointer',
                    }}
                  >
                    {ang}°
                  </button>
                ))}
              </div>
            </div>

            {/* Конечное положение Тори (X, Z в метрах) */}
            <div style={{ padding: '8px 10px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 6, border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', marginBottom: 6 }}>
                <span style={{ color: '#93c5fd', fontWeight: 600 }}>Конечное положение Тори (X / Z, м):</span>
                {(currentEp.customToriPosX !== undefined || currentEp.customToriPosZ !== undefined) && (
                  <button
                    type="button"
                    onClick={() => {
                      updateEpisode(activeEpisodeIdx, 'customToriPosX', undefined);
                      updateEpisode(activeEpisodeIdx, 'customToriPosZ', undefined);
                    }}
                    style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: '#1e293b', color: '#93c5fd', border: '1px solid #334155', cursor: 'pointer' }}
                  >
                    Авто
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--washi-dim)' }}>X (влево-/вправо+)</label>
                  <input
                    type="number"
                    step="0.05"
                    placeholder={String(currentEp.toriTrajectory?.end?.[0] ?? 0)}
                    value={currentEp.customToriPosX !== undefined && currentEp.customToriPosX !== null ? currentEp.customToriPosX : ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateEpisode(activeEpisodeIdx, 'customToriPosX', raw === '' || Number.isNaN(Number(raw)) ? undefined : Number(raw));
                    }}
                    style={{ width: '100%', marginTop: 2, padding: '4px 6px', fontSize: '0.78rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--washi-dim)' }}>Z (назад-/вперёд+)</label>
                  <input
                    type="number"
                    step="0.05"
                    placeholder={String(currentEp.toriTrajectory?.end?.[2] ?? 0)}
                    value={currentEp.customToriPosZ !== undefined && currentEp.customToriPosZ !== null ? currentEp.customToriPosZ : ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateEpisode(activeEpisodeIdx, 'customToriPosZ', raw === '' || Number.isNaN(Number(raw)) ? undefined : Number(raw));
                    }}
                    style={{ width: '100%', marginTop: 2, padding: '4px 6px', fontSize: '0.78rem' }}
                  />
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--washi-dim)' }}>
                Траектория выпада Тори:
              </label>
              <input
                value={currentEp.toriMovement}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'toriMovement', e.target.value)}
                placeholder="Прямой выпад вперед по оси Z"
                style={{ marginTop: 4 }}
              />
            </div>
          </div>

          {/* КОЛОНКА 2: ДИСТАНЦИЯ МА-АЙ (間合い) */}
          <div className="bunkai-card-column">
            <h4 className="bunkai-card-column__title bunkai-card-column__title--maai">
              <Ruler size={14} color="var(--gold)" />
              <span>Дистанция контакта (Ма-ай / 間合い)</span>
            </h4>

            <div className="maai-scale">
              <div className="maai-meter">
                <span style={{ fontSize: '0.8rem', color: 'var(--washi-dim)' }}>Расстояние контакта:</span>
                <span className="maai-meter__val">{currentEp.combatDistance.toFixed(2)} м</span>
              </div>

              <div className={`maai-zone-badge ${currentMaai.className}`}>
                {currentMaai.name}
              </div>

              <input
                type="range"
                min="0.35"
                max="2.50"
                step="0.01"
                value={currentEp.combatDistance}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'combatDistance', parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--gold-bright)' }}
              />

              <div className="maai-zones-legend">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#fca5a5', fontWeight: 600 }}>0.8 - 1.1 м:</span>
                  <span>Чика-ма (ближний бой, заломы)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--gold-bright)', fontWeight: 600 }}>1.1 - 1.8 м:</span>
                  <span>Иссоку-итто (шаг и удар)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>1.8 - 2.5 м:</span>
                  <span>То-ма (дальняя дистанция)</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', color: 'var(--washi-dim)' }}>Фаза взаимодействия:</label>
                <select
                  value={currentEp.phase || 'Встречный сбив (Укэ)'}
                  onChange={(e) => updateEpisode(activeEpisodeIdx, 'phase', e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  {PHASES.map((ph) => (
                    <option key={ph} value={ph}>
                      {ph}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* КОЛОНКА 3: ЗАЩИТА И КОНТРАТАКА (УКЭ 1 - БЕЛОЕ ДОГИ) */}
          <div className="bunkai-card-column">
            <h4 className="bunkai-card-column__title bunkai-card-column__title--counter" style={{ color: '#f8fafc' }}>
              <Shield size={14} color="#f8fafc" />
              <span>Защита и контратака (Укэ 1 — Белое доги / 防御・反撃)</span>
            </h4>

            <div>
              <label style={{ fontSize: '0.76rem', color: '#f8fafc', fontWeight: 600 }}>
                3D-анимация Укэ 1 (Белый):
              </label>
              <select
                value={currentEp.ukeClip}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'ukeClip', e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              >
                {currentEp.ukeClip && !UKE_CLIPS.some((c) => c.id === currentEp.ukeClip) && (
                  <option value={currentEp.ukeClip}>{currentEp.ukeClip}</option>
                )}
                {UKE_CLIPS.map((uc) => (
                  <option key={uc.id} value={uc.id}>
                    {uc.label}
                  </option>
                ))}
                {clipsList.length > 0 && (
                  <optgroup label="Все готовые клипы из библиотеки">
                    {clipsList
                      .map((c) => c.Clip_Name)
                      .filter((name, idx, arr) => name && arr.indexOf(name) === idx && !UKE_CLIPS.some((u) => u.id === name))
                      .map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Начальная и Конечная стойки Укэ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: '0.74rem', color: '#f8fafc' }}>Нач. стойка Укэ:</label>
                <select
                  value={currentEp.ukeStance || 'zenkutsu_dachi_left'}
                  onChange={(e) => updateEpisode(activeEpisodeIdx, 'ukeStance', e.target.value)}
                  style={{ width: '100%', marginTop: 2, fontSize: '0.78rem', padding: '4px 6px' }}
                >
                  {STANCE_OPTIONS.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', color: '#f8fafc' }}>Кон. стойка Укэ:</label>
                <select
                  value={currentEp.ukeFinalStance || ''}
                  onChange={(e) => updateEpisode(activeEpisodeIdx, 'ukeFinalStance', e.target.value)}
                  style={{ width: '100%', marginTop: 2, fontSize: '0.78rem', padding: '4px 6px' }}
                >
                  <option value="">Авто (по сценарию)</option>
                  {STANCE_OPTIONS.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            {/* Контекстные кнопки при ударе ногой Маэ-гэри Укэ */}
            {(currentEp.ukeClip || '').includes('mae_geri') && (
              <div style={{ padding: '6px 8px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 6, border: '1px solid #334155' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                  Постановка ноги Укэ после Маэ-гэри:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button
                    type="button"
                    style={{
                      padding: '4px 6px',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: currentEp.ukeLandingMode === 'back' ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)',
                      color: currentEp.ukeLandingMode === 'back' ? '#0f172a' : '#fff',
                      border: currentEp.ukeLandingMode === 'back' ? '1px solid #ffffff' : '1px solid #334155',
                    }}
                    onClick={() => {
                      updateEpisode(activeEpisodeIdx, 'ukeLandingMode', 'back');
                      updateEpisode(activeEpisodeIdx, 'ukeFinalStance', currentEp.ukeStance || 'zenkutsu_dachi_left');
                    }}
                  >
                    🔙 Ногу назад
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '4px 6px',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: currentEp.ukeLandingMode === 'forward' ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)',
                      color: currentEp.ukeLandingMode === 'forward' ? '#0f172a' : '#fff',
                      border: currentEp.ukeLandingMode === 'forward' ? '1px solid #ffffff' : '1px solid #334155',
                    }}
                    onClick={() => {
                      updateEpisode(activeEpisodeIdx, 'ukeLandingMode', 'forward');
                      updateEpisode(activeEpisodeIdx, 'ukeFinalStance', (currentEp.ukeStance || '').includes('left') ? 'zenkutsu_dachi_right' : 'zenkutsu_dachi_left');
                    }}
                  >
                    🔜 Ногу вперед
                  </button>
                </div>
              </div>
            )}

            {participantMode === '3-person' && (
              <div>
                <label style={{ fontSize: '0.76rem', color: '#fca5a5', fontWeight: 600 }}>
                  3D-анимация Укэ 2 (Фланг):
                </label>
                <select
                  value={currentEp.uke2Clip}
                  onChange={(e) => updateEpisode(activeEpisodeIdx, 'uke2Clip', e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  {UKE_CLIPS.map((uc) => (
                    <option key={uc.id} value={uc.id}>
                      {uc.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Конечный угол поворота Укэ (Целевой разворот / End Yaw) */}
            <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 6, border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 4 }}>
                <span style={{ color: '#f8fafc', fontWeight: 600 }}>Конечный поворот Укэ (Целевой разворот):</span>
                <strong style={{ color: '#fff', fontFamily: 'monospace' }}>
                  {(currentEp.ukeEndAngleDeg !== undefined ? currentEp.ukeEndAngleDeg : 180) > 0
                    ? `+${currentEp.ukeEndAngleDeg !== undefined ? currentEp.ukeEndAngleDeg : 180}`
                    : (currentEp.ukeEndAngleDeg !== undefined ? currentEp.ukeEndAngleDeg : 180)}°
                </strong>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={currentEp.ukeEndAngleDeg !== undefined ? currentEp.ukeEndAngleDeg : 180}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'ukeEndAngleDeg', parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#f8fafc', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {[180, 0, 90, -90, 45, -45].map((ang) => (
                  <button
                    key={ang}
                    type="button"
                    onClick={() => updateEpisode(activeEpisodeIdx, 'ukeEndAngleDeg', ang)}
                    style={{
                      flex: 1,
                      padding: '2px 4px',
                      fontSize: '0.67rem',
                      fontWeight: 600,
                      borderRadius: 4,
                      background: (currentEp.ukeEndAngleDeg !== undefined ? currentEp.ukeEndAngleDeg : 180) === ang ? '#f8fafc' : '#1e293b',
                      color: (currentEp.ukeEndAngleDeg !== undefined ? currentEp.ukeEndAngleDeg : 180) === ang ? '#0f172a' : '#cbd5e1',
                      border: '1px solid #334155',
                      cursor: 'pointer',
                    }}
                  >
                    {ang}°
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 6 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--washi-dim)' }}>
                  Уход / Тай-сабаки: <strong>{currentEp.ukeEvasionAngleDeg || 0}°</strong>
                </span>
                <button
                  type="button"
                  onClick={() => updateEpisode(activeEpisodeIdx, 'orientationModeUke', 'mode2_look_at')}
                  style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: 4, background: '#1e293b', color: '#e2e8f0', border: '1px solid #475569', cursor: 'pointer' }}
                >
                  Авто на Тори
                </button>
              </div>
              <input
                type="range"
                min="-90"
                max="90"
                step="5"
                value={currentEp.ukeEvasionAngleDeg || 0}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'ukeEvasionAngleDeg', parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#f8fafc', marginTop: 2 }}
              />
            </div>

            {/* Конечное положение Укэ (X, Z в метрах) */}
            <div style={{ padding: '8px 10px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 6, border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', marginBottom: 6 }}>
                <span style={{ color: '#f8fafc', fontWeight: 600 }}>Конечное положение Укэ (X / Z, м):</span>
                {(currentEp.customUkePosX !== undefined || currentEp.customUkePosZ !== undefined) && (
                  <button
                    type="button"
                    onClick={() => {
                      updateEpisode(activeEpisodeIdx, 'customUkePosX', undefined);
                      updateEpisode(activeEpisodeIdx, 'customUkePosZ', undefined);
                    }}
                    style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', cursor: 'pointer' }}
                  >
                    Авто
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--washi-dim)' }}>X (влево-/вправо+)</label>
                  <input
                    type="number"
                    step="0.05"
                    placeholder={String(currentEp.ukeTrajectory?.end?.[0] ?? 0)}
                    value={currentEp.customUkePosX !== undefined && currentEp.customUkePosX !== null ? currentEp.customUkePosX : ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateEpisode(activeEpisodeIdx, 'customUkePosX', raw === '' || Number.isNaN(Number(raw)) ? undefined : Number(raw));
                    }}
                    style={{ width: '100%', marginTop: 2, padding: '4px 6px', fontSize: '0.78rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--washi-dim)' }}>Z (назад-/вперёд+)</label>
                  <input
                    type="number"
                    step="0.05"
                    placeholder={String(currentEp.ukeTrajectory?.end?.[2] ?? currentEp.combatDistance ?? 1.45)}
                    value={currentEp.customUkePosZ !== undefined && currentEp.customUkePosZ !== null ? currentEp.customUkePosZ : ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateEpisode(activeEpisodeIdx, 'customUkePosZ', raw === '' || Number.isNaN(Number(raw)) ? undefined : Number(raw));
                    }}
                    style={{ width: '100%', marginTop: 2, padding: '4px 6px', fontSize: '0.78rem' }}
                  />
                </div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: '0.76rem', margin: 0, color: 'var(--washi-dim)' }}>
                  Защитное действие и контрудар (Укэ)
                </label>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => setPickerTarget({ index: activeEpisodeIdx, field: 'counter' })}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><BookOpen size={13} /> Справочник</span>
                </button>
              </div>
              <input
                value={currentEp.toriCounter}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'toriCounter', e.target.value)}
                placeholder="Смещение с линии атаки (Тай-сабаки) + блок Агэ-укэ"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--washi-dim)' }}>
                Биомеханический итог (Кудзуси / Сваливание):
              </label>
              <input
                value={currentEp.outcome}
                onChange={(e) => updateEpisode(activeEpisodeIdx, 'outcome', e.target.value)}
                placeholder="Выведение из равновесия и нейтрализация противника"
                style={{ marginTop: 4 }}
              />
            </div>
          </div>
        </div>

        {/* НИЖНИЙ НАВИГАТОР ПО ШАГАМ ВНУТРИ ИНСПЕКТОРА */}
        <div className="bunkai-step-inspector-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={prevStep}
            disabled={activeEpisodeIdx === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ChevronLeft size={16} /> Предыдущий шаг ({activeEpisodeIdx > 0 ? activeEpisodeIdx : 1})
          </button>

          <span style={{ fontSize: '0.86rem', color: 'var(--washi-dim)' }}>
            Шаг <strong style={{ color: '#fff' }}>{activeEpisodeIdx + 1}</strong> из <strong style={{ color: '#fff' }}>{episodes.length}</strong>
          </span>

          <button
            type="button"
            className="btn"
            onClick={nextStep}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f8fafc', color: '#0f172a', border: '1px solid #ffffff', fontWeight: 700, borderRadius: 6, padding: '6px 14px' }}
          >
            {activeEpisodeIdx < episodes.length - 1 ? (
              <>Следующий шаг ({activeEpisodeIdx + 2}) <ChevronRight size={16} /></>
            ) : (
              <>+ Добавить шаг ({activeEpisodeIdx + 2}) <Plus size={16} /></>
            )}
          </button>
        </div>
      </section>

      {/* НИЖНЯЯ ПАНЕЛЬ ДЕЙСТВИЙ */}
      <footer className="bunkai-studio__actions">
        <div>
          {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
          {!error && (
            <p style={{ margin: 0, color: 'var(--washi-dim)', fontSize: '0.88rem' }}>
              Всего настроено эпизодов: <strong>{episodes.length}</strong> · Активный: <strong>Эпизод {activeEpisodeIdx + 1}</strong>
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => navigate(-1)} disabled={saving}>
            Отмена
          </button>
          <button
            type="button"
            className="btn"
            onClick={onSubmit}
            disabled={saving}
            style={{
              maxWidth: '100%',
              whiteSpace: 'normal',
              textAlign: 'center',
              background: '#10b981',
              color: '#ffffff',
              border: '1px solid #059669',
              fontWeight: 700,
              padding: '10px 24px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Save size={16} color="#ffffff" />
            {saving ? 'Сохранение в базе данных…' : isEdit ? 'Обновить бункай' : 'Опубликовать бункай Шотокан'}
          </button>
        </div>
      </footer>

      {/* Модальное окно напоминания о сохранении перед завершением работы */}
      {showExitModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#181822',
              border: '1px solid #334155',
              borderRadius: 12,
              padding: '24px',
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Save size={20} color="#34d399" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700 }}>
                  Напоминание о сохранении
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Мастерская разбора боевого применения (Бункай)
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              Вы внесли изменения в траектории, конечные углы поворота моделей или параметры взаимодействия. Хотите сохранить их перед выходом?
            </p>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  background: '#1e293b',
                  color: '#cbd5e1',
                  border: '1px solid #334155',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Продолжить работу
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDirty(false);
                  setShowExitModal(false);
                  navigate(-1);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#fca5a5',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Выйти без сохранения
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowExitModal(false);
                  await onSubmit();
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  background: '#10b981',
                  color: '#ffffff',
                  border: '1px solid #059669',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Save size={14} color="#ffffff" /> Сохранить и выйти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно справочника приемов Shotokan */}
      {pickerTarget !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => setPickerTarget(null)}
        >
          <div style={{ width: '100%', maxWidth: 880 }} onClick={(e) => e.stopPropagation()}>
            <TechniquePicker
              onSelect={handleTechniquePicked}
              onCancel={() => setPickerTarget(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
