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
  try {
    const { history, message } = await request.json();

    // 验证 API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key not configured' },
        { status: 500 }
      );
    }

    // Initialize Gemini Client (在服务器端)
    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-2.5-flash";
    
    // Convert generic Message type to Gemini content format
    const contents = history.map((msg: Message) => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));
    
    // Add the new user message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model,
      config: {
        systemInstruction: CHAT_SYSTEM_INSTRUCTION,
        temperature: 0.5,
        responseMimeType: "application/json",
        responseSchema: CHAT_RESPONSE_SCHEMA
      },
      contents: contents
    });

    const jsonText = response.text;
    if (jsonText) {
      const parsed = JSON.parse(jsonText);
      return NextResponse.json({
        text: parsed.question,
        options: parsed.options || [],
        allowMultiple: parsed.allowMultiple || false
      });
    }

    return NextResponse.json({
      text: "抱歉，系统暂时无法处理，请重试。",
      options: [],
      allowMultiple: false
    });

  } catch (error) {
    console.error("Error in triage chat:", error);
    return NextResponse.json(
      { error: "系统错误：无法连接到分诊服务。" },
      { status: 500 }
    );
  }
}
