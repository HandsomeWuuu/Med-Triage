// 测试具体的模型是否可用
const API_KEY = 'sk-bdpN20sgmgTUzx455kBflsKqZTdBfRyvDFgQo8QlLCgeCr3o';
const BASE_URL = 'https://api.cursorai.art';

const modelsToTest = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-001',
  'gemini-1.5-flash',
  'gemini-pro'
];

async function testModel(modelName) {
  console.log(`\n🧪 Testing model: ${modelName}`);
  console.log('─'.repeat(60));
  
  try {
    const url = `${BASE_URL}/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: '你好' }]
        }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 100
        }
      })
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log('✅ SUCCESS!');
      console.log(`📝 Response: ${text?.substring(0, 50)}...`);
      return true;
    } else {
      const errorText = await response.text();
      console.log('❌ FAILED');
      console.log(`   Error: ${errorText.substring(0, 150)}`);
      return false;
    }
  } catch (error) {
    console.log('❌ ERROR');
    console.log(`   ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing Available Gemini Models');
  console.log('='.repeat(60));
  
  for (const model of modelsToTest) {
    await testModel(model);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ Tests completed!');
}

runTests();
