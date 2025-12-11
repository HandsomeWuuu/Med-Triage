import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Message } from '@/types';

// System instruction for the chat interaction
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
`;

// Schema for the chat response with options
const CHAT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    question: { 
      type: Type.STRING, 
      description: "The follow-up question to the patient in Chinese." 
    },
    options: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "A list of 4-6 short, likely answers in Chinese for the user to click."
    },
    allowMultiple: { 
      type: Type.BOOLEAN,
      description: "True if the user can select multiple options, False for single choice."
    }
  },
  required: ["question", "options", "allowMultiple"]
};

export async function POST(request: NextRequest) {
  console.log('🚀 Chat API called');
  
  try {
    const { history, message } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';

    // 详细的环境检查
    console.log('📋 Environment:', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      baseUrl,
      isVercel: !!process.env.VERCEL,
      vercelEnv: process.env.VERCEL_ENV,
    });

    if (!apiKey) {
      console.error('❌ ERROR: GEMINI_API_KEY not found');
      return NextResponse.json(
        { error: 'API Key not configured. Check Vercel environment variables.' },
        { status: 500 }
      );
    }

    console.log('🔧 Using direct HTTP API:', {
      baseUrl,
      apiKeyPrefix: apiKey.substring(0, 15) + '...',
    });

    // 构建消息（添加系统指令作为第一条消息）
    const messages = [
      {
        role: 'user',
        parts: [{ text: CHAT_SYSTEM_INSTRUCTION + '\n\nYou MUST respond in valid JSON format.' }]
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

    // 使用直接 HTTP 请求调用 API
    const apiUrl = `${baseUrl}/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    console.log('📤 Sending request...');
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
      console.error('❌ API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 500)
      });
      throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();
    console.log('✅ Received response from API');

    // 解析响应
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('No text in response');
    }

    const parsed = JSON.parse(text);
    console.log('📊 Parsed response:', JSON.stringify(parsed, null, 2));
    
    // 处理 options：如果是对象数组，提取文本字段
    let options = parsed.options || [];
    if (options.length > 0 && typeof options[0] === 'object') {
      // 对象格式：{value, text} 或 {key, value}
      options = options.map((opt: any) => opt.text || opt.value || String(opt));
    }
    
    return NextResponse.json({
      text: parsed.question,
      options: options,
      allowMultiple: parsed.allowMultiple || parsed.question_type === 'multiple_choice' || false
    });

  } catch (error) {
    console.error("❌ FATAL ERROR in chat:", error);
    
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { 
        error: `系统错误：${errorMessage}`,
        hint: 'Check Vercel function logs for details'
      },
      { status: 500 }
    );
  }
}
