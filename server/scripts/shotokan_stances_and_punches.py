"""
Стойки (Дати) и Удары руками (Цуки) каратэ Шотокан
"""

def register_stances_and_punches(gen_clip, poses):
    p_ready = poses['yoi']
    p_zenkutsu = poses['zenkutsu']
    p_kokutsu = poses['kokutsu']
    p_kiba = poses['kiba']
    p_fudo = poses['fudo']
    p_gankaku = poses['gankaku']
    p_hikite = poses['hikite']
    p_chudan_punch = poses['chudan_punch']
    p_fist = poses['fist']
    p_set_bone = poses['set_bone']
    p_set_hips = poses['set_hips']

    # 1-6. Дыхательные циклы базовых стоек (2.4s петля)
    gen_clip('stance_ready', 2.4, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        {'t': 1.2, 'pose': lambda: p_ready(1.0)},
        {'t': 2.4, 'pose': lambda: p_ready(0.0)},
    ])

    gen_clip('stance_zenkutsu', 2.4, [
        {'t': 0.0, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_chudan_punch('left', 0.8))},
        {'t': 1.2, 'pose': lambda: (p_zenkutsu('left', True, 1.0), p_hikite('right'), p_chudan_punch('left', 0.8))},
        {'t': 2.4, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_chudan_punch('left', 0.8))},
    ])

    gen_clip('stance_kokutsu', 2.4, [
        {'t': 0.0, 'pose': lambda: p_kokutsu('left', 0.0)},
        {'t': 1.2, 'pose': lambda: p_kokutsu('left', 1.0)},
        {'t': 2.4, 'pose': lambda: p_kokutsu('left', 0.0)},
    ])

    gen_clip('stance_kiba', 2.4, [
        {'t': 0.0, 'pose': lambda: (p_kiba(0.0), p_hikite('left'), p_hikite('right'))},
        {'t': 1.2, 'pose': lambda: (p_kiba(1.0), p_hikite('left'), p_hikite('right'))},
        {'t': 2.4, 'pose': lambda: (p_kiba(0.0), p_hikite('left'), p_hikite('right'))},
    ])

    gen_clip('stance_fudo', 2.4, [
        {'t': 0.0, 'pose': lambda: (p_fudo(0.0), p_hikite('right'), p_chudan_punch('left', 0.6))},
        {'t': 1.2, 'pose': lambda: (p_fudo(1.0), p_hikite('right'), p_chudan_punch('left', 0.6))},
        {'t': 2.4, 'pose': lambda: (p_fudo(0.0), p_hikite('right'), p_chudan_punch('left', 0.6))},
    ])

    gen_clip('stance_gankaku', 2.4, [
        {'t': 0.0, 'pose': lambda: (p_gankaku(0.0), p_hikite('left'), p_set_bone('UpperArm.R', x_deg=-30, y_deg=40, z_deg=-30), p_fist('both'))},
        {'t': 1.2, 'pose': lambda: (p_gankaku(1.0), p_hikite('left'), p_set_bone('UpperArm.R', x_deg=-30, y_deg=40, z_deg=-30), p_fist('both'))},
        {'t': 2.4, 'pose': lambda: (p_gankaku(0.0), p_hikite('left'), p_set_bone('UpperArm.R', x_deg=-30, y_deg=40, z_deg=-30), p_fist('both'))},
    ])

    # 7. Чоку-цуки (Прямой удар кулаком на месте)
    # Начинается из хикитэ, локоть скользит вдоль ребер, в конце взрывная ротация 180°
    gen_clip('choku_zuki', 1.2, [
        {'t': 0.0, 'pose': lambda: (p_ready(0.0), p_hikite('left'), p_chudan_punch('right', 1.0))},
        {'t': 0.15, 'pose': lambda: (p_ready(0.0), p_hikite('left'), p_chudan_punch('right', 0.5))},
        {'t': 0.35, 'pose': lambda: (p_ready(0.0), p_chudan_punch('left', 0.5), p_chudan_punch('right', 0.2))},
        {'t': 0.55, 'pose': lambda: (p_ready(0.0), p_chudan_punch('left', 1.0), p_hikite('right'))},
        {'t': 0.85, 'pose': lambda: (p_ready(0.0), p_chudan_punch('left', 1.0), p_hikite('right'))},
        {'t': 1.20, 'pose': lambda: (p_ready(0.0), p_hikite('left'), p_chudan_punch('right', 1.0))},
    ])

    # 8. Ой-цуки (Удар с шагом вперед в Дзэнкуцу-дати)
    gen_clip('oi_zuki', 1.5, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        {'t': 0.3, 'pose': lambda: (p_set_hips(0, -0.04, -0.06), p_hikite('right'), p_set_bone('UpperArm.L', x_deg=-40, y_deg=0, z_deg=-20), p_fist('both'))},
        {'t': 0.65, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_chudan_punch('right', 1.0))},
        {'t': 1.05, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_chudan_punch('right', 1.0))},
        {'t': 1.50, 'pose': lambda: p_ready(0.0)},
    ])

    # 9. Гяку-цуки (Реверсивный удар от бедра с взрывной ротацией таза)
    gen_clip('gyaku_zuki', 1.4, [
        {'t': 0.0, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_chudan_punch('left', 0.7))},
        {'t': 0.25, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_chudan_punch('left', 0.3))},
        {'t': 0.55, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('left'), p_chudan_punch('right', 1.0))},
        {'t': 0.95, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('left'), p_chudan_punch('right', 1.0))},
        {'t': 1.40, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_chudan_punch('left', 0.7))},
    ])

    # 10. Кизами-цуки (Быстрый передний джеб с микроподшагом)
    gen_clip('kizami_zuki', 1.1, [
        {'t': 0.0, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_chudan_punch('left', 0.5))},
        {'t': 0.30, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_chudan_punch('left', 1.0))},
        {'t': 0.65, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_chudan_punch('left', 0.7))},
        {'t': 1.10, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_chudan_punch('left', 0.5))},
    ])

    # 11. Рэн-цуки (Связка «двойка»: левый джеб + правый прямой)
    gen_clip('ren_zuki', 1.6, [
        {'t': 0.0, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_chudan_punch('left', 0.5))},
        {'t': 0.25, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_chudan_punch('left', 1.0))},
        {'t': 0.55, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_chudan_punch('left', 0.4), p_hikite('right'))},
        {'t': 0.85, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('left'), p_chudan_punch('right', 1.0))},
        {'t': 1.20, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('left'), p_chudan_punch('right', 1.0))},
        {'t': 1.60, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_chudan_punch('left', 0.5))},
    ])

    # 12. Санбон-цуки (Тройная связка: дзёдан + чудан + чудан)
    gen_clip('sanbon_zuki', 2.0, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        {'t': 0.4, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_chudan_punch('right', 1.0))},
        {'t': 0.9, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('right'), p_chudan_punch('left', 1.0))},
        {'t': 1.4, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_chudan_punch('right', 1.0))},
        {'t': 2.0, 'pose': lambda: p_ready(0.0)},
    ])

    # 13. Моротэ-цуки (Двойной параллельный удар двумя кулаками)
    gen_clip('morote_zuki', 1.4, [
        {'t': 0.0, 'pose': lambda: p_ready(0.0)},
        {'t': 0.25, 'pose': lambda: (p_ready(0.0), p_hikite('left'), p_hikite('right'))},
        {'t': 0.60, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_chudan_punch('left', 0.9), p_chudan_punch('right', 0.9))},
        {'t': 0.95, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_chudan_punch('left', 0.9), p_chudan_punch('right', 0.9))},
        {'t': 1.40, 'pose': lambda: p_ready(0.0)},
    ])

    # 14. Каги-цуки / Hook (Боковой крюк в корпус в Киба-дати)
    gen_clip('hook', 1.4, [
        {'t': 0.0, 'pose': lambda: (p_kiba(0.0), p_hikite('left'), p_hikite('right'))},
        {'t': 0.35, 'pose': lambda: (p_kiba(0.0), p_hikite('left'), p_set_bone('UpperArm.R', x_deg=-30, y_deg=20, z_deg=-45), p_set_bone('LowerArm.R', x_deg=70, y_deg=0, z_deg=0), p_fist('both'))},
        {'t': 0.65, 'pose': lambda: (p_kiba(0.0), p_hikite('left'), p_set_bone('UpperArm.R', x_deg=10, y_deg=-20, z_deg=35), p_set_bone('LowerArm.R', x_deg=90, y_deg=0, z_deg=0), p_fist('both'))},
        {'t': 1.00, 'pose': lambda: (p_kiba(0.0), p_hikite('left'), p_set_bone('UpperArm.R', x_deg=10, y_deg=-20, z_deg=35), p_set_bone('LowerArm.R', x_deg=90, y_deg=0, z_deg=0), p_fist('both'))},
        {'t': 1.40, 'pose': lambda: (p_kiba(0.0), p_hikite('left'), p_hikite('right'))},
    ])
