require('dotenv').config();
const path = require('path');
const { pathToFileURL } = require('url');
const { poolPromise, sql } = require('../src/config/database');

async function seedBunkaiHeianShodan() {
  try {
    const engineUrl = pathToFileURL(
      path.resolve(__dirname, '../../client/src/three/bunkaiScenarioEngine.js')
    ).href;
    const { HEIAN_SHODAN_BUNKAI_18_STEPS } = await import(engineUrl);

    const pool = await poolPromise;
    console.log('Подключение к БД успешно.');

    // 1. Находим Ката Хэйан Шодан
    const kataRes = await pool.request().query(`
      SELECT Kata_ID, Title FROM dbo.Kata
      WHERE Title LIKE N'%Хэйан Шодан%' OR Title LIKE N'%Хейан Шодан%' OR Title LIKE N'%Heian Shodan%'
    `);

    if (!kataRes.recordset || kataRes.recordset.length === 0) {
      console.warn('Ката Хэйан Шодан не найдено в БД, пропускаем сид БД.');
      return;
    }

    const kataId = kataRes.recordset[0].Kata_ID;
    console.log(`Найдено ката: #${kataId} ${kataRes.recordset[0].Title}`);

    // 2. Находим все официальные/постановочные записи Бункая для Хэйан Шодан и обновляем их
    const bunkaiRes = await pool.request().input('kId', kataId).query(`
      SELECT Bunkai_ID, Title FROM dbo.Bunkai
      WHERE Kata_ID = @kId AND (
        Bunkai_ID = 1
        OR Title LIKE N'%Канонический Бункай: Хэйан Шодан%'
        OR Title LIKE N'%по постановке%'
      )
      ORDER BY Bunkai_ID ASC
    `);

    const stepCount = HEIAN_SHODAN_BUNKAI_18_STEPS.length;
    const bunkaiTitle = `Канонический Бункай: Хэйан Шодан (${stepCount} шага)`;
    const bunkaiDesc =
      'Официальный пошаговый бункай ката Хэйан Шодан по эталонному плану: 1 — Тори (синий, атакующий), 2 — Укэ (белый, защищающийся). Полный цикл от ритуального поклона Рэй, ухода Тай-сабаки 35°, болевого приёма Ваки-гатамэ и подсечки Аши-барай в партер до подъёма Окиагари и завершающего поклона.';

    const targetBunkaiIds = [];
    if (bunkaiRes.recordset && bunkaiRes.recordset.length > 0) {
      for (const row of bunkaiRes.recordset) {
        const bId = row.Bunkai_ID;
        const nextTitle = row.Title && row.Title.includes('по постановке')
          ? `Бункай Хэйан Шодан по постановке (${stepCount} шага)`
          : bunkaiTitle;
        await pool
          .request()
          .input('bId', bId)
          .input('title', sql.NVarChar(200), nextTitle)
          .input('desc', sql.NVarChar(sql.MAX), bunkaiDesc)
          .query(`
            UPDATE dbo.Bunkai
            SET Title = @title,
                Description = @desc,
                Status = N'approved'
            WHERE Bunkai_ID = @bId
          `);
        targetBunkaiIds.push(bId);
        console.log(`Обновлена запись Bunkai #${bId} (${nextTitle})`);
      }
    } else {
      const insRes = await pool
        .request()
        .input('kId', kataId)
        .input('title', sql.NVarChar(200), bunkaiTitle)
        .input('desc', sql.NVarChar(sql.MAX), bunkaiDesc)
        .query(`
          INSERT INTO dbo.Bunkai (Author_ID, Kata_ID, Title, Description, Application, Difficulty, Status)
          VALUES (1, @kId, @title, @desc,
            N'Парное боевое применение ключевых связок ката Хэйан Шодан на реальной дистанции.',
            N'beginner', N'approved');
          SELECT SCOPE_IDENTITY() AS NewId;
        `);
      targetBunkaiIds.push(insRes.recordset[0].NewId);
      console.log(`Создана запись Bunkai #${targetBunkaiIds[0]}`);
    }

    // 3. Гарантируем наличие всех используемых клипов в dbo.AnimationClips
    const clipsMap = new Map();
    const allClipsRes = await pool.request().query('SELECT Clip_ID, Clip_Name FROM dbo.AnimationClips');
    allClipsRes.recordset.forEach((c) => clipsMap.set(c.Clip_Name, c.Clip_ID));

    for (const step of HEIAN_SHODAN_BUNKAI_18_STEPS) {
      for (const p of step.participants) {
        const cn = p.clipName;
        if (cn && !clipsMap.has(cn)) {
          const cat = cn.includes('dachi') || cn.includes('stance') || cn.includes('shizentai')
            ? 'stance'
            : cn.includes('uke') || cn.includes('barai')
            ? 'block'
            : cn.includes('geri') || cn.includes('kick')
            ? 'kick'
            : 'punch';
          const ins = await pool
            .request()
            .input('cn', sql.NVarChar(100), cn)
            .input('dn', sql.NVarChar(200), cn)
            .input('cat', sql.NVarChar(50), cat)
            .query(`
              IF NOT EXISTS (SELECT 1 FROM dbo.AnimationClips WHERE Clip_Name = @cn)
                INSERT INTO dbo.AnimationClips (Clip_Name, Display_Name, Category, Duration, Stance_In, Stance_Out, Interaction_Type, Optimal_Distance)
                VALUES (@cn, @dn, @cat, 1.5, N'zenkutsu_dachi_left', N'zenkutsu_dachi_left', N'body_contact', 1.2);
              SELECT Clip_ID FROM dbo.AnimationClips WHERE Clip_Name = @cn;
            `);
          if (ins.recordset?.[0]?.Clip_ID) {
            clipsMap.set(cn, ins.recordset[0].Clip_ID);
          }
        }
      }
    }

    for (const bunkaiId of targetBunkaiIds) {
      // 4. Очищаем старые шаги для этого бункая
      await pool.request().input('bId', bunkaiId).query(`
        DELETE FROM dbo.BunkaiStepParticipants
        WHERE Step_ID IN (SELECT Step_ID FROM dbo.BunkaiSteps WHERE Bunkai_ID = @bId);
        DELETE FROM dbo.BunkaiSteps WHERE Bunkai_ID = @bId;
      `);

      // 5. Вставляем все 34 шага, участников и Metadata_Json
      for (const step of HEIAN_SHODAN_BUNKAI_18_STEPS) {
        const metadata = {
          notes: step.notes,
          contactType: step.contactType,
          interactionType: step.interactionType,
          tContact: step.tContact,
          isGround: Boolean(step.isGround),
          isRising: Boolean(step.isRising),
          isBow: Boolean(step.isBow),
          backToOpponent: Boolean(step.backToOpponent),
          preserveScenarioYaw: Boolean(step.preserveScenarioYaw),
          toriTurnDir: step.toriTurnDir || 0,
          ukeTurnDir: step.ukeTurnDir || 0,
          toriActionType: step.toriActionType || 'stance',
          ukeActionType: step.ukeActionType || 'stance',
          displacementTori: step.displacementTori || [0, 0, 0],
          displacementUke: step.displacementUke || [0, 0, 0],
          toriTrajectory: step.toriTrajectory || null,
          ukeTrajectory: step.ukeTrajectory || null,
          scenarioAngles: step.scenarioAngles || null,
        };

        const sIns = await pool
          .request()
          .input('bId', bunkaiId)
          .input('num', step.stepNumber)
          .input('title', sql.NVarChar(200), step.title)
          .input('desc', sql.NVarChar(sql.MAX), step.description)
          .input('dur', step.duration)
          .input('pCount', 2)
          .input('dist', step.optimalDistance)
          .input('angle', step.attackAngleDeg || 0)
          .input('meta', sql.NVarChar(sql.MAX), JSON.stringify(metadata))
          .query(`
            INSERT INTO dbo.BunkaiSteps (Bunkai_ID, Step_Number, Title, Description, Duration, Participant_Count, Target_Distance, Target_Angle, Metadata_Json)
            VALUES (@bId, @num, @title, @desc, @dur, @pCount, @dist, @angle, @meta);
            SELECT SCOPE_IDENTITY() AS Id;
          `);
        const stepId = sIns.recordset[0].Id;

        for (const p of step.participants) {
          if (p.role === 'uke2') continue;
          const cId = clipsMap.get(p.clipName) || null;
          const isTori = p.role === 'tori';
          const traj = isTori ? step.toriTrajectory : step.ukeTrajectory;
          const rotY = isTori
            ? (step.scenarioAngles?.toriAngleDeg ?? (traj?.endYaw !== undefined ? Math.round((traj.endYaw * 180) / Math.PI) : 0))
            : (step.scenarioAngles?.ukeAngleDeg ?? (traj?.endYaw !== undefined ? Math.round((traj.endYaw * 180) / Math.PI) : 180));

          await pool
            .request()
            .input('sId', stepId)
            .input('role', sql.NVarChar(20), p.role)
            .input('cId', cId)
            .input('st', sql.NVarChar(50), p.stance || 'heiko_dachi')
            .input('fst', sql.NVarChar(50), p.finalStance || null)
            .input('lm', sql.NVarChar(20), p.landingMode || 'auto')
            .input('ox', traj?.end?.[0] ?? 0)
            .input('oz', traj?.end?.[2] ?? 0)
            .input('ry', rotY)
            .input('delay', p.delaySeconds || 0)
            .query(`
              INSERT INTO dbo.BunkaiStepParticipants (Step_ID, Role, Clip_ID, Initial_Stance, Final_Stance, Landing_Mode, Offset_X, Offset_Z, Rotation_Y, Delay_Seconds)
              VALUES (@sId, @role, @cId, @st, @fst, @lm, @ox, @oz, @ry, @delay);
            `);
        }
      }

      console.log(`✔ Успешно сохранены все ${stepCount} шагов бункая для Bunkai #${bunkaiId} в БД!`);
    }
  } catch (err) {
    console.warn('База данных недоступна или произошла ошибка:', err.message);
    process.exitCode = 1;
  }
}

seedBunkaiHeianShodan().then(() => process.exit());
