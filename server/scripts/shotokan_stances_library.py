"""
Shotokan Stances and Locomotion Library:
- Authentic stances: Shizentai, Zenkutsu-dachi, Kokutsu-dachi, Kiba-dachi, Fudo-dachi, Gankaku
- Canonical footwork: Suri-ashi, Tsugi-ashi, weight transfers, stance entries/exits
- Koshi pivots and turns: 45°, 90°, 180° with Metsuke, weight transfer, and foot locking
"""

def register_stances_and_locomotion(engine, poses):
    reg = engine['register_clip']
    set_b = engine['set_bone']
    set_h = engine['set_hips']
    fist = engine['make_fist']
    shuto = engine['make_shuto']
    relaxed = engine['make_relaxed']

    p_yoi = poses['yoi']
    p_zenkutsu = poses['zenkutsu']
    p_kokutsu = poses['kokutsu']
    p_kiba = poses['kiba']
    p_fudo = poses['fudo']
    p_gankaku = poses['gankaku']
    p_hikite = poses['hikite']
    p_punch = poses['chudan_punch']

    # =========================================================
    # 1. CANONICAL STANCES (2.0s breathing loops)
    # =========================================================
    for name in ['idle_shizentai', 'stance_ready', 'heiko_dachi']:
        reg(name, 2.0, [
            {'t': 0.0, 'pose': lambda: p_yoi(0.0)},
            {'t': 1.0, 'pose': lambda: p_yoi(1.0)},
            {'t': 2.0, 'pose': lambda: p_yoi(0.0)},
        ])

    for name in ['zenkutsu_dachi_left', 'stance_zenkutsu']:
        reg(name, 2.0, [
            {'t': 0.0, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('right'), p_punch('left', 0.8))},
            {'t': 1.0, 'pose': lambda: (p_zenkutsu('left', False, 1.0), p_hikite('right'), p_punch('left', 0.8))},
            {'t': 2.0, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('right'), p_punch('left', 0.8))},
        ])

    reg('zenkutsu_dachi_right', 2.0, [
        {'t': 0.0, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_punch('right', 0.8))},
        {'t': 1.0, 'pose': lambda: (p_zenkutsu('right', False, 1.0), p_hikite('left'), p_punch('right', 0.8))},
        {'t': 2.0, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_punch('right', 0.8))},
    ])

    for name in ['kokutsu_dachi_left', 'stance_kokutsu']:
        reg(name, 2.0, [
            {'t': 0.0, 'pose': lambda: p_kokutsu('left', 0.0)},
            {'t': 1.0, 'pose': lambda: p_kokutsu('left', 1.0)},
            {'t': 2.0, 'pose': lambda: p_kokutsu('left', 0.0)},
        ])

    reg('kokutsu_dachi_right', 2.0, [
        {'t': 0.0, 'pose': lambda: p_kokutsu('right', 0.0)},
        {'t': 1.0, 'pose': lambda: p_kokutsu('right', 1.0)},
        {'t': 2.0, 'pose': lambda: p_kokutsu('right', 0.0)},
    ])

    for name in ['fudo_dachi', 'stance_fudo']:
        reg(name, 2.0, [
            {'t': 0.0, 'pose': lambda: (p_fudo(0.0), p_hikite('right'), p_punch('left', 0.6))},
            {'t': 1.0, 'pose': lambda: (p_fudo(1.0), p_hikite('right'), p_punch('left', 0.6))},
            {'t': 2.0, 'pose': lambda: (p_fudo(0.0), p_hikite('right'), p_punch('left', 0.6))},
        ])

    reg('stance_kiba', 2.0, [
        {'t': 0.0, 'pose': lambda: (p_kiba(0.0), p_hikite('left'), p_hikite('right'))},
        {'t': 1.0, 'pose': lambda: (p_kiba(1.0), p_hikite('left'), p_hikite('right'))},
        {'t': 2.0, 'pose': lambda: (p_kiba(0.0), p_hikite('left'), p_hikite('right'))},
    ])

    reg('stance_gankaku', 2.0, [
        {'t': 0.0, 'pose': lambda: (p_gankaku(0.0), p_hikite('left'), set_b('UpperArm.R', x_deg=35, y_deg=40, z_deg=30), fist('both'))},
        {'t': 1.0, 'pose': lambda: (p_gankaku(1.0), p_hikite('left'), set_b('UpperArm.R', x_deg=35, y_deg=40, z_deg=30), fist('both'))},
        {'t': 2.0, 'pose': lambda: (p_gankaku(0.0), p_hikite('left'), set_b('UpperArm.R', x_deg=35, y_deg=40, z_deg=30), fist('both'))},
    ])

    # =========================================================
    # 2. FOOTWORK & STEPS (Suri-Ashi)
    # Rear foot drive -> level horizontal hip glide -> crescent arc -> solid plant
    # =========================================================
    for name in ['step_forward', 'step_forward_right', 'step']:
        reg(name, 1.2, [
            {'t': 0.0, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('left'), p_punch('right', 0.5))},
            # Drive & gather (crescent passing center)
            {'t': 0.35, 'pose': lambda: (
                set_h(0.0, -0.12, -0.15, rx_deg=2, ry_deg=10, rz_deg=0),
                set_b('UpperLeg.L', x_deg=-30, y_deg=-4, z_deg=-4),
                set_b('LowerLeg.L', x_deg=45, y_deg=0, z_deg=0),
                set_b('Foot.L', x_deg=-15, y_deg=0, z_deg=0),
                set_b('UpperLeg.R', x_deg=-15, y_deg=4, z_deg=2),
                set_b('LowerLeg.R', x_deg=35, y_deg=0, z_deg=0),
                set_b('Foot.R', x_deg=-10, y_deg=0, z_deg=0),
                p_hikite('both')
            )},
            # Forward landing & Kime
            {'t': 0.75, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_punch('right', 0.9))},
            {'t': 1.00, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_punch('right', 0.9))},
            {'t': 1.20, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_punch('right', 0.7))},
        ])

    reg('step_forward_left', 1.2, [
        {'t': 0.0, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('right'), p_punch('left', 0.5))},
        {'t': 0.35, 'pose': lambda: (
            set_h(0.0, -0.12, -0.15, rx_deg=2, ry_deg=-10, rz_deg=0),
            set_b('UpperLeg.R', x_deg=-30, y_deg=4, z_deg=4),
            set_b('LowerLeg.R', x_deg=45, y_deg=0, z_deg=0),
            set_b('Foot.R', x_deg=-15, y_deg=0, z_deg=0),
            set_b('UpperLeg.L', x_deg=-15, y_deg=-4, z_deg=-2),
            set_b('LowerLeg.L', x_deg=35, y_deg=0, z_deg=0),
            set_b('Foot.L', x_deg=-10, y_deg=0, z_deg=0),
            p_hikite('both')
        )},
        {'t': 0.75, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('right'), p_punch('left', 0.9))},
        {'t': 1.00, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('right'), p_punch('left', 0.9))},
        {'t': 1.20, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('right'), p_punch('left', 0.7))},
    ])

    for name in ['step_backward', 'step_backward_left']:
        reg(name, 1.2, [
            {'t': 0.0, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('right'), p_punch('left', 0.7))},
            {'t': 0.40, 'pose': lambda: (
                set_h(0.0, 0.05, -0.15, rx_deg=2, ry_deg=10, rz_deg=0),
                set_b('UpperLeg.R', x_deg=-35, y_deg=6, z_deg=6),
                set_b('LowerLeg.R', x_deg=55, y_deg=0, z_deg=0),
                set_b('Foot.R', x_deg=-18, y_deg=0, z_deg=0),
                set_b('UpperLeg.L', x_deg=-10, y_deg=-4, z_deg=-2),
                set_b('LowerLeg.L', x_deg=30, y_deg=0, z_deg=0),
                set_b('Foot.L', x_deg=-10, y_deg=0, z_deg=0),
                p_hikite('both')
            )},
            {'t': 0.80, 'pose': lambda: (p_zenkutsu('right', True, 0.0), p_hikite('left'), p_punch('right', 0.6))},
            {'t': 1.20, 'pose': lambda: (p_zenkutsu('right', True, 0.0), p_hikite('left'), p_punch('right', 0.6))},
        ])

    reg('step_backward_right', 1.2, [
        {'t': 0.0, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_punch('right', 0.7))},
        {'t': 0.40, 'pose': lambda: (
            set_h(0.0, 0.05, -0.15, rx_deg=2, ry_deg=-10, rz_deg=0),
            set_b('UpperLeg.L', x_deg=-35, y_deg=-6, z_deg=-6),
            set_b('LowerLeg.L', x_deg=55, y_deg=0, z_deg=0),
            set_b('Foot.L', x_deg=-18, y_deg=0, z_deg=0),
            set_b('UpperLeg.R', x_deg=-10, y_deg=4, z_deg=2),
            set_b('LowerLeg.R', x_deg=30, y_deg=0, z_deg=0),
            set_b('Foot.R', x_deg=-10, y_deg=0, z_deg=0),
            p_hikite('both')
        )},
        {'t': 0.80, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_punch('left', 0.6))},
        {'t': 1.20, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_punch('left', 0.6))},
    ])

    # Tsugi-ashi (Gliding shuffle step)
    reg('slide_forward', 1.0, [
        {'t': 0.0, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_punch('left', 0.5))},
        {'t': 0.35, 'pose': lambda: (set_h(0, -0.08, -0.16), p_zenkutsu('left', True, 0.0), p_hikite('right'), p_punch('left', 0.7))},
        {'t': 0.70, 'pose': lambda: (set_h(0, -0.16, -0.15), p_zenkutsu('left', True, 0.0), p_hikite('right'), p_punch('left', 0.9))},
        {'t': 1.00, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_punch('left', 0.5))},
    ])

    reg('slide_backward', 1.0, [
        {'t': 0.0, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_punch('left', 0.5))},
        {'t': 0.35, 'pose': lambda: (set_h(0, 0.06, -0.16), p_zenkutsu('left', True, 0.0), p_hikite('right'), p_punch('left', 0.5))},
        {'t': 0.70, 'pose': lambda: (set_h(0, 0.12, -0.15), p_zenkutsu('left', True, 0.0), p_hikite('right'), p_punch('left', 0.5))},
        {'t': 1.00, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_punch('left', 0.5))},
    ])

    # Weight shifting actions
    for name in ['shift_weight_forward', 'stance_shift_forward']:
        reg(name, 1.0, [
            {'t': 0.0, 'pose': lambda: p_zenkutsu('left', False, 0.0)},
            {'t': 0.5, 'pose': lambda: (set_h(0, -0.04, -0.15), p_zenkutsu('left', False, 0.0))},
            {'t': 1.0, 'pose': lambda: p_zenkutsu('left', False, 0.0)},
        ])

    for name in ['shift_weight_backward', 'stance_shift_backward']:
        reg(name, 1.0, [
            {'t': 0.0, 'pose': lambda: p_zenkutsu('left', False, 0.0)},
            {'t': 0.5, 'pose': lambda: (set_h(0, 0.06, -0.15), p_zenkutsu('left', True, 0.0))},
            {'t': 1.0, 'pose': lambda: p_zenkutsu('left', False, 0.0)},
        ])

    for name in ['shift_weight_left', 'stance_shift_left']:
        reg(name, 1.0, [
            {'t': 0.0, 'pose': lambda: p_yoi(0.0)},
            {'t': 0.5, 'pose': lambda: (set_h(-0.06, 0, 0, rz_deg=-3), p_yoi(0.0))},
            {'t': 1.0, 'pose': lambda: p_yoi(0.0)},
        ])

    for name in ['shift_weight_right', 'stance_shift_right']:
        reg(name, 1.0, [
            {'t': 0.0, 'pose': lambda: p_yoi(0.0)},
            {'t': 0.5, 'pose': lambda: (set_h(0.06, 0, 0, rz_deg=3), p_yoi(0.0))},
            {'t': 1.0, 'pose': lambda: p_yoi(0.0)},
        ])

    # Stance Transitions (Enter / Exit)
    reg('enter_zenkutsu_left', 1.0, [
        {'t': 0.0, 'pose': lambda: p_yoi(0.0)},
        {'t': 0.4, 'pose': lambda: (set_h(0, -0.04, -0.08), p_yoi(0.0))},
        {'t': 0.75, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('right'), p_punch('left', 0.8))},
        {'t': 1.0, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('right'), p_punch('left', 0.8))},
    ])

    reg('exit_zenkutsu_left', 1.0, [
        {'t': 0.0, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('right'), p_punch('left', 0.8))},
        {'t': 0.4, 'pose': lambda: (set_h(0, -0.04, -0.08), p_yoi(0.0))},
        {'t': 1.0, 'pose': lambda: p_yoi(0.0)},
    ])

    reg('enter_zenkutsu_right', 1.0, [
        {'t': 0.0, 'pose': lambda: p_yoi(0.0)},
        {'t': 0.4, 'pose': lambda: (set_h(0, -0.04, -0.08), p_yoi(0.0))},
        {'t': 0.75, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_punch('right', 0.8))},
        {'t': 1.0, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_punch('right', 0.8))},
    ])

    reg('exit_zenkutsu_right', 1.0, [
        {'t': 0.0, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_punch('right', 0.8))},
        {'t': 0.4, 'pose': lambda: (set_h(0, -0.04, -0.08), p_yoi(0.0))},
        {'t': 1.0, 'pose': lambda: p_yoi(0.0)},
    ])

    reg('enter_kokutsu_left', 1.0, [
        {'t': 0.0, 'pose': lambda: p_yoi(0.0)},
        {'t': 0.4, 'pose': lambda: (set_h(0, 0.05, -0.08), p_yoi(0.0))},
        {'t': 1.0, 'pose': lambda: p_kokutsu('left', 0.0)},
    ])

    reg('exit_kokutsu_left', 1.0, [
        {'t': 0.0, 'pose': lambda: p_kokutsu('left', 0.0)},
        {'t': 0.4, 'pose': lambda: (set_h(0, 0.05, -0.08), p_yoi(0.0))},
        {'t': 1.0, 'pose': lambda: p_yoi(0.0)},
    ])

    reg('enter_kokutsu_right', 1.0, [
        {'t': 0.0, 'pose': lambda: p_yoi(0.0)},
        {'t': 0.4, 'pose': lambda: (set_h(0, 0.05, -0.08), p_yoi(0.0))},
        {'t': 1.0, 'pose': lambda: p_kokutsu('right', 0.0)},
    ])

    reg('exit_kokutsu_right', 1.0, [
        {'t': 0.0, 'pose': lambda: p_kokutsu('right', 0.0)},
        {'t': 0.4, 'pose': lambda: (set_h(0, 0.05, -0.08), p_yoi(0.0))},
        {'t': 1.0, 'pose': lambda: p_yoi(0.0)},
    ])

    reg('enter_heiko_dachi', 1.0, [
        {'t': 0.0, 'pose': lambda: p_zenkutsu('left', False, 0.0)},
        {'t': 1.0, 'pose': lambda: p_yoi(0.0)},
    ])

    reg('exit_heiko_dachi', 1.0, [
        {'t': 0.0, 'pose': lambda: p_yoi(0.0)},
        {'t': 1.0, 'pose': lambda: p_zenkutsu('left', False, 0.0)},
    ])

    # =========================================================
    # 3. KOSHI PIVOTS & TURNS
    # Metsuke -> Weight transfer -> Pivot -> Foot reposition -> Pelvis -> Torso -> Kime
    # =========================================================
    for name in ['pivot_left', 'front_leg_pivot']:
        reg(name, 1.0, [
            {'t': 0.0, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('right'), p_punch('left', 0.7))},
            # Metsuke + Pelvic Koshi rotation to Hanmi
            {'t': 0.35, 'pose': lambda: (
                set_b('Neck', x_deg=0, y_deg=15, z_deg=0),
                set_h(0.02, -0.06, -0.15, rx_deg=3, ry_deg=45, z_deg=0),
                p_zenkutsu('left', True, 0.0),
                p_hikite('right'),
                p_punch('left', 0.5)
            )},
            # Snap to Shomen with Kime
            {'t': 0.70, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('right'), p_punch('left', 1.0))},
            {'t': 1.00, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('right'), p_punch('left', 0.8))},
        ])

    for name in ['pivot_right', 'rear_leg_pivot']:
        reg(name, 1.0, [
            {'t': 0.0, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_punch('right', 0.7))},
            {'t': 0.35, 'pose': lambda: (
                set_b('Neck', x_deg=0, y_deg=-15, z_deg=0),
                set_h(-0.02, -0.06, -0.15, rx_deg=3, ry_deg=-45, z_deg=0),
                p_zenkutsu('right', True, 0.0),
                p_hikite('left'),
                p_punch('right', 0.5)
            )},
            {'t': 0.70, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_punch('right', 1.0))},
            {'t': 1.00, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_punch('right', 0.8))},
        ])

    for name in ['turn_left', 'turn_into_zenkutsu_left', 'body_alignment_left', 'hip_rotation_left']:
        reg(name, 1.2, [
            {'t': 0.0, 'pose': lambda: p_zenkutsu('right', False, 0.0)},
            # Metsuke left first
            {'t': 0.25, 'pose': lambda: (
                set_b('Neck', x_deg=0, y_deg=45, z_deg=0),
                set_b('Head', x_deg=0, y_deg=15, z_deg=0),
                set_h(0.0, -0.04, -0.12, rx_deg=2, ry_deg=25, z_deg=0),
                p_hikite('both')
            )},
            # Pivot and landing in left Zenkutsu
            {'t': 0.70, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_punch('left', 0.8))},
            {'t': 0.95, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_punch('left', 0.8))},
            {'t': 1.20, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_punch('left', 0.6))},
        ])

    for name in ['turn_right', 'turn_into_zenkutsu_right', 'body_alignment_right', 'hip_rotation_right']:
        reg(name, 1.2, [
            {'t': 0.0, 'pose': lambda: p_zenkutsu('left', False, 0.0)},
            {'t': 0.25, 'pose': lambda: (
                set_b('Neck', x_deg=0, y_deg=-45, z_deg=0),
                set_b('Head', x_deg=0, y_deg=-15, z_deg=0),
                set_h(0.0, -0.04, -0.12, rx_deg=2, ry_deg=-25, z_deg=0),
                p_hikite('both')
            )},
            {'t': 0.70, 'pose': lambda: (p_zenkutsu('right', True, 0.0), p_hikite('left'), p_punch('right', 0.8))},
            {'t': 0.95, 'pose': lambda: (p_zenkutsu('right', True, 0.0), p_hikite('left'), p_punch('right', 0.8))},
            {'t': 1.20, 'pose': lambda: (p_zenkutsu('right', True, 0.0), p_hikite('left'), p_punch('right', 0.6))},
        ])

    for name in ['turn_with_step_left', 'turn_and_step']:
        reg(name, 1.4, [
            {'t': 0.0, 'pose': lambda: p_zenkutsu('right', False, 0.0)},
            # Head turns, rear foot gathers inward
            {'t': 0.35, 'pose': lambda: (
                set_b('Neck', x_deg=0, y_deg=60, z_deg=0),
                set_h(0, -0.08, -0.13, rx_deg=2, ry_deg=45, z_deg=0),
                set_b('UpperLeg.L', x_deg=-25, y_deg=-4, z_deg=-4),
                set_b('LowerLeg.L', x_deg=40, y_deg=0, z_deg=0),
                p_hikite('both')
            )},
            # 180° / 90° pivot settle
            {'t': 0.85, 'pose': lambda: (p_zenkutsu('left', True, 0.0), p_hikite('right'), p_punch('left', 0.8))},
            {'t': 1.40, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('right'), p_punch('left', 0.6))},
        ])

    reg('turn_with_step_right', 1.4, [
        {'t': 0.0, 'pose': lambda: p_zenkutsu('left', False, 0.0)},
        {'t': 0.35, 'pose': lambda: (
            set_b('Neck', x_deg=0, y_deg=-60, z_deg=0),
            set_h(0, -0.08, -0.13, rx_deg=2, ry_deg=-45, z_deg=0),
            set_b('UpperLeg.R', x_deg=-25, y_deg=4, z_deg=4),
            set_b('LowerLeg.R', x_deg=40, y_deg=0, z_deg=0),
            p_hikite('both')
        )},
        {'t': 0.85, 'pose': lambda: (p_zenkutsu('right', True, 0.0), p_hikite('left'), p_punch('right', 0.8))},
        {'t': 1.40, 'pose': lambda: (p_zenkutsu('right', False, 0.0), p_hikite('left'), p_punch('right', 0.6))},
    ])

    for name in ['turn_into_kokutsu_left', 'turn_and_enter_kokutsu']:
        reg(name, 1.2, [
            {'t': 0.0, 'pose': lambda: p_zenkutsu('right', False, 0.0)},
            {'t': 0.4, 'pose': lambda: (set_h(0, 0.05, -0.14, ry_deg=-30), p_yoi(0.0))},
            {'t': 0.8, 'pose': lambda: p_kokutsu('left', 0.0)},
            {'t': 1.2, 'pose': lambda: p_kokutsu('left', 0.0)},
        ])

    reg('turn_into_kokutsu_right', 1.2, [
        {'t': 0.0, 'pose': lambda: p_zenkutsu('left', False, 0.0)},
        {'t': 0.4, 'pose': lambda: (set_h(0, 0.05, -0.14, ry_deg=30), p_yoi(0.0))},
        {'t': 0.8, 'pose': lambda: p_kokutsu('right', 0.0)},
        {'t': 1.2, 'pose': lambda: p_kokutsu('right', 0.0)},
    ])

    for name in ['turn_and_enter_zenkutsu', 'turn_and_recover', 'body_alignment_forward']:
        reg(name, 1.2, [
            {'t': 0.0, 'pose': lambda: p_zenkutsu('right', True, 0.0)},
            {'t': 0.5, 'pose': lambda: (set_h(0, -0.04, -0.10), p_yoi(0.0))},
            {'t': 0.9, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('right'), p_punch('left', 0.8))},
            {'t': 1.2, 'pose': lambda: (p_zenkutsu('left', False, 0.0), p_hikite('right'), p_punch('left', 0.6))},
        ])
