import { NextRequest, NextResponse } from 'next/server';

/**
 * 环境变量检查端点
 * 访问: https://your-domain.vercel.app/api/env-check
 * 用于诊断 Vercel 部署时的环境变量问题
 */
export async function GET(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  const baseUrl = process.env.GEMINI_BASE_URL;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
    },
    apiConfig: {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET',
      baseUrl: baseUrl || 'NOT SET (will use default)',
      baseUrlSet: !!baseUrl,
    },
    allEnvKeys: Object.keys(process.env).filter(key => 
      key.includes('GEMINI') || key.includes('VERCEL')
    ),
  });
}
