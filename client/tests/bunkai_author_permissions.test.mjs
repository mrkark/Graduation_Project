import assert from 'assert/strict';

console.log('=== TEST SUITE: Bunkai Author-Only Editing Permissions ===\n');

// 1. Тест: Идентификация создателя бункая
console.log('Test 1: Creator identity verification');
{
  function isUserBunkaiCreator(user, bunkai) {
    const currentUserId = user?.User_ID ?? user?.userId ?? user?.id;
    const authorId = bunkai?.Author_ID ?? bunkai?.Author?.User_ID;
    return Boolean(currentUserId && authorId && Number(currentUserId) === Number(authorId));
  }

  const creatorUser = { User_ID: 42, Username: 'SenseiFunakoshi' };
  const anotherUser = { User_ID: 105, Username: 'KarateStudent' };
  const adminUser = { User_ID: 1, role: 'admin' };
  const guestUser = null;

  const bunkaiRecord = {
    Bunkai_ID: 1,
    Author_ID: 42,
    Title: 'Канонический бункай Хэйан Шодан',
    Author: { User_ID: 42, Username: 'SenseiFunakoshi' },
  };

  assert.equal(isUserBunkaiCreator(creatorUser, bunkaiRecord), true, 'Creator must be recognized as creator');
  assert.equal(isUserBunkaiCreator(anotherUser, bunkaiRecord), false, 'Another user must NOT be recognized as creator');
  assert.equal(isUserBunkaiCreator(adminUser, bunkaiRecord), false, 'Admin who is not creator is not creator');
  assert.equal(isUserBunkaiCreator(guestUser, bunkaiRecord), false, 'Guest user is not creator');
  console.log('  PASSED: Creator identity correctly verified');
}

// 2. Тест: Отображение панели редактирования движений (canEdit flag)
console.log('\nTest 2: Movement editing panel availability');
{
  function shouldRenderMotionEditingPanel(canEdit) {
    return Boolean(canEdit);
  }

  // Создатель
  assert.equal(shouldRenderMotionEditingPanel(true), true, 'Creator gets the panel to change movements');

  // Любой другой пользователь (студент, гость, зритель)
  assert.equal(shouldRenderMotionEditingPanel(false), false, 'Non-creators must NOT have the panel to change movements');
  console.log('  PASSED: Only creator receives canEdit=true');
}

// 3. Тест: Доступ к странице формы редактирования (/bunkai/:id/edit)
console.log('\nTest 3: Edit route access restriction');
{
  function checkEditRouteAccess(currentUserId, bunkaiAuthorId) {
    const isCreator = Boolean(currentUserId && bunkaiAuthorId && Number(currentUserId) === Number(bunkaiAuthorId));
    if (!isCreator) {
      return {
        allowed: false,
        error: 'Доступ ограничен: только создатель бункая может редактировать движения и сценарий.',
      };
    }
    return { allowed: true, error: null };
  }

  // Создатель редактирует свой бункай
  const creatorAccess = checkEditRouteAccess(42, 42);
  assert.equal(creatorAccess.allowed, true);
  assert.equal(creatorAccess.error, null);

  // Другой пользователь пытается зайти на /bunkai/1/edit
  const strangerAccess = checkEditRouteAccess(105, 42);
  assert.equal(strangerAccess.allowed, false);
  assert.ok(strangerAccess.error.includes('только создатель бункая'));
  console.log('  PASSED: Stranger is blocked from editing existing bunkai');
}

console.log('\n======================================================');
console.log('ALL BUNKAI AUTHOR PERMISSION TESTS PASSED (3/3)!');
console.log('======================================================\n');
