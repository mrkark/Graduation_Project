const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (chunk) => (buf += chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(buf) }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token },
      },
      (res) => {
        let buf = '';
        res.on('data', (chunk) => (buf += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(buf) });
          } catch {
            resolve({ status: res.statusCode, raw: buf });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function verifyAll() {
  const loginRes = await post('/api/auth/login', { username: 'admin', password: 'Admin#12345' });
  const token = loginRes.body?.data?.accessToken;

  let failed = 0;
  for (let i = 1; i <= 26; i++) {
    const res = await get('/api/kata/' + i, token);
    if (res.status === 200 && res.body?.success) {
      console.log(`[✔ 200 OK] Kata #${i}: ${res.body.data.Title}`);
    } else {
      console.error(`[❌ FAIL] Kata #${i}: status=${res.status}`, res.body);
      failed++;
    }
  }

  if (failed === 0) {
    console.log('\n🎉 ВСЕ 26 КАТА УСПЕШНО ЗАГРУЖАЮТСЯ СО СТАТУСОМ 200 OK БЕЗ ОШИБОК!');
    process.exit(0);
  } else {
    console.error(`\nОШИБКА: Обнаружено ${failed} сбойных ката.`);
    process.exit(1);
  }
}

verifyAll().catch((e) => {
  console.error(e);
  process.exit(1);
});
