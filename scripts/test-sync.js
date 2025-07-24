const https = require('https');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function testSync() {
  console.log('🧪 Testing BoxHero sync API...');
  
  const postData = JSON.stringify({
    action: 'full-sync',
    dryRun: true, // Start with dry run
    updateExisting: true,
    addNew: true,
    syncStock: true
  });
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/boxhero-sync',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  try {
    const response = await makeRequest(options, postData);
    console.log('📊 Response status:', response.statusCode);
    console.log('📄 Response data:', response.data);
    
    if (response.statusCode === 200) {
      console.log('✅ Sync API test successful!');
    } else {
      console.log('❌ Sync API test failed with status:', response.statusCode);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testSync();
