import { NextRequest, NextResponse } from 'next/server';
import { Message } from '@/types';

// 使用直接 HTTP 请求的方式调用第三方 Gemini API
// 适用于不完全兼容 @google/genai SDK 的第三方服务

const CHAT_SYSTEM_INSTRUCTION = `
You are an expert Medical Triage Nurse AI, communicating in Simplified Chinese (简体中文).
Your goal is to interview the patient to understand their "Chief Complaint" (主诉).

CRITICAL RULES:
1. ASK FEW QUESTIONS: Patients are impatient. Ask only 3-5 high-impact questions total to determine severity and key symptoms.
2. BE CONCISE: Questions must be short (under 20 words).
3. GENERATE OPTIONS: You MUST provide a list of 4-6 predefined short options (answers) in Chinese.
   - If inquiring about specific pain/location, use Single Choice.
   - If inquiring about associated symptoms (e.g., "Do you also have...?"), use Multiple Choice.
   - Always include "其他" (Other) or "无" (None).

Tone: Professional, empathetic, efficient.

You must respond in JSON format with this structure:
{
  "question": "your question in Chinese",
  "options": ["option1", "option2", "option3", "option4"],
  "allowMultiple": true or false
}
`;

export async function POST(request: NextRequest) {
  try {
    const { history, message } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key not configured' },
        { status: 500 }
      );
    }

    // 构建对话内容
    const messages = [
      {
        role: 'user',
        parts: [{ text: CHAT_SYSTEM_INSTRUCTION }]
      },
      ...history.map((msg: Message) => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      })),
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ];

    console.log('🔧 Direct API call:', {
      baseUrl,
      apiKeyPrefix: apiKey.substring(0, 15) + '...',
      messagesCount: messages.length
    });

    // 直接调用 REST API
    const apiUrl = `${baseUrl}/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: messages,
        generationConfig: {
          temperature: 0.5,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ API Response received');

    // 解析响应
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('No text in response');
    }

    const parsed = JSON.parse(text);
    return NextResponse.json({
      text: parsed.question,
      options: parsed.options || [],
      allowMultiple: parsed.allowMultiple || false
    });

  } catch (error) {
    console.error("❌ Error in direct API chat:", error);
    
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message
      });
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `系统错误：${errorMessage}` },
      { status: 500 }
    );
  }
}
