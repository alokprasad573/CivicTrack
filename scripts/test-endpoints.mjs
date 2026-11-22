async function testAll() {
  const tests = [
    { name: 'Health check', url: 'http://127.0.0.1:4000/health', expectedStatus: [200] },
    { name: 'API v1 Health check', url: 'http://127.0.0.1:4000/api/v1/health', expectedStatus: [200] },
    { name: 'Readiness probe', url: 'http://127.0.0.1:4000/ready', expectedStatus: [200, 503] },
    { name: 'OpenAPI Spec', url: 'http://127.0.0.1:4000/api/v1/docs/openapi.json', expectedStatus: [200] },
    { name: 'Swagger UI Docs', url: 'http://127.0.0.1:4000/docs/', expectedStatus: [200] },
    { name: 'Nearby complaints (standard query)', url: 'http://127.0.0.1:4000/api/v1/complaints/nearby?lat=12.9716&lng=77.5946&radius=10000', expectedStatus: [200] },
    { name: 'Nearby complaints (geo alias query)', url: 'http://127.0.0.1:4000/api/v1/complaints/nearby?latitude=12.9716&longitude=77.5946&radiusMeters=5000', expectedStatus: [200] },
    { name: 'Notifications (auth guarded)', url: 'http://127.0.0.1:4000/api/v1/notifications', expectedStatus: [401] },
    { name: 'Users /me (auth guarded)', url: 'http://127.0.0.1:4000/api/v1/users/me', expectedStatus: [401] },
    { name: 'Complaints list (auth guarded)', url: 'http://127.0.0.1:4000/api/v1/complaints', expectedStatus: [401] },
    { name: 'Storage upload-intent (POST, auth guarded)', url: 'http://127.0.0.1:4000/api/v1/storage/upload-intent', method: 'POST', expectedStatus: [401] },
  ];

  console.log('Validating all CivicTrack API endpoints on port 4000...\n');
  let allPassed = true;

  for (const t of tests) {
    try {
      const res = await fetch(t.url, {
        method: t.method || 'GET',
        headers: { 'X-Forwarded-For': '127.0.0.1' },
      });
      const pass = t.expectedStatus.includes(res.status);
      console.log(`[${pass ? 'PASS' : 'FAIL'}] ${t.name} -> HTTP ${res.status} (expected ${t.expectedStatus.join('/')})`);
      if (!pass) allPassed = false;
    } catch (err) {
      console.error(`[ERROR] ${t.name} failed: ${err.message}`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('\n>>> ALL CIVICTRACK BACKEND ENDPOINTS ARE VERIFIED AND WORKING PROPERLY! <<<');
  } else {
    process.exit(1);
  }
}
testAll();
