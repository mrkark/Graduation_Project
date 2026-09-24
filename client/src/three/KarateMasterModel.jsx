import React from 'react';
import RealisticSenseiModel from './RealisticSenseiModel';

export const STYLES = {
  tori: {
    giColor: '#fdfbf7',
    beltColor: '#121212',
    skinColor: '#d69e72',
  },
  uke: {
    giColor: '#2b333e',
    beltColor: '#8b2500',
    skinColor: '#cb966c',
  },
  uke2: {
    giColor: '#3d2626',
    beltColor: '#4a1212',
    skinColor: '#cb966c',
  },
};

/**
 * Определение наиболее подходящей канонической стойки Шотокан по переданным параметрам
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

  // Если таз на обычной высоте ожидания
  if (angles.hipsY && angles.hipsY > 0.90) return 'ready';

  // Если левая рука делает смет вниз
  if (angles.leftShoulderX && angles.leftShoulderX > -0.65 && angles.leftShoulderZ > 0.3) return 'gedan_barai';

  // Если левая рука поднята высоко над лбом
  if (angles.leftShoulderX && angles.leftShoulderX < -1.6) return 'age_uke';

  return 'ready';
}

/**
 * KarateMasterModel — Реалистичный человек-мастер каратэ в белом кимоно (доги)
 * с анатомическим управлением суставами и правильной посадкой подошв на татами
 */
export default function KarateMasterModel({
  role = 'tori',
  stance = 'ready',
  angles = null,
  activeClip = null,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) {
  const finalStance = resolveStance(stance, angles);
  const normalizedRole = role === 'uke2' ? 'uke' : role;

  return (
    <RealisticSenseiModel
      role={normalizedRole}
      stance={finalStance}
      activeClip={activeClip}
      position={position}
      rotation={rotation}
    />
  );
}
