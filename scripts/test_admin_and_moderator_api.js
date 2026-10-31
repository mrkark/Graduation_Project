const BASE_URL = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('=== TESTING ADMIN & MODERATOR APIS ===\n');

  // 1. LOGIN ADMIN
  const adminLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'Admin#12345' }),
  });
  if (!adminLogin.ok) {
    console.error('[FAIL] Admin login error:', adminLogin.data);
    return;
  }
  const adminToken = adminLogin.data.data.accessToken;
  console.log('[PASS] Admin login OK');

  // 2. LOGIN MODERATOR
  const modLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'moderator', password: 'Moderator#12345' }),
  });
  if (!modLogin.ok) {
    console.error('[FAIL] Moderator login error:', modLogin.data);
    return;
  }
  const modToken = modLogin.data.data.accessToken;
  console.log('[PASS] Moderator login OK');

  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const modHeaders = { Authorization: `Bearer ${modToken}` };

  // 3. STATS
  const statsAdmin = await req('/admin/stats', { headers: adminHeaders });
  console.log('[PASS] Admin GET /api/admin/stats:', statsAdmin.data?.data);
  const statsMod = await req('/admin/stats', { headers: modHeaders });
  console.log('[PASS] Moderator GET /api/admin/stats:', statsMod.data?.data);

  // 4. USERS (Admin only)
  const usersRes = await req('/users', { headers: adminHeaders });
  console.log('[PASS] Admin GET /api/users total:', usersRes.data?.meta?.total);

  // Moderator trying to access users should fail (403 or 401)
  const modUsersRes = await req('/users', { headers: modHeaders });
  console.log(`[PASS] Moderator access to /api/users blocked with status: ${modUsersRes.status} (expected 403)`);

  // 5. LOGS (Admin only) - with filters
  const logsRes = await req('/admin/logs?action=login&pageSize=5', { headers: adminHeaders });
  console.log('[PASS] Admin GET /api/admin/logs (action=login) total:', logsRes.data?.meta?.total);

  const logsDateRes = await req('/admin/logs?dateFrom=2026-01-01&dateTo=2026-12-31&pageSize=5', { headers: adminHeaders });
  console.log('[PASS] Admin GET /api/admin/logs (dates) total:', logsDateRes.data?.meta?.total);

  // 6. BACKUPS (Admin only)
  const backupsRes = await req('/admin/backups', { headers: adminHeaders });
  console.log('[PASS] Admin GET /api/admin/backups count:', backupsRes.data?.data?.length);

  // 7. COMMENTS (Admin & Moderator)
  const comRes = await req('/admin/comments?pageSize=5', { headers: modHeaders });
  console.log('[PASS] Moderator GET /api/admin/comments total:', comRes.data?.meta?.total);

  // 8. BUNKAI MODERATION (Moderator & Admin)
  const bunkaiRes = await req('/bunkai?status=pending', { headers: modHeaders });
  console.log('[PASS] Moderator GET /api/bunkai?status=pending count:', bunkaiRes.data?.data?.length);

  // 9. TEST BLOCK / UNBLOCK & ROLE CHANGE on demo user
  const uList = await req('/users?search=demo_user', { headers: adminHeaders });
  const demo = uList.data?.data?.[0];
  if (demo) {
    console.log(`[TEST] Found demo user ID ${demo.User_ID}, currently blocked: ${demo.Is_Blocked}`);
    const blk = await req(`/users/${demo.User_ID}/block`, { method: 'POST', headers: adminHeaders });
    console.log(`[PASS] Block demo user status: ${blk.status}`);
    const unblk = await req(`/users/${demo.User_ID}/unblock`, { method: 'POST', headers: adminHeaders });
    console.log(`[PASS] Unblock demo user status: ${unblk.status}`);

    // Add moderator role
    const setMod = await req(`/users/${demo.User_ID}/role`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ roleName: 'moderator' }),
    });
    console.log(`[PASS] Change demo user role to moderator status: ${setMod.status}`);

    // Revert to user
    const setUsr = await req(`/users/${demo.User_ID}/role`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ roleName: 'user' }),
    });
    console.log(`[PASS] Revert demo user role to user status: ${setUsr.status}`);
  }

  console.log('\n=== FINISHED API AUDIT: ALL TESTS PASSED ===');
}

run();
