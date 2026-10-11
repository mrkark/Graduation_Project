"""
Удары ногами (Гэри) и Боевые комбинации каратэ Шотокан
"""

def register_kicks_and_combos(gen_clip, poses):
    p_ready = poses['yoi']
    p_zenkutsu = poses['zenkutsu']
    p_kokutsu = poses['kokutsu']
    p_gankaku = poses['gankaku']
    p_hikite = poses['hikite']
    p_chudan_punch = poses['chudan_punch']
    p_fist = poses['fist']
    p_shuto = poses['shuto']
    p_set_bone = poses['set_bone']
    p_set_hips = poses['set_hips']

    # 25. Маэ-гэри (Прямой удар ногой подушечками стопы коси)
    # 4 канонические фазы:
    # 1) Камера (подъем колена выше пояса к груди, пятка под ягодицей)
    # 2) Удар (хлесткий выстрел голенью вперед в чудан, пальцы ноги загнуты вверх)
    # 3) Хикиаси (мгновенный возврат голени к колену у груди)
    # 4) Опускание ноги в стойку
    gen_clip('mae_geri', 1.5, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Фаза 1: Камера
        {'t': 0.30, 'pose': lambda: (
            p_set_hips(0, 0, 0.04),
            p_set_bone('UpperLeg.L', x_deg=-8, y_deg=0, z_deg=-2),
            p_set_bone('LowerLeg.L', x_deg=14, y_deg=0, z_deg=0),
            p_set_bone('UpperLeg.R', x_deg=-105, y_deg=5, z_deg=5),
            p_set_bone('LowerLeg.R', x_deg=130, y_deg=0, z_deg=0),
            p_set_bone('Foot.R', x_deg=-35, y_deg=0, z_deg=0),
            p_set_bone('Toe.R', x_deg=35, y_deg=0, z_deg=0),
            p_set_bone('UpperArm.L', x_deg=-35, y_deg=-20, z_deg=-45),
            p_set_bone('LowerArm.L', x_deg=75, y_deg=0, z_deg=0),
            p_set_bone('UpperArm.R', x_deg=-35, y_deg=20, z_deg=45),
            p_set_bone('LowerArm.R', x_deg=75, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        # Фаза 2: Кимэ / Удар в чудан
        {'t': 0.60, 'pose': lambda: (
            p_set_hips(0, -0.05, 0.02),
            p_set_bone('UpperLeg.L', x_deg=-10, y_deg=0, z_deg=-2),
            p_set_bone('LowerLeg.L', x_deg=16, y_deg=0, z_deg=0),
            p_set_bone('UpperLeg.R', x_deg=-90, y_deg=0, z_deg=0),
            p_set_bone('LowerLeg.R', x_deg=0, y_deg=0, z_deg=0),
            p_set_bone('Foot.R', x_deg=-20, y_deg=0, z_deg=0),
            p_set_bone('Toe.R', x_deg=40, y_deg=0, z_deg=0),
            p_set_bone('UpperArm.L', x_deg=-35, y_deg=-20, z_deg=-45),
            p_set_bone('LowerArm.L', x_deg=75, y_deg=0, z_deg=0),
            p_set_bone('UpperArm.R', x_deg=-35, y_deg=20, z_deg=45),
            p_set_bone('LowerArm.R', x_deg=75, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        # Фаза 3: Хикиаси (складывание голени)
        {'t': 0.95, 'pose': lambda: (
            p_set_hips(0, 0, 0.03),
            p_set_bone('UpperLeg.L', x_deg=-8, y_deg=0, z_deg=-2),
            p_set_bone('LowerLeg.L', x_deg=14, y_deg=0, z_deg=0),
            p_set_bone('UpperLeg.R', x_deg=-100, y_deg=5, z_deg=5),
            p_set_bone('LowerLeg.R', x_deg=125, y_deg=0, z_deg=0),
            p_set_bone('Foot.R', x_deg=-30, y_deg=0, z_deg=0),
            p_set_bone('UpperArm.L', x_deg=-35, y_deg=-20, z_deg=-45),
            p_set_bone('LowerArm.L', x_deg=75, y_deg=0, z_deg=0),
            p_set_bone('UpperArm.R', x_deg=-35, y_deg=20, z_deg=45),
            p_set_bone('LowerArm.R', x_deg=75, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        # Фаза 4: Возврат
        {'t': 1.50, 'pose': lambda: p_ready(0.0)},
    ])

    # 26. Ёко-гэри (Боковой проникающий удар ребром стопы сокуто)
    gen_clip('yoko_geri', 1.6, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Подъем колена к противоположному плечу
        {'t': 0.32, 'pose': lambda: (
            p_set_hips(0, 0, 0.02, rx_deg=0, ry_deg=-40, rz_deg=0),
            p_set_bone('UpperLeg.L', x_deg=-10, y_deg=-30, z_deg=0),
            p_set_bone('LowerLeg.L', x_deg=18, y_deg=0, z_deg=0),
            p_set_bone('UpperLeg.R', x_deg=-95, y_deg=40, z_deg=35),
            p_set_bone('LowerLeg.R', x_deg=125, y_deg=0, z_deg=0),
            p_set_bone('Foot.R', x_deg=25, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        # Боковой выстрел ребром стопы сокуто
        {'t': 0.68, 'pose': lambda: (
            p_set_hips(0, 0, 0.0, rx_deg=0, ry_deg=-70, rz_deg=15),
            p_set_bone('Spine', x_deg=-15, y_deg=0, z_deg=-10),
            p_set_bone('UpperLeg.L', x_deg=-5, y_deg=-50, z_deg=0),
            p_set_bone('LowerLeg.L', x_deg=12, y_deg=0, z_deg=0),
            p_set_bone('UpperLeg.R', x_deg=-10, y_deg=45, z_deg=60),
            p_set_bone('LowerLeg.R', x_deg=0, y_deg=0, z_deg=0),
            p_set_bone('Foot.R', x_deg=-30, y_deg=0, z_deg=15),
            p_set_bone('UpperArm.R', x_deg=-30, y_deg=30, z_deg=60),
            p_set_bone('LowerArm.R', x_deg=30, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        # Хикиаси
        {'t': 1.05, 'pose': lambda: (
            p_set_hips(0, 0, 0.02, rx_deg=0, ry_deg=-40, rz_deg=0),
            p_set_bone('UpperLeg.R', x_deg=-95, y_deg=40, z_deg=35),
            p_set_bone('LowerLeg.R', x_deg=125, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        {'t': 1.60, 'pose': lambda: p_ready(0.0)},
    ])

    # 27. Маваси-гэри (Круговой удар ногой с доворотом таза)
    gen_clip('mawashi_geri', 1.6, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Вынос колена сбоку по дуге
        {'t': 0.32, 'pose': lambda: (
            p_set_hips(0, 0, 0.02, rx_deg=0, ry_deg=-45, rz_deg=0),
            p_set_bone('UpperLeg.L', x_deg=-12, y_deg=-35, z_deg=0),
            p_set_bone('LowerLeg.L', x_deg=20, y_deg=0, z_deg=0),
            p_set_bone('UpperLeg.R', x_deg=-80, y_deg=35, z_deg=45),
            p_set_bone('LowerLeg.R', x_deg=120, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        # Хлесткий удар подъемом стопы (хайсоку)
        {'t': 0.68, 'pose': lambda: (
            p_set_hips(0, -0.06, 0.0, rx_deg=0, ry_deg=-65, rz_deg=10),
            p_set_bone('UpperLeg.L', x_deg=-8, y_deg=-55, z_deg=0),
            p_set_bone('LowerLeg.L', x_deg=15, y_deg=0, z_deg=0),
            p_set_bone('UpperLeg.R', x_deg=-85, y_deg=45, z_deg=20),
            p_set_bone('LowerLeg.R', x_deg=0, y_deg=0, z_deg=0),
            p_set_bone('Foot.R', x_deg=-45, y_deg=0, z_deg=0),
            p_set_bone('UpperArm.R', x_deg=-40, y_deg=20, z_deg=40),
            p_set_bone('LowerArm.R', x_deg=70, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        # Хикиаси
        {'t': 1.05, 'pose': lambda: (
            p_set_hips(0, 0, 0.02, rx_deg=0, ry_deg=-45, rz_deg=0),
            p_set_bone('UpperLeg.R', x_deg=-80, y_deg=35, z_deg=45),
            p_set_bone('LowerLeg.R', x_deg=120, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        {'t': 1.60, 'pose': lambda: p_ready(0.0)},
    ])

    # 28. Усиро-гэри (Удар назад пяткой с наклоном корпуса)
    gen_clip('ushiro_geri', 1.6, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Подъем колена к груди и поворот спиной к цели
        {'t': 0.32, 'pose': lambda: (
            p_set_hips(0, 0, 0.0, rx_deg=10, ry_deg=-150, rz_deg=0),
            p_set_bone('UpperLeg.R', x_deg=-90, y_deg=0, z_deg=0),
            p_set_bone('LowerLeg.R', x_deg=120, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        # Выстрел пяткой назад с наклоном корпуса вперед
        {'t': 0.68, 'pose': lambda: (
            p_set_hips(0, 0, -0.05, rx_deg=20, ry_deg=-170, rz_deg=0),
            p_set_bone('Spine', x_deg=25, y_deg=0, z_deg=0),
            p_set_bone('UpperLeg.R', x_deg=25, y_deg=0, z_deg=0),
            p_set_bone('LowerLeg.R', x_deg=0, y_deg=0, z_deg=0),
            p_set_bone('Foot.R', x_deg=-45, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        {'t': 1.05, 'pose': lambda: (
            p_set_hips(0, 0, 0.0, rx_deg=10, ry_deg=-150, rz_deg=0),
            p_set_bone('UpperLeg.R', x_deg=-90, y_deg=0, z_deg=0),
            p_set_bone('LowerLeg.R', x_deg=120, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        {'t': 1.60, 'pose': lambda: p_ready(0.0)},
    ])

    # 29. Kick (Базовый удар ногой маэ-гэри)
    gen_clip('kick', 1.5, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        {'t': 0.30, 'pose': lambda: (
            p_set_hips(0, 0, 0.04),
            p_set_bone('UpperLeg.R', x_deg=-105, y_deg=5, z_deg=5),
            p_set_bone('LowerLeg.R', x_deg=130, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        {'t': 0.60, 'pose': lambda: (
            p_set_hips(0, -0.05, 0.02),
            p_set_bone('UpperLeg.R', x_deg=-90, y_deg=0, z_deg=0),
            p_set_bone('LowerLeg.R', x_deg=0, y_deg=0, z_deg=0),
            p_set_bone('Foot.R', x_deg=-20, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        {'t': 0.95, 'pose': lambda: (
            p_set_hips(0, 0, 0.03),
            p_set_bone('UpperLeg.R', x_deg=-100, y_deg=5, z_deg=5),
            p_set_bone('LowerLeg.R', x_deg=125, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        {'t': 1.50, 'pose': lambda: p_ready(0.0)},
    ])

    # 30. Step (Цуги-аси скользящий шаг)
    gen_clip('step', 1.2, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        {'t': 0.35, 'pose': lambda: (p_set_hips(0, -0.15, -0.04), p_set_bone('UpperLeg.L', x_deg=-15, y_deg=0, z_deg=-3), p_set_bone('LowerLeg.L', x_deg=25, y_deg=0, z_deg=0), p_fist('both'))},
        {'t': 0.75, 'pose': lambda: (p_set_hips(0, -0.30, 0.0), p_ready(0.0))},
        {'t': 1.20, 'pose': lambda: p_ready(0.0)},
    ])

    # 31. Маэ-гэри + Гяку-цуки (Удар ногой с переходом в прямой удар рукой)
    gen_clip('mae_geri_gyaku_zuki', 2.0, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Маэ-гэри
        {'t': 0.35, 'pose': lambda: (
            p_set_hips(0, 0, 0.03),
            p_set_bone('UpperLeg.R', x_deg=-105, y_deg=5, z_deg=5),
            p_set_bone('LowerLeg.R', x_deg=130, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        {'t': 0.65, 'pose': lambda: (
            p_set_hips(0, -0.04, 0.02),
            p_set_bone('UpperLeg.R', x_deg=-90, y_deg=0, z_deg=0),
            p_set_bone('LowerLeg.R', x_deg=0, y_deg=0, z_deg=0),
            p_fist('both')
        )},
        # Приземление в Дзэнкуцу-дати с мощным ударом Гяку-цуки
        {'t': 1.15, 'pose': lambda: (
            p_zenkutsu('right', False, 0.0),
            p_hikite('right'),
            p_chudan_punch('left', 1.0)
        )},
        {'t': 1.55, 'pose': lambda: (
            p_zenkutsu('right', False, 0.0),
            p_hikite('right'),
            p_chudan_punch('left', 1.0)
        )},
        {'t': 2.00, 'pose': lambda: p_ready(0.0)},
    ])

    # 32. Агэ-укэ + Гяку-цуки (Блок головой и контратака)
    gen_clip('age_uke_gyaku_zuki', 2.0, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Агэ-укэ
        {'t': 0.45, 'pose': lambda: (
            p_zenkutsu('left', True, 0.0),
            p_hikite('right'),
            p_set_bone('UpperArm.L', x_deg=55, y_deg=-45, z_deg=-60),
            p_set_bone('LowerArm.L', x_deg=95, y_deg=-50, z_deg=0),
            p_fist('both')
        )},
        # Контратака Гяку-цуки
        {'t': 1.05, 'pose': lambda: (
            p_zenkutsu('left', False, 0.0),
            p_hikite('left'),
            p_chudan_punch('right', 1.0)
        )},
        {'t': 1.50, 'pose': lambda: (
            p_zenkutsu('left', False, 0.0),
            p_hikite('left'),
            p_chudan_punch('right', 1.0)
        )},
        {'t': 2.00, 'pose': lambda: p_ready(0.0)},
    ])

    # 33. Ганкаку-сюто (Журавль на скале и рубящий блок)
    gen_clip('gankaku_shuto', 2.0, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        {'t': 0.50, 'pose': lambda: (
            p_gankaku(0.0),
            p_hikite('left'),
            p_set_bone('UpperArm.R', x_deg=-30, y_deg=40, z_deg=-30),
            p_fist('both')
        )},
        # Сброс в Кокуцу-дати с Сюто-укэ
        {'t': 1.15, 'pose': lambda: (
            p_kokutsu('left', 0.0),
            p_set_bone('UpperArm.L', x_deg=-15, y_deg=25, z_deg=-60),
            p_set_bone('LowerArm.L', x_deg=75, y_deg=45, z_deg=0),
            p_set_bone('UpperArm.R', x_deg=-25, y_deg=-30, z_deg=30),
            p_set_bone('LowerArm.R', x_deg=100, y_deg=-45, z_deg=0),
            p_shuto('both')
        )},
        {'t': 1.60, 'pose': lambda: (
            p_kokutsu('left', 0.0),
            p_set_bone('UpperArm.L', x_deg=-15, y_deg=25, z_deg=-60),
            p_set_bone('LowerArm.L', x_deg=75, y_deg=45, z_deg=0),
            p_shuto('both')
        )},
        {'t': 2.00, 'pose': lambda: p_ready(0.0)},
    ])

    # 34. Хэйан Сёдан (Полная последовательность первого ката Шотокан)
    gen_clip('heian_shodan', 4.5, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Поворот влево, Гэдан-барай в Дзэнкуцу-дати
        {'t': 0.8, 'pose': lambda: (
            p_zenkutsu('left', True, 0.0),
            p_hikite('right'),
            p_set_bone('UpperArm.L', x_deg=-55, y_deg=-15, z_deg=-45),
            p_set_bone('LowerArm.L', x_deg=35, y_deg=-40, z_deg=0),
            p_fist('both')
        )},
        # Шаг вперед Ой-цуки в Дзэнкуцу-дати
        {'t': 1.8, 'pose': lambda: (
            p_zenkutsu('right', False, 0.0),
            p_hikite('left'),
            p_chudan_punch('right', 1.0)
        )},
        # Поворот на 180° вправо, Гэдан-барай
        {'t': 2.7, 'pose': lambda: (
            p_zenkutsu('right', True, 0.0),
            p_hikite('left'),
            p_set_bone('UpperArm.R', x_deg=-55, y_deg=15, z_deg=45),
            p_set_bone('LowerArm.R', x_deg=35, y_deg=40, z_deg=0),
            p_fist('both')
        )},
        # Шаг вперед Ой-цуки
        {'t': 3.6, 'pose': lambda: (
            p_zenkutsu('left', False, 0.0),
            p_hikite('right'),
            p_chudan_punch('left', 1.0)
        )},
        {'t': 4.5, 'pose': lambda: p_ready(0.0)},
    ])
