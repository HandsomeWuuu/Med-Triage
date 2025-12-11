import { NextRequest, NextResponse } from 'next/server';

/**
 * API 连接测试端点
 * 测试能否连接到第三方 Gemini API
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';

  console.log('🧪 Test API called');
  console.log('Environment:', {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length,
    baseUrl,
    isVercel: !!process.env.VERCEL
  });

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'GEMINI_API_KEY not configured',
      hint: 'Please add GEMINI_API_KEY in Vercel environment variables'
    }, { status: 500 });
  }

  try {
    // 简单的列表模型测试
    const testUrl = `${baseUrl}/v1beta/models?key=${apiKey}`;
    
    console.log('📤 Testing connection to:', baseUrl);
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ API test failed:', data);
      return NextResponse.json({
        success: false,
        status: response.status,
        error: data.error?.message || 'Unknown error',
        fullError: data
      }, { status: response.status });
    }

    console.log('✅ API test successful');
    
    return NextResponse.json({
      success: true,
      status: response.status,
      modelsCount: data.models?.length || 0,
      firstModel: data.models?.[0]?.name || 'N/A',
      message: 'API connection successful!'
    });

  } catch (error) {
    console.error('❌ Test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.name : 'Error'
    }, { status: 500 });
  }
}
