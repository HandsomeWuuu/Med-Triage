import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Message } from '@/types';

// System instruction for the chat interaction
const CHAT_SYSTEM_INSTRUCTION = `
You are an expert Medical Triage Nurse AI, communicating in Simplified Chinese (简体中文).
Your goal is to interview the patient to understand their "Chief Complaint" (主诉).

CRITICAL RULES:
1. ASK ONE QUESTION AT A TIME: Ask only ONE question per response. Do NOT return multiple questions.
2. ASK FEW QUESTIONS TOTAL: Plan to ask only 3-5 questions total throughout the conversation.
3. BE CONCISE: Questions must be short (under 20 words).
4. GENERATE OPTIONS: You MUST provide a list of 4-6 predefined short options (answers) in Chinese.
   - If inquiring about specific pain/location, use Single Choice (allowMultiple: false).
   - If inquiring about associated symptoms (e.g., "Do you also have...?"), use Multiple Choice (allowMultiple: true).
   - Always include "其他" (Other) or "无" (None).

OUTPUT FORMAT (JSON):
{
  "question": "你的一个问题",
  "options": ["选项1", "选项2", "选项3", "选项4"],
  "allowMultiple": false
}

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
    console.log('✅ Received response');

    // 解析响应
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('No text in response');
    }

    // 记录完整的原始响应（用于调试）
    console.log('📄 Raw response text (length:', text.length, ')');
    console.log('First 500 chars:', text.substring(0, 500));
    if (text.length > 500) {
      console.log('Last 200 chars:', text.substring(text.length - 200));
    }

    // 清理和解析 JSON
    let parsed;
    try {
      // 尝试清理 JSON 字符串
      let cleanedText = text.trim();
      
      // 如果文本被 markdown 代码块包裹，移除它们
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // 不要替换换行符，因为 JSON 字符串值内部可能包含换行符
      // 只移除真正的控制字符（保留 \n, \r, \t）
      cleanedText = cleanedText
        .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        .trim();
      
      // 确保字符串完整闭合
      const openBraces = (cleanedText.match(/{/g) || []).length;
      const closeBraces = (cleanedText.match(/}/g) || []).length;
      const openBrackets = (cleanedText.match(/\[/g) || []).length;
      const closeBrackets = (cleanedText.match(/\]/g) || []).length;
      
      if (openBraces > closeBraces) {
        console.log('🔧 Adding missing closing braces:', openBraces - closeBraces);
        cleanedText += '}'.repeat(openBraces - closeBraces);
      }
      if (openBrackets > closeBrackets) {
        console.log('🔧 Adding missing closing brackets:', openBrackets - closeBrackets);
        cleanedText += ']'.repeat(openBrackets - closeBrackets);
      }
      
      console.log('🧹 Cleaned text (first 500):', cleanedText.substring(0, 500));
      
      parsed = JSON.parse(cleanedText);
      console.log('📊 Parsed response structure:', Object.keys(parsed));
      console.log('📊 Full parsed:', JSON.stringify(parsed, null, 2).substring(0, 1000));
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError);
      console.error('Failed text (first 800 chars):', text.substring(0, 800));
      console.error('Failed text (last 200 chars):', text.substring(text.length - 200));
      throw new Error(`Invalid JSON response from AI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
    
    // 处理不同的响应格式
    let questionText = '';
    let options: string[] = [];
    let allowMultiple = false;
    
    // 检查是否是 questions 数组格式（返回了多个问题）
    if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      console.warn('⚠️ Received questions array format, using first question');
      const firstQuestion = parsed.questions[0];
      questionText = firstQuestion.question || '请描述您的症状';
      options = firstQuestion.options || [];
      allowMultiple = firstQuestion.type === 'Multiple Choice';
      console.log(`📝 Extracted first question from ${parsed.questions.length} questions`);
    }
    // 检查是否是错误的 dialogue 格式
    else if (parsed.dialogue && Array.isArray(parsed.dialogue)) {
      console.warn('⚠️ Received dialogue format instead of expected format');
      // 尝试从 dialogue 中提取问题
      const aiMessage = parsed.dialogue.find((d: any) => d.speaker === 'AI' || d.role === 'assistant');
      questionText = aiMessage?.text || '请描述您的症状';
      // 使用默认选项
      options = ['继续', '重新开始'];
      allowMultiple = false;
    } 
    // 正确的单个问题格式
    else if (parsed.question) {
      questionText = parsed.question;
      options = parsed.options || [];
      
      // 处理 options：如果是对象数组，提取文本字段
      if (options.length > 0 && typeof options[0] === 'object') {
        options = options.map((opt: any) => opt.text || opt.value || String(opt));
      }
      
      allowMultiple = parsed.allowMultiple || parsed.question_type === 'multiple_choice' || false;
    } 
    // 未知格式
    else {
      console.error('❌ Unknown response format:', Object.keys(parsed));
      console.error('Full parsed object:', JSON.stringify(parsed, null, 2));
      throw new Error('Unexpected response format from AI');
    }
    
    console.log('✅ Final response:', { questionText, optionsCount: options.length, allowMultiple });
    
    return NextResponse.json({
      text: questionText,
      options: options,
      allowMultiple: allowMultiple
    });

  } catch (error) {
    console.error("❌ Error in chat:", error);
    
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
