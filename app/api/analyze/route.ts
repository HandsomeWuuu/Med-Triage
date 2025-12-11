import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Message } from '@/types';

// Schema for the structured analysis output
const ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    diagnoses: {
      type: Type.ARRAY,
      description: "List of top 3-5 potential differential diagnoses.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the medical condition in Chinese." },
          probability: { type: Type.INTEGER, description: "Estimated probability percentage (0-100)." },
          description: { type: Type.STRING, description: "Brief explanation of why this fits in Chinese." },
          urgency: { 
            type: Type.STRING, 
            enum: ["Low", "Medium", "High", "Critical"],
            description: "Triage urgency level (Keep these enum values in English for code logic)."
          },
          recommendedAction: { type: Type.STRING, description: "Next step (e.g., 'Go to ER') in Chinese." }
        },
        required: ["name", "probability", "description", "urgency", "recommendedAction"]
      }
    },
    symptomConnections: {
      type: Type.ARRAY,
      description: "Relationships between identified symptoms and the suspected conditions for a Sankey diagram.",
      items: {
        type: Type.OBJECT,
        properties: {
          symptom: { type: Type.STRING, description: "The specific symptom reported in Chinese." },
          condition: { type: Type.STRING, description: "The condition it points to in Chinese." },
          strength: { type: Type.INTEGER, description: "Strength of the correlation (1-10)." }
        },
        required: ["symptom", "condition", "strength"]
      }
    }
  },
  required: ["diagnoses", "symptomConnections"]
};

export async function POST(request: NextRequest) {
  try {
    const { history } = await request.json();

    // 验证 API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key not configured' },
        { status: 500 }
      );
    }

    // 使用直接 HTTP 请求（兼容第三方 API）
    const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
    
    console.log('🔧 Analyze API using direct HTTP');

    // 构建提示词
    const conversationText = history.map((m: Message) => `${m.role}: ${m.text}`).join('\n');
    const prompt = `
Based on the following patient interview transcript, generate a differential diagnosis and map symptoms to conditions.
Output ONLY valid JSON with this structure:
{
  "diagnoses": [{"name": "疾病名(中文)", "probability": 0-100, "description": "理由(中文)", "urgency": "Low|Medium|High|Critical", "recommendedAction": "建议(中文)"}],
  "symptomConnections": [{"symptom": "症状(中文)", "condition": "疾病(中文)", "strength": 1-10}]
}

TRANSCRIPT:
${conversationText}
`;

    // 直接 HTTP 请求
    const apiUrl = `${baseUrl}/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('No analysis result');
    }

    const result = JSON.parse(text);
    console.log('✅ Analysis complete');
    return NextResponse.json(result);

  } catch (error) {
    console.error("❌ Error in analyze:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `分析失败：${errorMessage}` },
      { status: 500 }
    );
  }
}
