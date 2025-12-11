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
          maxOutputTokens: 8192,  // 增加 token 限制避免截断
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
      
      // 特殊处理 429 错误
      if (response.status === 429) {
        return NextResponse.json(
          { 
            error: 'API 请求过于频繁，请稍后再试',
            hint: 'Rate limit exceeded. Please wait a moment and try again.'
          },
          { status: 429 }
        );
      }
      
      throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();
    console.log('📦 Response data structure:', {
      hasCandidates: !!data.candidates,
      candidatesLength: data.candidates?.length,
      hasContent: !!data.candidates?.[0]?.content,
      hasParts: !!data.candidates?.[0]?.content?.parts
    });
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      console.error('❌ Empty response from API:', JSON.stringify(data, null, 2).substring(0, 500));
      
      // 返回基本的分析结果
      return NextResponse.json({
        diagnoses: [{
          name: "数据不足",
          probability: 30,
          description: "症状信息收集不完整，建议继续问诊或咨询医生",
          urgency: "Medium",
          recommendedAction: "建议咨询专业医生进行详细评估"
        }],
        symptomConnections: []
      });
    }

    console.log('📄 Raw analysis response (length:', text.length, ')');
    console.log('First 500 chars:', text.substring(0, 500));

    // 智能清理和解析 JSON
    let result;
    try {
      let cleanedText = text.trim();
      
      // 移除 markdown 代码块
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // 移除控制字符
      cleanedText = cleanedText
        .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        .trim();
      
      // 检查并修复不完整的 JSON
      const openBraces = (cleanedText.match(/{/g) || []).length;
      const closeBraces = (cleanedText.match(/}/g) || []).length;
      const openBrackets = (cleanedText.match(/\[/g) || []).length;
      const closeBrackets = (cleanedText.match(/\]/g) || []).length;
      
      // 修复未终止的字符串
      if (!cleanedText.endsWith('"') && !cleanedText.endsWith(']') && 
          !cleanedText.endsWith('}') && !cleanedText.endsWith(',')) {
        console.log('🔧 Fixing unterminated string in analysis');
        cleanedText += '"';
      }
      
      if (openBrackets > closeBrackets) {
        console.log('🔧 Adding missing brackets:', openBrackets - closeBrackets);
        cleanedText += ']'.repeat(openBrackets - closeBrackets);
      }
      
      if (openBraces > closeBraces) {
        console.log('🔧 Adding missing braces:', openBraces - closeBraces);
        cleanedText += '}'.repeat(openBraces - closeBraces);
      }
      
      result = JSON.parse(cleanedText);
      console.log('✅ Analysis parsed successfully');
      
    } catch (parseError) {
      console.error('❌ Analysis JSON parse error:', parseError);
      console.error('Failed text:', text.substring(0, 800));
      
      // 紧急回退：返回基本结构
      console.log('🚑 Using emergency fallback for analysis');
      result = {
        diagnoses: [{
          name: "需要进一步检查",
          probability: 50,
          description: "症状信息不足，建议咨询医生",
          urgency: "Medium",
          recommendedAction: "请咨询医生进行专业评估"
        }],
        symptomConnections: []
      };
    }
    
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
