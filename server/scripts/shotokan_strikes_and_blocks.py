"""
Удары (Учи) и Защитные блоки (Укэ) каратэ Шотокан
"""

def register_strikes_and_blocks(gen_clip, poses):
    p_ready = poses['yoi']
    p_zenkutsu = poses['zenkutsu']
    p_kokutsu = poses['kokutsu']
    p_hikite = poses['hikite']
    p_fist = poses['fist']
    p_shuto = poses['shuto']
    p_set_bone = poses['set_bone']

    # 15. Уракэн-учи (Хлесткий круговой удар тыльной стороной кулака)
    gen_clip('uraken_uchi', 1.3, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Замах: кулак у противоположного плеча
        {'t': 0.25, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('left'), p_set_bone('UpperArm.R', x_deg=20, y_deg=-30, z_deg=-20), p_set_bone('LowerArm.R', x_deg=120, y_deg=40, z_deg=0), p_fist('both'))},
        # Хлесткий удар тыльной стороной кулака в висок
        {'t': 0.55, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('left'), p_set_bone('UpperArm.R', x_deg=15, y_deg=60, z_deg=65), p_set_bone('LowerArm.R', x_deg=25, y_deg=70, z_deg=0), p_set_bone('Hand.R', x_deg=15, y_deg=0, z_deg=0), p_fist('both'))},
        {'t': 0.85, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('left'), p_set_bone('UpperArm.R', x_deg=15, y_deg=60, z_deg=65), p_set_bone('LowerArm.R', x_deg=25, y_deg=70, z_deg=0), p_fist('both'))},
        {'t': 1.30, 'pose': lambda: p_ready(0.0)},
    ])

    # 16. Тэтцуи-учи (Удар кулаком-молотом сверху-вниз)
    gen_clip('tetsui_uchi', 1.4, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Замах высоко над головой
        {'t': 0.30, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('left'), p_set_bone('UpperArm.R', x_deg=90, y_deg=30, z_deg=30), p_set_bone('LowerArm.R', x_deg=100, y_deg=0, z_deg=0), p_fist('both'))},
        # Мощный нисходящий удар основанием кулака по ключице
        {'t': 0.65, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('left'), p_set_bone('UpperArm.R', x_deg=-25, y_deg=10, z_deg=75), p_set_bone('LowerArm.R', x_deg=45, y_deg=0, z_deg=0), p_fist('both'))},
        {'t': 0.95, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('left'), p_set_bone('UpperArm.R', x_deg=-25, y_deg=10, z_deg=75), p_set_bone('LowerArm.R', x_deg=45, y_deg=0, z_deg=0), p_fist('both'))},
        {'t': 1.40, 'pose': lambda: p_ready(0.0)},
    ])

    # 17. Эмпи-учи (Сокрушительный удар локтем с хлопком ладони)
    gen_clip('empi_uchi', 1.4, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Замах правого локтя назад
        {'t': 0.30, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_set_bone('UpperArm.R', x_deg=-15, y_deg=0, z_deg=-75), p_set_bone('LowerArm.R', x_deg=130, y_deg=0, z_deg=0), p_set_bone('UpperArm.L', x_deg=-20, y_deg=0, z_deg=-60), p_shuto('L'), p_fist('R'))},
        # Круговой удар локтем перед грудью, левая ладонь встречает кулак
        {'t': 0.65, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_set_bone('UpperArm.R', x_deg=10, y_deg=20, z_deg=50), p_set_bone('LowerArm.R', x_deg=140, y_deg=10, z_deg=0), p_set_bone('UpperArm.L', x_deg=5, y_deg=-20, z_deg=-45), p_set_bone('LowerArm.L', x_deg=85, y_deg=0, z_deg=0), p_shuto('L'), p_fist('R'))},
        {'t': 0.95, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_set_bone('UpperArm.R', x_deg=10, y_deg=20, z_deg=50), p_set_bone('LowerArm.R', x_deg=140, y_deg=10, z_deg=0), p_shuto('L'), p_fist('R'))},
        {'t': 1.40, 'pose': lambda: p_ready(0.0)},
    ])

    # 18. Сюто-учи (Рубящий удар ребром открытой ладони от уха)
    gen_clip('shuto_uchi', 1.4, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Взведение открытой ладони у противоположного уха
        {'t': 0.30, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('left'), p_set_bone('UpperArm.R', x_deg=65, y_deg=-30, z_deg=15), p_set_bone('LowerArm.R', x_deg=115, y_deg=-40, z_deg=0), p_shuto('R'), p_fist('L'))},
        # Диагональный рубящий удар сюто в область шеи/ключицы
        {'t': 0.65, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('left'), p_set_bone('UpperArm.R', x_deg=-10, y_deg=25, z_deg=70), p_set_bone('LowerArm.R', x_deg=35, y_deg=40, z_deg=0), p_shuto('R'), p_fist('L'))},
        {'t': 0.98, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('left'), p_set_bone('UpperArm.R', x_deg=-10, y_deg=25, z_deg=70), p_set_bone('LowerArm.R', x_deg=35, y_deg=40, z_deg=0), p_shuto('R'), p_fist('L'))},
        {'t': 1.40, 'pose': lambda: p_ready(0.0)},
    ])

    # 19. Агэ-укэ (Восходящий верхний блок под 45° над лбом)
    gen_clip('age_uke', 1.4, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Замах: левый кулак поднимается от правого бедра
        {'t': 0.28, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_set_bone('UpperArm.L', x_deg=-45, y_deg=20, z_deg=-30), p_set_bone('LowerArm.L', x_deg=90, y_deg=0, z_deg=0), p_fist('both'))},
        # Блок зафиксирован над лбом под углом 45°, правая рука в хикитэ
        {'t': 0.62, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_set_bone('UpperArm.L', x_deg=55, y_deg=-45, z_deg=-60), p_set_bone('LowerArm.L', x_deg=95, y_deg=-50, z_deg=0), p_fist('both'))},
        {'t': 0.95, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_set_bone('UpperArm.L', x_deg=55, y_deg=-45, z_deg=-60), p_set_bone('LowerArm.L', x_deg=95, y_deg=-50, z_deg=0), p_fist('both'))},
        {'t': 1.40, 'pose': lambda: p_ready(0.0)},
    ])

    # 20. Сото-укэ (Блок снаружи-внутрь к центру)
    gen_clip('soto_uke', 1.4, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Замах у уха
        {'t': 0.28, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_set_bone('UpperArm.L', x_deg=35, y_deg=40, z_deg=25), p_set_bone('LowerArm.L', x_deg=90, y_deg=0, z_deg=0), p_fist('both'))},
        # Сбивающее движение к центральной линии груди
        {'t': 0.62, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_set_bone('UpperArm.L', x_deg=-5, y_deg=-30, z_deg=-60), p_set_bone('LowerArm.L', x_deg=90, y_deg=40, z_deg=0), p_fist('both'))},
        {'t': 0.95, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_set_bone('UpperArm.L', x_deg=-5, y_deg=-30, z_deg=-60), p_set_bone('LowerArm.L', x_deg=90, y_deg=40, z_deg=0), p_fist('both'))},
        {'t': 1.40, 'pose': lambda: p_ready(0.0)},
    ])

    # 21. Ути-укэ (Блок изнутри-наружу снизу-вверх)
    gen_clip('uchi_uke', 1.4, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Замах из-под противоположного локтя
        {'t': 0.28, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_set_bone('UpperArm.L', x_deg=-35, y_deg=-20, z_deg=-30), p_set_bone('LowerArm.L', x_deg=90, y_deg=-40, z_deg=0), p_fist('both'))},
        # Блок наружу, кулак на высоте плеча
        {'t': 0.62, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_set_bone('UpperArm.L', x_deg=-10, y_deg=30, z_deg=-55), p_set_bone('LowerArm.L', x_deg=85, y_deg=-40, z_deg=0), p_fist('both'))},
        {'t': 0.95, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_set_bone('UpperArm.L', x_deg=-10, y_deg=30, z_deg=-55), p_set_bone('LowerArm.L', x_deg=85, y_deg=-40, z_deg=0), p_fist('both'))},
        {'t': 1.40, 'pose': lambda: p_ready(0.0)},
    ])

    # 22. Гэдан-барай (Нижний смет над передним бедром)
    gen_clip('gedan_barai', 1.4, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Замах кулака у противоположного уха
        {'t': 0.25, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_set_bone('UpperArm.R', x_deg=-45, y_deg=0, z_deg=45), p_set_bone('UpperArm.L', x_deg=50, y_deg=30, z_deg=20), p_set_bone('LowerArm.L', x_deg=115, y_deg=0, z_deg=0), p_fist('both'))},
        # Резкий смет вниз-вперед над левым бедром
        {'t': 0.58, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_set_bone('UpperArm.L', x_deg=-55, y_deg=-15, z_deg=-45), p_set_bone('LowerArm.L', x_deg=35, y_deg=-40, z_deg=0), p_fist('both'))},
        {'t': 0.95, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_set_bone('UpperArm.L', x_deg=-55, y_deg=-15, z_deg=-45), p_set_bone('LowerArm.L', x_deg=35, y_deg=-40, z_deg=0), p_fist('both'))},
        {'t': 1.40, 'pose': lambda: p_ready(0.0)},
    ])

    # 23. Сюто-укэ (Блок ребром ладони в стойке Кокуцу-дати)
    gen_clip('shuto_uke', 1.4, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        # Замах открытыми ладонями
        {'t': 0.28, 'pose': lambda: (p_kokutsu('left', 0.0), p_set_bone('UpperArm.L', x_deg=45, y_deg=20, z_deg=30), p_set_bone('LowerArm.L', x_deg=110, y_deg=0, z_deg=0), p_set_bone('UpperArm.R', x_deg=-45, y_deg=0, z_deg=-20), p_shuto('both'))},
        # Фиксация блока: передняя ладонь защищает корпус, задняя у солнечного сплетения
        {'t': 0.62, 'pose': lambda: (p_kokutsu('left', 0.0), p_set_bone('UpperArm.L', x_deg=-15, y_deg=25, z_deg=-60), p_set_bone('LowerArm.L', x_deg=75, y_deg=45, z_deg=0), p_set_bone('UpperArm.R', x_deg=-25, y_deg=-30, z_deg=30), p_set_bone('LowerArm.R', x_deg=100, y_deg=-45, z_deg=0), p_shuto('both'))},
        {'t': 0.95, 'pose': lambda: (p_kokutsu('left', 0.0), p_set_bone('UpperArm.L', x_deg=-15, y_deg=25, z_deg=-60), p_set_bone('LowerArm.L', x_deg=75, y_deg=45, z_deg=0), p_set_bone('UpperArm.R', x_deg=-25, y_deg=-30, z_deg=30), p_set_bone('LowerArm.R', x_deg=100, y_deg=-45, z_deg=0), p_shuto('both'))},
        {'t': 1.40, 'pose': lambda: p_ready(0.0)},
    ])

    # 24. Мандзи-укэ (Двойной блок верхний и нижний)
    gen_clip('manji_uke', 1.4, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        {'t': 0.30, 'pose': lambda: (p_kokutsu('left', 0.0), p_set_bone('UpperArm.L', x_deg=-30, y_deg=0, z_deg=-30), p_set_bone('UpperArm.R', x_deg=30, y_deg=0, z_deg=30), p_fist('both'))},
        # Верхний блок назад (дзёдан ути-укэ правой рукой) + нижний смет вперед (гэдан-барай левой рукой)
        {'t': 0.65, 'pose': lambda: (p_kokutsu('left', 0.0), p_set_bone('UpperArm.L', x_deg=-55, y_deg=-15, z_deg=-45), p_set_bone('LowerArm.L', x_deg=35, y_deg=-40, z_deg=0), p_set_bone('UpperArm.R', x_deg=65, y_deg=-30, z_deg=-55), p_set_bone('LowerArm.R', x_deg=90, y_deg=-40, z_deg=0), p_fist('both'))},
        {'t': 1.00, 'pose': lambda: (p_kokutsu('left', 0.0), p_set_bone('UpperArm.L', x_deg=-55, y_deg=-15, z_deg=-45), p_set_bone('LowerArm.L', x_deg=35, y_deg=-40, z_deg=0), p_set_bone('UpperArm.R', x_deg=65, y_deg=-30, z_deg=-55), p_set_bone('LowerArm.R', x_deg=90, y_deg=-40, z_deg=0), p_fist('both'))},
        {'t': 1.40, 'pose': lambda: p_ready(0.0)},
    ])
