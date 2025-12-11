// 测试第三方 Gemini API 连接
// 运行: node test-api.js

const API_KEY = process.env.GEMINI_API_KEY || 'your-api-key-here';

// 测试不同的 URL 格式
const testUrls = [
  'https://api.cursorai.art',
  'https://api.cursorai.art/v1beta',
  'https://generativelanguage.googleapis.com' // Google 官方
];

async function testApi(baseUrl) {
  console.log(`\n🧪 Testing: ${baseUrl}`);
  console.log('─'.repeat(60));
  
  try {
    // 尝试列出模型（简单的测试请求）
    const url = `${baseUrl}/v1beta/models?key=${API_KEY}`;
    console.log(`📡 Request URL: ${url.replace(API_KEY, 'API_KEY_HIDDEN')}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS! API is reachable');
      console.log(`📦 Models found: ${data.models?.length || 0}`);
      if (data.models && data.models.length > 0) {
        console.log(`   First model: ${data.models[0].name}`);
      }
      return true;
    } else {
      const errorText = await response.text();
      console.log('❌ FAILED');
      console.log(`   Error: ${errorText.substring(0, 200)}`);
      return false;
    }
  } catch (error) {
    console.log('❌ CONNECTION FAILED');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting API Connection Tests');
  console.log('='.repeat(60));
  
  for (const url of testUrls) {
    await testApi(url);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ Tests completed!');
}

runTests();
