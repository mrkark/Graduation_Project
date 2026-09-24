import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Реалистичный 3D-аватар каратиста на базе фотореалистичной скелетной модели Ready Player Me (.glb)
 * Полная анатомия человека:
 * - 5 пальцев на каждой руке (Thumb, Index, Middle, Ring, Pinky с 4 фалангами каждый)
 * - 67 костей скелета Mixamo/Humanoid
 * - Белое каратэ-доги (кимоно) и брюки дзубон
 * - Чёрный пояс (Оби) с узлом и золотыми полосами дана
 * - Скелетная интерполяция канонических стоек Шотокан
 */

// Канонические углы костей для скелета Mixamo / Ready Player Me
export const REALISTIC_STANCES = {
  ready: {
    name: 'Хэйко-дати (Готовность)',
    desc: 'Естественная позиция ожидания. Стопы на ширине плеч, руки опущены в готовности, концентрация (дзансин).',
    bones: {
      Hips: { pos: [0, 0.98, 0], rot: [0, 0, 0] },
      Spine: { rot: [0.03, 0, 0] },
      Spine1: { rot: [0.02, 0, 0] },
      Spine2: { rot: [0.02, 0, 0] },
      Neck: { rot: [0.02, 0, 0] },
      Head: { rot: [0, 0, 0] },
      LeftShoulder: { rot: [0.05, 0, 0.05] },
      RightShoulder: { rot: [0.05, 0, -0.05] },
      LeftArm: { rot: [0.15, 0.1, 1.25] },
      RightArm: { rot: [0.15, -0.1, -1.25] },
      LeftForeArm: { rot: [0.25, 0.2, 0.35] },
      RightForeArm: { rot: [0.25, -0.2, -0.35] },
      LeftHand: { rot: [0.1, 0, 0.15] },
      RightHand: { rot: [0.1, 0, -0.15] },
      LeftUpLeg: { rot: [0.05, 0, 0.08] },
      RightUpLeg: { rot: [0.05, 0, -0.08] },
      LeftLeg: { rot: [-0.08, 0, 0] },
      RightLeg: { rot: [-0.08, 0, 0] },
      LeftFoot: { rot: [0.03, 0, 0] },
      RightFoot: { rot: [0.03, 0, 0] },
    },
    fist: true,
  },
  zenkutsu: {
    name: 'Дзэнкуцу-дати + Ой-цуки (Прямой удар)',
    desc: 'Низкая наступательная стойка: левая нога согнута впереди, правая прямая сзади. Правый кулак наносит пробивающий удар.',
    bones: {
      Hips: { pos: [0, 0.82, 0], rot: [0.04, -0.12, 0] },
      Spine: { rot: [0.06, 0.08, 0] },
      Spine1: { rot: [0.05, 0.06, 0] },
      Spine2: { rot: [0.04, 0.04, 0] },
      Neck: { rot: [-0.04, 0.05, 0] },
      Head: { rot: [-0.02, 0.04, 0] },
      // Левая рука в хикитэ (у бедра)
      LeftShoulder: { rot: [-0.1, 0, 0.1] },
      LeftArm: { rot: [0.65, 0.3, 1.3] },
      LeftForeArm: { rot: [0.3, 0.8, 1.4] },
      LeftHand: { rot: [-0.2, 0.1, 0.3] },
      // Правая рука — мощный прямой удар вперёд
      RightShoulder: { rot: [0.15, 0, -0.1] },
      RightArm: { rot: [-1.45, -0.2, -0.3] },
      RightForeArm: { rot: [0.05, -0.1, -0.1] },
      RightHand: { rot: [0, 0.1, -0.1] },
      // Ноги: выпад вперёд
      LeftUpLeg: { rot: [-0.75, 0.1, 0.15] },
      LeftLeg: { rot: [1.15, 0, 0] },
      LeftFoot: { rot: [-0.4, 0, 0] },
      RightUpLeg: { rot: [0.45, -0.1, -0.2] },
      RightLeg: { rot: [-0.15, 0, 0] },
      RightFoot: { rot: [0.25, 0, 0] },
    },
    fist: true,
  },
  gedan_barai: {
    name: 'Дзэнкуцу-дати + Гэдан-барай (Нижний блок)',
    desc: 'Каноническое движение Хэйан Шодан: левое предплечье сметает нижнюю атаку, правый кулак у бедра.',
    bones: {
      Hips: { pos: [0, 0.83, 0], rot: [0.04, 0.15, 0] },
      Spine: { rot: [0.05, -0.06, 0] },
      Spine1: { rot: [0.04, -0.05, 0] },
      Spine2: { rot: [0.03, -0.04, 0] },
      Neck: { rot: [-0.02, -0.05, 0] },
      Head: { rot: [0, -0.04, 0] },
      // Левая рука — нижний смет
      LeftShoulder: { rot: [0.05, 0, 0.1] },
      LeftArm: { rot: [0.45, 0.3, 0.65] },
      LeftForeArm: { rot: [0.2, 0.2, 0.45] },
      LeftHand: { rot: [0.1, 0.2, 0.2] },
      // Правая рука — хикитэ
      RightShoulder: { rot: [-0.1, 0, -0.1] },
      RightArm: { rot: [0.7, -0.3, -1.35] },
      RightForeArm: { rot: [0.35, -0.75, -1.35] },
      RightHand: { rot: [-0.2, -0.1, -0.3] },
      // Ноги
      LeftUpLeg: { rot: [-0.72, 0.12, 0.14] },
      LeftLeg: { rot: [1.12, 0, 0] },
      LeftFoot: { rot: [-0.38, 0, 0] },
      RightUpLeg: { rot: [0.42, -0.12, -0.18] },
      RightLeg: { rot: [-0.12, 0, 0] },
      RightFoot: { rot: [0.22, 0, 0] },
    },
    fist: true,
  },
  kokutsu: {
    name: 'Кокуцу-дати + Сюто-укэ (Блок ладонью)',
    desc: 'Защитная стойка мастера: 70% веса на согнутой задней ноге. Передняя рука блокирует ребром ладони (сюто).',
    bones: {
      Hips: { pos: [0, 0.84, 0], rot: [0.03, 0.28, 0] },
      Spine: { rot: [0.02, -0.15, 0] },
      Spine1: { rot: [0.02, -0.12, 0] },
      Spine2: { rot: [0.02, -0.1, 0] },
      Neck: { rot: [0, -0.12, 0] },
      Head: { rot: [0, -0.08, 0] },
      // Левая рука — открытая ладонь сюто-укэ
      LeftShoulder: { rot: [0.1, 0, 0.15] },
      LeftArm: { rot: [-0.85, 0.35, 0.75] },
      LeftForeArm: { rot: [0.65, 0.2, 0.55] },
      LeftHand: { rot: [0.2, -0.35, -0.2] },
      // Правая рука — ладонь у солнечного сплетения
      RightShoulder: { rot: [-0.05, 0, -0.1] },
      RightArm: { rot: [-0.45, -0.2, -0.9] },
      RightForeArm: { rot: [1.1, -0.4, -0.9] },
      RightHand: { rot: [0.25, 0.2, 0.15] },
      // Ноги: кокуцу-дати
      LeftUpLeg: { rot: [-0.35, 0.15, 0.1] },
      LeftLeg: { rot: [0.45, 0, 0] },
      LeftFoot: { rot: [-0.1, 0, 0] },
      RightUpLeg: { rot: [0.25, -0.25, -0.3] },
      RightLeg: { rot: [1.25, 0, 0] },
      RightFoot: { rot: [-0.3, 0, 0] },
    },
    fist: false, // Открытые ладони сюто!
  },
  kiba: {
    name: 'Киба-дати + Каги-цуки (Стойка всадника)',
    desc: 'Стойка всадника из ката Тэкки: колени разведены в стороны, мощный низкий центр тяжести с боковым крюком.',
    bones: {
      Hips: { pos: [0, 0.81, 0], rot: [0.05, 0, 0] },
      Spine: { rot: [0.02, 0, 0] },
      Spine1: { rot: [0.02, 0, 0] },
      Spine2: { rot: [0.02, 0, 0] },
      Neck: { rot: [0, -0.25, 0] },
      Head: { rot: [0, -0.25, 0] },
      // Левая рука — горизонтальный крюк перед грудью
      LeftShoulder: { rot: [0.1, 0, 0.15] },
      LeftArm: { rot: [-0.85, 0.45, 0.5] },
      LeftForeArm: { rot: [1.35, 0.2, 0.8] },
      LeftHand: { rot: [0, 0.2, 0] },
      // Правая рука — хикитэ
      RightShoulder: { rot: [-0.05, 0, -0.1] },
      RightArm: { rot: [0.65, -0.2, -1.3] },
      RightForeArm: { rot: [0.35, -0.7, -1.3] },
      RightHand: { rot: [-0.15, -0.1, -0.2] },
      // Ноги: широкая стойка всадника
      LeftUpLeg: { rot: [-0.15, 0.15, 0.75] },
      LeftLeg: { rot: [1.15, 0, 0] },
      LeftFoot: { rot: [-0.4, 0, 0] },
      RightUpLeg: { rot: [-0.15, -0.15, -0.75] },
      RightLeg: { rot: [1.15, 0, 0] },
      RightFoot: { rot: [-0.4, 0, 0] },
    },
    fist: true,
  },
  fudo: {
    name: 'Фудо-дати (Стойка Сочин — Непоколебимость)',
    desc: 'Монолитная боевая стойка мастера каратэ Сочин: укорененный центр тяжести, вертикальный защитный кулак мусо-камаэ.',
    bones: {
      Hips: { pos: [0, 0.82, 0], rot: [0.04, 0.12, 0] },
      Spine: { rot: [0.03, -0.05, 0] },
      Spine1: { rot: [0.03, -0.04, 0] },
      Spine2: { rot: [0.02, -0.03, 0] },
      Neck: { rot: [0, -0.08, 0] },
      Head: { rot: [0, -0.06, 0] },
      // Левая рука — вертикальный татэ-сюто / мусо-камаэ
      LeftShoulder: { rot: [0.15, 0, 0.15] },
      LeftArm: { rot: [-1.15, 0.3, 0.45] },
      LeftForeArm: { rot: [0.85, 0.3, 0.6] },
      LeftHand: { rot: [0.2, -0.2, 0] },
      // Правая рука — зафиксированный кулак у ребер
      RightShoulder: { rot: [-0.05, 0, -0.1] },
      RightArm: { rot: [0.45, -0.2, -1.2] },
      RightForeArm: { rot: [0.55, -0.6, -1.1] },
      RightHand: { rot: [-0.1, -0.1, -0.15] },
      // Ноги: фудо-дати
      LeftUpLeg: { rot: [-0.62, 0.2, 0.35] },
      LeftLeg: { rot: [1.05, 0, 0] },
      LeftFoot: { rot: [-0.35, 0, 0] },
      RightUpLeg: { rot: [0.25, -0.22, -0.45] },
      RightLeg: { rot: [0.95, 0, 0] },
      RightFoot: { rot: [-0.25, 0, 0] },
    },
    fist: true,
  },
  gankaku: {
    name: 'Цуру-аси-дати (Журавль на скале — Ганкаку)',
    desc: 'Балансирующая стойка на одной ноге. Правая нога поджата к колену, готовность нанести взрывной удар ногой и бэкфист.',
    bones: {
      Hips: { pos: [0, 0.95, 0], rot: [0.02, -0.1, 0] },
      Spine: { rot: [0.04, 0.05, 0] },
      Spine1: { rot: [0.03, 0.04, 0] },
      Spine2: { rot: [0.02, 0.03, 0] },
      Neck: { rot: [-0.02, 0.05, 0] },
      Head: { rot: [0, 0.04, 0] },
      // Руки в камаэ Ганкаку
      LeftShoulder: { rot: [0.08, 0, 0.12] },
      LeftArm: { rot: [-0.75, 0.2, 0.75] },
      LeftForeArm: { rot: [0.95, 0.2, 0.6] },
      LeftHand: { rot: [0.15, 0, 0.1] },
      RightShoulder: { rot: [0.05, 0, -0.1] },
      RightArm: { rot: [-0.55, -0.2, -0.85] },
      RightForeArm: { rot: [1.1, -0.3, -0.8] },
      RightHand: { rot: [0.1, 0, -0.1] },
      // Левая нога — опорный столб, правая — поджата в стойку журавля!
      LeftUpLeg: { rot: [0.05, 0, 0.04] },
      LeftLeg: { rot: [0.02, 0, 0] },
      LeftFoot: { rot: [0.02, 0, 0] },
      RightUpLeg: { rot: [-1.25, -0.25, -0.45] },
      RightLeg: { rot: [2.1, 0, 0] },
      RightFoot: { rot: [-0.65, 0, 0] },
    },
    fist: true,
  },
};

