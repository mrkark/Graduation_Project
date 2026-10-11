import React from 'react';
import KaratekaLowpolyModel from './KaratekaLowpolyModel';

export const STYLES = {
  tori: {
    giColor: '#faf9f6',
    beltColor: '#141414',
    skinColor: '#ffffff',
  },
  uke: {
    giColor: '#243346',
    beltColor: '#181818',
    skinColor: '#ffffff',
  },
  uke2: {
    giColor: '#342b2b',
    beltColor: '#3a1212',
    skinColor: '#ffffff',
  },
};

/**
 * Определение наиболее подходящей канонической техники / стойки Шотокан по переданным параметрам
 */
function resolveStance(stance, angles) {
  if (stance) return stance;
  if (!angles) return 'ready';

  if (angles.stance) return angles.stance;

  // Если передан открытый блок ладонью или глубокий перенос веса назад
  if (angles.leftHandOpen || angles.rightHandOpen) return 'kokutsu';

  // Если колени разведены в стороны
  if (angles.leftHipZ && angles.leftHipZ > 0.4) return 'kiba';

  // Если правая нога сильно поджата
  if (angles.rightKneeX && angles.rightKneeX > 1.8) return 'gankaku';

  // Если локоть наносит удар
  if (angles.rightElbowX && angles.rightElbowX > 2.0) return 'empi_uchi';

  // Если правая рука делает прямой контрудар
  if (angles.rightShoulderX && angles.rightShoulderX < -1.0) return 'gyaku_zuki';

  // Если левая рука поднята высоко над лбом (верхний блок)
  if (angles.leftShoulderX && angles.leftShoulderX < -1.0) return 'age_uke';

  // Если левая рука выполняет блок ребром ладони (шуто-укэ)
  if (angles.leftShoulderZ && angles.leftShoulderZ > 0.35) return 'shuto_uke';

  // Если левая рука делает смет вниз
  if (angles.leftShoulderX && angles.leftShoulderX > -0.65 && angles.leftShoulderZ > 0.25) return 'gedan_barai';

  // Если переднее бедро вынесено вперед в длинную боевую стойку
  if (angles.leftHipX && angles.leftHipX > 0.25) return 'zenkutsu';

  // Если таз на обычной высоте ожидания
  if (angles.hipsY && angles.hipsY > 0.90) return 'ready';

  return 'ready';
}

/**
 * KarateMasterModel — Аутентичный мастер каратэ Шотокан
 * Высокодетализированная rigged PBR-модель из Blender (karateka_lowpoly.blend / glb):
 * - Анатомический скелет из 64 костей
 * - Высококачественные текстуры кожи лица и тела (diffuse, normal, roughness)
 * - Плотное хлопковое кимоно (Белое для Тори, Индиго для Укэ) с фактурой плетения
 * - Черный пояс Kuro-Obi (5-й Дан)
 * - Полная поддержка 34 канонических техник и стоек Шотокан
 */
export default function KarateMasterModel({
  role = 'tori',
  stance = null,
  angles = null,
  activeClip = null,
  speed = 1.0,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  kataMode = false,
  kataClipName = 'heian_shodan',
  kataTimeRange = null,
  kataScrubProgress = null,
  isPlaying = true,
  replayTrigger = 0,
  onStepEnd = null,
  onTimeUpdate = null,
  onRootMove = null,
}) {
  const finalStance = resolveStance(stance, angles);

  return (
    <KaratekaLowpolyModel
      role={role}
      stance={finalStance}
      angles={angles}
      activeClip={activeClip}
      speed={speed}
      position={position}
      rotation={rotation}
      kataMode={kataMode}
      kataClipName={kataClipName}
      kataTimeRange={kataTimeRange}
      kataScrubProgress={kataScrubProgress}
      isPlaying={isPlaying}
      replayTrigger={replayTrigger}
      onStepEnd={onStepEnd}
      onTimeUpdate={onTimeUpdate}
      onRootMove={onRootMove}
    />
  );
}

