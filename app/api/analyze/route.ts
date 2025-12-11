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

    // Initialize Gemini Client (在服务器端)
    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-2.5-flash";

    // Construct a prompt context from history
    const conversationText = history.map((m: Message) => `${m.role}: ${m.text}`).join('\n');
    const prompt = `
      Based on the following patient interview transcript, generate a differential diagnosis and map symptoms to conditions.
      Output ONLY valid JSON matching the schema.
      IMPORTANT: All text fields (name, description, recommendedAction, symptom, condition) MUST be in Simplified Chinese (简体中文).
      The 'urgency' field must remain one of the English enum values: "Low", "Medium", "High", "Critical".
      
      TRANSCRIPT:
      ${conversationText}
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
        temperature: 0.2,
      }
    });

    const jsonText = response.text;
    if (!jsonText) {
      return NextResponse.json(
        { error: 'No analysis result' },
        { status: 500 }
      );
    }

    const result = JSON.parse(jsonText);
    return NextResponse.json(result);

  } catch (error) {
    console.error("Error generating medical analysis:", error);
    return NextResponse.json(
      { error: "分析失败，请重试。" },
      { status: 500 }
    );
  }
}