// 3D Модель пояса Оби мастера каратэ
function KarateObiBelt() {
  return (
    <group position={[0, 0.04, 0]}>
      {/* Полоса пояса вокруг талии */}
      <mesh castShadow>
        <cylinderGeometry args={[0.22, 0.225, 0.09, 24]} />
        <meshStandardMaterial color="#111111" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Узел пояса спереди */}
      <mesh position={[0, 0, 0.21]} rotation={[0, 0, 0.2]} castShadow>
        <boxGeometry args={[0.09, 0.07, 0.05]} />
        <meshStandardMaterial color="#111111" roughness={0.4} />
      </mesh>
      {/* Левый свисающий конец */}
      <group position={[-0.03, -0.14, 0.215]} rotation={[0.15, 0, -0.08]}>
        <mesh castShadow>
          <boxGeometry args={[0.045, 0.24, 0.015]} />
          <meshStandardMaterial color="#111111" roughness={0.4} />
        </mesh>
        {/* Золотые полосы дана */}
        <mesh position={[0, -0.07, 0.009]}>
          <boxGeometry args={[0.047, 0.012, 0.003]} />
          <meshStandardMaterial color="#d4af37" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[0, -0.05, 0.009]}>
          <boxGeometry args={[0.047, 0.012, 0.003]} />
          <meshStandardMaterial color="#d4af37" roughness={0.3} metalness={0.8} />
        </mesh>
      </group>
      {/* Правый свисающий конец */}
      <group position={[0.03, -0.16, 0.21]} rotation={[0.12, 0, 0.09]}>
        <mesh castShadow>
          <boxGeometry args={[0.045, 0.28, 0.015]} />
          <meshStandardMaterial color="#111111" roughness={0.4} />
        </mesh>
        {/* Красная нашивка школы */}
        <mesh position={[0, -0.09, 0.009]}>
          <boxGeometry args={[0.038, 0.024, 0.003]} />
          <meshStandardMaterial color="#991b1b" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

export default function RealisticKaratekaModel({
  modelUrl = '/models/karateka.glb',
  stance = 'ready',
  role = 'tori',
}) {
  const { scene, nodes, materials } = useGLTF(modelUrl);
  const modelRef = useRef();

  // Настройка материалов и внешнего вида под каратэ-доги
  useEffect(() => {
    if (!scene) return;

    // Скрываем головной убор (ковбойскую шляпу и т.д.)
    if (nodes.Wolf3D_Headwear) {
      nodes.Wolf3D_Headwear.visible = false;
    }

    // Верхняя одежда: белое хлопковое кимоно (доги)
    if (nodes.Wolf3D_Outfit_Top) {
      nodes.Wolf3D_Outfit_Top.material = new THREE.MeshStandardMaterial({
        color: role === 'tori' ? '#fbf8f2' : '#1c2833',
        roughness: 0.85,
        metalness: 0.05,
      });
      nodes.Wolf3D_Outfit_Top.castShadow = true;
    }

    // Брюки: белые свободные брюки дзубон
    if (nodes.Wolf3D_Outfit_Bottom) {
      nodes.Wolf3D_Outfit_Bottom.material = new THREE.MeshStandardMaterial({
        color: role === 'tori' ? '#f7f4ed' : '#1a252f',
        roughness: 0.88,
        metalness: 0.05,
      });
      nodes.Wolf3D_Outfit_Bottom.castShadow = true;
    }

    // Обувь: лаконичный вид
    if (nodes.Wolf3D_Outfit_Footwear) {
      nodes.Wolf3D_Outfit_Footwear.material = new THREE.MeshStandardMaterial({
        color: '#221e1a',
        roughness: 0.9,
      });
    }

    // Включение теней для частей тела
    if (nodes.Wolf3D_Body) nodes.Wolf3D_Body.castShadow = true;
    if (nodes.Wolf3D_Head) nodes.Wolf3D_Head.castShadow = true;
  }, [scene, nodes, role]);

  // Сгибание 5 пальцев в кулак (сэйкэн) или раскрытие в ладонь (сюто)
  const setHandPose = (isFist) => {
    const fingerNames = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
    const sides = ['Left', 'Right'];

    for (const side of sides) {
      for (const f of fingerNames) {
        for (let joint = 1; joint <= 3; joint++) {
          const boneName = `${side}Hand${f}${joint}`;
          const bone = nodes[boneName];
          if (!bone) continue;

          if (isFist) {
            // Сжимаем фаланги в кулак каратэ
            if (f === 'Thumb') {
              bone.rotation.set(joint === 1 ? 0.4 : 0.2, 0, joint === 1 ? -0.3 : -0.15);
            } else {
              bone.rotation.set(0.65, 0, 0);
            }
          } else {
            // Раскрытая жесткая ладонь сюто (пальцы сомкнуты и выпрямлены)
            if (f === 'Thumb') {
              bone.rotation.set(0.2, 0, -0.4); // Большой палец прижат
            } else {
              bone.rotation.set(0.02, 0, 0); // Прямые плотные пальцы
            }
          }
        }
      }
    }
  };

  // Анимация суставов и интерполяция к целевой стойке
  useFrame(({ clock }, delta) => {
    const stanceConfig = REALISTIC_STANCES[stance] || REALISTIC_STANCES.ready;
    const targetBones = stanceConfig.bones;
    const factor = 1 - Math.exp(-delta * 7); // Плавная интерполяция к цели

    // Микро-дыхание мастера (грудная клетка слегка поднимается и опускается)
    const breath = Math.sin(clock.getElapsedTime() * 1.8) * 0.015;

    for (const [boneName, transform] of Object.entries(targetBones)) {
      const bone = nodes[boneName];
      if (!bone) continue;

      // Интерполяция поворота сустава
      if (transform.rot) {
        const [rx, ry, rz] = transform.rot;
        const extraX = (boneName === 'Spine' || boneName === 'Spine1') ? breath : 0;
        bone.rotation.x += (rx + extraX - bone.rotation.x) * factor;
        bone.rotation.y += (ry - bone.rotation.y) * factor;
        bone.rotation.z += (rz - bone.rotation.z) * factor;
      }

      // Позиция таза (Hips) для глубоких стоек
      if (boneName === 'Hips' && transform.pos) {
        bone.position.y += (transform.pos[1] - bone.position.y) * factor;
      }
    }

    // Управление фалангами пальцев
    setHandPose(stanceConfig.fist);
  });

  return (
    <group ref={modelRef} position={[0, -0.98, 0]}>
      {/* Примитив трехмерной модели Ready Player Me */}
      <primitive object={scene} />

      {/* Аутентичный пояс Оби, прикрепленный к талии */}
      {nodes.Hips && (
        <primitive object={nodes.Hips}>
          <KarateObiBelt />
        </primitive>
      )}
    </group>
  );
}

useGLTF.preload('/models/karateka.glb');
